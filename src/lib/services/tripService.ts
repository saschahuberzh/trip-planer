/**
 * Trip management use cases: listing, creating, editing (including TripDay
 * synchronization and cover images) and deleting trips. See DATA_MODEL.md.
 */
import { compareCalendarDates, eachDateInRange } from "@/lib/domain/dateTime";
import type { ImageAsset, Trip, TripDay, TripStatus } from "@/lib/domain/types";
import {
  getRepositories,
  type NewImageAsset,
  type NewTrip,
  type Repositories,
} from "@/lib/repositories";

/** Trip fields edited by the user. The cover image is handled separately. */
export type TripInput = Omit<NewTrip, "coverImageId">;

export type CoverImageChange =
  | { type: "keep" }
  | { type: "remove" }
  | { type: "replace"; image: NewImageAsset };

export interface TripGroup {
  status: TripStatus;
  trips: Trip[];
}

export interface TripChangePreview {
  /** Days with user data that would fall outside the new date range (kept, not deleted). */
  daysOutsideRange: TripDay[];
  /** Expenses whose conversions refer to the current base currency, if it changes. */
  affectedExpenseCount: number;
}

export interface TripUpdateResult {
  trip: Trip;
  /** Days with user data that are now outside the trip dates. */
  daysOutsideRange: TripDay[];
}

export interface TripDeletionSummary {
  days: number;
  places: number;
  activities: number;
  transports: number;
  accommodations: number;
  bookings: number;
  expenses: number;
  coverImage: boolean;
}

export const DEFAULT_BASE_CURRENCY = "EUR";

const GROUP_ORDER: readonly TripStatus[] = ["active", "planned", "completed"];

function isOutside(date: string, startDate: string, endDate: string): boolean {
  return compareCalendarDates(date, startDate) < 0 || compareCalendarDates(date, endDate) > 0;
}

