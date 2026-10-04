import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TravelDatabase } from "@/lib/db/database";
import type { Booking } from "@/lib/domain/types";
import { createRepositories, type Repositories } from "@/lib/repositories";
import { createAccommodationService, type AccommodationService } from "./accommodationService";
import { createBookingService, groupBookings, type BookingService } from "./bookingService";
import { createItineraryService } from "./itineraryService";
import { createTripService } from "./tripService";

let db: TravelDatabase;
let repos: Repositories;
let stays: AccommodationService;
let bookings: BookingService;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T19:00:00.000Z"));
  db = new TravelDatabase(`stay-booking-test-${crypto.randomUUID()}`);
  repos = createRepositories(db);
  stays = createAccommodationService(repos);
  bookings = createBookingService(repos);
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

async function setup() {
  return createTripService(repos).createTrip({
    name: "Uzbekistan",
    countries: [],
    startDate: "2026-06-12",
    endDate: "2026-06-16",
    status: "planned",
    baseCurrency: "CHF",
  });
}

const hotel = { name: "Hotel Uzbekistan", checkInDate: "2026-06-12", checkOutDate: "2026-06-14" };

describe("accommodations", () => {
  it("lists chronologically and appears in the itinerary", async () => {
    const trip = await setup();
    await stays.createAccommodation(trip.id, { ...hotel, name: "Later", checkInDate: "2026-06-14", checkOutDate: "2026-06-16" });
    await stays.createAccommodation(trip.id, hotel);
    expect((await stays.listAccommodations(trip.id)).map((a) => a.name)).toEqual(["Hotel Uzbekistan", "Later"]);
    const itinerary = await createItineraryService(repos).getItinerary(trip.id);
    expect(itinerary?.accommodations.map((a) => a.name)).toEqual(["Hotel Uzbekistan", "Later"]);
  });

  it("uses a place as location, never both place and own fields", async () => {
    const trip = await setup();
    const place = await repos.places.create({ tripId: trip.id, name: "Hotel", type: "hotel", favorite: false, visited: false });
    const linked = await stays.createAccommodation(trip.id, { ...hotel, placeId: place.id });
    await expect(stays.updateAccommodation(linked.id, { ...hotel, placeId: place.id, address: "X" })).rejects.toThrow();
    const own = await stays.updateAccommodation(linked.id, { ...hotel, address: "Amir Temur 1", latitude: 41.3, longitude: 69.2 });
    expect(own).not.toHaveProperty("placeId");
    expect(own).toMatchObject({ address: "Amir Temur 1" });
  });

  it("keeps the location when its place is deleted", async () => {
    const trip = await setup();
    const place = await repos.places.create({ tripId: trip.id, name: "Hotel", type: "hotel", address: "Amir Temur 1", latitude: 41.3, longitude: 69.2, favorite: false, visited: false });
    const linked = await stays.createAccommodation(trip.id, { ...hotel, placeId: place.id });
    await repos.places.delete(place.id);
    expect(await repos.accommodations.get(linked.id)).toMatchObject({ address: "Amir Temur 1", latitude: 41.3, longitude: 69.2 });
  });

  it("deletes an accommodation and keeps linked bookings without the link", async () => {
    const trip = await setup();
    const stay = await stays.createAccommodation(trip.id, hotel);
    const booking = await bookings.createBooking(trip.id, { type: "accommodation", title: "Booking.com", linkedEntity: { type: "accommodation", id: stay.id } });
    expect((await stays.getLinks(stay.id, trip.id)).bookings.map((b) => b.id)).toEqual([booking.id]);
    await stays.deleteAccommodation(stay.id);
    expect(await repos.bookings.get(booking.id)).not.toHaveProperty("linkedEntity");
  });
});

describe("bookings", () => {
  it("creates, edits (clearing fields) and deletes bookings", async () => {
    const trip = await setup();
    const booking = await bookings.createBooking(trip.id, { type: "other", title: "Opera", url: "https://opera.uz/", bookingReference: "X1" });
    await bookings.updateBooking(booking.id, { type: "activity", title: "Opera night" });
    const stored = await repos.bookings.get(booking.id);
    expect(stored).toMatchObject({ type: "activity", title: "Opera night" });
    expect(stored).not.toHaveProperty("url");
    expect(stored).not.toHaveProperty("bookingReference");
    await bookings.deleteBooking(booking.id);
    expect(await repos.bookings.get(booking.id)).toBeUndefined();
  });

  it("links to a transport and is unlinked when the transport is deleted", async () => {
    const trip = await setup();
    const days = await repos.tripDays.listByTrip(trip.id);
    const itinerary = createItineraryService(repos);
    const { transport } = await itinerary.createTransport(trip.id, days[1].id, { type: "train" });
    const booking = await bookings.createBooking(trip.id, { type: "train", title: "Afrosiyob", linkedEntity: { type: "transport", id: transport.id } });
    await itinerary.deleteTransport(transport.id);
    expect(await repos.bookings.get(booking.id)).not.toHaveProperty("linkedEntity");
  });

  it("rejects links to missing entries", async () => {
    const trip = await setup();
    await expect(bookings.createBooking(trip.id, { type: "other", title: "X", linkedEntity: { type: "activity", id: "missing" } })).rejects.toThrow();
  });
});

describe("groupBookings", () => {
  const booking = (title: string, local?: string, timeZone = "Asia/Tashkent"): Booking => ({
    id: title,
    tripId: "t",
    type: "other",
    title,
    ...(local ? { dateTime: { local, timeZone } } : {}),
    createdAt: "2026-10-03T19:00:00.000Z",
    updatedAt: "2026-10-03T19:00:00.000Z",
  });

  it("splits at now, using each booking's time zone", () => {
    // Now: 2026-06-13 10:00 in Tashkent (05:00 UTC).
    const now = Date.UTC(2026, 5, 13, 5, 0);
    const groups = groupBookings(
      [
        booking("later", "2026-06-14T09:00"),
        booking("soon", "2026-06-13T10:30"),
        booking("earlier today", "2026-06-13T09:00"),
        // 07:00 in Zurich (UTC+2) is exactly now (05:00 UTC): upcoming.
        booking("zurich", "2026-06-13T07:00", "Europe/Zurich"),
        booking("yesterday", "2026-06-12T20:00"),
        booking("no date"),
      ],
      now,
    );
    expect(groups.upcoming.map((b) => b.id)).toEqual(["zurich", "soon", "later"]);
    expect(groups.past.map((b) => b.id)).toEqual(["earlier today", "yesterday"]);
    expect(groups.withoutDate.map((b) => b.id)).toEqual(["no date"]);
  });
});
