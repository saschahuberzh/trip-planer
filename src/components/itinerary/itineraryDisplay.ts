import { formatCalendarDate } from "@/lib/domain/dateTime";
import type { Place, TripDay } from "@/lib/domain/types";
import type { TimelineEntry } from "@/lib/services/itineraryOrdering";
import type { DayTimeline } from "@/lib/services/itineraryService";
import { transportTimes, transportTitle } from "./transportDisplay";


/** e.g. "Fri, 12 Jun". */
export function formatDayDate(date: string): string {
  return formatCalendarDate(date, undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** e.g. "Friday, 12 June 2026". */
export function formatDayDateLong(date: string): string {
  return formatCalendarDate(date, undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** "Day 3", or "Outside trip dates" for a day outside the trip range. */
export function dayLabel(timeline: Pick<DayTimeline, "dayNumber">): string {
  return timeline.dayNumber === null ? "Outside trip dates" : `Day ${timeline.dayNumber}`;
}

/** The day's places of the day, e.g. "Tashkent → Samarkand"; undefined when none. */
export function dayPlacesLabel(day: TripDay, places: ReadonlyMap<string, Place>): string | undefined {
  const names = (day.placeIds ?? []).map((id) => places.get(id)?.name).filter((name) => name !== undefined);
  return names.length > 0 ? names.join(" → ") : undefined;
}

/** The day's title, else its places of the day. */
function dayHeadingSuffix(day: TripDay, places: ReadonlyMap<string, Place>): string | undefined {
  return day.title ?? dayPlacesLabel(day, places);
}

/** One-line description of a day for pickers, e.g. "Day 2 · Sat, 13 Jun · Samarkand". */
export function dayOptionLabel(timeline: DayTimeline, places: ReadonlyMap<string, Place>): string {
  const parts = [
    timeline.dayNumber === null ? "Outside dates" : `Day ${timeline.dayNumber}`,
    formatDayDate(timeline.day.date),
  ];
  const suffix = dayHeadingSuffix(timeline.day, places);
  if (suffix !== undefined) parts.push(suffix);
  return parts.join(" · ");
}

export function entryTitle(entry: TimelineEntry, places: ReadonlyMap<string, Place>): string {
  return entry.kind === "activity" ? entry.item.title : transportTitle(entry.item, places);
}

/** Start and end wall-clock times as entered, never converted. */
export function entryTimes(entry: TimelineEntry): { start?: string; end?: string; arrivalDays: number } {
  if (entry.kind === "activity") return { start: entry.item.startTime, end: entry.item.endTime, arrivalDays: 0 };
  return transportTimes(entry.item);
}
