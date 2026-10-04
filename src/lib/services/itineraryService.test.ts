import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TravelDatabase } from "@/lib/db/database";
import type { Trip } from "@/lib/domain/types";
import { createRepositories, type Repositories } from "@/lib/repositories";
import { createItineraryService, TripDayInRangeError, type ItineraryService } from "./itineraryService";
import { createTripService, type TripInput, type TripService } from "./tripService";

let db: TravelDatabase;
let repos: Repositories;
let itinerary: ItineraryService;
let trips: TripService;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T19:00:00.000Z"));
  db = new TravelDatabase(`itinerary-service-test-${crypto.randomUUID()}`);
  repos = createRepositories(db);
  itinerary = createItineraryService(repos);
  trips = createTripService(repos);
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

const tripInput: TripInput = {
  name: "Central Asia",
  countries: ["Uzbekistan"],
  startDate: "2026-06-12",
  endDate: "2026-06-14",
  status: "planned",
  baseCurrency: "CHF",
};

async function setup() {
  const trip = await trips.createTrip(tripInput);
  const days = await repos.tripDays.listByTrip(trip.id);
  return { trip, days };
}

async function load(tripId: string) {
  const result = await itinerary.getItinerary(tripId);
  if (!result) throw new Error("trip missing");
  return result;
}

/** Titles (activities) or ids (transports) of a day, in timeline order. */
async function dayTitles(tripId: string, date: string): Promise<string[]> {
  const { days, outsideDays } = await load(tripId);
  const day = [...days, ...outsideDays].find((timeline) => timeline.day.date === date);
  return day?.entries.map(entryLabel) ?? [];
}

async function unplannedTitles(tripId: string): Promise<string[]> {
  return (await load(tripId)).unplanned.map(entryLabel);
}

function entryLabel(entry: { kind: string; item: { id: string; title?: string } }): string {
  return entry.item.title ?? entry.item.id;
}

async function sortOrders(tripDayId: string | undefined, tripId: string): Promise<number[]> {
  const activities = await repos.activities.listByTrip(tripId);
  const transports = await repos.transports.listByTrip(tripId);
  return [...activities, ...transports]
    .filter((item) => item.tripDayId === tripDayId)
    .map((item) => item.sortOrder)
    .sort((a, b) => a - b);
}

async function add(trip: Trip, tripDayId: string | undefined, title: string, startTime?: string) {
  return itinerary.createActivity(trip.id, tripDayId, { title, startTime });
}

describe("getItinerary", () => {
  it("returns undefined for an unknown trip", async () => {
    expect(await itinerary.getItinerary("missing")).toBeUndefined();
  });

  it("lists persisted days chronologically with day numbers", async () => {
    const { trip } = await setup();
    const result = await load(trip.id);
    expect(result.days.map((day) => [day.day.date, day.dayNumber])).toEqual([
      ["2026-06-12", 1],
      ["2026-06-13", 2],
      ["2026-06-14", 3],
    ]);
    expect(result.outsideDays).toEqual([]);
    expect(result.unplanned).toEqual([]);
  });

  it("combines activities and transports in one timeline per day", async () => {
    const { trip, days } = await setup();
    await add(trip, days[0].id, "Museum");
    await repos.transports.create({ tripId: trip.id, tripDayId: days[0].id, type: "train", sortOrder: 1 });
    await add(trip, days[0].id, "Dinner");
    const [first] = (await load(trip.id)).days;
    expect(first.entries.map((entry) => [entry.kind, entry.item.sortOrder])).toEqual([
      ["activity", 0],
      ["transport", 1],
      ["activity", 2],
    ]);
  });
});

describe("ensureTripDays", () => {
  it("creates missing days in the trip range", async () => {
    const { trip, days } = await setup();
    await repos.tripDays.delete(days[1].id);
    await itinerary.ensureTripDays(trip.id);
    expect((await load(trip.id)).days.map((day) => day.day.date)).toEqual(["2026-06-12", "2026-06-13", "2026-06-14"]);
  });

  it("keeps outside days with user data and removes empty ones", async () => {
    const { trip, days } = await setup();
    await add(trip, days[0].id, "Arrival");
    await repos.tripDays.update(days[2].id, { title: "Bukhara" });
    // Change the range directly so that ensureTripDays has to resolve it.
    await repos.trips.update(trip.id, { startDate: "2026-06-13", endDate: "2026-06-13" });
    await itinerary.ensureTripDays(trip.id);
    const result = await load(trip.id);
    expect(result.days.map((day) => day.day.date)).toEqual(["2026-06-13"]);
    expect(result.outsideDays.map((day) => [day.day.date, day.dayNumber, day.outside])).toEqual([
      ["2026-06-12", null, true],
      ["2026-06-14", null, true],
    ]);
  });

  it("does not write when nothing is missing", async () => {
    const { trip, days } = await setup();
    await itinerary.ensureTripDays(trip.id);
    expect(await repos.tripDays.listByTrip(trip.id)).toEqual(days);
  });
});

