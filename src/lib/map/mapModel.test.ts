import { describe, expect, it } from "vitest";
import type { Activity, Place, Transport, Trip, TripDay } from "@/lib/domain/types";
import type { TimelineEntry } from "@/lib/services/itineraryOrdering";
import type { DayTimeline, Itinerary } from "@/lib/services/itineraryService";
import { allPlacesModel, boundsOf, dayModel, formatDayRanges, placeDayNumbers, routeModel } from "./mapModel";

const meta = { createdAt: "2026-10-03T19:00:00.000Z", updatedAt: "2026-10-03T19:00:00.000Z" };

function place(id: string, coordinates?: [number, number], type: Place["type"] = "city"): Place {
  return {
    id,
    tripId: "t",
    name: id,
    type,
    favorite: false,
    visited: false,
    ...(coordinates ? { latitude: coordinates[0], longitude: coordinates[1] } : {}),
    ...meta,
  };
}

function activity(id: string, placeId: string | undefined, sortOrder: number): TimelineEntry {
  const item: Activity = { id, tripId: "t", tripDayId: "d", title: id, sortOrder, ...meta };
  if (placeId) item.placeId = placeId;
  return { kind: "activity", item };
}

function transport(id: string, from: string | undefined, to: string | undefined, type: Transport["type"] = "train"): TimelineEntry {
  const item: Transport = { id, tripId: "t", tripDayId: "d", type, sortOrder: 0, ...meta };
  if (from) item.originPlaceId = from;
  if (to) item.destinationPlaceId = to;
  return { kind: "transport", item };
}

function day(n: number, placeIds?: string[], entries: TimelineEntry[] = [], outside = false): DayTimeline {
  const tripDay: TripDay = { id: `d${n}`, tripId: "t", date: `2026-06-${String(10 + n).padStart(2, "0")}`, ...meta };
  if (placeIds) tripDay.placeIds = placeIds;
  return { day: tripDay, dayNumber: outside ? null : n, outside, entries };
}

const places = [
  place("Tashkent", [41.3, 69.2]),
  place("Samarkand", [39.65, 66.97]),
  place("Bukhara", [39.77, 64.42]),
  place("Registan", [39.654, 66.975], "attraction"),
  place("Secret", undefined, "attraction"),
  place("Cafe", [39.66, 66.96], "restaurant"),
];

function itinerary(days: DayTimeline[], outsideDays: DayTimeline[] = []): Itinerary {
  return {
    trip: {
      id: "t",
      name: "Trip",
      countries: [],
      startDate: "2026-06-11",
      endDate: "2026-06-17",
      status: "planned",
      baseCurrency: "CHF",
      ...meta,
    } satisfies Trip,
    days,
    outsideDays,
    unplanned: [],
    places: new Map(places.map((p) => [p.id, p])),
  };
}

const ids = (items: { place: Place }[]) => items.map((item) => item.place.id);

describe("routeModel", () => {
  it("numbers places of the day chronologically and merges consecutive days at the same place", () => {
    const model = routeModel(
      itinerary([
        day(1, ["Tashkent"]),
        day(2, ["Tashkent"]),
        day(3, ["Tashkent", "Samarkand"]),
        day(4, ["Samarkand"]),
        day(5),
        day(6, ["Bukhara"]),
        day(7, ["Tashkent"]),
      ]),
    );
    expect(model.stops.map((stop) => [stop.number, stop.place.id, stop.dayNumbers])).toEqual([
      [1, "Tashkent", [1, 2, 3]],
      [2, "Samarkand", [3, 4]],
      [3, "Bukhara", [6]],
      [4, "Tashkent", [7]],
    ]);
    expect(model.segments).toHaveLength(3);
    expect(model.segments.every((segment) => segment.transport === undefined)).toBe(true);
    // One marker per place, with all its stop numbers.
    expect(model.markers.map((marker) => [marker.placeId, marker.label])).toEqual([
      ["Tashkent", "1, 4"],
      ["Samarkand", "2"],
      ["Bukhara", "3"],
    ]);
  });

  it("skips places without coordinates and lists them as not on map", () => {
    const model = routeModel(itinerary([day(1, ["Tashkent"]), day(2, ["Secret"]), day(3, ["Tashkent"])]));
    expect(ids(model.stops)).toEqual(["Tashkent"]);
    expect(model.stops[0].dayNumbers).toEqual([1, 3]);
    expect(model.unlocated.map((p) => p.id)).toEqual(["Secret"]);
  });

  it("ignores days outside the trip dates and is empty without places of the day", () => {
    expect(routeModel(itinerary([day(1)], [day(9, ["Bukhara"], [], true)]))).toEqual({
      markers: [],
      segments: [],
      stops: [],
      unlocated: [],
    });
  });
});