export function createTripService(repos: Repositories) {
  /**
   * Creates missing TripDays for the range and deletes empty days outside it.
   * Days with user data outside the range are kept and returned.
   * Must run inside `repos.transaction`.
   */
  async function syncTripDays(tripId: string, startDate: string, endDate: string): Promise<TripDay[]> {
    const existing = await repos.tripDays.listByTrip(tripId);
    const existingDates = new Set(existing.map((day) => day.date));
    for (const date of eachDateInRange(startDate, endDate)) {
      if (!existingDates.has(date)) await repos.tripDays.create({ tripId, date });
    }
    const kept: TripDay[] = [];
    for (const day of existing) {
      if (!isOutside(day.date, startDate, endDate)) continue;
      if (await repos.tripDays.hasUserData(day.id)) kept.push(day);
      else await repos.tripDays.delete(day.id);
    }
    return kept;
  }

  async function daysWithUserDataOutside(tripId: string, startDate: string, endDate: string): Promise<TripDay[]> {
    const days = await repos.tripDays.listByTrip(tripId);
    const result: TripDay[] = [];
    for (const day of days) {
      if (isOutside(day.date, startDate, endDate) && (await repos.tripDays.hasUserData(day.id))) {
        result.push(day);
      }
    }
    return result;
  }

  return {
    getTrip(id: string): Promise<Trip | undefined> {
      return repos.trips.get(id);
    },

    getImage(id: string): Promise<ImageAsset | undefined> {
      return repos.images.get(id);
    },

    /** Trips grouped as active, upcoming (planned) and completed; empty groups omitted. */
    async listTripGroups(): Promise<TripGroup[]> {
      const trips = await repos.trips.list();
      return GROUP_ORDER.map((status) => {
        const direction = status === "completed" ? -1 : 1;
        const inGroup = trips
          .filter((trip) => trip.status === status)
          .sort(
            (a, b) =>
              direction * compareCalendarDates(a.startDate, b.startDate) ||
              a.name.localeCompare(b.name),
          );
        return { status, trips: inGroup };
      }).filter((group) => group.trips.length > 0);
    },

    /** Base currency suggested for a new trip: that of the most recently created trip. */
    async suggestedBaseCurrency(): Promise<string> {
      const trips = await repos.trips.list();
      const latest = trips.reduce<Trip | undefined>(
        (current, trip) => (current === undefined || trip.createdAt > current.createdAt ? trip : current),
        undefined,
      );
      return latest?.baseCurrency ?? DEFAULT_BASE_CURRENCY;
    },

    /** Creates the trip, its cover image and one TripDay per date, atomically. */
    createTrip(input: TripInput, coverImage?: NewImageAsset): Promise<Trip> {
      return repos.transaction(async () => {
        const coverImageId = coverImage === undefined ? undefined : (await repos.images.create(coverImage)).id;
        const trip = await repos.trips.create({ ...input, coverImageId });
        await syncTripDays(trip.id, trip.startDate, trip.endDate);
        return trip;
      });
    },

    /** What saving these values would affect; shown to the user before saving. */
    async previewTripChange(
      id: string,
      change: Pick<TripInput, "startDate" | "endDate" | "baseCurrency">,
    ): Promise<TripChangePreview> {
      const trip = await repos.trips.get(id);
      const currencyChanges = trip !== undefined && trip.baseCurrency !== change.baseCurrency;
      return {
        daysOutsideRange: await daysWithUserDataOutside(id, change.startDate, change.endDate),
        affectedExpenseCount: currencyChanges ? (await repos.expenses.listByTrip(id)).length : 0,
      };
    },

    /**
     * Updates the trip and synchronizes its TripDays: missing days are created,
     * empty days outside the range are deleted, days with user data are kept.
     * A replaced or removed cover image is deleted.
     */
    updateTrip(id: string, input: TripInput, cover: CoverImageChange): Promise<TripUpdateResult> {
      return repos.transaction(async () => {
        let coverImageId: string | undefined;
        if (cover.type === "replace") coverImageId = (await repos.images.create(cover.image)).id;
        else if (cover.type === "keep") coverImageId = (await repos.trips.get(id))?.coverImageId;
        // Every key is listed so that cleared optional fields are removed.
        const trip = await repos.trips.update(id, {
          name: input.name,
          countries: input.countries,
          startDate: input.startDate,
          endDate: input.endDate,
          status: input.status,
          baseCurrency: input.baseCurrency,
          budgetAmount: input.budgetAmount,
          notes: input.notes,
          coverImageId,
        });
        const daysOutsideRange = await syncTripDays(id, trip.startDate, trip.endDate);
        return { trip, daysOutsideRange };
      });
    },

    /** Counts of everything that deleting the trip removes, for the confirmation. */
    async getDeletionSummary(id: string): Promise<TripDeletionSummary> {
      const [trip, days, places, activities, transports, accommodations, bookings, expenses] =
        await Promise.all([
          repos.trips.get(id),
          repos.tripDays.listByTrip(id),
          repos.places.listByTrip(id),
          repos.activities.listByTrip(id),
          repos.transports.listByTrip(id),
          repos.accommodations.listByTrip(id),
          repos.bookings.listByTrip(id),
          repos.expenses.listByTrip(id),
        ]);
      return {
        days: days.length,
        places: places.length,
        activities: activities.length,
        transports: transports.length,
        accommodations: accommodations.length,
        bookings: bookings.length,
        expenses: expenses.length,
        coverImage: trip?.coverImageId !== undefined,
      };
    },

    /** Deletes the trip with everything it owns and its cover image. */
    deleteTrip(id: string): Promise<void> {
      return repos.trips.delete(id);
    },
  };
}

export type TripService = ReturnType<typeof createTripService>;

let service: TripService | null = null;

/** Trip service bound to the app database (browser only). */
export function getTripService(): TripService {
  service ??= createTripService(getRepositories());
  return service;
}
