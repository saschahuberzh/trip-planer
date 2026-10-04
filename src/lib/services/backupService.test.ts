import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUP_VERSION } from "@/lib/backup/format";
import { TravelDatabase } from "@/lib/db/database";
import { DATABASE_VERSION } from "@/lib/db/schema";
import type { BackupData } from "@/lib/domain/types";
import { createRepositories, type DomainSnapshot, type Repositories } from "@/lib/repositories";
import { createBackupService, type BackupService } from "./backupService";
import { createItineraryService } from "./itineraryService";
import { createTripService } from "./tripService";

let databases: TravelDatabase[] = [];

function openDevice(): { db: TravelDatabase; repos: Repositories; backup: BackupService } {
  const db = new TravelDatabase(`backup-test-${crypto.randomUUID()}`);
  databases.push(db);
  const repos = createRepositories(db);
  return { db, repos, backup: createBackupService(repos) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T19:00:00.000Z"));
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all(databases.map((db) => db.delete()));
  databases = [];
});

const coverBytes = new Uint8Array([255, 216, 255, 224, 1, 2, 3, 4, 5, 250]);

/** A trip using every entity type and reference kind. */
async function seed(repos: Repositories): Promise<void> {
  const trips = createTripService(repos);
  const itinerary = createItineraryService(repos);
  const trip = await trips.createTrip(
    { name: "Silk Road", countries: ["Uzbekistan"], startDate: "2026-06-12", endDate: "2026-06-14", status: "planned", baseCurrency: "CHF", budgetAmount: 3000 },
    { mimeType: "image/jpeg", blob: new Blob([coverBytes], { type: "image/jpeg" }), width: 1600, height: 900 },
  );
  const days = await repos.tripDays.listByTrip(trip.id);
  const tashkent = await repos.places.create({ tripId: trip.id, name: "Tashkent", type: "city", latitude: 41.3, longitude: 69.24, favorite: true, visited: false });
  const samarkand = await repos.places.create({ tripId: trip.id, name: "Samarkand", type: "city", favorite: false, visited: false, externalRef: { provider: "photon", id: "R1" } });
  await itinerary.setDayPlaces(days[1].id, [tashkent.id, samarkand.id]);
  const activity = await itinerary.createActivity(trip.id, days[0].id, { title: "Chorsu", startTime: "09:00", placeId: tashkent.id });
  await itinerary.createActivity(trip.id, undefined, { title: "Idea" });
  const { transport } = await itinerary.createTransport(trip.id, days[1].id, {
    type: "train",
    originPlaceId: tashkent.id,
    destinationPlaceId: samarkand.id,
    departure: { local: "2026-06-13T08:00", timeZone: "Asia/Tashkent" },
    arrival: { local: "2026-06-13T10:10", timeZone: "Asia/Tashkent" },
    price: 27,
    currency: "USD",
  });
  const stay = await repos.accommodations.create({ tripId: trip.id, name: "Hotel", checkInDate: "2026-06-12", checkOutDate: "2026-06-13", placeId: tashkent.id });
  const booking = await repos.bookings.create({ tripId: trip.id, type: "train", title: "Tickets", linkedEntity: { type: "transport", id: transport.id } });
  await repos.bookings.create({ tripId: trip.id, type: "accommodation", title: "Hotel booking", linkedEntity: { type: "accommodation", id: stay.id } });
  await repos.expenses.create({ tripId: trip.id, title: "Tickets", category: "transport", status: "paid", originalAmount: 27, originalCurrency: "USD", exchangeRateToBase: 0.9, amountInBaseCurrency: 24.3, linkedEntity: { type: "booking", id: booking.id } });
  await repos.visitedCountries.add("UZ");
  await repos.visitedCountries.add("KZ");
  await repos.expenses.create({ tripId: trip.id, title: "Plov", category: "food", status: "planned", originalAmount: 80000, originalCurrency: "UZS", date: "2026-06-12", linkedEntity: { type: "activity", id: activity.id } });
}

