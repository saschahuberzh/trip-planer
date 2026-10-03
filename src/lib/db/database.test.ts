import { Dexie } from "dexie";
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachConnectionHandlers, describeOpenError, type DatabaseStatus } from "./connection";
import { TravelDatabase } from "./database";
import { DATABASE_VERSION, SCHEMA_VERSIONS } from "./schema";

const opened: Dexie[] = [];
let counter = 0;

function uniqueName(): string {
  counter += 1;
  return `db-test-${counter}-${crypto.randomUUID()}`;
}

function track<T extends Dexie>(db: T): T {
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) db.close();
});

const trip = {
  id: "trip-1",
  name: "Japan",
  countries: ["Japan"],
  startDate: "2026-04-01",
  endDate: "2026-04-03",
  status: "planned" as const,
  baseCurrency: "CHF",
  createdAt: "2026-10-03T19:00:00.000Z",
  updatedAt: "2026-10-03T19:00:00.000Z",
};

describe("schema", () => {
  it("declares strictly increasing versions", () => {
    const versions = SCHEMA_VERSIONS.map((schema) => schema.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(DATABASE_VERSION).toBe(versions[versions.length - 1]);
  });

  it("opens with the explicit version and all tables", async () => {
    const db = track(new TravelDatabase(uniqueName()));
    await db.open();
    expect(db.verno).toBe(DATABASE_VERSION);
    expect(db.tables.map((table) => table.name).sort()).toEqual(
      [
        "accommodations",
        "activities",
        "appMeta",
        "bookings",
        "expenses",
        "images",
        "places",
        "safetyBackups",
        "transports",
        "tripDays",
        "trips",
      ].sort(),
    );
  });

  it("enforces one TripDay per (tripId, date)", async () => {
    const db = track(new TravelDatabase(uniqueName()));
    const day = { tripId: "t", date: "2026-04-01", createdAt: trip.createdAt, updatedAt: trip.updatedAt };
    await db.tripDays.add({ ...day, id: "d1" });
    await expect(db.tripDays.add({ ...day, id: "d2" })).rejects.toThrow(Dexie.ConstraintError);
    await db.tripDays.add({ ...day, id: "d3", tripId: "other" });
  });
});

describe("migrations", () => {
  it("keeps data when the database is reopened", async () => {
    const name = uniqueName();
    const first = new TravelDatabase(name);
    await first.trips.add(trip);
    first.close();

    const second = track(new TravelDatabase(name));
    expect(await second.trips.get(trip.id)).toEqual(trip);
  });

  it("opens a database created with the version 1 schema and keeps its data", async () => {
    const name = uniqueName();
    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_VERSIONS[0].stores);
    await v1.table("trips").add(trip);
    v1.close();

    const current = track(new TravelDatabase(name));
    await current.open();
    expect(current.verno).toBe(DATABASE_VERSION);
    expect(await current.trips.get(trip.id)).toEqual(trip);
  });

  it("fails without touching data when the stored database is newer", async () => {
    const name = uniqueName();
    const newer = new Dexie(name);
    newer.version(DATABASE_VERSION + 1).stores({ ...SCHEMA_VERSIONS[0].stores, extra: "id" });
    await newer.table("trips").add(trip);
    newer.close();

    const older = track(new TravelDatabase(name));
    const error = await older.open().then(() => null, (reason: unknown) => reason);
    expect(error).toBeInstanceOf(Dexie.VersionError);
    expect(describeOpenError(error)).toMatch(/newer version/);

    const check = track(new Dexie(name));
    await check.open();
    expect(await check.table("trips").get(trip.id)).toEqual(trip);
  });
});

describe("connection handlers", () => {
  it("closes an old connection when another tab upgrades, and asks to reload", async () => {
    const name = uniqueName();
    const oldTab = track(new TravelDatabase(name));
    const statuses: DatabaseStatus[] = [];
    attachConnectionHandlers(oldTab, (status) => statuses.push(status));
    await oldTab.open();
    await oldTab.trips.add(trip);

    const newTab = track(new Dexie(name));
    newTab.version(DATABASE_VERSION + 1).stores({ ...SCHEMA_VERSIONS[0].stores, extra: "id" });
    await newTab.open();

    expect(statuses).toContainEqual({ state: "reload-required" });
    expect(oldTab.isOpen()).toBe(false);
    // Auto-open stays disabled so stale code cannot write with the old schema.
    await expect(oldTab.trips.toArray()).rejects.toThrow(Dexie.DatabaseClosedError);
    expect(await newTab.table("trips").get(trip.id)).toEqual(trip);
  });

  it("reports when its own upgrade is blocked by another connection", async () => {
    const name = uniqueName();
    const blocker = track(new Dexie(name));
    blocker.version(1).stores(SCHEMA_VERSIONS[0].stores);
    await blocker.open();
    // A connection that ignores versionchange (e.g. a tab without these handlers).
    blocker.on("versionchange", () => false);

    const upgrading = track(new Dexie(name));
    upgrading.version(2).stores({ ...SCHEMA_VERSIONS[0].stores, extra: "id" });
    const onStatus = vi.fn();
    attachConnectionHandlers(upgrading, onStatus);
    const opening = upgrading.open();

    await vi.waitFor(() => expect(onStatus).toHaveBeenCalledWith({ state: "blocked" }));
    blocker.close();
    await opening;
    expect(upgrading.verno).toBe(2);
  });
});
