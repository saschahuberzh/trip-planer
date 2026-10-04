"use client";

import { useState, type ReactNode } from "react";
import { calendarDaysInclusive, deviceToday } from "@/lib/domain/dateTime";
import type { Booking, Expense, Trip } from "@/lib/domain/types";
import { useItinerary } from "@/lib/hooks/useItinerary";
import { useLiveData } from "@/lib/hooks/useLiveData";
import { budgetOverview, isConverted, type BudgetOverview, type ExpenseTotals } from "@/lib/services/budget";
import { getBookingService } from "@/lib/services/bookingService";
import { getExpenseService } from "@/lib/services/expenseService";
import type { Itinerary } from "@/lib/services/itineraryService";
import { isOutsideTripDates } from "@/lib/services/tripDays";
import { Button } from "@/components/ui/Button";
import { AlertIcon, PlusIcon } from "@/components/ui/icons";
import { formatDayDate } from "@/components/itinerary/itineraryDisplay";
import { formatMoney } from "@/components/trips/tripDisplay";
import { TripFormSheet } from "@/components/trips/TripFormSheet";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_SYMBOLS, formatUnconverted } from "./budgetDisplay";
import { ExpenseSheet, type ExpenseSheetTarget } from "./ExpenseSheet";
import { LoadError, ScreenSkeleton, TripNotFound } from "@/components/ui/ScreenState";

type Filter = "all" | "paid" | "planned" | "unconverted";
const FILTER_LABELS: Record<Filter, string> = { all: "All", paid: "Paid", planned: "Planned", unconverted: "Not converted" };

/** Budget: overview in the base currency, expenses, costs by category and per day. */
export function BudgetScreen() {
  const itinerary = useItinerary();
  if (itinerary.status === "loading") return <ScreenSkeleton />;
  if (itinerary.status === "error") return <LoadError what="The budget" />;
  if (itinerary.data === undefined) return <TripNotFound />;
  return <BudgetData itinerary={itinerary.data} />;
}

function BudgetData({ itinerary }: { itinerary: Itinerary }) {
  const tripId = itinerary.trip.id;
  const data = useLiveData(
    async () => {
      const [expenses, bookings] = await Promise.all([getExpenseService().listExpenses(tripId), getBookingService().listBookings(tripId)]);
      return { expenses, bookings };
    },
    [tripId],
  );
  if (data.status === "loading") return <ScreenSkeleton />;
  if (data.status === "error") return <LoadError what="The budget" />;
  return <BudgetContent itinerary={itinerary} expenses={data.data.expenses} bookings={data.data.bookings} />;
}

/** "Day 2 · Sat 13 Jun" within the trip dates, else the date. */
function dayLabel(trip: Trip, date: string | undefined): string {
  if (date === undefined) return "Undated";
  if (isOutsideTripDates(date, trip)) return formatDayDate(date);
  return `Day ${calendarDaysInclusive(trip.startDate, date)} · ${formatDayDate(date)}`;
}

