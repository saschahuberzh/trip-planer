"use client";

import { useMemo, useState, type FormEvent } from "react";
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, type Booking, type Expense } from "@/lib/domain/types";
import {
  applyExpenseLink,
  emptyExpenseFormValues,
  expenseToFormValues,
  formatRate,
  previewConversion,
  suggestedRate,
  validateExpenseForm,
  type ExpenseFormErrors,
  type ExpenseFormValues,
} from "@/lib/services/expenseForm";
import { getExpenseService } from "@/lib/services/expenseService";
import type { Itinerary } from "@/lib/services/itineraryService";
import { Button } from "@/components/ui/Button";
import { ConfirmBody } from "@/components/ui/ConfirmBody";
import { TrashIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { CurrencySelect, Field, inputClass } from "@/components/trips/formFields";
import { formatMoney } from "@/components/trips/tripDisplay";
import { linkKey } from "@/components/bookings/bookingDisplay";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_SYMBOLS, EXPENSE_STATUS_LABELS, expenseLinkOptions } from "./budgetDisplay";

export type ExpenseSheetTarget = { mode: "create"; date: string } | { mode: "edit"; expense: Expense };

type ExpenseSheetProps = {
  itinerary: Itinerary;
  expenses: readonly Expense[];
  bookings: readonly Booking[];
  target: ExpenseSheetTarget | null;
  onClose: () => void;
};

export function ExpenseSheet({ target, onClose, ...props }: ExpenseSheetProps) {
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const close = () => {
    setDeleting(false);
    onClose();
  };
  const title = deleting ? "Delete expense?" : target?.mode === "edit" ? "Edit expense" : "New expense";
  return (
    <Sheet open={target !== null} onClose={close} title={title} dismissible={!busy}>
      {target !== null &&
        (deleting && target.mode === "edit" ? (
          <DeleteExpense expense={target.expense} onBusyChange={setBusy} onCancel={() => setDeleting(false)} onDeleted={close} />
        ) : (
          <ExpenseForm {...props} target={target} onBusyChange={setBusy} onDone={close} onDelete={() => setDeleting(true)} />
        ))}
    </Sheet>
  );
}

type ExpenseFormProps = Omit<ExpenseSheetProps, "target" | "onClose"> & {
  target: ExpenseSheetTarget;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
  onDelete: () => void;
};

/** Currency of the most recently added expense, else the base currency. */
function lastCurrency(expenses: readonly Expense[], baseCurrency: string): string {
  let latest: Expense | undefined;
  for (const expense of expenses) if (latest === undefined || expense.createdAt > latest.createdAt) latest = expense;
  return latest?.originalCurrency ?? baseCurrency;
}

