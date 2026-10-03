import { calendarDaysInclusive, formatCalendarDateRange } from "@/lib/domain/dateTime";
import type { Trip, TripStatus } from "@/lib/domain/types";

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
};

export const TRIP_GROUP_TITLES: Record<TripStatus, string> = {
  active: "Current trip",
  planned: "Upcoming",
  completed: "Completed",
};

export const TRIP_STATUS_BADGE: Record<TripStatus, string> = {
  planned: "bg-sky-100 text-sky-800",
  active: "bg-emerald-100 text-emerald-800",
  completed: "bg-slate-200 text-slate-700",
};

export function tripDates(trip: Pick<Trip, "startDate" | "endDate">): string {
  return formatCalendarDateRange(trip.startDate, trip.endDate);
}

export function tripDuration(trip: Pick<Trip, "startDate" | "endDate">): string {
  const days = calendarDaysInclusive(trip.startDate, trip.endDate);
  return days === 1 ? "1 day" : `${days} days`;
}

export function tripCountries(trip: Pick<Trip, "countries">): string {
  return trip.countries.join(" · ");
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 0 }).format(amount);
}

export function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}
