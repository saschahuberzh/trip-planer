/**
 * Budget calculations (DATA_MODEL.md "Budget Calculations"). Only Expenses are counted.
 * Converted amounts are summed in the trip's base currency; unconverted amounts are summed
 * per original currency and never added to base-currency totals. A set is "complete" when
 * it contains no unconverted expense; derived base-currency totals are incomplete otherwise.
 */
import { roundToCurrency } from "@/lib/domain/currency";
import { compareCalendarDates } from "@/lib/domain/dateTime";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory, type Trip } from "@/lib/domain/types";

export interface CurrencyAmount {
  currency: string;
  amount: number;
}

export interface ExpenseTotals {
  /** Sum of `amountInBaseCurrency` of converted expenses, in the base currency. */
  converted: number;
  /** Sums of `originalAmount` of unconverted expenses, per currency (sorted by code). */
  unconverted: CurrencyAmount[];
  /** Number of unconverted expenses. */
  unconvertedCount: number;
  count: number;
  /** No unconverted expenses. */
  complete: boolean;
}

export function isConverted(expense: Expense): expense is Expense & { exchangeRateToBase: number; amountInBaseCurrency: number } {
  return expense.exchangeRateToBase !== undefined && expense.amountInBaseCurrency !== undefined;
}

/** Totals of a set of expenses. Sums are rounded to each currency's minor unit (float noise). */
export function totalsOf(expenses: readonly Expense[], baseCurrency: string): ExpenseTotals {
  let converted = 0;
  const unconverted = new Map<string, number>();
  let unconvertedCount = 0;
  for (const expense of expenses) {
    if (isConverted(expense)) converted += expense.amountInBaseCurrency;
    else {
      unconvertedCount++;
      unconverted.set(expense.originalCurrency, (unconverted.get(expense.originalCurrency) ?? 0) + expense.originalAmount);
    }
  }
  return {
    converted: roundToCurrency(converted, baseCurrency),
    unconverted: [...unconverted.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, amount]) => ({ currency, amount: roundToCurrency(amount, currency) })),
    unconvertedCount,
    count: expenses.length,
    complete: unconvertedCount === 0,
  };
}

export interface StatusTotals {
  paid: ExpenseTotals;
  planned: ExpenseTotals;
  /** Paid + planned. */
  total: ExpenseTotals;
}

function statusTotals(expenses: readonly Expense[], baseCurrency: string): StatusTotals {
  return {
    paid: totalsOf(expenses.filter((expense) => expense.status === "paid"), baseCurrency),
    planned: totalsOf(expenses.filter((expense) => expense.status === "planned"), baseCurrency),
    total: totalsOf(expenses, baseCurrency),
  };
}

export interface RemainingBudget {
  /** `budgetAmount − converted spent`; provisional while `complete` is false. */
  amount: number;
  /** False when any paid expense is unconverted: the value must not be shown as final. */
  complete: boolean;
}

export interface DayCosts extends StatusTotals {
  /** YYYY-MM-DD, or undefined for undated expenses. */
  date?: string;
}

export interface BudgetOverview {
  baseCurrency: string;
  budgetAmount?: number;
  /** Spent = paid, Planned = expected, Projected = both (StatusTotals.total). */
  totals: StatusTotals;
  /** Only when the trip has a budget amount. */
  remaining?: RemainingBudget;
  /** Every category with at least one expense, in the fixed category order. */
  byCategory: (StatusTotals & { category: ExpenseCategory })[];
  /** Dated days chronologically, then undated. */
  byDay: DayCosts[];
}

export function budgetOverview(trip: Pick<Trip, "baseCurrency" | "budgetAmount">, expenses: readonly Expense[]): BudgetOverview {
  const { baseCurrency, budgetAmount } = trip;
  const totals = statusTotals(expenses, baseCurrency);

  const byCategory = EXPENSE_CATEGORIES.flatMap((category) => {
    const inCategory = expenses.filter((expense) => expense.category === category);
    return inCategory.length === 0 ? [] : [{ category, ...statusTotals(inCategory, baseCurrency) }];
  });

  const dates = [...new Set(expenses.flatMap((expense) => (expense.date === undefined ? [] : [expense.date])))].sort(
    compareCalendarDates,
  );
  const byDay: DayCosts[] = dates.map((date) => ({
    date,
    ...statusTotals(expenses.filter((expense) => expense.date === date), baseCurrency),
  }));
  const undated = expenses.filter((expense) => expense.date === undefined);
  if (undated.length > 0) byDay.push(statusTotals(undated, baseCurrency));

  return {
    baseCurrency,
    budgetAmount,
    totals,
    remaining:
      budgetAmount === undefined
        ? undefined
        : { amount: roundToCurrency(budgetAmount - totals.paid.converted, baseCurrency), complete: totals.paid.complete },
    byCategory,
    byDay,
  };
}