function ExpenseForm({ itinerary, expenses, bookings, target, onBusyChange, onDone, onDelete }: ExpenseFormProps) {
  const { trip } = itinerary;
  const base = trip.baseCurrency;
  const options = useMemo(() => expenseLinkOptions(itinerary, bookings), [itinerary, bookings]);
  const [values, setValues] = useState<ExpenseFormValues>(() =>
    target.mode === "edit" ? expenseToFormValues(target.expense) : emptyExpenseFormValues(lastCurrency(expenses, base), target.date),
  );
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (key in current ? { ...current, [key]: undefined } : current));
  };

  const foreign = values.currency !== base;
  const converted = previewConversion(values, base);
  const lastRate = foreign ? suggestedRate(expenses, values.currency) : undefined;
  const currentKey = values.link ? linkKey(values.link.type, values.link.id) : "";
  const linkMissing = values.link !== undefined && !options.some((option) => option.key === currentKey);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    // A linked entry deleted meanwhile is dropped instead of blocking the save.
    const result = validateExpenseForm(linkMissing ? { ...values, link: undefined } : values, base);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    onBusyChange(true);
    try {
      const service = getExpenseService();
      if (target.mode === "create") await service.createExpense(trip.id, result.input);
      else await service.updateExpense(target.expense.id, result.input);
      onDone();
    } catch (error) {
      console.error("Failed to save expense", error);
      setSaveError("The expense couldn't be saved. Your existing data has not been changed.");
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  const groups = [
    { label: "Transport", type: "transport" },
    { label: "Accommodation", type: "accommodation" },
    { label: "Activities", type: "activity" },
    { label: "Bookings", type: "booking" },
  ] as const;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <Field label="Amount" error={errors.amount}>
          {(props) => (
            <input
              {...props}
              value={values.amount}
              onChange={(event) => set("amount", event.target.value)}
              inputMode="decimal"
              placeholder="e.g. 85000"
              autoComplete="off"
              className={`${inputClass} text-lg font-semibold`}
            />
          )}
        </Field>
        <Field label="Currency" error={errors.currency}>
          {(props) => <CurrencySelect {...props} value={values.currency} onChange={(currency) => set("currency", currency)} />}
        </Field>
      </div>

      {foreign && (
        <fieldset className="space-y-2 rounded-2xl p-3 ring-1 ring-slate-200">
          <legend className="px-1 text-sm font-medium text-slate-700">Conversion to {base} (optional)</legend>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Enter conversion as">
            {(["rate", "amount"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={values.conversion === mode}
                onClick={() => set("conversion", mode)}
                className={`min-h-9 rounded-lg text-sm font-medium ${values.conversion === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
              >
                {mode === "rate" ? "Exchange rate" : `Amount in ${base}`}
              </button>
            ))}
          </div>
          {values.conversion === "rate" ? (
            <Field label={`1 ${values.currency} = … ${base}`} error={errors.rate}>
              {(props) => (
                <input
                  {...props}
                  value={values.rate}
                  onChange={(event) => set("rate", event.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 0.000065"
                  autoComplete="off"
                  className={inputClass}
                />
              )}
            </Field>
          ) : (
            <Field label={`Amount in ${base}`} error={errors.baseAmount} hint="e.g. from your card statement">
              {(props) => (
                <input
                  {...props}
                  value={values.baseAmount}
                  onChange={(event) => set("baseAmount", event.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  className={inputClass}
                />
              )}
            </Field>
          )}
          {lastRate !== undefined && values.conversion === "rate" && values.rate !== formatRate(lastRate) && (
            <button
              type="button"
              onClick={() => set("rate", formatRate(lastRate))}
              className="min-h-9 text-sm font-semibold text-teal-700"
            >
              Use last rate: 1 {values.currency} = {formatRate(lastRate)} {base}
            </button>
          )}
          <p className="text-sm text-slate-600" aria-live="polite">
            {converted !== undefined ? (
              <>
                = <strong className="text-slate-900">{formatMoney(converted, base)}</strong>
              </>
            ) : (
              "Not converted yet — it is listed and counted per currency until you add a rate."
            )}
          </p>
        </fieldset>
      )}

      <Field label="Title" error={errors.title}>
        {(props) => (
          <input
            {...props}
            value={values.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder="e.g. Dinner at Caravan"
            autoComplete="off"
            className={inputClass}
          />
        )}
      </Field>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-slate-700">Category</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {EXPENSE_CATEGORIES.map((category) => (
            <label
              key={category}
              className="flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-50 px-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 has-checked:bg-teal-50 has-checked:text-teal-900 has-checked:ring-2 has-checked:ring-teal-600"
            >
              <input
                type="radio"
                name="expense-category"
                value={category}
                checked={values.category === category}
                onChange={() => set("category", category)}
                className="sr-only"
              />
              <span aria-hidden="true">{EXPENSE_CATEGORY_SYMBOLS[category]}</span>
              <span className="truncate">{EXPENSE_CATEGORY_LABELS[category]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium text-slate-700">Status</legend>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {EXPENSE_STATUSES.map((status) => (
              <label
                key={status}
                className="flex min-h-9 cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-slate-600 has-checked:bg-white has-checked:text-slate-900 has-checked:shadow-sm"
              >
                <input
                  type="radio"
                  name="expense-status"
                  value={status}
                  checked={values.status === status}
                  onChange={() => set("status", status)}
                  className="sr-only"
                />
                {EXPENSE_STATUS_LABELS[status]}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Date (optional)" error={errors.date}>
          {(props) => (
            <input {...props} type="date" value={values.date} onChange={(event) => set("date", event.target.value)} className={inputClass} />
          )}
        </Field>
      </div>

      <Field label="For (optional)" hint="Linking fills in empty fields from the entry.">
        {(props) => (
          <select
            {...props}
            value={linkMissing ? "" : currentKey}
            onChange={(event) => {
              const option = options.find((candidate) => candidate.key === event.target.value);
              setValues((current) =>
                applyExpenseLink(current, option ? { type: option.type, id: option.id } : undefined, option?.prefill),
              );
              setErrors({});
            }}
            className={inputClass}
          >
            <option value="">Nothing linked</option>
            {groups.map((group) => {
              const items = options.filter((option) => option.type === group.type);
              return items.length === 0 ? null : (
                <optgroup key={group.type} label={group.label}>
                  {items.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        )}
      </Field>

      <Field label="Notes (optional)">
        {(props) => (
          <textarea {...props} value={values.notes} onChange={(event) => set("notes", event.target.value)} rows={2} className={inputClass} />
        )}
      </Field>

      {saveError && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {saveError}
        </p>
      )}

      <div className="space-y-3 pb-[env(safe-area-inset-bottom)]">
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onDone} disabled={saving} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="flex-[2]">
            {saving ? "Saving…" : target.mode === "create" ? "Add expense" : "Save changes"}
          </Button>
        </div>
        {target.mode === "edit" && (
          <Button variant="ghost" onClick={onDelete} disabled={saving} className="w-full text-red-600">
            <TrashIcon />
            Delete expense
          </Button>
        )}
      </div>
    </form>
  );
}

function DeleteExpense({
  expense,
  onBusyChange,
  onCancel,
  onDeleted,
}: {
  expense: Expense;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      await getExpenseService().deleteExpense(expense.id);
      onDeleted();
    } catch (caught) {
      console.error("Failed to delete expense", caught);
      setError("The expense couldn't be deleted. Nothing was removed.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <ConfirmBody
      error={error}
      busy={busy}
      cancelLabel="Keep"
      confirmLabel={busy ? "Deleting…" : "Delete"}
      danger
      onCancel={onCancel}
      onConfirm={() => void confirm()}
    >
      <strong className="text-slate-900">{expense.title}</strong> ({formatMoney(expense.originalAmount, expense.originalCurrency)})
      will be permanently deleted from this device. This can&apos;t be undone.
    </ConfirmBody>
  );
}
