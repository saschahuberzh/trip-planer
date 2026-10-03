import type { TravelDatabase } from "@/lib/db/database";
import type { Expense } from "@/lib/domain/types";
import { assertValidExpense } from "@/lib/domain/validation";
import { EntityNotFoundError } from "./errors";
import { requireLinkedEntity, requireTrip } from "./references";
import { tripScopedCrud, writeTransaction, type NewEntity } from "./shared";

export type NewExpense = NewEntity<Expense>;

/**
 * Stores expenses as given. Conversion fields are validated for consistency but never
 * calculated here; stored `amountInBaseCurrency` values are preserved as-is.
 */
export function createExpenseRepository(db: TravelDatabase) {
  const crud = tripScopedCrud<Expense>(db, db.expenses, {
    entityName: "Expense",
    async check(expense) {
      const trip = await requireTrip(db, expense.tripId);
      assertValidExpense(expense, trip.baseCurrency);
      await requireLinkedEntity(db, expense.linkedEntity, expense.tripId);
    },
  });

  return {
    ...crud,

    delete(id: string): Promise<void> {
      return writeTransaction(db, async () => {
        if (!(await db.expenses.get(id))) throw new EntityNotFoundError("Expense", id);
        await db.expenses.delete(id);
      });
    },
  };
}

export type ExpenseRepository = ReturnType<typeof createExpenseRepository>;
