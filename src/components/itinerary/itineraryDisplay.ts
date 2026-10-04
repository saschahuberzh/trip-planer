import { formatCalendarDate } from "@/lib/domain/dateTime";
import type { TransportType } from "@/lib/domain/types";
import type { TimelineEntry } from "@/lib/services/itineraryOrdering";
import type { DayTimeline } from "@/lib/services/itineraryService";

const TRANSPORT_TYPE_LABELS: Record<TransportType, string> = {
  flight: "Flight",
  train: "Train",
  bus: "Bus",
  car: "Car",
  taxi: "Taxi",
  ferry: "Ferry",
  walking: "Walk",
  other: "Transport",
};

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

/** One-line description of a day for pickers, e.g. "Day 2 · Sat, 13 Jun · Samarkand". */
export function dayOptionLabel(timeline: DayTimeline): string {
  const parts = [
    timeline.dayNumber === null ? "Outside dates" : `Day ${timeline.dayNumber}`,
    formatDayDate(timeline.day.date),
  ];
  if (timeline.day.title !== undefined) parts.push(timeline.day.title);
  return parts.join(" · ");
}

export function entryTitle(entry: TimelineEntry): string {
  if (entry.kind === "activity") return entry.item.title;
  const { originText, destinationText, type } = entry.item;
  const route = [originText, destinationText].filter((part) => part !== undefined).join(" → ");
  return route === "" ? TRANSPORT_TYPE_LABELS[type] : `${TRANSPORT_TYPE_LABELS[type]} · ${route}`;
}

/** Start and end wall-clock times as entered, never converted. */
export function entryTimes(entry: TimelineEntry): { start?: string; end?: string } {
  if (entry.kind === "activity") return { start: entry.item.startTime, end: entry.item.endTime };
  return { start: entry.item.departure?.local.slice(11), end: entry.item.arrival?.local.slice(11) };
}
