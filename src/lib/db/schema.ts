import type { Transaction } from "dexie";

export const DATABASE_NAME = "travel-planner";

export interface SchemaVersion {
  version: number;
  /** Dexie store declarations: primary key first, then indexes. `null` deletes a table. */
  stores: Record<string, string | null>;
  /** Data migration from the previous version. Must preserve existing user data. */
  upgrade?: (tx: Transaction) => Promise<void> | void;
}

/**
 * Every released schema version, oldest first. Never edit or remove a released entry:
 * append a new version (with an `upgrade` when data must be transformed) and add a
 * migration test that opens a database created by the previous version.
 */
export const SCHEMA_VERSIONS: readonly SchemaVersion[] = [
  {
    version: 1,
    stores: {
      trips: "id",
      tripDays: "id, tripId, &[tripId+date]",
      places: "id, tripId",
      activities: "id, tripId, tripDayId, placeId",
      transports: "id, tripId, tripDayId, originPlaceId, destinationPlaceId",
      accommodations: "id, tripId, placeId",
      bookings: "id, tripId, [linkedEntity.type+linkedEntity.id]",
      expenses: "id, tripId, [linkedEntity.type+linkedEntity.id]",
      images: "id",
      appMeta: "key",
      safetyBackups: "id, createdAt",
    },
  },
  {
    // Countries tab: adds a table, existing data is unchanged.
    version: 2,
    stores: {
      visitedCountries: "countryCode",
    },
  },
];

export const DATABASE_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1].version;