async function comparable(snapshot: DomainSnapshot) {
  const sortById = <T extends { id: string }>(items: readonly T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
  const { images, visitedCountries, ...tables } = snapshot;
  return {
    ...Object.fromEntries(Object.entries(tables).map(([table, items]) => [table, sortById<{ id: string }>(items)])),
    visitedCountries: [...visitedCountries].sort((a, b) => a.countryCode.localeCompare(b.countryCode)),
    images: await Promise.all(
      sortById(images).map(async ({ blob, ...image }) => ({ ...image, bytes: [...new Uint8Array(await blob.arrayBuffer())], type: blob.type })),
    ),
  };
}

async function exported(device: ReturnType<typeof openDevice>): Promise<BackupData> {
  return JSON.parse(await device.backup.exportBackupJson()) as BackupData;
}

async function expectRejected(device: ReturnType<typeof openDevice>, backup: unknown, message: RegExp) {
  const result = await device.backup.validateBackupText(JSON.stringify(backup));
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.join("\n")).toMatch(message);
}

describe("export", () => {
  it("serializes every table with images as base64 and a format version", async () => {
    const device = openDevice();
    await seed(device.repos);
    const backup = await exported(device);
    expect(backup).toMatchObject({ format: "travel-planner-backup", version: BACKUP_VERSION, exportedAt: "2026-10-03T19:00:00.000Z", databaseVersion: DATABASE_VERSION });
    expect(backup.visitedCountries.map((country) => country.countryCode).sort()).toEqual(["KZ", "UZ"]);
    expect(backup.trips).toHaveLength(1);
    expect(backup.tripDays).toHaveLength(3);
    expect(backup.images[0]).toMatchObject({ mimeType: "image/jpeg", width: 1600, dataBase64: Buffer.from(coverBytes).toString("base64") });
    expect(JSON.stringify(backup.trips)).not.toContain("base64");
  });

  it("records the last export in AppMeta", async () => {
    const device = openDevice();
    await device.backup.recordExport();
    expect((await device.backup.storageInfo()).lastExportAt).toBe("2026-10-03T19:00:00.000Z");
  });
});

describe("restore (acceptance criteria)", () => {
  it("restores all travel data into a fresh installation", async () => {
    const source = openDevice();
    await seed(source.repos);
    const text = await source.backup.exportBackupJson();

    const fresh = openDevice();
    const result = await fresh.backup.validateBackupText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.summary).toMatchObject({ tripNames: ["Silk Road"], counts: { trips: 1, tripDays: 3, places: 2, activities: 2, transports: 1, accommodations: 1, bookings: 2, expenses: 2, images: 1, visitedCountries: 2 } });
    expect(result.backup.warnings).toEqual([]);
    await fresh.backup.restoreBackup(result.backup);

    expect(await comparable(await fresh.repos.backup.readAll())).toEqual(await comparable(await source.repos.backup.readAll()));
  });

  it("leaves existing data unchanged for an invalid backup", async () => {
    const device = openDevice();
    await seed(device.repos);
    const before = await comparable(await device.repos.backup.readAll());
    const backup = await exported(device);
    await expectRejected(device, { ...backup, trips: [{ ...backup.trips[0], startDate: "2026-13-01" }] }, /startDate/);
    expect(await comparable(await device.repos.backup.readAll())).toEqual(before);
  });

  it("leaves existing data unchanged when the restore fails midway", async () => {
    const source = openDevice();
    await seed(source.repos);
    const result = await source.backup.validateBackupText(await source.backup.exportBackupJson());
    if (!result.ok) throw new Error("expected a valid backup");

    const device = openDevice();
    await createTripService(device.repos).createTrip({ name: "Mine", countries: [], startDate: "2026-01-01", endDate: "2026-01-02", status: "planned", baseCurrency: "EUR" });
    const before = await comparable(await device.repos.backup.readAll());
    vi.spyOn(device.db.bookings, "bulkAdd").mockRejectedValueOnce(new Error("disk full"));
    await expect(device.backup.restoreBackup(result.backup)).rejects.toThrow("disk full");
    expect(await comparable(await device.repos.backup.readAll())).toEqual(before);
    // The safety backup made before the attempt is kept.
    expect(await device.backup.listSafetyBackups()).toHaveLength(1);
  });
});

