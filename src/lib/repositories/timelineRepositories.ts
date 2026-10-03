/**
 * Activities and Transports: the two entry types of the itinerary timeline.
 * These repositories store `tripDayId`/`sortOrder` as given; computing and rewriting
 * order belongs to the itinerary service, not to these repositories.
 */
import type { TravelDatabase } from "@/lib/db/database";
import type { Activity, Transport } from "@/lib/domain/types";
import { assertValidActivity, assertValidTransport } from "@/lib/domain/validation";
import { EntityNotFoundError } from "./errors";
import { deleteTimelineEntries, requireInTrip, requireTrip } from "./references";
import { tripScopedCrud, writeTransaction, type NewEntity } from "./shared";

export type NewActivity = NewEntity<Activity>;
export type NewTransport = NewEntity<Transport>;

export function createActivityRepository(db: TravelDatabase) {
  const crud = tripScopedCrud<Activity>(db, db.activities, {
    entityName: "Activity",
    async check(activity) {
      assertValidActivity(activity);
      await requireTrip(db, activity.tripId);
      await requireInTrip(db.tripDays, activity.tripDayId, activity.tripId, "Trip day");
      await requireInTrip(db.places, activity.placeId, activity.tripId, "Place");
    },
  });

  return {
    ...crud,

    listByTripDay(tripDayId: string): Promise<Activity[]> {
      return db.activities.where("tripDayId").equals(tripDayId).toArray();
    },

    /** Deletes the activity; Bookings and Expenses linking to it are unlinked. */
    delete(id: string): Promise<void> {
      return writeTransaction(db, async () => {
        if (!(await db.activities.get(id))) throw new EntityNotFoundError("Activity", id);
        await deleteTimelineEntries(db, [id], []);
      });
    },
  };
}

export function createTransportRepository(db: TravelDatabase) {
  const crud = tripScopedCrud<Transport>(db, db.transports, {
    entityName: "Transport",
    async check(transport) {
      assertValidTransport(transport);
      await requireTrip(db, transport.tripId);
      await requireInTrip(db.tripDays, transport.tripDayId, transport.tripId, "Trip day");
      await requireInTrip(db.places, transport.originPlaceId, transport.tripId, "Origin place");
      await requireInTrip(db.places, transport.destinationPlaceId, transport.tripId, "Destination place");
    },
  });

  return {
    ...crud,

    listByTripDay(tripDayId: string): Promise<Transport[]> {
      return db.transports.where("tripDayId").equals(tripDayId).toArray();
    },

    /** Deletes the transport; Bookings and Expenses linking to it are unlinked. */
    delete(id: string): Promise<void> {
      return writeTransaction(db, async () => {
        if (!(await db.transports.get(id))) throw new EntityNotFoundError("Transport", id);
        await deleteTimelineEntries(db, [], [id]);
      });
    },
  };
}

export type ActivityRepository = ReturnType<typeof createActivityRepository>;
export type TransportRepository = ReturnType<typeof createTransportRepository>;
