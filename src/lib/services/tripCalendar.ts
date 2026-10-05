/**
 * Calendar overview of a trip (Plan → Calendar): which place the traveller is at on each
 * day, from the places of the day. Kept free of React so it can be tested directly.
 */
import { addDays, eachDateInRange, isoWeekday } from "@/lib/domain/dateTime";
import { nightsOf } from "./accommodationSchedule";
import type { Itinerary } from "./itineraryService";

export interface CalendarPlace {
  placeId: string;
  name: string;
  /** Same place, same colour; assigned in order of first appearance. */
  colorIndex: number;
}

export interface CalendarDay {
  date: string;
  /** Set for days within the trip dates. */
  trip?: {
    tripDayId: string;
    dayNumber: number;
    /** An accommodation covers the night of this day (check-in ≤ date < check-out). */
    hasStay: boolean;
  };
  /** Places of the day, in their order (e.g. travel day: from, to). */
  places: CalendarPlace[];
}

/** A run of consecutive days at the same place. */
export interface CalendarStay extends CalendarPlace {
  firstDayNumber: number;
  lastDayNumber: number;
  /** Nights spent there: days whose last place it is, except the trip's last day. */
  nights: number;
}

export interface CalendarMonth {
  /** "YYYY-MM". */
  month: string;
  /**
   * Always CALENDAR_WEEKS Monday–Sunday weeks, so every month has the same height; null
   * pads the days of neighbouring months (and the empty weeks at the end).
   */
  weeks: (CalendarDay | null)[][];
}

export interface TripCalendar {
  /** Every month the trip touches, chronologically (shown one at a time). */
  months: CalendarMonth[];
  stays: CalendarStay[];
}

const monthOf = (date: string) => date.slice(0, 7);

/** The most weeks a month can touch (e.g. a 31-day month starting on a Saturday). */
export const CALENDAR_WEEKS = 6;

/** The month to show first: today's month during the trip, else the trip's first month. */
export function initialCalendarMonth(calendar: TripCalendar, today: string): string | undefined {
  const months = calendar.months.map((entry) => entry.month);
  return months.includes(monthOf(today)) ? monthOf(today) : months[0];
}

export function tripCalendar(itinerary: Itinerary): TripCalendar {
  const { trip, days, places } = itinerary;
  const byDate = new Map(days.map((timeline) => [timeline.day.date, timeline]));
  const colors = new Map<string, number>();

  const placesOf = (placeIds: readonly string[] | undefined): CalendarPlace[] =>
    (placeIds ?? []).flatMap((placeId) => {
      const place = places.get(placeId);
      if (!place) return [];
      if (!colors.has(placeId)) colors.set(placeId, colors.size);
      return [{ placeId, name: place.name, colorIndex: colors.get(placeId) ?? 0 }];
    });

  // Stays, in day order (colours are assigned here, chronologically).
  const stays: CalendarStay[] = [];
  const tripDays = days.filter((timeline) => timeline.dayNumber !== null);
  const dayPlaces = new Map<string, CalendarPlace[]>();
  tripDays.forEach((timeline, index) => {
    const dayNumber = timeline.dayNumber ?? 0;
    const placesOfDay = placesOf(timeline.day.placeIds);
    dayPlaces.set(timeline.day.id, placesOfDay);
    const lastDay = index === tripDays.length - 1;
    placesOfDay.forEach((place, position) => {
      const previous = stays.at(-1);
      // A place continues the current stay when it is the same place on the next day.
      const continues = previous?.placeId === place.placeId && previous.lastDayNumber >= dayNumber - 1;
      const stay = continues ? previous : { ...place, firstDayNumber: dayNumber, lastDayNumber: dayNumber, nights: 0 };
      if (!continues) stays.push(stay);
      stay.lastDayNumber = dayNumber;
      // The night belongs to the day's last place; the trip's last night is not part of it.
      if (position === placesOfDay.length - 1 && !lastDay) stay.nights += 1;
    });
  });

  // Nights with an accommodation, named by their date.
  const stayNights = new Set(
    itinerary.accommodations.flatMap((stay) => Array.from({ length: Math.max(0, nightsOf(stay)) }, (_, i) => addDays(stay.checkInDate, i))),
  );

  const dayOf = (date: string): CalendarDay => {
    const timeline = byDate.get(date);
    if (timeline === undefined || timeline.dayNumber === null) return { date, places: [] };
    return {
      date,
      trip: { tripDayId: timeline.day.id, dayNumber: timeline.dayNumber, hasStay: stayNights.has(date) },
      places: dayPlaces.get(timeline.day.id) ?? [],
    };
  };

  const months: CalendarMonth[] = [];
  for (let first = `${monthOf(trip.startDate)}-01`; first <= trip.endDate; first = nextMonth(first)) {
    const last = addDays(nextMonth(first), -1);
    const gridStart = addDays(first, 1 - isoWeekday(first));
    const gridEnd = addDays(last, 7 - isoWeekday(last));
    const weeks: (CalendarDay | null)[][] = [];
    for (const date of eachDateInRange(gridStart, gridEnd)) {
      if (isoWeekday(date) === 1) weeks.push([]);
      weeks[weeks.length - 1].push(monthOf(date) === monthOf(first) ? dayOf(date) : null);
    }
    while (weeks.length < CALENDAR_WEEKS) weeks.push(Array.from({ length: 7 }, () => null));
    months.push({ month: monthOf(first), weeks });
  }
  return { months, stays };
}

/** First day of the following month ("2027-12-01" → "2028-01-01"). */
function nextMonth(firstOfMonth: string): string {
  return `${monthOf(addDays(firstOfMonth, 31))}-01`;
}
