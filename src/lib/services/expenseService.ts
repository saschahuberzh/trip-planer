/**
 * Expense use cases. `amountInBaseCurrency` is calculated when an expense is saved
 * (rounded to the base currency) and then stored; it is recalculated only when that
 * expense's original amount, currency or rate changes (DATA_MODEL.md "Stability").
 */
import { roundToCurrency } from "@/lib/domain/currency";
import { compareCalendarDates } from "@/lib/domain/dateTime";
import type { Expense } from "@/lib/domain/types";
import { EntityNotFoundError, getRepositories, InvalidReferenceError, type NewEntity, type Repositories } from "@/lib/repositories";

/** Expense fields edited by the user; the base amount is derived from the rate. */
export type ExpenseInput = Omit<NewEntity<Expense>, "tripId" | "amountInBaseCurrency">;

/** Conversion fields for saving. Expenses in the base currency are always converted at rate 1. */
function conversionFor(
  input: Pick<ExpenseInput, "originalAmount" | "originalCurrency" | "exchangeRateToBase">,
  baseCurrency: string,
): Pick<Expense, "exchangeRateToBase" | "amountInBaseCurrency"> {
  if (input.originalCurrency === baseCurrency) return { exchangeRateToBase: 1, amountInBaseCurrency: input.originalAmount };
  if (input.exchangeRateToBase === undefined) return { exchangeRateToBase: undefined, amountInBaseCurrency: undefined };
  return {
    exchangeRateToBase: input.exchangeRateToBase,
    amountInBaseCurrency: roundToCurrency(input.originalAmount * input.exchangeRateToBase, baseCurrency),
  };
}

/** Newest first: dated by date (descending), undated last; then most recently created. */
function sortExpenses(expenses: readonly Expense[]): Expense[] {
  return [...expenses].sort((a, b) => {
    if (a.date !== b.date) {
      if (a.date === undefined) return 1;
      if (b.date === undefined) return -1;
      return compareCalendarDates(b.date, a.date);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function createExpenseService(repos: Repositories) {
  async function baseCurrencyOf(tripId: string): Promise<string> {
    const trip = await repos.trips.get(tripId);
    if (!trip) throw new InvalidReferenceError(`Trip ${tripId} does not exist`);
    return trip.baseCurrency;
  }

  return {
    async listExpenses(tripId: string): Promise<Expense[]> {
      return sortExpenses(await repos.expenses.listByTrip(tripId));
    },

    createExpense(tripId: string, input: ExpenseInput): Promise<Expense> {
      return repos.transaction(async () => {
        const conversion = conversionFor(input, await baseCurrencyOf(tripId));
        return repos.expenses.create({ ...input, ...conversion, tripId });
      });
    },

    /** Keeps the stored base amount unless the original amount, currency or rate changed. */
    updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
      return repos.transaction(async () => {
        const existing = await repos.expenses.get(id);
        if (!existing) throw new EntityNotFoundError("Expense", id);
        const unchanged =
          existing.originalAmount === input.originalAmount &&
          existing.originalCurrency === input.originalCurrency &&
          existing.exchangeRateToBase === input.exchangeRateToBase;
        const conversion = unchanged
          ? { exchangeRateToBase: existing.exchangeRateToBase, amountInBaseCurrency: existing.amountInBaseCurrency }
          : conversionFor(input, await baseCurrencyOf(existing.tripId));
        // Every key is listed so that cleared optional fields are removed.
        return repos.expenses.update(id, {
          title: input.title,
          category: input.category,
          status: input.status,
          date: input.date,
          originalAmount: input.originalAmount,
          originalCurrency: input.originalCurrency,
          notes: input.notes,
          linkedEntity: input.linkedEntity,
          ...conversion,
        });
      });
    },

    deleteExpense(id: string): Promise<void> {
      return repos.expenses.delete(id);
    },
  };
}

export type ExpenseService = ReturnType<typeof createExpenseService>;

let service: ExpenseService | null = null;

export function getExpenseService(): ExpenseService {
  service ??= createExpenseService(getRepositories());
  return service;
}