describe("validation", () => {
  it("rejects files that aren't backups", async () => {
    const device = openDevice();
    expect(await device.backup.validateBackupText("{oops")).toEqual({ ok: false, errors: ["The file is not valid JSON."] });
    await expectRejected(device, [], /not a backup/);
    await expectRejected(device, { format: "something-else", version: 1 }, /not a Travel Planner backup/);
  });

  it("rejects newer, unsupported and missing versions", async () => {
    const device = openDevice();
    const backup = await exported(device);
    await expectRejected(device, { ...backup, version: BACKUP_VERSION + 1 }, /newer app version/);
    await expectRejected(device, { ...backup, version: 0 }, /no longer supported/);
    await expectRejected(device, { ...backup, version: "1" }, /no valid format version/);
  });

  it("imports a format 1 backup (before visited countries) without countries", async () => {
    const source = openDevice();
    await seed(source.repos);
    const { visitedCountries, ...current } = await exported(source);
    expect(visitedCountries).toHaveLength(2);
    const fresh = openDevice();
    await fresh.repos.visitedCountries.add("JP");
    const result = await fresh.backup.validateBackupText(JSON.stringify({ ...current, version: 1 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.summary.counts).toMatchObject({ trips: 1, visitedCountries: 0 });
    await fresh.backup.restoreBackup(result.backup);
    // Replace restore: the backup had no countries, so none remain (the safety backup keeps JP).
    expect(await fresh.repos.visitedCountries.list()).toEqual([]);
    expect(await fresh.repos.trips.count()).toBe(1);
  });

  it("rejects invalid and duplicate visited countries", async () => {
    const device = openDevice();
    const backup = await exported(device);
    const country = { countryCode: "UZ", createdAt: "2026-10-03T19:00:00.000Z", updatedAt: "2026-10-03T19:00:00.000Z" };
    await expectRejected(device, { ...backup, visitedCountries: [{ ...country, countryCode: "Uzbekistan" }] }, /two-letter ISO 3166-1 code/);
    await expectRejected(device, { ...backup, visitedCountries: [country, country] }, /duplicate country/);
    await expectRejected(device, { ...backup, visitedCountries: "UZ" }, /"visitedCountries" is missing/);
  });

  it("requires every table", async () => {
    const device = openDevice();
    const withoutExpenses: Partial<BackupData> = await exported(device);
    delete withoutExpenses.expenses;
    await expectRejected(device, withoutExpenses, /"expenses" is missing/);
  });

  it("rejects invalid records, duplicate IDs and broken references", async () => {
    const device = openDevice();
    await seed(device.repos);
    const backup = await exported(device);
    const [trip] = backup.trips;
    await expectRejected(device, { ...backup, places: [...backup.places, backup.places[0]] }, /duplicate ID/);
    await expectRejected(device, { ...backup, activities: [{ ...backup.activities[0], placeId: "missing" }] }, /place missing does not exist/);
    await expectRejected(device, { ...backup, tripDays: [...backup.tripDays, { ...backup.tripDays[0], id: "other" }] }, /already has a day/);
    await expectRejected(device, { ...backup, tripDays: [{ ...backup.tripDays[1], placeIds: ["ghost"] }, backup.tripDays[0], backup.tripDays[2]] }, /place ghost/);
    await expectRejected(device, { ...backup, bookings: [{ ...backup.bookings[0], linkedEntity: { type: "transport", id: "gone" } }] }, /linked transport gone/);
    await expectRejected(device, { ...backup, places: [{ ...backup.places[0], tripId: "other-trip" }] }, /trip other-trip does not exist/);
    await expectRejected(device, { ...backup, transports: [{ ...backup.transports[0], timeZone: undefined, departure: { local: "2026-06-13T08:00", timeZone: "Mars/Base" } }] }, /departure/);
    await expectRejected(device, { ...backup, trips: [{ ...trip, baseCurrency: "XXX" }] }, /baseCurrency/);
    await expectRejected(device, { ...backup, trips: [null] }, /not an object/);
  });

  it("checks expense conversions against the trip's base currency, keeping stored amounts", async () => {
    const device = openDevice();
    await seed(device.repos);
    const backup = await exported(device);
    const converted = backup.expenses.find((expense) => expense.title === "Tickets");
    const unconverted = backup.expenses.find((expense) => expense.title === "Plov");
    if (!converted || !unconverted) throw new Error("seed data missing");
    const chf = { ...converted, originalCurrency: "CHF", originalAmount: 10, exchangeRateToBase: 1.1, amountInBaseCurrency: 11 };
    await expectRejected(device, { ...backup, expenses: [chf, unconverted] }, /rate 1/);
    await expectRejected(device, { ...backup, expenses: [{ ...converted, amountInBaseCurrency: undefined }, unconverted] }, /set together/);
    // A stored amount that differs from amount × rate is kept as-is.
    const result = await device.backup.validateBackupText(
      JSON.stringify({ ...backup, expenses: [{ ...converted, amountInBaseCurrency: 99 }, unconverted] }),
    );
    expect(result.ok && result.backup.data.expenses.find((expense) => expense.id === converted.id)?.amountInBaseCurrency).toBe(99);
  });

  it("skips unreadable images and clears the cover reference instead of blocking", async () => {
    const device = openDevice();
    await seed(device.repos);
    const backup = await exported(device);
    const result = await device.backup.validateBackupText(JSON.stringify({ ...backup, images: [{ ...backup.images[0], dataBase64: "not base64!" }] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.warnings).toEqual(["Image 1 could not be read and was skipped.", 'The cover photo of "Silk Road" is missing and was removed.']);
    expect(result.backup.data.trips[0]).not.toHaveProperty("coverImageId");
    expect(result.backup.data.images).toEqual([]);
  });
});

describe("safety backups", () => {
  async function emptyBackup() {
    const result = await openDevice().backup.validateBackupText(await openDevice().backup.exportBackupJson());
    if (!result.ok) throw new Error("expected a valid empty backup");
    return result.backup;
  }

  it("holds the previous data and restores it", async () => {
    const device = openDevice();
    await seed(device.repos);
    const before = await comparable(await device.repos.backup.readAll());
    const safety = await device.backup.restoreBackup(await emptyBackup());
    expect(await device.repos.trips.count()).toBe(0);

    const back = await device.backup.validateBackupText(await device.backup.safetyBackupJson(safety.id));
    if (!back.ok) throw new Error("expected a valid safety backup");
    await device.backup.restoreBackup(back.backup);
    expect(await comparable(await device.repos.backup.readAll())).toEqual(before);
  });

  it("keeps the latest 3, newest first, and never touches AppMeta", async () => {
    const device = openDevice();
    await device.repos.appMeta.set("lastExportAt", "2026-10-01T10:00:00.000Z");
    const empty = await emptyBackup();
    for (let i = 0; i < 4; i++) {
      vi.setSystemTime(new Date(`2026-10-0${4 + i}T10:00:00.000Z`));
      await device.backup.restoreBackup(empty);
    }
    const safety = await device.backup.listSafetyBackups();
    expect(safety.map((backup) => backup.createdAt)).toEqual([
      "2026-10-07T10:00:00.000Z",
      "2026-10-06T10:00:00.000Z",
      "2026-10-05T10:00:00.000Z",
    ]);
    expect((await device.backup.storageInfo()).lastExportAt).toBe("2026-10-01T10:00:00.000Z");
  });
});
