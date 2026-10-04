/**
 * JSON backup format (DATA_MODEL.md "Backup Format"). The format version is independent
 * of the IndexedDB schema version. Increase BACKUP_VERSION when the format changes and
 * add a migration from the previous version to BACKUP_MIGRATIONS (with tests).
 */
export const BACKUP_FORMAT = "travel-planner-backup";
export const BACKUP_VERSION = 2;
/** Oldest backup version this app can read (older ones are migrated in memory). */
export const OLDEST_SUPPORTED_BACKUP_VERSION = 1;

/**
 * In-memory migrations: `BACKUP_MIGRATIONS[n]` turns a raw version-n backup into a raw
 * version n+1 backup. Only entries for supported versions below BACKUP_VERSION exist.
 */
export const BACKUP_MIGRATIONS: Readonly<Record<number, (backup: Record<string, unknown>) => Record<string, unknown>>> = {
  // Format 2 added visited countries (Countries tab); older backups have none.
  1: (backup) => ({ ...backup, visitedCountries: [] }),
};

export const BACKUP_TABLES = [
  "trips",
  "tripDays",
  "places",
  "activities",
  "transports",
  "accommodations",
  "bookings",
  "expenses",
  "images",
  "visitedCountries",
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupCounts = Record<BackupTable, number>;
