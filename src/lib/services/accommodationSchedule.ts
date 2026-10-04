/**
 * Which accommodation is shown on which day (DATA_MODEL.md "Itinerary Ordering"):
 * every date within [checkInDate, checkOutDate], as check-in, night or check-out.
 */
import { addDays, compareCalendarDates, daysBetween } from "@/lib/domain/dateTime";
import type { Accommodation, Trip } from "@/lib/domain/types";

export type StayRole = "check-in" | "night" | "check-out";

export interface StayOnDate {
  accommodation: Accommodation;
  role: StayRole;
  /** 1-based night (check-in day = night 1); undefined on the check-out day. */
  night?: number;
  /** Total nights (0 for a stay that checks out on the check-in day). */
  nights: number;
}

const ROLE_ORDER: Record<StayRole, number> = { "check-out": 0, night: 1, "check-in": 2 };

export function nightsOf(accommodation: Pick<Accommodation, "checkInDate" | "checkOutDate">): number {
  return daysBetween(accommodation.checkInDate, accommodation.checkOutDate);
}

/** Stays touching `date`, morning first: check-outs, ongoing nights, then check-ins. */
export function staysOnDate(accommodations: readonly Accommodation[], date: string): StayOnDate[] {
  const result: StayOnDate[] = [];
  for (const accommodation of accommodations) {
    if (compareCalendarDates(date, accommodation.checkInDate) < 0) continue;
    if (compareCalendarDates(date, accommodation.checkOutDate) > 0) continue;
    const nights = nightsOf(accommodation);
    const offset = daysBetween(accommodation.checkInDate, date);
    if (offset === 0) result.push({ accommodation, role: "check-in", night: nights > 0 ? 1 : undefined, nights });
    else if (date === accommodation.checkOutDate) result.push({ accommodation, role: "check-out", nights });
    else result.push({ accommodation, role: "night", night: offset + 1, nights });
  }
  return result.sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.accommodation.name.localeCompare(b.accommodation.name),
  );
}

/** Chronological: by check-in date, then check-out date, then name. */
export function sortAccommodations<T extends Accommodation>(accommodations: readonly T[]): T[] {
  return [...accommodations].sort(
    (a, b) =>
      compareCalendarDates(a.checkInDate, b.checkInDate) ||
      compareCalendarDates(a.checkOutDate, b.checkOutDate) ||
      a.name.localeCompare(b.name),
  );
}

/** Nights of the trip (each night named by its date) and those without any accommodation. */
export function nightCoverage(
  trip: Pick<Trip, "startDate" | "endDate">,
  accommodations: readonly Accommodation[],
): { nights: number; uncovered: string[] } {
  const nights = Math.max(0, daysBetween(trip.startDate, trip.endDate));
  const covered = new Set(
    accommodations.flatMap((stay) => Array.from({ length: Math.max(0, nightsOf(stay)) }, (_, i) => addDays(stay.checkInDate, i))),
  );
  const uncovered = Array.from({ length: nights }, (_, i) => addDays(trip.startDate, i)).filter((night) => !covered.has(night));
  return { nights, uncovered };
}
