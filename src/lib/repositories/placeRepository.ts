import type { TravelDatabase } from "@/lib/db/database";
import { nowInstant } from "@/lib/domain/dateTime";
import type { Place } from "@/lib/domain/types";
import { assertValidPlace } from "@/lib/domain/validation";
import { EntityNotFoundError } from "./errors";
import { requireTrip } from "./references";
import { tripScopedCrud, writeTransaction, type NewEntity } from "./shared";

export type NewPlace = NewEntity<Place>;

export function createPlaceRepository(db: TravelDatabase) {
  const crud = tripScopedCrud<Place>(db, db.places, {
    entityName: "Place",
    async check(place) {
      assertValidPlace(place);
      await requireTrip(db, place.tripId);
    },
  });

  return {
    ...crud,

    /**
     * Deletes a place and unlinks references to it: Activities keep their title,
     * Transports get the place name as origin/destination text, Accommodations
     * receive the place's address and coordinates.
     */
    delete(id: string): Promise<void> {
      return writeTransaction(db, async () => {
        const place = await db.places.get(id);
        if (!place) throw new EntityNotFoundError("Place", id);
        const updatedAt = nowInstant();

        await db.activities.where("placeId").equals(id).modify((activity) => {
          delete activity.placeId;
          activity.updatedAt = updatedAt;
        });
        await db.transports.where("originPlaceId").equals(id).modify((transport) => {
          delete transport.originPlaceId;
          transport.originText = place.name;
          transport.updatedAt = updatedAt;
        });
        await db.transports.where("destinationPlaceId").equals(id).modify((transport) => {
          delete transport.destinationPlaceId;
          transport.destinationText = place.name;
          transport.updatedAt = updatedAt;
        });
        await db.accommodations.where("placeId").equals(id).modify((accommodation) => {
          delete accommodation.placeId;
          if (place.address !== undefined) accommodation.address = place.address;
          if (place.latitude !== undefined && place.longitude !== undefined) {
            accommodation.latitude = place.latitude;
            accommodation.longitude = place.longitude;
          }
          accommodation.updatedAt = updatedAt;
        });
        await db.places.delete(id);
      });
    },
  };
}

export type PlaceRepository = ReturnType<typeof createPlaceRepository>;
