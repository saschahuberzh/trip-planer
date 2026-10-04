/**
 * Create/edit expense form: values, validation and conversion to ExpenseInput.
 * The conversion can be entered as an exchange rate ("1 UZS = 0.000065 CHF") or as the
 * amount in the base currency (e.g. from a card statement); either way a rate is stored.
 */
import { isCurrencyCode, roundToCurrency } from "@/lib/domain/currency";
import { isCalendarDate } from "@/lib/domain/dateTime";
import type { Expense, ExpenseCategory, ExpenseLinkType, ExpenseStatus } from "@/lib/domain/types";
import type { ExpenseInput } from "./expenseService";
import { optionalText } from "./itineraryForms";
import { parseAmount } from "./tripForm";

const MAX_EXPENSE_TITLE_LENGTH = 120;

export interface ExpenseFormValues {
  title: string;
  category: ExpenseCategory;
  status: ExpenseStatus;
  /** YYYY-MM-DD or empty (undated). */
  date: string;
  amount: string;
  currency: string;
  /** "1 [currency] = rate [base]"; used when `conversion` is "rate". */
  rate: string;
  /** Amount in the base currency; used when `conversion` is "amount". */
  baseAmount: string;
  conversion: "rate" | "amount";
  notes: string;
  link: { type: ExpenseLinkType; id: string } | undefined;
}

type ErrorKey = "title" | "date" | "amount" | "currency" | "rate" | "baseAmount";
export type ExpenseFormErrors = Partial<Record<ErrorKey, string>>;
export type ExpenseFormResult = { ok: true; input: ExpenseInput } | { ok: false; errors: ExpenseFormErrors };

export function emptyExpenseFormValues(currency: string, date: string): ExpenseFormValues {
  return {
    title: "",
    category: "food",
    status: "paid",
    date,
    amount: "",
    currency,
    rate: "",
    baseAmount: "",
    conversion: "rate",
    notes: "",
    link: undefined,
  };
}

/**
 * Plain decimal text with ~10 significant digits and no exponent:
 * 0.000065 → "0.000065", 2e-7 → "0.0000002", 0.1234567891234 → "0.1234567891".
 */
export function formatRate(rate: number): string {
  const decimals = Math.min(20, Math.max(0, 9 - Math.floor(Math.log10(rate))));
  return rate.toFixed(decimals).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function expenseToFormValues(expense: Expense): ExpenseFormValues {
  return {
    title: expense.title,
    category: expense.category,
    status: expense.status,
    date: expense.date ?? "",
    amount: String(expense.originalAmount),
    currency: expense.originalCurrency,
    rate: expense.exchangeRateToBase === undefined ? "" : formatRate(expense.exchangeRateToBase),
    baseAmount: expense.amountInBaseCurrency === undefined ? "" : String(expense.amountInBaseCurrency),
    conversion: "rate",
    notes: expense.notes ?? "",
    link: expense.linkedEntity,
  };
}

/** Data of a linked entry used to fill empty fields. */
export interface ExpensePrefill {
  title: string;
  category: ExpenseCategory;
  date?: string;
  price?: { amount: number; currency: string };
}

/** Links the expense; empty title/amount/date are filled from the entry, the category always follows it. */
export function applyExpenseLink(
  values: ExpenseFormValues,
  link: { type: ExpenseLinkType; id: string } | undefined,
  prefill: ExpensePrefill | undefined,
): ExpenseFormValues {
  if (link === undefined || prefill === undefined) return { ...values, link: undefined };
  const next: ExpenseFormValues = { ...values, link, category: prefill.category };
  if (next.title.trim() === "") next.title = prefill.title;
  if (next.date === "" && prefill.date) next.date = prefill.date;
  if (next.amount.trim() === "" && prefill.price) {
    next.amount = String(prefill.price.amount);
    next.currency = prefill.price.currency;
  }
  return next;
}

/** The most recently used rate for `currency` in this trip, as a suggestion. */
export function suggestedRate(expenses: readonly Expense[], currency: string): number | undefined {
  let latest: Expense | undefined;
  for (const expense of expenses) {
    if (expense.originalCurrency !== currency || expense.exchangeRateToBase === undefined) continue;
    if (latest === undefined || expense.updatedAt > latest.updatedAt) latest = expense;
  }
  return latest?.exchangeRateToBase;
}

function positive(text: string): number | null {
  const parsed = parseAmount(text);
  return parsed !== null && parsed.value > 0 ? parsed.value : null;
}

export function validateExpenseForm(values: ExpenseFormValues, baseCurrency: string): ExpenseFormResult {
  const errors: ExpenseFormErrors = {};
  const title = optionalText(values.title);
  if (title === undefined) errors.title = "Give the expense a title.";
  else if (title.length > MAX_EXPENSE_TITLE_LENGTH) errors.title = `Use at most ${MAX_EXPENSE_TITLE_LENGTH} characters.`;
  if (values.date !== "" && !isCalendarDate(values.date)) errors.date = "Choose a valid date.";

  const amount = positive(values.amount);
  if (amount === null) errors.amount = "Enter an amount greater than 0.";
  if (!isCurrencyCode(values.currency)) errors.currency = "Choose a currency.";

  let rate: number | undefined;
  if (values.currency === baseCurrency) rate = 1;
  else if (values.conversion === "rate" && values.rate.trim() !== "") {
    const parsed = positive(values.rate);
    if (parsed === null) errors.rate = "Enter a rate greater than 0, e.g. 0.000065.";
    else rate = parsed;
  } else if (values.conversion === "amount" && values.baseAmount.trim() !== "") {
    const parsed = positive(values.baseAmount);
    if (parsed === null) errors.baseAmount = `Enter the amount in ${baseCurrency}.`;
    else if (amount !== null) rate = parsed / amount;
  }

  if (Object.keys(errors).length > 0 || title === undefined || amount === null) return { ok: false, errors };
  return {
    ok: true,
    input: {
      title,
      category: values.category,
      status: values.status,
      date: values.date === "" ? undefined : values.date,
      originalAmount: amount,
      originalCurrency: values.currency,
      exchangeRateToBase: rate,
      notes: optionalText(values.notes),
      linkedEntity: values.link,
    },
  };
}

/** Converted amount for display while editing (same rule as when saving). */
export function previewConversion(values: ExpenseFormValues, baseCurrency: string): number | undefined {
  const result = validateExpenseForm({ ...values, title: values.title || "x" }, baseCurrency);
  if (!result.ok || result.input.exchangeRateToBase === undefined) return undefined;
  return roundToCurrency(result.input.originalAmount * result.input.exchangeRateToBase, baseCurrency);
}
