/**
 * Complete validation of a backup before anything is modified (DATA_MODEL.md "Validation").
 * Returns either the restorable data (images decoded to Blobs) with a summary and warnings,
 * or the list of problems. Never throws for bad input.
 */
import {
  assertValidAccommodation,
  assertValidActivity,
  assertValidBooking,
  assertValidExpense,
  assertValidImageAsset,
  assertValidPlace,
  assertValidTransport,
  assertValidTrip,
  assertValidTripDay,
  ValidationError,
} from "@/lib/domain/validation";
import {
  IMAGE_MIME_TYPES,
  type Accommodation,
  type Activity,
  type BackupData,
  type Booking,
  type Expense,
  type ImageAsset,
  type ImageMimeType,
  type Place,
  type Transport,
  type Trip,
  type TripDay,
} from "@/lib/domain/types";
import type { DomainSnapshot } from "@/lib/repositories";
import { base64ToBlob } from "./base64";
import {
  BACKUP_FORMAT,
  BACKUP_MIGRATIONS,
  BACKUP_TABLES,
  BACKUP_VERSION,
  OLDEST_SUPPORTED_BACKUP_VERSION,
  type BackupCounts,
} from "./format";

export interface BackupSummary {
  exportedAt: string;
  appVersion: string;
  version: number;
  counts: BackupCounts;
  tripNames: string[];
}

export interface ValidBackup {
  /** Ready for `replaceAll`. */
  data: DomainSnapshot;
  summary: BackupSummary;
  /** Problems that don't block the restore (e.g. unreadable images). */
  warnings: string[];
}

export type BackupValidationResult = { ok: true; backup: ValidBackup } | { ok: false; errors: string[] };

const MAX_LISTED_ERRORS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses the file text; JSON syntax errors become a validation error. */
export function parseBackupText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Brings an older supported backup to the current version (in memory). */
function migrate(raw: Record<string, unknown>): { ok: true; backup: Record<string, unknown> } | { ok: false; error: string } {
  const version = raw.version;
  if (typeof version !== "number" || !Number.isInteger(version)) return { ok: false, error: "The backup has no valid format version." };
  if (version > BACKUP_VERSION) {
    return { ok: false, error: `This backup was created by a newer app version (format ${version}). Update the app first.` };
  }
  if (version < OLDEST_SUPPORTED_BACKUP_VERSION) return { ok: false, error: `Backup format ${version} is no longer supported.` };
  let backup = raw;
  for (let current = version; current < BACKUP_VERSION; current++) {
    const step = BACKUP_MIGRATIONS[current];
    if (!step) return { ok: false, error: `No migration from backup format ${current}.` };
    backup = { ...step(backup), version: current + 1 };
  }
  return { ok: true, backup };
}