describe("trip date changes", () => {
  it("creates days for an extended range and keeps entries on their days", async () => {
    const { trip, days } = await setup();
    await add(trip, days[1].id, "Registan");
    await trips.updateTrip(trip.id, { ...tripInput, endDate: "2026-06-16" }, { type: "keep" });
    const result = await load(trip.id);
    expect(result.days.map((day) => day.day.date)).toEqual([
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
      "2026-06-15",
      "2026-06-16",
    ]);
    expect(await dayTitles(trip.id, "2026-06-13")).toEqual(["Registan"]);
  });

  it("shows days with entries outside the new range instead of deleting them", async () => {
    const { trip, days } = await setup();
    await add(trip, days[2].id, "Old town");
    await trips.updateTrip(trip.id, { ...tripInput, endDate: "2026-06-13" }, { type: "keep" });
    const result = await load(trip.id);
    expect(result.days.map((day) => day.day.date)).toEqual(["2026-06-12", "2026-06-13"]);
    expect(result.outsideDays.map((day) => day.day.date)).toEqual(["2026-06-14"]);
    expect(await dayTitles(trip.id, "2026-06-14")).toEqual(["Old town"]);
  });

  it("brings an outside day back into the range when the dates include it again", async () => {
    const { trip, days } = await setup();
    await add(trip, days[2].id, "Old town");
    await trips.updateTrip(trip.id, { ...tripInput, endDate: "2026-06-13" }, { type: "keep" });
    await trips.updateTrip(trip.id, tripInput, { type: "keep" });
    const result = await load(trip.id);
    expect(result.outsideDays).toEqual([]);
    expect(result.days.find((day) => day.day.id === days[2].id)?.dayNumber).toBe(3);
  });
});

describe("activities", () => {
  it("appends new activities with and without times", async () => {
    const { trip, days } = await setup();
    await add(trip, days[0].id, "Breakfast", "08:00");
    const lunch = await add(trip, days[0].id, "Lunch somewhere");
    expect(lunch).toMatchObject({ tripDayId: days[0].id, sortOrder: 1 });
    expect(lunch.startTime).toBeUndefined();
    expect(await dayTitles(trip.id, "2026-06-12")).toEqual(["Breakfast", "Lunch somewhere"]);
  });

  it("appends after the highest sortOrder, including transports", async () => {
    const { trip, days } = await setup();
    await repos.transports.create({ tripId: trip.id, tripDayId: days[0].id, type: "bus", sortOrder: 5 });
    expect((await add(trip, days[0].id, "After bus")).sortOrder).toBe(6);
  });

  it("creates Unplanned activities", async () => {
    const { trip } = await setup();
    const idea = await add(trip, undefined, "Cooking class");
    expect(idea.tripDayId).toBeUndefined();
    expect(await unplannedTitles(trip.id)).toEqual(["Cooking class"]);
  });

  it("edits fields and clears optional values", async () => {
    const { trip, days } = await setup();
    const activity = await itinerary.createActivity(trip.id, days[0].id, {
      title: "Museum",
      startTime: "09:00",
      endTime: "11:00",
      notes: "Tickets online",
    });
    await itinerary.updateActivity(activity.id, { title: "History museum" }, days[0].id);
    const stored = await repos.activities.get(activity.id);
    expect(stored).toMatchObject({ title: "History museum", tripDayId: days[0].id, sortOrder: 0 });
    expect(stored?.startTime).toBeUndefined();
    expect(stored?.endTime).toBeUndefined();
    expect(stored?.notes).toBeUndefined();
  });

  it("moves an activity to the end of another day when its day changes", async () => {
    const { trip, days } = await setup();
    const museum = await add(trip, days[0].id, "Museum");
    await add(trip, days[0].id, "Market");
    await add(trip, days[1].id, "Train");
    await itinerary.updateActivity(museum.id, { title: "Museum" }, days[1].id);
    expect(await dayTitles(trip.id, "2026-06-12")).toEqual(["Market"]);
    expect(await dayTitles(trip.id, "2026-06-13")).toEqual(["Train", "Museum"]);
    expect(await sortOrders(days[0].id, trip.id)).toEqual([0]);
    expect(await sortOrders(days[1].id, trip.id)).toEqual([0, 1]);
  });

  it("deletes an activity and unlinks bookings and expenses", async () => {
    const { trip, days } = await setup();
    const activity = await add(trip, days[0].id, "Opera");
    const booking = await repos.bookings.create({
      tripId: trip.id,
      type: "activity",
      title: "Opera tickets",
      linkedEntity: { type: "activity", id: activity.id },
    });
    const expense = await repos.expenses.create({
      tripId: trip.id,
      title: "Opera",
      category: "activities",
      status: "paid",
      originalAmount: 40,
      originalCurrency: "CHF",
      exchangeRateToBase: 1,
      amountInBaseCurrency: 40,
      linkedEntity: { type: "activity", id: activity.id },
    });
    await itinerary.deleteActivity(activity.id);
    expect(await repos.activities.get(activity.id)).toBeUndefined();
    expect((await repos.bookings.get(booking.id))?.linkedEntity).toBeUndefined();
    expect((await repos.expenses.get(expense.id))?.linkedEntity).toBeUndefined();
  });

  it("rejects an activity for a day of another trip", async () => {
    const { trip } = await setup();
    const other = await trips.createTrip({ ...tripInput, name: "Other" });
    const [otherDay] = await repos.tripDays.listByTrip(other.id);
    await expect(add(trip, otherDay.id, "Wrong")).rejects.toThrow();
    expect(await repos.activities.listByTrip(trip.id)).toEqual([]);
  });
});

