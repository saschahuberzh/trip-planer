import { Dexie } from "dexie";
import type { TravelDatabase } from "@/lib/db/database";
import type { TripDay } from "@/lib/domain/types";
import { assertValidTripDay } from "@/lib/domain/validation";
import { ConflictError, EntityNotFoundError } from "./errors";
import { deleteTimelineEntries, requireInTrip, requireTrip } from "./references";
import { tripScopedCrud, writeTransaction, type NewEntity } from "./shared";

export type NewTripDay = NewEntity<TripDay>;

export class TripDayNotEmptyError extends Error {
  constructor(id: string) {
    super(`Trip day ${id} contains user data`);
    this.name = "TripDayNotEmptyError";
  }
}

export function createTripDayRepository(db: TravelDatabase) {
  const crud = tripScopedCrud<TripDay, "date">(db, db.tripDays, {
    entityName: "Trip day",
    async check(day) {
      assertValidTripDay(day);
      await requireTrip(db, day.tripId);
      const sameDate = await db.tripDays.where("[tripId+date]").equals([day.tripId, day.date]).first();
      if (sameDate && sameDate.id !== day.id) {
        throw new ConflictError(`Trip already has a day for ${day.date}`);
      }
      for (const placeId of day.placeIds ?? []) await requireInTrip(db.places, placeId, day.tripId, "Place");
    },
  });

  async function inspect(id: string) {
    const day = await db.tripDays.get(id);
    if (!day) throw new EntityNotFoundError("Trip day", id);
    const [activityIds, transportIds] = await Promise.all([
      db.activities.where("tripDayId").equals(id).primaryKeys(),
      db.transports.where("tripDayId").equals(id).primaryKeys(),
    ]);
    const hasUserData =
      day.title !== undefined ||
      day.notes !== undefined ||
      day.placeIds !== undefined ||
      activityIds.length > 0 ||
      transportIds.length > 0;
    return { activityIds, transportIds, hasUserData };
  }

  return {
    ...crud,

    /** Days of a trip ordered by date. */
    async listByTrip(tripId: string): Promise<TripDay[]> {
      return db.tripDays.where("[tripId+date]").between([tripId, Dexie.minKey], [tripId, Dexie.maxKey]).toArray();
    },

    /** A day contains user data if it has a title, notes, places of the day, or any Activity or Transport. */
    async hasUserData(id: string): Promise<boolean> {
      return (await db.transaction("r", [db.tripDays, db.activities, db.transports], () => inspect(id)))
        .hasUserData;
    },

    /**
     * Deletes a day. A day with user data is only deleted when `deleteItems` is set,
     * which also deletes its Activities and Transports (unlinking their Bookings/Expenses).
     */
    delete(id: string, { deleteItems = false } = {}): Promise<void> {
      return writeTransaction(db, async () => {
        const { activityIds, transportIds, hasUserData } = await inspect(id);
        if (hasUserData && !deleteItems) throw new TripDayNotEmptyError(id);
        await deleteTimelineEntries(db, activityIds, transportIds);
        await db.tripDays.delete(id);
      });
    },
  };
}

export type TripDayRepository = ReturnType<typeof createTripDayRepository>;
