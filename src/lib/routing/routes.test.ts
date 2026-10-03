import { describe, expect, it } from "vitest";
import {
  PRECACHED_PAGE_PATHS,
  ROUTE_TEMPLATE_ID,
  TRIP_SECTIONS,
  appRoutePath,
  parseAppRoute,
  templatePathFor,
  tripSectionOf,
} from "./routes";

const tripId = "4f1c2b7e-9a3d-4e5f-8b6a-1c2d3e4f5a6b";

describe("parseAppRoute", () => {
  it("parses global routes", () => {
    expect(parseAppRoute("/")).toEqual({ name: "trips" });
    expect(parseAppRoute("/settings")).toEqual({ name: "settings" });
    expect(parseAppRoute("/settings/")).toEqual({ name: "settings" });
  });

  it("reads the trip ID from the URL", () => {
    expect(parseAppRoute(`/trips/${tripId}`)).toEqual({ name: "trip-overview", tripId });
    for (const section of TRIP_SECTIONS) {
      expect(parseAppRoute(`/trips/${tripId}/${section}`)).toEqual({
        name: "trip-section",
        tripId,
        section,
      });
    }
  });

  it("reads nested day and place IDs", () => {
    expect(parseAppRoute(`/trips/${tripId}/plan/day-1`)).toEqual({
      name: "trip-day",
      tripId,
      dayId: "day-1",
    });
    expect(parseAppRoute(`/trips/${tripId}/places/place-1`)).toEqual({
      name: "trip-place",
      tripId,
      placeId: "place-1",
    });
  });

  it("decodes encoded segments", () => {
    expect(parseAppRoute("/trips/a%20b")).toEqual({ name: "trip-overview", tripId: "a b" });
  });

  it("rejects unknown or malformed paths", () => {
    expect(parseAppRoute("/trips")).toBeNull();
    expect(parseAppRoute(`/trips/${tripId}/unknown`)).toBeNull();
    expect(parseAppRoute(`/trips/${tripId}/map/extra`)).toBeNull();
    expect(parseAppRoute(`/trips/${tripId}/plan/day/extra`)).toBeNull();
    expect(parseAppRoute("/trips/%E0%A4%A")).toBeNull();
    expect(parseAppRoute("/other")).toBeNull();
  });
});

describe("appRoutePath", () => {
  it("round-trips through parseAppRoute", () => {
    const routes = [
      { name: "trips" },
      { name: "settings" },
      { name: "trip-overview", tripId },
      { name: "trip-section", tripId, section: "budget" },
      { name: "trip-day", tripId, dayId: "d 1" },
      { name: "trip-place", tripId, placeId: "p/1" },
    ] as const;
    for (const route of routes) {
      expect(parseAppRoute(appRoutePath(route))).toEqual(route);
    }
  });
});

describe("tripSectionOf", () => {
  it("maps nested routes to their section", () => {
    expect(tripSectionOf({ name: "trip-day", tripId, dayId: "d" })).toBe("plan");
    expect(tripSectionOf({ name: "trip-place", tripId, placeId: "p" })).toBe("places");
    expect(tripSectionOf({ name: "trip-overview", tripId })).toBeNull();
  });
});

describe("templatePathFor", () => {
  it("maps any trip ID to the section template", () => {
    expect(templatePathFor(`/trips/${tripId}/plan`)).toBe(`/trips/${ROUTE_TEMPLATE_ID}/plan`);
    expect(templatePathFor(`/trips/${tripId}`)).toBe(`/trips/${ROUTE_TEMPLATE_ID}`);
    expect(templatePathFor(`/trips/${tripId}/places/x`)).toBe(
      `/trips/${ROUTE_TEMPLATE_ID}/places/${ROUTE_TEMPLATE_ID}`,
    );
    expect(templatePathFor("/settings")).toBe("/settings");
    expect(templatePathFor("/unknown")).toBeNull();
  });

  it("only returns precached pages", () => {
    const samples = [
      "/",
      "/settings",
      `/trips/${tripId}`,
      ...TRIP_SECTIONS.map((section) => `/trips/${tripId}/${section}`),
      `/trips/${tripId}/plan/day`,
      `/trips/${tripId}/places/place`,
    ];
    for (const pathname of samples) {
      expect(PRECACHED_PAGE_PATHS).toContain(templatePathFor(pathname));
    }
  });
});