describe("reordering", () => {
  it("shifts entries up and down and rewrites consecutive sortOrders", async () => {
    const { trip, days } = await setup();
    const a = await add(trip, days[0].id, "A");
    await add(trip, days[0].id, "B");
    const c = await add(trip, days[0].id, "C");
    await itinerary.shiftEntry({ kind: "activity", id: c.id }, -1);
    expect(await dayTitles(trip.id, "2026-06-12")).toEqual(["A", "C", "B"]);
    await itinerary.shiftEntry({ kind: "activity", id: a.id }, 1);
    expect(await dayTitles(trip.id, "2026-06-12")).toEqual(["C", "A", "B"]);
    expect(await sortOrders(days[0].id, trip.id)).toEqual([0, 1, 2]);
  });

  it("ignores shifts beyond the ends", async () => {
    const { trip, days } = await setup();
    const a = await add(trip, days[0].id, "A");
    const b = await add(trip, days[0].id, "B");
    await itinerary.shiftEntry({ kind: "activity", id: a.id }, -1);
    await itinerary.shiftEntry({ kind: "activity", id: b.id }, 1);
    expect(await dayTitles(trip.id, "2026-06-12")).toEqual(["A", "B"]);
  });

  it("reorders activities and transports together", async () => {
    const { trip, days } = await setup();
    await add(trip, days[0].id, "Museum");
    const train = await repos.transports.create({ tripId: trip.id, tripDayId: days[0].id, type: "train", sortOrder: 1 });
    await itinerary.moveEntry({ kind: "transport", id: train.id }, days[0].id, 0);
    expect(await dayTitles(trip.id, "2026-06-12")).toEqual([train.id, "Museum"]);
  });

  it("normalizes gaps and duplicate sortOrders when reordering", async () => {
    const { trip, days } = await setup();
    const ids = [];
    for (const [title, sortOrder] of [["A", 10], ["B", 10], ["C", 40]] as const) {
      ids.push((await repos.activities.create({ tripId: trip.id, tripDayId: days[0].id, title, sortOrder })).id);
    }
    const before = await dayTitles(trip.id, "2026-06-12");
    const last = (await load(trip.id)).days[0].entries[2];
    await itinerary.moveEntry({ kind: "activity", id: last.item.id }, days[0].id, 0);
    expect(await dayTitles(trip.id, "2026-06-12")).toEqual([before[2], before[0], before[1]]);
    expect(await sortOrders(days[0].id, trip.id)).toEqual([0, 1, 2]);
  });

  it("preserves user-defined order regardless of times", async () => {
    const { trip, days } = await setup();
    await add(trip, days[0].id, "Evening", "20:00");
    await add(trip, days[0].id, "Morning", "08:00");
    await add(trip, days[0].id, "Untimed");
    expect(await dayTitles(trip.id, "2026-06-12")).toEqual(["Evening", "Morning", "Untimed"]);
  });
});

