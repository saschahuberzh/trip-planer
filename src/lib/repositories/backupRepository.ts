import type { TravelDatabase } from "@/lib/db/database";
import type { Accommodation, Activity, Booking, Expense, ImageAsset, Place, Transport, Trip, TripDay, VisitedCountry } from "@/lib/domain/types";

/** The complete travel data (all domain tables), as stored. */
export interface DomainSnapshot {
  trips: Trip[];
  tripDays: TripDay[];
  places: Place[];
  activities: Activity[];
  transports: Transport[];
  accommodations: Accommodation[];
  bookings: Booking[];
  expenses: Expense[];
  images: ImageAsset[];
  visitedCountries: VisitedCountry[];
}

/**
 * Whole-database reads and the Replace restore. Records written by `replaceAll` must have
 * been validated completely beforehand (see lib/backup/validate.ts); this layer only
 * guarantees atomicity: either everything is replaced or nothing changes.
 */
export function createBackupRepository(db: TravelDatabase) {
  return {
    /** A consistent snapshot of all domain tables (one read transaction). */
    readAll(): Promise<DomainSnapshot> {
      return db.transaction("r", db.domainTables, async () => {
        const [trips, tripDays, places, activities, transports, accommodations, bookings, expenses, images, visitedCountries] =
          await Promise.all([
            db.trips.toArray(),
            db.tripDays.toArray(),
            db.places.toArray(),
            db.activities.toArray(),
            db.transports.toArray(),
            db.accommodations.toArray(),
            db.bookings.toArray(),
            db.expenses.toArray(),
            db.images.toArray(),
            db.visitedCountries.toArray(),
          ]);
        return { trips, tripDays, places, activities, transports, accommodations, bookings, expenses, images, visitedCountries };
      });
    },

    /**
     * Replaces all travel data in a single transaction. AppMeta and safety backups are
     * not touched. If anything fails, the transaction aborts and the old data remains.
     */
    replaceAll(data: DomainSnapshot): Promise<void> {
      return db.transaction("rw", db.domainTables, async () => {
        for (const table of db.domainTables) await table.clear();
        await db.trips.bulkAdd(data.trips);
        await db.images.bulkAdd(data.images);
        await db.tripDays.bulkAdd(data.tripDays);
        await db.places.bulkAdd(data.places);
        await db.activities.bulkAdd(data.activities);
        await db.transports.bulkAdd(data.transports);
        await db.accommodations.bulkAdd(data.accommodations);
        await db.bookings.bulkAdd(data.bookings);
        await db.expenses.bulkAdd(data.expenses);
        await db.visitedCountries.bulkAdd(data.visitedCountries);
      });
    },
  };
}

export type BackupRepository = ReturnType<typeof createBackupRepository>;
