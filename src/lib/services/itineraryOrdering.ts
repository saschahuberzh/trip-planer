/**
 * Pure itinerary ordering rules (see DATA_MODEL.md "Itinerary Ordering").
 * Activities and Transports share one `sortOrder` space per bucket
 * (a TripDay or the trip's Unplanned section).
 */
import type { Activity, Transport } from "@/lib/domain/types";

export type TimelineEntry =
  | { kind: "activity"; item: Activity }
  | { kind: "transport"; item: Transport };

export type TimelineEntryKind = TimelineEntry["kind"];

/** Identifies one timeline entry across both entity types. */
export interface TimelineEntryRef {
  kind: TimelineEntryKind;
  id: string;
}

export function entryRef(entry: TimelineEntry): TimelineEntryRef {
  return { kind: entry.kind, id: entry.item.id };
}

export function isSameEntry(entry: TimelineEntry, ref: TimelineEntryRef): boolean {
  return entry.kind === ref.kind && entry.item.id === ref.id;
}

/** Timeline order: `sortOrder`, ties broken by `id`. */
function compareTimelineEntries(a: TimelineEntry, b: TimelineEntry): number {
  const bySortOrder = a.item.sortOrder - b.item.sortOrder;
  if (bySortOrder !== 0) return bySortOrder;
  return compareText(a.item.id, b.item.id);
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortTimeline(entries: readonly TimelineEntry[]): TimelineEntry[] {
  return [...entries].sort(compareTimelineEntries);
}

/** `sortOrder` for an entry appended to the bucket: `max(sortOrder) + 1`, or 0 when empty. */
export function nextSortOrder(entries: readonly TimelineEntry[]): number {
  return entries.reduce((max, entry) => Math.max(max, entry.item.sortOrder + 1), 0);
}

/** Moves the element at `from` to index `to` (clamped), returning a new array. */
export function moveWithin<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  const [moved] = result.splice(from, 1);
  result.splice(Math.max(0, Math.min(to, result.length)), 0, moved);
  return result;
}

/**
 * Wall-clock start of an entry as "YYYY-MM-DDTHH:mm", compared as text.
 * Activity times belong to their day's date; transports use their local departure.
 * Times are never converted between timezones.
 */
function entryStartKey(entry: TimelineEntry, dayDate: string): string | undefined {
  if (entry.kind === "activity") {
    return entry.item.startTime === undefined ? undefined : `${dayDate}T${entry.item.startTime}`;
  }
  return entry.item.departure?.local;
}

function entryEndKey(entry: TimelineEntry, dayDate: string): string {
  if (entry.kind === "activity") return entry.item.endTime === undefined ? "" : `${dayDate}T${entry.item.endTime}`;
  return entry.item.arrival?.local ?? "";
}

/**
 * The explicit "sort by time" order of a day's timeline (`entries` in current order).
 *
 * Entries with a time are ordered by start time (then end time, then their current
 * order). Entries without a time stay directly after the entry they currently follow;
 * untimed entries at the top of the day stay at the top.
 */
export function sortEntriesByTime(entries: readonly TimelineEntry[], dayDate: string): TimelineEntry[] {
  const head: TimelineEntry[] = [];
  const groups: { start: string; end: string; position: number; entries: TimelineEntry[] }[] = [];
  for (const entry of entries) {
    const start = entryStartKey(entry, dayDate);
    if (start === undefined) {
      (groups.length > 0 ? groups[groups.length - 1].entries : head).push(entry);
    } else {
      groups.push({ start, end: entryEndKey(entry, dayDate), position: groups.length, entries: [entry] });
    }
  }
  groups.sort(
    (a, b) =>
      compareText(a.start, b.start) || compareText(a.end, b.end) || a.position - b.position,
  );
  return [...head, ...groups.flatMap((group) => group.entries)];
}

/** Whether "sort by time" would change the order. */
export function isSortedByTime(entries: readonly TimelineEntry[], dayDate: string): boolean {
  const sorted = sortEntriesByTime(entries, dayDate);
  return sorted.every((entry, index) => entry === entries[index]);
}