describe("moving between days and Unplanned", () => {
  it("moves an entry to a position in another day and renumbers both days", async () => {
    const { trip, days } = await setup();
    const a = await add(trip, days[0].id, "A");
    await add(trip, days[0].id, "B");
    await add(trip, days[1].id, "X");
    await add(trip, days[1].id, "Y");
    await itinerary.moveEntry({ kind: "activity", id: a.id }, days[1].id, 1);
    expect(await dayTitles(trip.id, "2026-06-12")).toEqual(["B"]);
    expect(await dayTitles(trip.id, "2026-06-13")).toEqual(["X", "A", "Y"]);
    expect(await sortOrders(days[0].id, trip.id)).toEqual([0]);
    expect(await sortOrders(days[1].id, trip.id)).toEqual([0, 1, 2]);
  });

  it("appends to the end by default", async () => {
    const { trip, days } = await setup();
    const a = await add(trip, days[0].id, "A");
    await add(trip, days[1].id, "X");
    await itinerary.moveEntry({ kind: "activity", id: a.id }, days[1].id);
    expect(await dayTitles(trip.id, "2026-06-13")).toEqual(["X", "A"]);
  });

  it("moves entries from a day to Unplanned and back", async () => {
    const { trip, days } = await setup();
    const a = await add(trip, days[0].id, "A");
    await add(trip, undefined, "Idea");
    await itinerary.moveEntry({ kind: "activity", id: a.id }, undefined);
    expect(await unplannedTitles(trip.id)).toEqual(["Idea", "A"]);
    expect((await repos.activities.get(a.id))?.tripDayId).toBeUndefined();
    expect(await sortOrders(undefined, trip.id)).toEqual([0, 1]);

    await itinerary.moveEntry({ kind: "activity", id: a.id }, days[2].id);
    expect(await unplannedTitles(trip.id)).toEqual(["Idea"]);
    expect(await dayTitles(trip.id, "2026-06-14")).toEqual(["A"]);
  });

  it("moves transports between buckets", async () => {
    const { trip, days } = await setup();
    const bus = await repos.transports.create({ tripId: trip.id, tripDayId: days[0].id, type: "bus", sortOrder: 0 });
    await itinerary.moveEntry({ kind: "transport", id: bus.id }, undefined);
    expect((await repos.transports.get(bus.id))?.tripDayId).toBeUndefined();
  });

  it("writes nothing when the move fails", async () => {
    const { trip, days } = await setup();
    const a = await add(trip, days[0].id, "A");
    await add(trip, days[0].id, "B");
    await expect(itinerary.moveEntry({ kind: "activity", id: a.id }, "missing-day")).rejects.toThrow();
    expect(await dayTitles(trip.id, "2026-06-12")).toEqual(["A", "B"]);
    expect((await repos.activities.get(a.id))?.tripDayId).toBe(days[0].id);
  });
});

describe("sort by time", () => {
  it("rewrites the day's order only when requested", async () => {
    const { trip, days } = await setup();
    await add(trip, days[0].id, "Dinner", "19:00");
    await add(trip, days[0].id, "Stroll");
    await add(trip, days[0].id, "Breakfast", "08:00");
    await add(trip, days[0].id, "Museum", "10:00");
    expect(await dayTitles(trip.id, "2026-06-12")).toEqual(["Dinner", "Stroll", "Breakfast", "Museum"]);

    await itinerary.sortDayByTime(days[0].id);
    expect(await dayTitles(trip.id, "2026-06-12")).toEqual(["Breakfast", "Museum", "Dinner", "Stroll"]);
    expect(await sortOrders(days[0].id, trip.id)).toEqual([0, 1, 2, 3]);
  });

  it("leaves other days untouched", async () => {
    const { trip, days } = await setup();
    await add(trip, days[0].id, "Late", "20:00");
    await add(trip, days[0].id, "Early", "07:00");
    await add(trip, days[1].id, "Late", "20:00");
    await add(trip, days[1].id, "Early", "07:00");
    await itinerary.sortDayByTime(days[0].id);
    expect(await dayTitles(trip.id, "2026-06-13")).toEqual(["Late", "Early"]);
  });
});

