/**
 * Itinerary use cases: reading the day-by-day timeline, creating/editing/deleting
 * activities, reordering and moving timeline entries, and resolving days outside
 * the trip dates. All ordering is written here (see DATA_MODEL.md "Itinerary Ordering");
 * repositories only store what this service computes.
 */
import { calendarDaysInclusive } from "@/lib/domain/dateTime";
import type { Activity, Trip, TripDay } from "@/lib/domain/types";
import { EntityNotFoundError, getRepositories, type Repositories } from "@/lib/repositories";
import {
  isSameEntry,
  moveWithin,
  nextSortOrder,
  sortEntriesByTime,
  sortTimeline,
  type TimelineEntry,
  type TimelineEntryRef,
} from "./itineraryOrdering";
import { isOutsideTripDates, syncTripDays } from "./tripDays";

/** Activity fields edited by the user. Place links are kept as they are. */
export type ActivityInput = Pick<Activity, "title" | "startTime" | "endTime" | "notes">;

export type TripDayDetailsInput = Pick<TripDay, "title" | "notes">;

export interface DayTimeline {
  day: TripDay;
  /** 1-based position within the trip dates; null when outside them. */
  dayNumber: number | null;
  outside: boolean;
  entries: TimelineEntry[];
}

export interface Itinerary {
  trip: Trip;
  /** Days within the trip dates, chronologically. */
  days: DayTimeline[];
  /** Persisted days outside the trip dates (they contain user data), chronologically. */
  outsideDays: DayTimeline[];
  unplanned: TimelineEntry[];
}

export class TripDayInRangeError extends Error {
  constructor() {
    super("Only days outside the trip dates can be deleted");
    this.name = "TripDayInRangeError";
  }
}