describe("dayModel", () => {
  it("orders places of the day first, then activity places in timeline order", () => {
    const model = dayModel(
      itinerary([
        day(2, ["Samarkand"], [activity("a1", "Registan", 0), activity("a2", undefined, 1), activity("a3", "Cafe", 2), activity("a4", "Secret", 3)]),
      ]),
      "d2",
    );
    expect(model.stops.map((stop) => [stop.number, stop.place.id])).toEqual([
      [1, "Samarkand"],
      [2, "Registan"],
      [3, "Cafe"],
    ]);
    expect(model.unlocated.map((p) => p.id)).toEqual(["Secret"]);
    expect(model.segments).toHaveLength(2);
  });

  it("merges a directly repeated place but keeps later revisits", () => {
    const model = dayModel(
      itinerary([day(1, ["Samarkand"], [activity("a", "Samarkand", 0), activity("b", "Registan", 1), activity("c", "Samarkand", 2)])]),
      "d1",
    );
    expect(model.stops.map((stop) => stop.place.id)).toEqual(["Samarkand", "Registan", "Samarkand"]);
    expect(model.markers.find((marker) => marker.placeId === "Samarkand")?.label).toBe("1, 3");
  });

  it("supports days outside the trip dates and unknown days", () => {
    const outside = itinerary([], [day(9, ["Bukhara"], [], true)]);
    expect(ids(dayModel(outside, "d9").stops)).toEqual(["Bukhara"]);
    expect(dayModel(outside, "missing").markers).toEqual([]);
  });
});

describe("allPlacesModel", () => {
  const trip = itinerary([
    day(1, ["Tashkent"]),
    day(2, ["Samarkand"], [activity("a", "Registan", 0)]),
    day(3, ["Samarkand"], [activity("b", "Registan", 0)]),
  ]);

  it("labels places with their days and marks unplanned places", () => {
    const markers = allPlacesModel(trip).markers.map((marker) => [marker.placeId, marker.label, marker.tone]);
    expect(markers).toEqual([
      ["Bukhara", "", "unplanned"],
      ["Cafe", "", "unplanned"],
      ["Registan", "2–3", "planned"],
      ["Samarkand", "2–3", "planned"],
      ["Tashkent", "1", "planned"],
    ]);
    expect(allPlacesModel(trip).unlocated.map((p) => p.id)).toEqual(["Secret"]);
    expect(allPlacesModel(trip).segments).toEqual([]);
  });

  it("filters by day and category", () => {
    expect(allPlacesModel(trip, { tripDayId: "d2" }).markers.map((m) => m.placeId)).toEqual(["Registan", "Samarkand"]);
    expect(allPlacesModel(trip, { type: "attraction" }).markers.map((m) => m.placeId)).toEqual(["Registan"]);
    expect(allPlacesModel(trip, { type: "attraction" }).unlocated.map((p) => p.id)).toEqual(["Secret"]);
  });

  it("collects day numbers per place", () => {
    expect(placeDayNumbers(trip).get("Registan")).toEqual([2, 3]);
  });
});

describe("helpers", () => {
  it("formats day ranges", () => {
    expect(formatDayRanges([5, 1, 2, 3, 3])).toBe("1–3, 5");
    expect(formatDayRanges([])).toBe("");
  });

  it("computes bounds", () => {
    expect(boundsOf([])).toBeUndefined();
    expect(
      boundsOf([
        { latitude: 41.3, longitude: 69.2 },
        { latitude: 39.6, longitude: 64.4 },
      ]),
    ).toEqual({ southWest: { latitude: 39.6, longitude: 64.4 }, northEast: { latitude: 41.3, longitude: 69.2 } });
  });
});

describe("transport connections", () => {
  it("labels route segments that a transport connects on a day between the stops", () => {
    const model = routeModel(
      itinerary([
        day(1, ["Tashkent"]),
        day(2, ["Tashkent", "Samarkand"], [transport("train", "Tashkent", "Samarkand")]),
        day(3, ["Samarkand"]),
        day(4, ["Bukhara"]),
      ]),
    );
    expect(model.segments.map((segment) => segment.transport)).toEqual([{ id: "train", type: "train" }, undefined]);
  });

  it("ignores transports in the wrong direction or on unrelated days", () => {
    const model = routeModel(
      itinerary([
        day(1, ["Tashkent"], [transport("back", "Samarkand", "Tashkent")]),
        day(2, ["Samarkand"]),
        day(3, ["Bukhara"]),
        day(4, ["Bukhara"], [transport("late", "Samarkand", "Bukhara", "bus")]),
      ]),
    );
    expect(model.segments.map((segment) => segment.transport)).toEqual([undefined, undefined]);
  });

  it("puts transport origin and destination into the day sequence at their timeline position", () => {
    const model = dayModel(
      itinerary([
        day(2, ["Tashkent", "Samarkand"], [
          activity("breakfast", "Cafe", 0),
          transport("flight", "Tashkent", "Samarkand", "flight"),
          activity("sights", "Registan", 2),
        ]),
      ]),
      "d2",
    );
    // Tashkent is covered by the timeline only after Cafe, so it isn't put in front.
    expect(model.stops.map((stop) => stop.place.id)).toEqual(["Cafe", "Tashkent", "Samarkand", "Registan"]);
    expect(model.segments.map((segment) => segment.transport?.type)).toEqual([undefined, "flight", undefined]);
  });

  it("puts uncovered places of the day in front of the timeline", () => {
    const model = dayModel(itinerary([day(3, ["Tashkent", "Samarkand"], [activity("a", "Registan", 0)])]), "d3");
    expect(model.stops.map((stop) => stop.place.id)).toEqual(["Tashkent", "Samarkand", "Registan"]);
  });

  it("does not label a segment when the transport's origin has no position", () => {
    const model = dayModel(itinerary([day(1, [], [transport("bus", "Secret", "Samarkand", "bus")])]), "d1");
    expect(model.stops.map((stop) => stop.place.id)).toEqual(["Samarkand"]);
    expect(model.segments).toEqual([]);
    expect(model.unlocated.map((place) => place.id)).toEqual(["Secret"]);
  });
});
