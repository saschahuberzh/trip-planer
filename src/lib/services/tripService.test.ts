import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TravelDatabase } from "@/lib/db/database";
import { createRepositories, type NewImageAsset, type Repositories } from "@/lib/repositories";
import { createTripService, type TripInput, type TripService } from "./tripService";

let db: TravelDatabase;
let repos: Repositories;
let service: TripService;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T19:00:00.000Z"));
  db = new TravelDatabase(`trip-service-test-${crypto.randomUUID()}`);
  repos = createRepositories(db);
  service = createTripService(repos);
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

const input: TripInput = {
  name: "Central Asia",
  countries: ["Uzbekistan", "Kazakhstan", "Kyrgyzstan"],
  startDate: "2026-06-12",
  endDate: "2026-06-14",
  status: "planned",
  baseCurrency: "CHF",
  budgetAmount: 3000,
};

const cover = (): NewImageAsset => ({
  mimeType: "image/jpeg",
  blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
  width: 1600,
  height: 900,
});

async function dayDates(tripId: string): Promise<string[]> {
  return (await repos.tripDays.listByTrip(tripId)).map((day) => day.date);
}

describe("creating trips", () => {
  it("creates one TripDay per date in the range", async () => {
    const trip = await service.createTrip(input);
    expect(await repos.trips.get(trip.id)).toMatchObject({ name: "Central Asia", budgetAmount: 3000 });
    expect(await dayDates(trip.id)).toEqual(["2026-06-12", "2026-06-13", "2026-06-14"]);
  });

  it("stores the cover image separately and references it by ID", async () => {
    const trip = await service.createTrip(input, cover());
    expect(trip.coverImageId).toBeDefined();
    const image = await service.getImage(trip.coverImageId ?? "");
    expect(image).toMatchObject({ width: 1600, height: 900, mimeType: "image/jpeg" });
  });

  it("writes nothing when the trip is invalid", async () => {
    await expect(service.createTrip({ ...input, endDate: "2026-06-01" }, cover())).rejects.toThrow();
    expect(await db.trips.count()).toBe(0);
    expect(await db.images.count()).toBe(0);
    expect(await db.tripDays.count()).toBe(0);
  });
});

