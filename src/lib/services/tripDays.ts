/**
 * TripDay range rules shared by trip editing and the itinerary (see DATA_MODEL.md "TripDay").
 */
import { compareCalendarDates, eachDateInRange } from "@/lib/domain/dateTime";
import type { Trip, TripDay } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";

/** "Outside trip dates" is derived from the trip range, never stored. */
export function isOutsideTripDates(date: string, trip: Pick<Trip, "startDate" | "endDate">): boolean {
  return compareCalendarDates(date, trip.startDate) < 0 || compareCalendarDates(date, trip.endDate) > 0;
}

/**
 * Creates missing TripDays for the range and deletes empty days outside it.
 * Days with user data outside the range are kept and returned.
 * Must run inside `repos.transaction`.
 */
export async function syncTripDays(
  repos: Repositories,
  tripId: string,
  range: Pick<Trip, "startDate" | "endDate">,
): Promise<TripDay[]> {
  const existing = await repos.tripDays.listByTrip(tripId);
  const existingDates = new Set(existing.map((day) => day.date));
  for (const date of eachDateInRange(range.startDate, range.endDate)) {
    if (!existingDates.has(date)) await repos.tripDays.create({ tripId, date });
  }
  const kept: TripDay[] = [];
  for (const day of existing) {
    if (!isOutsideTripDates(day.date, range)) continue;
    if (await repos.tripDays.hasUserData(day.id)) kept.push(day);
    else await repos.tripDays.delete(day.id);
  }
  return kept;
}

/** Days with user data that fall outside the given range. */
export async function daysWithUserDataOutside(
  repos: Repositories,
  tripId: string,
  range: Pick<Trip, "startDate" | "endDate">,
): Promise<TripDay[]> {
  const days = await repos.tripDays.listByTrip(tripId);
  const result: TripDay[] = [];
  for (const day of days) {
    if (isOutsideTripDates(day.date, range) && (await repos.tripDays.hasUserData(day.id))) {
      result.push(day);
    }
  }
  return result;
}