function BudgetContent({ itinerary, expenses, bookings }: { itinerary: Itinerary; expenses: Expense[]; bookings: Booking[] }) {
  const { trip } = itinerary;
  const [target, setTarget] = useState<ExpenseSheetTarget | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const overview = budgetOverview(trip, expenses);
  const today = deviceToday();
  const newExpense = () => setTarget({ mode: "create", date: isOutsideTripDates(today, trip) ? "" : today });

  const visible = expenses.filter((expense) =>
    filter === "all" ? true : filter === "unconverted" ? !isConverted(expense) : expense.status === filter,
  );

  // Phones: overview, expenses, categories, days. Large screens: summary column on the left,
  // expenses on the right. Column wrappers are display: contents on phones.
  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-5 lg:grid lg:max-w-6xl lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:px-8 lg:py-8">
      <div className="contents lg:flex lg:flex-col lg:gap-4">
        <div className="order-1 lg:order-none">
          <Overview trip={trip} overview={overview} onShowUnconverted={() => setFilter("unconverted")} />
        </div>
        <div className="order-3 empty:hidden lg:order-none">
          {overview.byCategory.length > 0 && (
            <Breakdown title="By category">
              {overview.byCategory.map((row) => (
                <BreakdownRow
                  key={row.category}
                  label={`${EXPENSE_CATEGORY_SYMBOLS[row.category]} ${EXPENSE_CATEGORY_LABELS[row.category]}`}
                  totals={row.total}
                  planned={row.planned}
                  base={trip.baseCurrency}
                  max={Math.max(...overview.byCategory.map((item) => item.total.converted))}
                />
              ))}
            </Breakdown>
          )}
        </div>
        <div className="order-4 empty:hidden lg:order-none">
          {overview.byDay.length > 0 && (
            <Breakdown title="Per day">
              {overview.byDay.map((row) => (
                <BreakdownRow
                  key={row.date ?? "undated"}
                  label={dayLabel(trip, row.date)}
                  totals={row.total}
                  planned={row.planned}
                  base={trip.baseCurrency}
                  max={Math.max(...overview.byDay.map((item) => item.total.converted))}
                />
              ))}
            </Breakdown>
          )}
        </div>
      </div>
      <div className="contents lg:block">
        <div className="order-2 lg:order-none">
          <section aria-labelledby="expenses-heading" className="space-y-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 id="expenses-heading" className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
                Expenses
              </h2>
              <Button onClick={newExpense} className="shrink-0">
                <PlusIcon />
                Add expense
              </Button>
            </div>
            {expenses.length > 0 && (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Filter expenses">
                {(Object.keys(FILTER_LABELS) as Filter[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={filter === key}
                    onClick={() => setFilter(key)}
                    className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm font-medium ${
                      filter === key ? "bg-teal-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
                    }`}
                  >
                    {FILTER_LABELS[key]}
                  </button>
                ))}
              </div>
            )}
            {expenses.length === 0 ? (
              <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
                <p className="text-3xl" aria-hidden="true">
                  💰
                </p>
                <h3 className="mt-2 text-lg font-semibold">No expenses yet</h3>
                <p className="mt-1 text-slate-600">
                  Record costs in any currency — paid or planned. Add the exchange rate now or later.
                </p>
              </div>
            ) : visible.length === 0 ? (
              <p className="rounded-3xl bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">No expenses match this filter.</p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                {visible.map((expense) => (
                  <li key={expense.id}>
                    <ExpenseRow trip={trip} expense={expense} onOpen={() => setTarget({ mode: "edit", expense })} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <ExpenseSheet itinerary={itinerary} expenses={expenses} bookings={bookings} target={target} onClose={() => setTarget(null)} />
    </section>
  );
}

function Overview({ trip, overview, onShowUnconverted }: { trip: Trip; overview: BudgetOverview; onShowUnconverted: () => void }) {
  const [editingTrip, setEditingTrip] = useState(false);
  const base = trip.baseCurrency;
  const { paid, planned, total } = overview.totals;
  const remaining = overview.remaining;
  const used = overview.budgetAmount ? Math.min(1, paid.converted / overview.budgetAmount) : 0;
  return (
    <div className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-slate-500">Budget</span>
        {overview.budgetAmount !== undefined ? (
          <span className="text-lg font-semibold text-slate-900">{formatMoney(overview.budgetAmount, base)}</span>
        ) : (
          <button type="button" onClick={() => setEditingTrip(true)} className="min-h-11 text-sm font-semibold text-teal-700">
            Set a budget
          </button>
        )}
      </div>

      {remaining !== undefined && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div className={`h-full rounded-full ${remaining.amount < 0 ? "bg-red-500" : "bg-teal-600"}`} style={{ width: `${used * 100}%` }} />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-slate-500">Remaining</span>
            {remaining.complete ? (
              <span className={`text-2xl font-bold ${remaining.amount < 0 ? "text-red-600" : "text-slate-900"}`}>
                {formatMoney(remaining.amount, base)}
              </span>
            ) : (
              <span className="text-right">
                <span className="block font-semibold text-amber-800">Incomplete</span>
                <span className="block text-xs text-slate-500">provisional {formatMoney(remaining.amount, base)}</span>
              </span>
            )}
          </div>
          {!remaining.complete && (
            <p className="mt-1 text-xs text-amber-800">
              {paid.unconvertedCount === 1 ? "1 paid expense is" : `${paid.unconvertedCount} paid expenses are`} not converted to {base}.
            </p>
          )}
        </div>
      )}

      <dl className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
        <Figure label="Spent" totals={paid} base={base} />
        <Figure label="Planned" totals={planned} base={base} />
        <Figure label="Projected" totals={total} base={base} />
      </dl>

      {total.unconverted.length > 0 && (
        <button
          type="button"
          onClick={onShowUnconverted}
          className="flex w-full items-start gap-2 rounded-xl bg-amber-50 p-3 text-left text-sm text-amber-950 ring-1 ring-amber-200"
        >
          <AlertIcon className="size-5 shrink-0 text-amber-600" />
          <span>
            <span className="block font-semibold">Not converted: {formatUnconverted(total.unconverted)}</span>
            <span className="block">
              {total.unconvertedCount === 1 ? "1 expense is" : `${total.unconvertedCount} expenses are`} not included in {base} totals.
              Tap to show {total.unconvertedCount === 1 ? "it" : "them"} and add a rate.
            </span>
          </span>
        </button>
      )}
      <TripFormSheet open={editingTrip} onClose={() => setEditingTrip(false)} trip={trip} />
    </div>
  );
}

function Figure({ label, totals, base }: { label: string; totals: ExpenseTotals; base: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">
        {formatMoney(totals.converted, base)}
        {!totals.complete && (
          <span className="block text-[11px] font-medium text-amber-800" title={`${totals.unconvertedCount} not converted`}>
            incomplete
          </span>
        )}
      </dd>
    </div>
  );
}

function ExpenseRow({ trip, expense, onOpen }: { trip: Trip; expense: Expense; onOpen: () => void }) {
  const base = trip.baseCurrency;
  return (
    <button type="button" onClick={onOpen} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
      <span aria-hidden="true" className="text-xl">
        {EXPENSE_CATEGORY_SYMBOLS[expense.category]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium text-slate-900">{expense.title}</span>
          {expense.status === "planned" && (
            <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800">Planned</span>
          )}
        </span>
        <span className="block truncate text-xs text-slate-500">{dayLabel(trip, expense.date)}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-semibold text-slate-900">{formatMoney(expense.originalAmount, expense.originalCurrency)}</span>
        {expense.originalCurrency !== base &&
          (isConverted(expense) ? (
            <span className="block text-xs text-slate-500">≈ {formatMoney(expense.amountInBaseCurrency, base)}</span>
          ) : (
            <span className="block text-xs font-medium text-amber-700">not converted</span>
          ))}
      </span>
    </button>
  );
}

function Breakdown({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="px-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      <ul className="divide-y divide-slate-100 rounded-3xl bg-white px-4 shadow-sm ring-1 ring-slate-200">{children}</ul>
    </section>
  );
}

function BreakdownRow({
  label,
  totals,
  planned,
  base,
  max,
}: {
  label: string;
  totals: ExpenseTotals;
  planned: ExpenseTotals;
  base: string;
  max: number;
}) {
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium text-slate-800">{label}</span>
        <span className="shrink-0 text-sm font-semibold text-slate-900">
          {formatMoney(totals.converted, base)}
          {!totals.complete && <span className="text-xs font-medium text-amber-800"> · incomplete</span>}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className="h-full rounded-full bg-teal-600" style={{ width: max > 0 ? `${(totals.converted / max) * 100}%` : "0%" }} />
      </div>
      {(planned.count > 0 || totals.unconverted.length > 0) && (
        <p className="mt-1 text-xs text-slate-500">
          {[
            planned.count > 0 ? `incl. ${formatMoney(planned.converted, base)} planned` : undefined,
            totals.unconverted.length > 0 ? `+ ${formatUnconverted(totals.unconverted)} not converted` : undefined,
          ]
            .filter((part) => part !== undefined)
            .join(" · ")}
        </p>
      )}
    </li>
  );
}