describe("changing trip dates", () => {
  it("creates missing days when the range grows", async () => {
    const trip = await service.createTrip(input);
    const originalIds = (await repos.tripDays.listByTrip(trip.id)).map((day) => day.id);
    const result = await service.updateTrip(
      trip.id,
      { ...input, startDate: "2026-06-11", endDate: "2026-06-15" },
      { type: "keep" },
    );
    expect(result.daysOutsideRange).toEqual([]);
    const days = await repos.tripDays.listByTrip(trip.id);
    expect(days.map((day) => day.date)).toEqual([
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
      "2026-06-15",
    ]);
    // Existing days keep their identity.
    expect(days.slice(1, 4).map((day) => day.id)).toEqual(originalIds);
  });

  it("removes empty days outside the new range", async () => {
    const trip = await service.createTrip(input);
    await service.updateTrip(trip.id, { ...input, startDate: "2026-06-13", endDate: "2026-06-13" }, { type: "keep" });
    expect(await dayDates(trip.id)).toEqual(["2026-06-13"]);
  });

  it("keeps days with user data outside the range and reports them", async () => {
    const trip = await service.createTrip(input);
    const [first, second, third] = await repos.tripDays.listByTrip(trip.id);
    await repos.tripDays.update(first.id, { title: "Arrival in Tashkent" });
    await repos.activities.create({ tripId: trip.id, tripDayId: third.id, title: "Chorsu Bazaar", sortOrder: 0 });

    const preview = await service.previewTripChange(trip.id, {
      startDate: "2026-06-13",
      endDate: "2026-06-13",
      baseCurrency: "CHF",
    });
    expect(preview.daysOutsideRange.map((day) => day.id)).toEqual([first.id, third.id]);
    // Previewing changes nothing.
    expect(await dayDates(trip.id)).toEqual(["2026-06-12", "2026-06-13", "2026-06-14"]);

    const result = await service.updateTrip(
      trip.id,
      { ...input, startDate: "2026-06-13", endDate: "2026-06-13" },
      { type: "keep" },
    );
    expect(result.daysOutsideRange.map((day) => day.id)).toEqual([first.id, third.id]);
    expect((await repos.tripDays.listByTrip(trip.id)).map((day) => day.id)).toEqual([first.id, second.id, third.id]);
    expect(await repos.activities.listByTripDay(third.id)).toHaveLength(1);
  });

  it("handles moving the whole trip to new dates", async () => {
    const trip = await service.createTrip(input);
    const [first] = await repos.tripDays.listByTrip(trip.id);
    await repos.tripDays.update(first.id, { notes: "Visa pickup" });
    await service.updateTrip(trip.id, { ...input, startDate: "2026-07-01", endDate: "2026-07-02" }, { type: "keep" });
    expect(await dayDates(trip.id)).toEqual(["2026-06-12", "2026-07-01", "2026-07-02"]);
  });

  it("brings a kept day back into range without duplicating it", async () => {
    const trip = await service.createTrip(input);
    const [first] = await repos.tripDays.listByTrip(trip.id);
    await repos.tripDays.update(first.id, { title: "Arrival" });
    await service.updateTrip(trip.id, { ...input, startDate: "2026-06-13" }, { type: "keep" });
    await service.updateTrip(trip.id, input, { type: "keep" });
    const days = await repos.tripDays.listByTrip(trip.id);
    expect(days.map((day) => day.date)).toEqual(["2026-06-12", "2026-06-13", "2026-06-14"]);
    expect(days[0]).toMatchObject({ id: first.id, title: "Arrival" });
  });

  it("rolls back all changes when the update fails", async () => {
    const trip = await service.createTrip(input);
    await repos.expenses.create({
      tripId: trip.id,
      title: "Dinner",
      category: "food",
      status: "paid",
      originalAmount: 40,
      originalCurrency: "CHF",
      exchangeRateToBase: 1,
      amountInBaseCurrency: 40,
    });
    // An invalid date range fails after the base currency and the cover were changed.
    await expect(
      service.updateTrip(trip.id, { ...input, baseCurrency: "EUR", endDate: "2026-06-01" }, { type: "replace", image: cover() }),
    ).rejects.toThrow();
    expect(await repos.trips.get(trip.id)).toEqual(trip);
    expect((await repos.expenses.listByTrip(trip.id))[0]).toMatchObject({ exchangeRateToBase: 1, amountInBaseCurrency: 40 });
    expect(await dayDates(trip.id)).toHaveLength(3);
    expect(await db.images.count()).toBe(0);
  });

  it("reports expenses affected by a base currency change", async () => {
    const trip = await service.createTrip(input);
    const range = { startDate: input.startDate, endDate: input.endDate };
    const expense = { tripId: trip.id, title: "Taxi", category: "transport" as const, status: "paid" as const };
    await repos.expenses.create({ ...expense, originalAmount: 50000, originalCurrency: "UZS" });
    await repos.expenses.create({ ...expense, originalAmount: 40, originalCurrency: "CHF", exchangeRateToBase: 1, amountInBaseCurrency: 40 });
    await repos.expenses.create({ ...expense, originalAmount: 10, originalCurrency: "EUR", exchangeRateToBase: 0.94, amountInBaseCurrency: 9.4 });
    expect(await service.previewTripChange(trip.id, { ...range, baseCurrency: "CHF" })).toMatchObject({
      baseCurrencyChanges: false,
      clearedConversions: 0,
    });
    expect(await service.previewTripChange(trip.id, { ...range, baseCurrency: "EUR" })).toMatchObject({
      baseCurrencyChanges: true,
      clearedConversions: 1,
      expensesInNewBase: 1,
    });
  });

  it("changes the base currency: rate 1 in the new currency, other conversions cleared", async () => {
    const trip = await service.createTrip(input);
    const expense = { tripId: trip.id, title: "X", category: "food" as const, status: "paid" as const };
    const chf = await repos.expenses.create({ ...expense, originalAmount: 40, originalCurrency: "CHF", exchangeRateToBase: 1, amountInBaseCurrency: 40 });
    const eur = await repos.expenses.create({ ...expense, originalAmount: 10, originalCurrency: "EUR", exchangeRateToBase: 0.94, amountInBaseCurrency: 9.4 });
    const uzs = await repos.expenses.create({ ...expense, originalAmount: 50000, originalCurrency: "UZS" });
    const { trip: updated } = await service.updateTrip(trip.id, { ...input, baseCurrency: "EUR" }, { type: "keep" });
    expect(updated.baseCurrency).toBe("EUR");
    const stored = Object.fromEntries((await repos.expenses.listByTrip(trip.id)).map((e) => [e.id, e]));
    expect(stored[eur.id]).toMatchObject({ exchangeRateToBase: 1, amountInBaseCurrency: 10, originalAmount: 10 });
    expect(stored[chf.id]).toMatchObject({ originalAmount: 40, originalCurrency: "CHF" });
    expect(stored[chf.id]).not.toHaveProperty("exchangeRateToBase");
    expect(stored[chf.id]).not.toHaveProperty("amountInBaseCurrency");
    expect(stored[uzs.id]).not.toHaveProperty("amountInBaseCurrency");
  });
});

