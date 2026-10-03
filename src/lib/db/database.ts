import { Dexie, type Table } from "dexie";
import type {
  Accommodation,
  Activity,
  AppMetaKey,
  AppMetaValues,
  Booking,
  Expense,
  ImageAsset,
  Place,
  SafetyBackup,
  Transport,
  Trip,
  TripDay,
} from "@/lib/domain/types";
import { DATABASE_NAME, DATABASE_VERSION, SCHEMA_VERSIONS } from "./schema";

export type AppMetaRecord = {
  [K in AppMetaKey]: { key: K; value: AppMetaValues[K]; updatedAt: string };
}[AppMetaKey];

/** Dexie stores schema version N as native IndexedDB version N × 10 (+ small auto-patches). */
function storedSchemaVersion(db: Dexie): number {
  return Math.floor(db.backendDB().version / 10);
}

/** Dexie database. Only the repository layer may use this class. */
export class TravelDatabase extends Dexie {
  trips!: Table<Trip, string>;
  tripDays!: Table<TripDay, string>;
  places!: Table<Place, string>;
  activities!: Table<Activity, string>;
  transports!: Table<Transport, string>;
  accommodations!: Table<Accommodation, string>;
  bookings!: Table<Booking, string>;
  expenses!: Table<Expense, string>;
  images!: Table<ImageAsset, string>;
  appMeta!: Table<AppMetaRecord, AppMetaKey>;
  safetyBackups!: Table<SafetyBackup, string>;

  constructor(name: string = DATABASE_NAME) {
    super(name);
    for (const schema of SCHEMA_VERSIONS) {
      const version = this.version(schema.version).stores(schema.stores);
      if (schema.upgrade) version.upgrade(schema.upgrade);
    }
    // Dexie 4 would otherwise open a database upgraded by a newer app version, letting
    // this (older) code write records that the newer schema's migrations never saw.
    this.on(
      "ready",
      (db) => {
        if (storedSchemaVersion(db) > DATABASE_VERSION) {
          throw new Dexie.VersionError("The database was created by a newer app version");
        }
      },
      true,
    );
  }

  /** Tables holding user travel data (included in backups, replaced by restore). */
  get domainTables(): Table[] {
    return [
      this.trips,
      this.tripDays,
      this.places,
      this.activities,
      this.transports,
      this.accommodations,
      this.bookings,
      this.expenses,
      this.images,
    ];
  }
}
