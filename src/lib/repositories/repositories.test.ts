import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TravelDatabase } from "@/lib/db/database";
import type { BackupData, Trip } from "@/lib/domain/types";
import {
  ConflictError,
  InvalidReferenceError,
  EntityNotFoundError,
  TripDayNotEmptyError,
  ValidationError,
  createRepositories,
  type Repositories,
} from "./index";
import type { NewTrip } from "./tripRepository";

let db: TravelDatabase;
let repos: Repositories;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T19:00:00.000Z"));
  db = new TravelDatabase(`repo-test-${crypto.randomUUID()}`);
  repos = createRepositories(db);
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

const newTrip: NewTrip = {
  name: "Central Asia",
  countries: ["Uzbekistan", "Kazakhstan", "Kyrgyzstan"],
  startDate: "2026-06-12",
  endDate: "2026-06-14",
  status: "planned",
  baseCurrency: "CHF",
};

async function createTripWithDay(): Promise<{ trip: Trip; dayId: string }> {
  const trip = await repos.trips.create(newTrip);
  const day = await repos.tripDays.create({ tripId: trip.id, date: "2026-06-12" });
  return { trip, dayId: day.id };
}

function image(): Promise<{ id: string }> {
  return repos.images.create({
    mimeType: "image/jpeg",
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    width: 1600,
    height: 900,
  });
}

