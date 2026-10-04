import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/domain/types";
import { filterPlaces, findSimilarPlaces, normalizeName, placesCenter, sortPlacesByName } from "./placeFilters";

function place(id: string, name: string, extra: Partial<Place> = {}): Place {
  return {
    id,
    tripId: "t",
    name,
    type: "attraction",
    favorite: false,
    visited: false,
    createdAt: "2026-10-03T19:00:00.000Z",
    updatedAt: "2026-10-03T19:00:00.000Z",
    ...extra,
  };
}

const items = [
  { place: place("1", "Registan", { favorite: true, address: "Samarkand" }), planned: true },
  { place: place("2", "Chorsu Bazaar", { type: "custom", visited: true, address: "Tashkent" }), planned: false },
  { place: place("3", "Shah-i-Zinda", { notes: "Blue tiles" }), planned: false },
];
const ids = (list: { place: Place }[]) => list.map((item) => item.place.id);
const all = { query: "", status: "all", type: undefined } as const;

describe("filterPlaces", () => {
  it("filters by status", () => {
    expect(ids(filterPlaces(items, { ...all, status: "favorites" }))).toEqual(["1"]);
    expect(ids(filterPlaces(items, { ...all, status: "planned" }))).toEqual(["1"]);
    expect(ids(filterPlaces(items, { ...all, status: "unplanned" }))).toEqual(["2", "3"]);
    expect(ids(filterPlaces(items, { ...all, status: "visited" }))).toEqual(["2"]);
    expect(ids(filterPlaces(items, { ...all, status: "unvisited" }))).toEqual(["1", "3"]);
  });

  it("filters by type and combines filters", () => {
    expect(ids(filterPlaces(items, { ...all, type: "custom" }))).toEqual(["2"]);
    expect(ids(filterPlaces(items, { ...all, type: "attraction", status: "unplanned" }))).toEqual(["3"]);
  });

  it("searches name, address and notes ignoring case, accents and punctuation", () => {
    expect(ids(filterPlaces(items, { ...all, query: "samar" }))).toEqual(["1"]);
    expect(ids(filterPlaces(items, { ...all, query: "shah i" }))).toEqual(["3"]);
    expect(ids(filterPlaces(items, { ...all, query: "TILES" }))).toEqual(["3"]);
    expect(ids(filterPlaces(items, { ...all, query: "chörsu tashkent" }))).toEqual(["2"]);
  });
});

describe("sortPlacesByName", () => {
  it("sorts case-insensitively", () => {
    expect(ids(sortPlacesByName([items[2], { place: place("4", "ark"), planned: false }, items[0]]))).toEqual(["4", "1", "3"]);
  });
});

describe("findSimilarPlaces", () => {
  const places = [
    place("1", "Registan Square"),
    place("2", "Bibi-Khanym Mosque", { externalRef: { provider: "photon", id: "W7" } }),
    place("3", "Ark"),
  ];
  it("finds matching names and provider IDs", () => {
    expect(findSimilarPlaces(places, { name: "registan" }).map((p) => p.id)).toEqual(["1"]);
    expect(findSimilarPlaces(places, { name: "Bibi Khanym mosque" }).map((p) => p.id)).toEqual(["2"]);
    expect(findSimilarPlaces(places, { name: "Something", externalRef: { provider: "photon", id: "W7" } }).map((p) => p.id)).toEqual(["2"]);
  });
  it("ignores short fragments and the place being edited", () => {
    expect(findSimilarPlaces(places, { name: "Ar" })).toEqual([]);
    expect(findSimilarPlaces(places, { name: "Ark" }, "3")).toEqual([]);
    expect(findSimilarPlaces(places, { name: "Market" })).toEqual([]);
  });
});

describe("placesCenter / normalizeName", () => {
  it("averages located places only", () => {
    expect(placesCenter([place("1", "a", { latitude: 40, longitude: 60 }), place("2", "b", { latitude: 42, longitude: 70 }), place("3", "c")])).toEqual({
      latitude: 41,
      longitude: 65,
    });
    expect(placesCenter([place("1", "a")])).toBeUndefined();
  });
  it("normalizes names", () => {
    expect(normalizeName("  Shāh-i-Zinda ")).toBe("shah i zinda");
  });
});