describe("days outside the trip dates", () => {
  async function setupOutside() {
    const { trip, days } = await setup();
    await add(trip, days[2].id, "Old town");
    await add(trip, days[2].id, "Hammam");
    await trips.updateTrip(trip.id, { ...tripInput, endDate: "2026-06-13" }, { type: "keep" });
    return { trip, days, outsideDay: days[2] };
  }

  it("moves all entries to another day and removes the then-empty outside day", async () => {
    const { trip, days, outsideDay } = await setupOutside();
    await add(trip, days[1].id, "Train");
    await itinerary.moveAllEntries(outsideDay.id, days[1].id);
    expect(await dayTitles(trip.id, "2026-06-13")).toEqual(["Train", "Old town", "Hammam"]);
    expect(await repos.tripDays.get(outsideDay.id)).toBeUndefined();
    expect((await load(trip.id)).outsideDays).toEqual([]);
  });

  it("moves all entries to Unplanned", async () => {
    const { trip, outsideDay } = await setupOutside();
    await itinerary.moveAllEntries(outsideDay.id, undefined);
    expect(await unplannedTitles(trip.id)).toEqual(["Old town", "Hammam"]);
    expect(await repos.tripDays.get(outsideDay.id)).toBeUndefined();
  });

  it("keeps an outside day that still has a title or notes", async () => {
    const { trip, days, outsideDay } = await setupOutside();
    await itinerary.updateDayDetails(outsideDay.id, { title: "Bukhara" });
    await itinerary.moveAllEntries(outsideDay.id, days[0].id);
    expect((await load(trip.id)).outsideDays.map((day) => day.day.title)).toEqual(["Bukhara"]);
  });

  it("removes the outside day after its last entry is moved away individually", async () => {
    const { trip, outsideDay } = await setupOutside();
    const entries = (await load(trip.id)).outsideDays[0].entries;
    await itinerary.moveEntry({ kind: "activity", id: entries[0].item.id }, undefined);
    expect(await repos.tripDays.get(outsideDay.id)).toBeDefined();
    await itinerary.moveEntry({ kind: "activity", id: entries[1].item.id }, undefined);
    expect(await repos.tripDays.get(outsideDay.id)).toBeUndefined();
    expect(await unplannedTitles(trip.id)).toEqual(["Old town", "Hammam"]);
  });

  it("removes the outside day after its last activity is deleted", async () => {
    const { trip, outsideDay } = await setupOutside();
    for (const entry of (await load(trip.id)).outsideDays[0].entries) await itinerary.deleteActivity(entry.item.id);
    expect(await repos.tripDays.get(outsideDay.id)).toBeUndefined();
  });

  it("deletes an outside day with its items only when explicitly requested", async () => {
    const { trip, outsideDay } = await setupOutside();
    await itinerary.deleteOutsideDay(outsideDay.id);
    expect(await repos.tripDays.get(outsideDay.id)).toBeUndefined();
    expect(await repos.activities.listByTrip(trip.id)).toEqual([]);
  });

  it("refuses to delete days within the trip dates", async () => {
    const { days } = await setupOutside();
    await expect(itinerary.deleteOutsideDay(days[0].id)).rejects.toBeInstanceOf(TripDayInRangeError);
    expect(await repos.tripDays.get(days[0].id)).toBeDefined();
  });

  it("never removes days within the trip dates when they become empty", async () => {
    const { trip, days } = await setup();
    const a = await add(trip, days[0].id, "A");
    await itinerary.updateDayDetails(days[0].id, { title: "Arrival" });
    await itinerary.moveEntry({ kind: "activity", id: a.id }, undefined);
    await itinerary.updateDayDetails(days[0].id, {});
    expect(await repos.tripDays.get(days[0].id)).toMatchObject({ date: "2026-06-12" });
  });
});

describe("day details", () => {
  it("sets and clears the title and notes", async () => {
    const { days } = await setup();
    await itinerary.updateDayDetails(days[0].id, { title: "Tashkent", notes: "Arrive 06:00" });
    expect(await repos.tripDays.get(days[0].id)).toMatchObject({ title: "Tashkent", notes: "Arrive 06:00" });
    await itinerary.updateDayDetails(days[0].id, { title: undefined, notes: undefined });
    const cleared = await repos.tripDays.get(days[0].id);
    expect(cleared?.title).toBeUndefined();
    expect(cleared?.notes).toBeUndefined();
  });
});
