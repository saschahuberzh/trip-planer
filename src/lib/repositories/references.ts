/**
 * Cross-table reference checks and unlinking. All functions must run inside a
 * transaction started by a repository (see `writeTransaction`).
 */
import type { Table } from "dexie";
import type { TravelDatabase } from "@/lib/db/database";
import { nowInstant } from "@/lib/domain/dateTime";
import type { BookingLinkType, ExpenseLinkType, Trip } from "@/lib/domain/types";
import { InvalidReferenceError } from "./errors";
import type { TripScopedEntity } from "./shared";

export async function requireTrip(db: TravelDatabase, tripId: string): Promise<Trip> {
  const trip = await db.trips.get(tripId);
  if (!trip) throw new InvalidReferenceError(`Trip ${tripId} does not exist`);
  return trip;
}

/** Ensures the optional reference points to an existing record of the same trip. */
export async function requireInTrip(
  table: Table<TripScopedEntity, string>,
  id: string | undefined,
  tripId: string,
  label: string,
): Promise<void> {
  if (id === undefined) return;
  const record = await table.get(id);
  if (!record || record.tripId !== tripId) {
    throw new InvalidReferenceError(`${label} ${id} does not exist in this trip`);
  }
}

type LinkType = BookingLinkType | ExpenseLinkType;

function linkTargetTable(db: TravelDatabase, type: LinkType): Table<TripScopedEntity, string> {
  switch (type) {
    case "transport":
      return db.transports;
    case "accommodation":
      return db.accommodations;
    case "activity":
      return db.activities;
    case "booking":
      return db.bookings;
  }
}

export async function requireLinkedEntity(
  db: TravelDatabase,
  link: { type: LinkType; id: string } | undefined,
  tripId: string,
): Promise<void> {
  if (link === undefined) return;
  await requireInTrip(linkTargetTable(db, link.type), link.id, tripId, `Linked ${link.type}`);
}

/** Removes `linkedEntity` from Bookings and Expenses that link to the given entity. */
export async function unlinkLinksTo(db: TravelDatabase, type: LinkType, id: string): Promise<void> {
  const updatedAt = nowInstant();
  const unlink = (record: { linkedEntity?: unknown; updatedAt: string }) => {
    delete record.linkedEntity;
    record.updatedAt = updatedAt;
  };
  const index = "[linkedEntity.type+linkedEntity.id]";
  if (type !== "booking") {
    await db.bookings.where(index).equals([type, id]).modify(unlink);
  }
  await db.expenses.where(index).equals([type, id]).modify(unlink);
}

/** Deletes Activities and Transports, unlinking Bookings/Expenses that reference them. */
export async function deleteTimelineEntries(
  db: TravelDatabase,
  activityIds: string[],
  transportIds: string[],
): Promise<void> {
  for (const id of activityIds) await unlinkLinksTo(db, "activity", id);
  for (const id of transportIds) await unlinkLinksTo(db, "transport", id);
  await db.activities.bulkDelete(activityIds);
  await db.transports.bulkDelete(transportIds);
}
