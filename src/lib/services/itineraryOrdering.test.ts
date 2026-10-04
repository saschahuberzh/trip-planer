import { describe, expect, it } from "vitest";
import type { Activity, Transport } from "@/lib/domain/types";
import {
  isSortedByTime,
  moveWithin,
  nextSortOrder,
  sortEntriesByTime,
  sortTimeline,
  type TimelineEntry,
} from "./itineraryOrdering";

const meta = { createdAt: "2026-10-03T19:00:00.000Z", updatedAt: "2026-10-03T19:00:00.000Z" };

function activity(id: string, sortOrder: number, times: Partial<Pick<Activity, "startTime" | "endTime">> = {}): TimelineEntry {
  return { kind: "activity", item: { id, tripId: "t", tripDayId: "d", title: id, sortOrder, ...times, ...meta } };
}

function transport(id: string, sortOrder: number, departure?: string): TimelineEntry {
  const item: Transport = { id, tripId: "t", tripDayId: "d", type: "train", sortOrder, ...meta };
  if (departure) item.departure = { local: departure, timeZone: "Asia/Tashkent" };
  return { kind: "transport", item };
}

const ids = (entries: TimelineEntry[]) => entries.map((entry) => entry.item.id);

describe("sortTimeline", () => {
  it("orders activities and transports in one sortOrder space, ties broken by id", () => {
    const entries = [activity("b", 1), transport("t", 0), activity("a", 1), activity("c", 2)];
    expect(ids(sortTimeline(entries))).toEqual(["t", "a", "b", "c"]);
  });

  it("does not reorder by time", () => {
    const entries = [activity("late", 0, { startTime: "18:00" }), activity("early", 1, { startTime: "08:00" })];
    expect(ids(sortTimeline(entries))).toEqual(["late", "early"]);
  });
});

describe("nextSortOrder", () => {
  it("appends after the highest sortOrder of both entry types", () => {
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder([activity("a", 3), transport("t", 7)])).toBe(8);
  });
});

describe("moveWithin", () => {
  it("moves an item and clamps the target index", () => {
    expect(moveWithin(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveWithin(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveWithin(["a", "b", "c"], 1, 99)).toEqual(["a", "c", "b"]);
  });
});

describe("sortEntriesByTime", () => {
  const date = "2026-06-12";

  it("orders timed entries by start time, then end time", () => {
    const entries = [
      activity("lunch", 0, { startTime: "12:00" }),
      activity("museum-long", 1, { startTime: "09:00", endTime: "12:00" }),
      activity("museum-short", 2, { startTime: "09:00", endTime: "10:00" }),
    ];
    expect(ids(sortEntriesByTime(entries, date))).toEqual(["museum-short", "museum-long", "lunch"]);
  });

  it("keeps untimed entries after the entry they follow", () => {
    const entries = [
      activity("dinner", 0, { startTime: "19:00" }),
      activity("walk-after-dinner", 1),
      activity("breakfast", 2, { startTime: "08:00" }),
      activity("coffee-after-breakfast", 3),
    ];
    expect(ids(sortEntriesByTime(entries, date))).toEqual([
      "breakfast",
      "coffee-after-breakfast",
      "dinner",
      "walk-after-dinner",
    ]);
  });

  it("keeps untimed entries at the top of the day at the top", () => {
    const entries = [activity("idea", 0), activity("b", 1, { startTime: "10:00" }), activity("a", 2, { startTime: "09:00" })];
    expect(ids(sortEntriesByTime(entries, date))).toEqual(["idea", "a", "b"]);
  });

  it("keeps the current order for equal times", () => {
    const entries = [activity("x", 0, { startTime: "10:00" }), activity("y", 1, { startTime: "10:00" })];
    expect(ids(sortEntriesByTime(entries, date))).toEqual(["x", "y"]);
  });

  it("sorts transports by local departure together with activities", () => {
    const entries = [
      activity("dinner", 0, { startTime: "19:00" }),
      transport("train", 1, `${date}T08:15`),
      transport("night-bus", 2, "2026-06-11T23:30"),
      transport("unknown-time", 3),
    ];
    expect(ids(sortEntriesByTime(entries, date))).toEqual(["night-bus", "unknown-time", "train", "dinner"]);
  });

  it("reports whether the order is already sorted", () => {
    const sorted = [activity("a", 0, { startTime: "08:00" }), activity("b", 1)];
    expect(isSortedByTime(sorted, date)).toBe(true);
    expect(isSortedByTime([...sorted].reverse(), date)).toBe(true);
    expect(
      isSortedByTime([activity("a", 0, { startTime: "10:00" }), activity("b", 1, { startTime: "09:00" })], date),
    ).toBe(false);
  });
});