export async function validateBackup(input: unknown): Promise<BackupValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (message: string) => errors.push(message);

  if (!isRecord(input)) return { ok: false, errors: ["The file is not a backup (no JSON object)."] };
  if (input.format !== BACKUP_FORMAT) return { ok: false, errors: ["The file is not a Travel Planner backup."] };
  const migrated = migrate(input);
  if (!migrated.ok) return { ok: false, errors: [migrated.error] };
  const raw = migrated.backup;

  for (const table of BACKUP_TABLES) {
    if (!Array.isArray(raw[table])) fail(`"${table}" is missing or not a list.`);
  }
  if (typeof raw.exportedAt !== "string") fail("The export date is missing.");
  if (errors.length > 0) return { ok: false, errors };
  const backup = raw as unknown as BackupData;

  // --- Records ------------------------------------------------------------------
  function checkRecords<T extends { id: string }>(table: string, items: unknown[], check: (item: T) => void): T[] {
    const valid: T[] = [];
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const label = `${table}[${index}]${isRecord(item) && typeof item.id === "string" ? ` (${item.id})` : ""}`;
      if (!isRecord(item)) {
        fail(`${label}: not an object.`);
        return;
      }
      try {
        check(item as unknown as T);
      } catch (error) {
        fail(`${label}: ${error instanceof ValidationError ? error.issues.join("; ") : "malformed record"}.`);
        return;
      }
      const record = item as unknown as T;
      if (seen.has(record.id)) fail(`${label}: duplicate ID.`);
      seen.add(record.id);
      valid.push(record);
    });
    return valid;
  }

  const trips = checkRecords<Trip>("trips", backup.trips, assertValidTrip);
  const tripsById = new Map(trips.map((trip) => [trip.id, trip]));
  const tripDays = checkRecords<TripDay>("tripDays", backup.tripDays, assertValidTripDay);
  const places = checkRecords<Place>("places", backup.places, assertValidPlace);
  const activities = checkRecords<Activity>("activities", backup.activities, assertValidActivity);
  const transports = checkRecords<Transport>("transports", backup.transports, assertValidTransport);
  const accommodations = checkRecords<Accommodation>("accommodations", backup.accommodations, assertValidAccommodation);
  const bookings = checkRecords<Booking>("bookings", backup.bookings, assertValidBooking);
  const expenses = checkRecords<Expense>("expenses", backup.expenses, (expense) => {
    // Without its trip ("" matches no currency) the reference check below reports the problem.
    assertValidExpense(expense, tripsById.get(expense.tripId)?.baseCurrency ?? "");
  });

  // --- Images: unreadable ones are dropped with a warning (never block a restore) ---
  const images: ImageAsset[] = [];
  const imageIds = new Set<string>();
  backup.images.forEach((item, index) => {
    const label = `Image ${index + 1}`;
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.dataBase64 !== "string") {
      warnings.push(`${label} is incomplete and was skipped.`);
      return;
    }
    const mimeType = item.mimeType;
    const blob =
      typeof mimeType === "string" && (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)
        ? base64ToBlob(item.dataBase64, mimeType)
        : null;
    if (blob === null || blob.size === 0 || imageIds.has(item.id)) {
      warnings.push(`${label} could not be read and was skipped.`);
      return;
    }
    // Shape-checked right below by assertValidImageAsset.
    const image = {
      id: item.id,
      mimeType: mimeType as ImageMimeType,
      blob,
      width: item.width,
      height: item.height,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    } as ImageAsset;
    try {
      assertValidImageAsset(image);
    } catch {
      warnings.push(`${label} has invalid details and was skipped.`);
      return;
    }
    imageIds.add(image.id);
    images.push(image);
  });

  if (errors.length > 0) return { ok: false, errors: limit(errors) };

  // --- References -----------------------------------------------------------------
  const byId = <T extends { id: string; tripId: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));
  const daysById = byId(tripDays);
  const placesById = byId(places);
  const linkTargets = {
    transport: byId(transports),
    accommodation: byId(accommodations),
    activity: byId(activities),
    booking: byId(bookings),
  };
  const inTrip = (map: Map<string, { tripId: string }>, id: string | undefined, tripId: string) =>
    id === undefined || map.get(id)?.tripId === tripId;
  const refFail = (label: string, field: string, id: string) => fail(`${label}: ${field} ${id} does not exist in its trip.`);

  const tripScoped: [string, { id: string; tripId: string }[]][] = [
    ["tripDays", tripDays],
    ["places", places],
    ["activities", activities],
    ["transports", transports],
    ["accommodations", accommodations],
    ["bookings", bookings],
    ["expenses", expenses],
  ];
  for (const [table, items] of tripScoped) {
    for (const item of items) if (!tripsById.has(item.tripId)) fail(`${table} (${item.id}): trip ${item.tripId} does not exist.`);
  }

  const dayKeys = new Set<string>();
  for (const day of tripDays) {
    const key = `${day.tripId}|${day.date}`;
    if (dayKeys.has(key)) fail(`tripDays (${day.id}): the trip already has a day on ${day.date}.`);
    dayKeys.add(key);
    for (const placeId of day.placeIds ?? []) if (!inTrip(placesById, placeId, day.tripId)) refFail(`tripDays (${day.id})`, "place", placeId);
  }
  for (const activity of activities) {
    if (!inTrip(daysById, activity.tripDayId, activity.tripId)) refFail(`activities (${activity.id})`, "day", activity.tripDayId ?? "");
    if (!inTrip(placesById, activity.placeId, activity.tripId)) refFail(`activities (${activity.id})`, "place", activity.placeId ?? "");
  }
  for (const transport of transports) {
    const label = `transports (${transport.id})`;
    if (!inTrip(daysById, transport.tripDayId, transport.tripId)) refFail(label, "day", transport.tripDayId ?? "");
    if (!inTrip(placesById, transport.originPlaceId, transport.tripId)) refFail(label, "origin place", transport.originPlaceId ?? "");
    if (!inTrip(placesById, transport.destinationPlaceId, transport.tripId)) refFail(label, "destination place", transport.destinationPlaceId ?? "");
  }
  for (const accommodation of accommodations) {
    if (!inTrip(placesById, accommodation.placeId, accommodation.tripId)) refFail(`accommodations (${accommodation.id})`, "place", accommodation.placeId ?? "");
  }
  for (const [table, items] of [["bookings", bookings], ["expenses", expenses]] as const) {
    for (const item of items) {
      const link = item.linkedEntity;
      if (link && !inTrip(linkTargets[link.type], link.id, item.tripId)) refFail(`${table} (${item.id})`, `linked ${link.type}`, link.id);
    }
  }
  if (errors.length > 0) return { ok: false, errors: limit(errors) };

  // Cover images that are missing or unreadable are cleared (with a warning).
  const restoredTrips = trips.map((trip) => {
    if (trip.coverImageId === undefined || imageIds.has(trip.coverImageId)) return trip;
    warnings.push(`The cover photo of "${trip.name}" is missing and was removed.`);
    const withoutCover = { ...trip };
    delete withoutCover.coverImageId;
    return withoutCover;
  });
  const usedImages = new Set(restoredTrips.flatMap((trip) => (trip.coverImageId ? [trip.coverImageId] : [])));

  const data: DomainSnapshot = {
    trips: restoredTrips,
    tripDays,
    places,
    activities,
    transports,
    accommodations,
    bookings,
    expenses,
    // Images no trip uses would be orphans; they are not restored.
    images: images.filter((image) => usedImages.has(image.id)),
  };
  return {
    ok: true,
    backup: {
      data,
      warnings,
      summary: {
        exportedAt: backup.exportedAt,
        appVersion: typeof backup.appVersion === "string" ? backup.appVersion : "unknown",
        version: backup.version,
        counts: Object.fromEntries(BACKUP_TABLES.map((table) => [table, data[table].length])) as BackupCounts,
        tripNames: restoredTrips.map((trip) => trip.name).sort((a, b) => a.localeCompare(b)),
      },
    },
  };
}

function limit(errors: string[]): string[] {
  return errors.length <= MAX_LISTED_ERRORS ? errors : [...errors.slice(0, MAX_LISTED_ERRORS), `… and ${errors.length - MAX_LISTED_ERRORS} more problems.`];
}
