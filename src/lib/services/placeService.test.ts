import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TravelDatabase } from "@/lib/db/database";
import { createRepositories, type Repositories } from "@/lib/repositories";
import { createItineraryService, type ItineraryService } from "./itineraryService";
import { createPlaceService, type PlaceInput, type PlaceService } from "./placeService";
import { createTripService } from "./tripService";

let db: TravelDatabase;
let repos: Repositories;
let places: PlaceService;
let itinerary: ItineraryService;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T19:00:00.000Z"));
  db = new TravelDatabase(`place-service-test-${crypto.randomUUID()}`);
  repos = createRepositories(db);
  places = createPlaceService(repos);
  itinerary = createItineraryService(repos);
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

const registan: PlaceInput = {
  name: "Registan",
  type: "attraction",
  address: "Samarkand",
  latitude: 39.6548,
  longitude: 66.9758,
  favorite: false,
  visited: false,
  externalRef: { provider: "photon", id: "R17141748" },
};

async function setup() {
  const trip = await createTripService(repos).createTrip({
    name: "Uzbekistan",
    countries: ["Uzbekistan"],
    startDate: "2026-06-12",
    endDate: "2026-06-14",
    status: "planned",
    baseCurrency: "CHF",
  });
  const days = await repos.tripDays.listByTrip(trip.id);
  return { trip, days };
}

describe("places", () => {
  it("stores search results in our own model with an informational external reference", async () => {
    const { trip } = await setup();
    const place = await places.createPlace(trip.id, registan);
    expect(await repos.places.get(place.id)).toMatchObject({ ...registan, tripId: trip.id });
  });

  it("stores manual places with a name only", async () => {
    const { trip } = await setup();
    const place = await places.createPlace(trip.id, { name: "Plov stall", type: "restaurant", favorite: false, visited: false });
    expect(place.latitude).toBeUndefined();
    expect(place.externalRef).toBeUndefined();
  });

  it("rejects incomplete coordinates and external references", async () => {
    const { trip } = await setup();
    await expect(places.createPlace(trip.id, { ...registan, longitude: undefined })).rejects.toThrow();
    await expect(places.createPlace(trip.id, { ...registan, externalRef: { provider: "", id: "1" } })).rejects.toThrow();
  });

  it("updates every field and clears removed optional values", async () => {
    const { trip } = await setup();
    const place = await places.createPlace(trip.id, { ...registan, website: "https://registan.uz/", notes: "Sunset" });
    await places.updatePlace(place.id, { name: "Registan Square", type: "attraction", favorite: true, visited: false });
    const stored = await repos.places.get(place.id);
    expect(stored).toMatchObject({ name: "Registan Square", favorite: true });
    for (const field of ["address", "latitude", "longitude", "website", "notes", "externalRef"]) {
      expect(stored).not.toHaveProperty(field);
    }
  });

  it("sets and removes the location", async () => {
    const { trip } = await setup();
    const place = await places.createPlace(trip.id, { name: "Viewpoint", type: "attraction", favorite: false, visited: false });
    await places.setPlaceLocation(place.id, { latitude: 39.66, longitude: 66.98 });
    expect(await repos.places.get(place.id)).toMatchObject({ latitude: 39.66, longitude: 66.98 });
    await places.setPlaceLocation(place.id, undefined);
    expect(await repos.places.get(place.id)).not.toHaveProperty("latitude");
    await expect(places.setPlaceLocation(place.id, { latitude: 95, longitude: 0 })).rejects.toThrow();
  });

  it("toggles favorite and visited", async () => {
    const { trip } = await setup();
    const place = await places.createPlace(trip.id, registan);
    await places.setFavorite(place.id, true);
    await places.setVisited(place.id, true);
    expect(await repos.places.get(place.id)).toMatchObject({ favorite: true, visited: true });
  });
});

describe("planned status and usage", () => {
  it("derives planned from activities assigned to a day", async () => {
    const { trip, days } = await setup();
    const place = await places.createPlace(trip.id, registan);
    expect((await places.listPlaces(trip.id))?.places[0].planned).toBe(false);

    await itinerary.createActivity(trip.id, undefined, { title: "Maybe Registan", placeId: place.id });
    expect((await places.listPlaces(trip.id))?.places[0].planned).toBe(false);

    await places.addPlaceToDay(place.id, days[1].id);
    const summary = (await places.listPlaces(trip.id))?.places[0];
    expect(summary?.planned).toBe(true);
    expect(summary?.usages.map((usage) => [usage.activity.title, usage.dayNumber])).toEqual([
      ["Registan", 2],
      ["Maybe Registan", null],
    ]);
  });

  it("lists places by name and returns one place with its usage", async () => {
    const { trip } = await setup();
    await places.createPlace(trip.id, { ...registan, name: "shah-i-Zinda" });
    const ark = await places.createPlace(trip.id, { ...registan, name: "Ark" });
    expect((await places.listPlaces(trip.id))?.places.map((item) => item.place.name)).toEqual(["Ark", "shah-i-Zinda"]);
    expect((await places.getPlace(trip.id, ark.id))?.summary.place.name).toBe("Ark");
    expect(await places.getPlace(trip.id, "missing")).toBeUndefined();
    expect(await places.listPlaces("missing")).toBeUndefined();
  });
});

describe("places of the day in summaries", () => {
  it("lists day stops chronologically and counts them as planned", async () => {
    const { trip, days } = await setup();
    const place = await places.createPlace(trip.id, registan);
    await itinerary.setDayPlaces(days[2].id, [place.id]);
    await itinerary.setDayPlaces(days[0].id, [place.id]);
    const summary = (await places.getPlace(trip.id, place.id))?.summary;
    expect(summary?.planned).toBe(true);
    expect(summary?.usages).toEqual([]);
    expect(summary?.dayStops.map((stop) => stop.dayNumber)).toEqual([1, 3]);
  });
});

describe("adding places to days", () => {
  it("creates an activity named after the place at the end of the day", async () => {
    const { trip, days } = await setup();
    await itinerary.createActivity(trip.id, days[0].id, { title: "Breakfast" });
    const place = await places.createPlace(trip.id, registan);
    const activity = await places.addPlaceToDay(place.id, days[0].id);
    expect(activity).toMatchObject({ title: "Registan", placeId: place.id, tripDayId: days[0].id, sortOrder: 1 });
  });

  it("allows one place in several activities", async () => {
    const { trip, days } = await setup();
    const place = await places.createPlace(trip.id, registan);
    await places.addPlaceToDay(place.id, days[0].id);
    await places.addPlaceToDay(place.id, days[2].id);
    expect((await places.getPlace(trip.id, place.id))?.summary.usages).toHaveLength(2);
  });
});

describe("deleting", () => {
  it("unlinks activities, which keep their title", async () => {
    const { trip, days } = await setup();
    const place = await places.createPlace(trip.id, registan);
    const activity = await itinerary.createActivity(trip.id, days[0].id, { title: "Light show", placeId: place.id });
    await places.deletePlace(place.id);
    const stored = await repos.activities.get(activity.id);
    expect(stored).toMatchObject({ title: "Light show", tripDayId: days[0].id });
    expect(stored).not.toHaveProperty("placeId");
  });

  it("never deletes the place when its activity is deleted", async () => {
    const { trip, days } = await setup();
    const place = await places.createPlace(trip.id, registan);
    const activity = await places.addPlaceToDay(place.id, days[0].id);
    await itinerary.deleteActivity(activity.id);
    expect(await repos.places.get(place.id)).toBeDefined();
  });
});
