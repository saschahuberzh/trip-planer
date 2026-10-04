import type { TravelDatabase } from "@/lib/db/database";
import { nowInstant } from "@/lib/domain/dateTime";
import type { Trip } from "@/lib/domain/types";
import { assertValidTrip } from "@/lib/domain/validation";
import { ConflictError, InvalidReferenceError, EntityNotFoundError } from "./errors";
import { newId, withoutUndefined, writeTransaction, type NewEntity } from "./shared";

export type NewTrip = NewEntity<Trip>;
export type TripPatch = Partial<Omit<Trip, "id" | "createdAt" | "updatedAt">>;

export function createTripRepository(db: TravelDatabase) {
  async function check(trip: Trip): Promise<void> {
    assertValidTrip(trip);
    if (trip.coverImageId !== undefined && !(await db.images.get(trip.coverImageId))) {
      throw new InvalidReferenceError(`Cover image ${trip.coverImageId} does not exist`);
    }
  }

  return {
    get(id: string): Promise<Trip | undefined> {
      return db.trips.get(id);
    },

    list(): Promise<Trip[]> {
      return db.trips.toArray();
    },

    count(): Promise<number> {
      return db.trips.count();
    },

    create(input: NewTrip): Promise<Trip> {
      return writeTransaction(db, async () => {
        const now = nowInstant();
        const trip = withoutUndefined<Trip>({ ...input, id: newId(), createdAt: now, updatedAt: now });
        await check(trip);
        await db.trips.add(trip);
        return trip;
      });
    },

    /**
     * Updates trip fields. Replacing or clearing `coverImageId` deletes the previous
     * ImageAsset. TripDays are not adjusted here.
     */
    update(id: string, patch: TripPatch): Promise<Trip> {
      return writeTransaction(db, async () => {
        const existing = await db.trips.get(id);
        if (!existing) throw new EntityNotFoundError("Trip", id);
        const trip = withoutUndefined<Trip>({
          ...existing,
          ...patch,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: nowInstant(),
        });
        await check(trip);
        if (
          trip.baseCurrency !== existing.baseCurrency &&
          (await db.expenses.where("tripId").equals(id).count()) > 0
        ) {
          // Stored conversions refer to the old base currency (see DATA_MODEL.md).
          throw new ConflictError("Changing the base currency of a trip with expenses requires converting its expenses");
        }
        if (existing.coverImageId !== undefined && existing.coverImageId !== trip.coverImageId) {
          await db.images.delete(existing.coverImageId);
        }
        await db.trips.put(trip);
        return trip;
      });
    },

    /**
     * Changes the trip's base currency and, in the same transaction, its expenses'
     * conversions (DATA_MODEL.md "Currency Conversion"): expenses in the new base currency
     * get rate 1, all others become unconverted until the user enters new rates.
     * Returns how many conversions were cleared.
     */
    changeBaseCurrency(id: string, baseCurrency: string): Promise<{ trip: Trip; clearedConversions: number }> {
      return writeTransaction(db, async () => {
        const existing = await db.trips.get(id);
        if (!existing) throw new EntityNotFoundError("Trip", id);
        if (existing.baseCurrency === baseCurrency) return { trip: existing, clearedConversions: 0 };
        const updatedAt = nowInstant();
        const trip: Trip = { ...existing, baseCurrency, updatedAt };
        await check(trip);
        await db.trips.put(trip);
        let clearedConversions = 0;
        await db.expenses.where("tripId").equals(id).modify((expense) => {
          if (expense.originalCurrency === baseCurrency) {
            expense.exchangeRateToBase = 1;
            expense.amountInBaseCurrency = expense.originalAmount;
          } else {
            if (expense.exchangeRateToBase !== undefined) clearedConversions++;
            delete expense.exchangeRateToBase;
            delete expense.amountInBaseCurrency;
          }
          expense.updatedAt = updatedAt;
        });
        return { trip, clearedConversions };
      });
    },

    /** Deletes the trip, every entity it owns and its cover image, atomically. */
    delete(id: string): Promise<void> {
      return writeTransaction(db, async () => {
        const trip = await db.trips.get(id);
        if (!trip) throw new EntityNotFoundError("Trip", id);
        await Promise.all(
          [
            db.tripDays,
            db.places,
            db.activities,
            db.transports,
            db.accommodations,
            db.bookings,
            db.expenses,
          ].map((table) => table.where("tripId").equals(id).delete()),
        );
        if (trip.coverImageId !== undefined) await db.images.delete(trip.coverImageId);
        await db.trips.delete(id);
      });
    },
  };
}

export type TripRepository = ReturnType<typeof createTripRepository>;