describe("metadata and persistence", () => {
  it("assigns id, createdAt and updatedAt and persists across connections", async () => {
    const trip = await repos.trips.create(newTrip);
    expect(trip.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(trip.createdAt).toBe("2026-10-03T19:00:00.000Z");
    expect(trip.updatedAt).toBe(trip.createdAt);

    db.close();
    const reopened = new TravelDatabase(db.name);
    expect(await createRepositories(reopened).trips.get(trip.id)).toEqual(trip);
    reopened.close();
  });

  it("updates updatedAt, keeps createdAt/id and clears fields set to undefined", async () => {
    const trip = await repos.trips.create({ ...newTrip, notes: "Silk road", budgetAmount: 3000 });
    vi.setSystemTime(new Date("2026-10-04T08:00:00.000Z"));
    const updated = await repos.trips.update(trip.id, { name: "Silk Road", notes: undefined });
    expect(updated).toMatchObject({ id: trip.id, name: "Silk Road", createdAt: trip.createdAt });
    expect(updated.updatedAt).toBe("2026-10-04T08:00:00.000Z");
    expect(updated).not.toHaveProperty("notes");
    expect(await repos.trips.get(trip.id)).toEqual(updated);
  });

  it("does not store undefined optional fields", async () => {
    const trip = await repos.trips.create({ ...newTrip, notes: undefined });
    expect(Object.keys((await repos.trips.get(trip.id)) ?? {})).not.toContain("notes");
  });
});

describe("validation and references", () => {
  it("rejects invalid entities without writing", async () => {
    await expect(repos.trips.create({ ...newTrip, endDate: "2026-06-01" })).rejects.toThrow(ValidationError);
    expect(await repos.trips.count()).toBe(0);
  });

  it("rejects references to missing records or other trips", async () => {
    const { trip } = await createTripWithDay();
    const other = await createTripWithDay();
    await expect(
      repos.activities.create({ tripId: trip.id, tripDayId: other.dayId, title: "Museum", sortOrder: 0 }),
    ).rejects.toThrow(InvalidReferenceError);
    await expect(
      repos.activities.create({ tripId: "missing", title: "Museum", sortOrder: 0 }),
    ).rejects.toThrow(InvalidReferenceError);
    await expect(
      repos.bookings.create({
        tripId: trip.id,
        type: "flight",
        title: "TAS → ALA",
        linkedEntity: { type: "transport", id: "missing" },
      }),
    ).rejects.toThrow(InvalidReferenceError);
    await expect(repos.trips.update(trip.id, { coverImageId: "missing" })).rejects.toThrow(
      InvalidReferenceError,
    );
  });

  it("never changes tripId through an update", async () => {
    const { trip } = await createTripWithDay();
    const place = await repos.places.create({
      tripId: trip.id,
      name: "Registan",
      type: "attraction",
      favorite: false,
      visited: false,
    });
    const patch = { tripId: "other", name: "Registan Square" };
    const updated = await repos.places.update(place.id, patch);
    expect(updated.tripId).toBe(trip.id);
  });

  it("reports missing records", async () => {
    await expect(repos.trips.update("missing", { name: "x" })).rejects.toThrow(EntityNotFoundError);
    await expect(repos.activities.delete("missing")).rejects.toThrow(EntityNotFoundError);
  });

  it("validates expense conversion against the trip base currency", async () => {
    const { trip } = await createTripWithDay();
    const base = { tripId: trip.id, title: "Hotel", category: "accommodation", status: "paid" } as const;
    await expect(
      repos.expenses.create({ ...base, originalAmount: 220, originalCurrency: "CHF" }),
    ).rejects.toThrow(ValidationError);
    const converted = await repos.expenses.create({
      ...base,
      originalAmount: 800000,
      originalCurrency: "UZS",
      exchangeRateToBase: 0.000065,
      amountInBaseCurrency: 52,
    });
    // Stored converted amounts are kept as-is.
    expect((await repos.expenses.get(converted.id))?.amountInBaseCurrency).toBe(52);
  });

  it("refuses a base-currency change while the trip has expenses", async () => {
    const { trip } = await createTripWithDay();
    await repos.trips.update(trip.id, { baseCurrency: "EUR" });
    await repos.expenses.create({
      tripId: trip.id,
      title: "Taxi",
      category: "transport",
      status: "paid",
      originalAmount: 1200,
      originalCurrency: "KGS",
    });
    await expect(repos.trips.update(trip.id, { baseCurrency: "CHF" })).rejects.toThrow(ConflictError);
  });
});

describe("trip days", () => {
  it("keeps one day per trip and date and lists days by date", async () => {
    const trip = await repos.trips.create(newTrip);
    await repos.tripDays.create({ tripId: trip.id, date: "2026-06-14" });
    await repos.tripDays.create({ tripId: trip.id, date: "2026-06-12" });
    await expect(repos.tripDays.create({ tripId: trip.id, date: "2026-06-12" })).rejects.toThrow(
      ConflictError,
    );
    expect((await repos.tripDays.listByTrip(trip.id)).map((day) => day.date)).toEqual([
      "2026-06-12",
      "2026-06-14",
    ]);
  });

  it("refuses to delete a day with user data unless items are deleted explicitly", async () => {
    const { trip, dayId } = await createTripWithDay();
    const activity = await repos.activities.create({ tripId: trip.id, tripDayId: dayId, title: "Bazaar", sortOrder: 0 });
    const expense = await repos.expenses.create({
      tripId: trip.id,
      title: "Spices",
      category: "shopping",
      status: "paid",
      originalAmount: 50000,
      originalCurrency: "UZS",
      linkedEntity: { type: "activity", id: activity.id },
    });

    expect(await repos.tripDays.hasUserData(dayId)).toBe(true);
    await expect(repos.tripDays.delete(dayId)).rejects.toThrow(TripDayNotEmptyError);
    expect(await repos.activities.get(activity.id)).toBeDefined();

    await repos.tripDays.delete(dayId, { deleteItems: true });
    expect(await repos.tripDays.get(dayId)).toBeUndefined();
    expect(await repos.activities.get(activity.id)).toBeUndefined();
    expect(await repos.expenses.get(expense.id)).not.toHaveProperty("linkedEntity");
  });

  it("deletes an empty day", async () => {
    const { dayId } = await createTripWithDay();
    expect(await repos.tripDays.hasUserData(dayId)).toBe(false);
    await repos.tripDays.delete(dayId);
    expect(await repos.tripDays.get(dayId)).toBeUndefined();
  });
});

describe("itinerary entries", () => {
  it("stores activities and transports in the same bucket with their sortOrder", async () => {
    const { trip, dayId } = await createTripWithDay();
    await repos.activities.create({ tripId: trip.id, tripDayId: dayId, title: "Breakfast", sortOrder: 0 });
    await repos.transports.create({
      tripId: trip.id,
      tripDayId: dayId,
      type: "train",
      originText: "Tashkent",
      destinationText: "Samarkand",
      departure: { local: "2026-06-12T08:00", timeZone: "Asia/Tashkent" },
      arrival: { local: "2026-06-12T10:10", timeZone: "Asia/Tashkent" },
      sortOrder: 1,
    });
    await repos.activities.create({ tripId: trip.id, title: "Someday", sortOrder: 0 });

    expect((await repos.activities.listByTripDay(dayId)).map((a) => a.sortOrder)).toEqual([0]);
    const [transport] = await repos.transports.listByTripDay(dayId);
    expect(transport.departure).toEqual({ local: "2026-06-12T08:00", timeZone: "Asia/Tashkent" });
    expect(await repos.activities.listByTrip(trip.id)).toHaveLength(2);
  });
});

describe("delete behavior", () => {
  it("unlinks bookings and expenses when a transport is deleted", async () => {
    const { trip } = await createTripWithDay();
    const transport = await repos.transports.create({ tripId: trip.id, type: "flight", sortOrder: 0 });
    const link = { type: "transport", id: transport.id } as const;
    const booking = await repos.bookings.create({ tripId: trip.id, type: "flight", title: "HY 101", linkedEntity: link });
    const expense = await repos.expenses.create({
      tripId: trip.id,
      title: "Flight",
      category: "transport",
      status: "planned",
      originalAmount: 180,
      originalCurrency: "USD",
      linkedEntity: link,
    });

    vi.setSystemTime(new Date("2026-10-05T10:00:00.000Z"));
    await repos.transports.delete(transport.id);

    expect(await repos.transports.get(transport.id)).toBeUndefined();
    const unlinkedBooking = await repos.bookings.get(booking.id);
    expect(unlinkedBooking).not.toHaveProperty("linkedEntity");
    expect(unlinkedBooking?.updatedAt).toBe("2026-10-05T10:00:00.000Z");
    expect(await repos.expenses.get(expense.id)).not.toHaveProperty("linkedEntity");
  });

  it("unlinks expenses when a booking is deleted", async () => {
    const { trip } = await createTripWithDay();
    const booking = await repos.bookings.create({ tripId: trip.id, type: "other", title: "Yurt camp" });
    const expense = await repos.expenses.create({
      tripId: trip.id,
      title: "Yurt",
      category: "accommodation",
      status: "paid",
      originalAmount: 3000,
      originalCurrency: "KGS",
      linkedEntity: { type: "booking", id: booking.id },
    });
    await repos.bookings.delete(booking.id);
    expect(await repos.expenses.get(expense.id)).not.toHaveProperty("linkedEntity");
  });

  it("unlinks place references and copies the place's data", async () => {
    const { trip, dayId } = await createTripWithDay();
    const place = await repos.places.create({
      tripId: trip.id,
      name: "Hotel Uzbekistan",
      type: "hotel",
      address: "45 Amir Timur St, Tashkent",
      latitude: 41.3125,
      longitude: 69.2797,
      favorite: true,
      visited: false,
    });
    const activity = await repos.activities.create({
      tripId: trip.id,
      tripDayId: dayId,
      placeId: place.id,
      title: "Check in",
      sortOrder: 0,
    });
    const transport = await repos.transports.create({
      tripId: trip.id,
      type: "taxi",
      originPlaceId: place.id,
      destinationPlaceId: place.id,
      sortOrder: 0,
    });
    const accommodation = await repos.accommodations.create({
      tripId: trip.id,
      placeId: place.id,
      name: "Hotel Uzbekistan",
      checkInDate: "2026-06-12",
      checkOutDate: "2026-06-14",
    });

    await repos.places.delete(place.id);

    expect(await repos.places.get(place.id)).toBeUndefined();
    const unlinkedActivity = await repos.activities.get(activity.id);
    expect(unlinkedActivity).not.toHaveProperty("placeId");
    expect(unlinkedActivity?.title).toBe("Check in");
    expect(await repos.transports.get(transport.id)).toMatchObject({
      originText: "Hotel Uzbekistan",
      destinationText: "Hotel Uzbekistan",
    });
    const unlinkedTransport = await repos.transports.get(transport.id);
    expect(unlinkedTransport).not.toHaveProperty("originPlaceId");
    expect(unlinkedTransport).not.toHaveProperty("destinationPlaceId");
    const unlinkedAccommodation = await repos.accommodations.get(accommodation.id);
    expect(unlinkedAccommodation).not.toHaveProperty("placeId");
    expect(unlinkedAccommodation).toMatchObject({
      address: "45 Amir Timur St, Tashkent",
      latitude: 41.3125,
      longitude: 69.2797,
    });
  });

  it("deletes a trip with all owned entities and its cover image, leaving other trips intact", async () => {
    const cover = await image();
    const { trip, dayId } = await createTripWithDay();
    await repos.trips.update(trip.id, { coverImageId: cover.id });
    const place = await repos.places.create({ tripId: trip.id, name: "Almaty", type: "city", favorite: false, visited: false });
    await repos.activities.create({ tripId: trip.id, tripDayId: dayId, placeId: place.id, title: "Walk", sortOrder: 0 });
    await repos.transports.create({ tripId: trip.id, type: "bus", sortOrder: 1 });
    await repos.accommodations.create({ tripId: trip.id, name: "Hostel", checkInDate: "2026-06-12", checkOutDate: "2026-06-13" });
    await repos.bookings.create({ tripId: trip.id, type: "other", title: "Tour" });
    await repos.expenses.create({
      tripId: trip.id,
      title: "Lunch",
      category: "food",
      status: "paid",
      originalAmount: 35000,
      originalCurrency: "KZT",
    });
    const other = await createTripWithDay();

    await repos.trips.delete(trip.id);

    expect(await repos.trips.get(trip.id)).toBeUndefined();
    expect(await repos.images.get(cover.id)).toBeUndefined();
    for (const table of db.domainTables.filter((t) => t.name !== "trips" && t.name !== "images")) {
      expect(await table.where("tripId").equals(trip.id).count()).toBe(0);
    }
    expect(await repos.tripDays.listByTrip(other.trip.id)).toHaveLength(1);
  });

  it("aborts the whole delete when a step fails", async () => {
    const { trip } = await createTripWithDay();
    const activity = await repos.activities.create({ tripId: trip.id, title: "Hike", sortOrder: 0 });
    const expense = await repos.expenses.create({
      tripId: trip.id,
      title: "Guide",
      category: "activities",
      status: "paid",
      originalAmount: 40,
      originalCurrency: "USD",
      linkedEntity: { type: "activity", id: activity.id },
    });
    const bulkDelete = vi.spyOn(db.activities, "bulkDelete").mockRejectedValueOnce(new Error("disk full"));

    await expect(repos.activities.delete(activity.id)).rejects.toThrow("disk full");
    bulkDelete.mockRestore();
    expect(await repos.activities.get(activity.id)).toBeDefined();
    expect((await repos.expenses.get(expense.id))?.linkedEntity).toEqual({ type: "activity", id: activity.id });
  });
});

describe("images", () => {
  it("stores Blobs separately and deletes replaced cover images", async () => {
    const first = await image();
    const trip = await repos.trips.create({ ...newTrip, coverImageId: first.id });
    const stored = await repos.images.get(first.id);
    expect(stored?.blob).toBeInstanceOf(Blob);
    expect(stored?.blob.size).toBe(3);

    const second = await image();
    await repos.trips.update(trip.id, { coverImageId: second.id });
    expect(await repos.images.get(first.id)).toBeUndefined();

    await repos.images.delete(second.id);
    expect(await repos.trips.get(trip.id)).not.toHaveProperty("coverImageId");
  });

  it("rejects unsupported image data", async () => {
    await expect(
      repos.images.create({ mimeType: "image/jpeg", blob: new Blob([]), width: 0, height: 10 }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("app meta", () => {
  it("stores typed values outside the domain tables", async () => {
    expect(await repos.appMeta.get("storagePersistence")).toBeUndefined();
    const record = { status: "granted", checkedAt: "2026-10-03T19:00:00.000Z" } as const;
    await repos.appMeta.set("storagePersistence", record);
    expect(await repos.appMeta.get("storagePersistence")).toEqual(record);
    expect(db.domainTables.map((table) => table.name)).not.toContain("appMeta");
  });
});

describe("safety backups", () => {
  const data: BackupData = {
    format: "travel-planner-backup",
    version: 1,
    exportedAt: "2026-10-03T19:00:00.000Z",
    appVersion: "0.1.0",
    databaseVersion: 1,
    trips: [],
    tripDays: [],
    places: [],
    activities: [],
    transports: [],
    accommodations: [],
    bookings: [],
    expenses: [],
    images: [],
  };

  it("keeps only the 3 most recent backups, newest first", async () => {
    const ids: string[] = [];
    for (let day = 1; day <= 5; day++) {
      vi.setSystemTime(new Date(`2026-10-0${day}T12:00:00.000Z`));
      ids.push((await repos.safetyBackups.create(data, "before_restore")).id);
    }
    expect((await repos.safetyBackups.list()).map((backup) => backup.id)).toEqual(ids.slice(2).reverse());
    expect(await repos.safetyBackups.get(ids[4])).toMatchObject({ reason: "before_restore", data });
  });

  it("is not part of the domain tables", () => {
    expect(db.domainTables.map((table) => table.name)).not.toContain("safetyBackups");
  });
});
