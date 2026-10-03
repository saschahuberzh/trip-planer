import { getDatabase } from "@/lib/db/connection";
import type { TravelDatabase } from "@/lib/db/database";
import { createAccommodationRepository } from "./accommodationRepository";
import { createAppMetaRepository } from "./appMetaRepository";
import { createBookingRepository } from "./bookingRepository";
import { createExpenseRepository } from "./expenseRepository";
import { createImageRepository } from "./imageRepository";
import { createPlaceRepository } from "./placeRepository";
import { createSafetyBackupRepository } from "./safetyBackupRepository";
import { createActivityRepository, createTransportRepository } from "./timelineRepositories";
import { createTripDayRepository } from "./tripDayRepository";
import { createTripRepository } from "./tripRepository";
import { writeTransaction } from "./shared";

export * from "./errors";
export { TripDayNotEmptyError } from "./tripDayRepository";
export type { EntityPatch, NewEntity } from "./shared";
export type { NewImageAsset } from "./imageRepository";
export type { NewTrip, TripPatch } from "./tripRepository";

export function createRepositories(db: TravelDatabase) {
  return {
    trips: createTripRepository(db),
    tripDays: createTripDayRepository(db),
    places: createPlaceRepository(db),
    activities: createActivityRepository(db),
    transports: createTransportRepository(db),
    accommodations: createAccommodationRepository(db),
    bookings: createBookingRepository(db),
    expenses: createExpenseRepository(db),
    images: createImageRepository(db),
    appMeta: createAppMetaRepository(db),
    safetyBackups: createSafetyBackupRepository(db),
    /**
     * Runs several repository calls atomically: if `fn` throws, nothing is written.
     * `fn` must only await repository calls (no fetches, timers or image decoding).
     */
    transaction<R>(fn: () => Promise<R>): Promise<R> {
      return writeTransaction(db, fn);
    },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

let repositories: Repositories | null = null;

/** Repositories bound to the app database (browser only). */
export function getRepositories(): Repositories {
  repositories ??= createRepositories(getDatabase());
  return repositories;
}