describe("editing trip fields", () => {
  it("clears optional fields that were removed", async () => {
    const trip = await service.createTrip({ ...input, notes: "Silk road" });
    const { trip: updated } = await service.updateTrip(
      trip.id,
      { ...input, budgetAmount: undefined, notes: undefined, countries: ["Uzbekistan"] },
      { type: "keep" },
    );
    expect(updated).not.toHaveProperty("budgetAmount");
    expect(updated).not.toHaveProperty("notes");
    expect(updated.countries).toEqual(["Uzbekistan"]);
  });

  it("keeps, replaces and removes the cover image", async () => {
    const trip = await service.createTrip(input, cover());
    const firstImageId = trip.coverImageId;

    const kept = await service.updateTrip(trip.id, { ...input, name: "Silk Road" }, { type: "keep" });
    expect(kept.trip.coverImageId).toBe(firstImageId);

    const replaced = await service.updateTrip(trip.id, input, { type: "replace", image: cover() });
    expect(replaced.trip.coverImageId).not.toBe(firstImageId);
    expect(await service.getImage(firstImageId ?? "")).toBeUndefined();

    const removed = await service.updateTrip(trip.id, input, { type: "remove" });
    expect(removed.trip).not.toHaveProperty("coverImageId");
    expect(await db.images.count()).toBe(0);
  });
});

describe("listing trips", () => {
  it("groups trips as active, upcoming and completed", async () => {
    await service.createTrip({ ...input, name: "Later", startDate: "2027-03-01", endDate: "2027-03-02" });
    await service.createTrip({ ...input, name: "Sooner", startDate: "2026-11-01", endDate: "2026-11-02" });
    await service.createTrip({ ...input, name: "Old", status: "completed", startDate: "2025-01-01", endDate: "2025-01-02" });
    await service.createTrip({ ...input, name: "Recent", status: "completed", startDate: "2026-05-01", endDate: "2026-05-02" });
    await service.createTrip({ ...input, name: "Now", status: "active", startDate: "2026-10-01", endDate: "2026-10-10" });

    const groups = await service.listTripGroups();
    expect(groups.map((group) => [group.status, group.trips.map((trip) => trip.name)])).toEqual([
      ["active", ["Now"]],
      ["planned", ["Sooner", "Later"]],
      ["completed", ["Recent", "Old"]],
    ]);
  });

  it("returns no groups without trips", async () => {
    expect(await service.listTripGroups()).toEqual([]);
  });

  it("suggests the base currency of the most recently created trip", async () => {
    expect(await service.suggestedBaseCurrency()).toBe("EUR");
    await service.createTrip({ ...input, baseCurrency: "JPY" });
    vi.setSystemTime(new Date("2026-10-04T08:00:00.000Z"));
    await service.createTrip({ ...input, baseCurrency: "CHF" });
    expect(await service.suggestedBaseCurrency()).toBe("CHF");
  });
});

describe("deleting trips", () => {
  it("summarizes and deletes everything the trip owns", async () => {
    const trip = await service.createTrip(input, cover());
    const other = await service.createTrip({ ...input, name: "Other" });
    await repos.places.create({ tripId: trip.id, name: "Registan", type: "attraction", favorite: false, visited: false });

    expect(await service.getDeletionSummary(trip.id)).toEqual({
      days: 3,
      places: 1,
      activities: 0,
      transports: 0,
      accommodations: 0,
      bookings: 0,
      expenses: 0,
      coverImage: true,
    });

    await service.deleteTrip(trip.id);
    expect(await service.getTrip(trip.id)).toBeUndefined();
    expect(await repos.tripDays.listByTrip(trip.id)).toEqual([]);
    expect(await repos.places.listByTrip(trip.id)).toEqual([]);
    expect(await db.images.count()).toBe(0);
    expect(await dayDates(other.id)).toHaveLength(3);
  });
});