export function createItineraryService(repos: Repositories) {
  /** Entries of one bucket (a day, or Unplanned when `tripDayId` is undefined), in order. */
  async function listBucket(tripId: string, tripDayId: string | undefined): Promise<TimelineEntry[]> {
    const [activities, transports] =
      tripDayId === undefined
        ? await Promise.all([repos.activities.listByTrip(tripId), repos.transports.listByTrip(tripId)])
        : await Promise.all([repos.activities.listByTripDay(tripDayId), repos.transports.listByTripDay(tripDayId)]);
    const inBucket = (item: { tripId: string; tripDayId?: string }) =>
      item.tripId === tripId && item.tripDayId === tripDayId;
    return sortTimeline([
      ...activities.filter(inBucket).map((item): TimelineEntry => ({ kind: "activity", item })),
      ...transports.filter(inBucket).map((item): TimelineEntry => ({ kind: "transport", item })),
    ]);
  }

  async function getEntry(ref: TimelineEntryRef): Promise<TimelineEntry> {
    if (ref.kind === "activity") {
      const item = await repos.activities.get(ref.id);
      if (!item) throw new EntityNotFoundError("Activity", ref.id);
      return { kind: "activity", item };
    }
    const item = await repos.transports.get(ref.id);
    if (!item) throw new EntityNotFoundError("Transport", ref.id);
    return { kind: "transport", item };
  }

  /**
   * Stores `entries` as the complete order of a bucket: consecutive `sortOrder`
   * values from 0. Only entries whose bucket or position changed are written.
   */
  async function writeBucket(entries: readonly TimelineEntry[], tripDayId: string | undefined): Promise<void> {
    for (const [sortOrder, entry] of entries.entries()) {
      if (entry.item.sortOrder === sortOrder && entry.item.tripDayId === tripDayId) continue;
      const patch = { tripDayId, sortOrder };
      if (entry.kind === "activity") await repos.activities.update(entry.item.id, patch);
      else await repos.transports.update(entry.item.id, patch);
    }
  }

  /** Empty days outside the trip dates are removed automatically (DATA_MODEL.md). */
  async function removeIfEmptyOutside(tripDayId: string | undefined): Promise<void> {
    if (tripDayId === undefined) return;
    const day = await repos.tripDays.get(tripDayId);
    if (!day) return;
    const trip = await repos.trips.get(day.tripId);
    if (!trip || !isOutsideTripDates(day.date, trip)) return;
    if (!(await repos.tripDays.hasUserData(day.id))) await repos.tripDays.delete(day.id);
  }

  /** Moves an entry to `index` (default: end) of the target bucket. Must run in a transaction. */
  async function moveEntryInTransaction(
    ref: TimelineEntryRef,
    toTripDayId: string | undefined,
    index?: number,
  ): Promise<void> {
    const entry = await getEntry(ref);
    const { tripId, tripDayId: fromTripDayId } = entry.item;
    const source = await listBucket(tripId, fromTripDayId);
    if (fromTripDayId === toTripDayId) {
      const from = source.findIndex((candidate) => isSameEntry(candidate, ref));
      await writeBucket(moveWithin(source, from, index ?? source.length), toTripDayId);
      return;
    }
    const target = await listBucket(tripId, toTripDayId);
    const remaining = source.filter((candidate) => !isSameEntry(candidate, ref));
    const reordered = [...target];
    reordered.splice(Math.max(0, Math.min(index ?? target.length, target.length)), 0, entry);
    await writeBucket(reordered, toTripDayId);
    await writeBucket(remaining, fromTripDayId);
    await removeIfEmptyOutside(fromTripDayId);
  }

  function toTimeline(trip: Trip, day: TripDay, entries: TimelineEntry[]): DayTimeline {
    const outside = isOutsideTripDates(day.date, trip);
    return {
      day,
      outside,
      dayNumber: outside ? null : calendarDaysInclusive(trip.startDate, day.date),
      entries,
    };
  }

  return {
    /** The trip's itinerary, or undefined if the trip does not exist. */
    async getItinerary(tripId: string): Promise<Itinerary | undefined> {
      const trip = await repos.trips.get(tripId);
      if (!trip) return undefined;
      const [days, activities, transports] = await Promise.all([
        repos.tripDays.listByTrip(tripId),
        repos.activities.listByTrip(tripId),
        repos.transports.listByTrip(tripId),
      ]);
      const buckets = new Map<string | undefined, TimelineEntry[]>();
      const dayIds = new Set(days.map((day) => day.id));
      const add = (tripDayId: string | undefined, entry: TimelineEntry) => {
        // Never hide an entry: a reference to a missing day shows it as Unplanned.
        const key = tripDayId !== undefined && dayIds.has(tripDayId) ? tripDayId : undefined;
        buckets.set(key, [...(buckets.get(key) ?? []), entry]);
      };
      for (const item of activities) add(item.tripDayId, { kind: "activity", item });
      for (const item of transports) add(item.tripDayId, { kind: "transport", item });

      const timelines = days.map((day) => toTimeline(trip, day, sortTimeline(buckets.get(day.id) ?? [])));
      return {
        trip,
        days: timelines.filter((timeline) => !timeline.outside),
        outsideDays: timelines.filter((timeline) => timeline.outside),
        unplanned: sortTimeline(buckets.get(undefined) ?? []),
      };
    },

    /**
     * Creates TripDays missing from the trip dates and removes empty days outside them.
     * Days with user data are never removed. Writes only when something is missing.
     */
    ensureTripDays(tripId: string): Promise<void> {
      return repos.transaction(async () => {
        const trip = await repos.trips.get(tripId);
        if (trip) await syncTripDays(repos, tripId, trip);
      });
    },

    updateDayDetails(tripDayId: string, input: TripDayDetailsInput): Promise<void> {
      return repos.transaction(async () => {
        await repos.tripDays.update(tripDayId, { title: input.title, notes: input.notes });
        await removeIfEmptyOutside(tripDayId);
      });
    },

    /** Appends a new activity to the day, or to Unplanned when `tripDayId` is undefined. */
    createActivity(tripId: string, tripDayId: string | undefined, input: ActivityInput): Promise<Activity> {
      return repos.transaction(async () => {
        const bucket = await listBucket(tripId, tripDayId);
        return repos.activities.create({
          tripId,
          tripDayId,
          title: input.title,
          startTime: input.startTime,
          endTime: input.endTime,
          notes: input.notes,
          sortOrder: nextSortOrder(bucket),
        });
      });
    },

    /** Updates the activity; a changed day appends it to the end of the new bucket. */
    updateActivity(id: string, input: ActivityInput, tripDayId: string | undefined): Promise<void> {
      return repos.transaction(async () => {
        const activity = await repos.activities.update(id, {
          title: input.title,
          startTime: input.startTime,
          endTime: input.endTime,
          notes: input.notes,
        });
        if (activity.tripDayId !== tripDayId) {
          await moveEntryInTransaction({ kind: "activity", id }, tripDayId);
        }
      });
    },

    /** Deletes the activity (unlinking Bookings/Expenses that reference it). */
    deleteActivity(id: string): Promise<void> {
      return repos.transaction(async () => {
        const activity = await repos.activities.get(id);
        if (!activity) throw new EntityNotFoundError("Activity", id);
        await repos.activities.delete(id);
        await removeIfEmptyOutside(activity.tripDayId);
      });
    },

    /**
     * Moves an entry to position `index` (default: end) of a day or Unplanned
     * (`toTripDayId` undefined). Rewrites the affected buckets in one transaction.
     */
    moveEntry(ref: TimelineEntryRef, toTripDayId: string | undefined, index?: number): Promise<void> {
      // The scope must be an async function so Dexie keeps the transaction across awaits.
      return repos.transaction(async () => {
        await moveEntryInTransaction(ref, toTripDayId, index);
      });
    },

    /** Moves an entry one position up (-1) or down (+1) within its bucket. */
    shiftEntry(ref: TimelineEntryRef, offset: -1 | 1): Promise<void> {
      return repos.transaction(async () => {
        const entry = await getEntry(ref);
        const bucket = await listBucket(entry.item.tripId, entry.item.tripDayId);
        const from = bucket.findIndex((candidate) => isSameEntry(candidate, ref));
        const to = from + offset;
        if (to < 0 || to >= bucket.length) return;
        await writeBucket(moveWithin(bucket, from, to), entry.item.tripDayId);
      });
    },

    /** Explicit "sort by time": rewrites the day's order (see `sortEntriesByTime`). */
    sortDayByTime(tripDayId: string): Promise<void> {
      return repos.transaction(async () => {
        const day = await repos.tripDays.get(tripDayId);
        if (!day) throw new EntityNotFoundError("Trip day", tripDayId);
        const bucket = await listBucket(day.tripId, tripDayId);
        await writeBucket(sortEntriesByTime(bucket, day.date), tripDayId);
      });
    },

    /**
     * Appends all entries of a day, in their order, to another day or Unplanned.
     * An outside day left without user data is removed.
     */
    moveAllEntries(fromTripDayId: string, toTripDayId: string | undefined): Promise<void> {
      return repos.transaction(async () => {
        if (fromTripDayId === toTripDayId) return;
        const day = await repos.tripDays.get(fromTripDayId);
        if (!day) throw new EntityNotFoundError("Trip day", fromTripDayId);
        const source = await listBucket(day.tripId, fromTripDayId);
        const target = await listBucket(day.tripId, toTripDayId);
        await writeBucket([...target, ...source], toTripDayId);
        await removeIfEmptyOutside(fromTripDayId);
      });
    },

    /**
     * Explicitly deletes a day outside the trip dates together with its entries
     * (after the user confirmed the listed items). Days within the dates can't be deleted.
     */
    deleteOutsideDay(tripDayId: string): Promise<void> {
      return repos.transaction(async () => {
        const day = await repos.tripDays.get(tripDayId);
        if (!day) throw new EntityNotFoundError("Trip day", tripDayId);
        const trip = await repos.trips.get(day.tripId);
        if (trip && !isOutsideTripDates(day.date, trip)) throw new TripDayInRangeError();
        await repos.tripDays.delete(tripDayId, { deleteItems: true });
      });
    },
  };
}

export type ItineraryService = ReturnType<typeof createItineraryService>;

let service: ItineraryService | null = null;

/** Itinerary service bound to the app database (browser only). */
export function getItineraryService(): ItineraryService {
  service ??= createItineraryService(getRepositories());
  return service;
}
