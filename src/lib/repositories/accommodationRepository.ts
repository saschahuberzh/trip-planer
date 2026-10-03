import type { TravelDatabase } from "@/lib/db/database";
import type { Accommodation } from "@/lib/domain/types";
import { assertValidAccommodation } from "@/lib/domain/validation";
import { EntityNotFoundError } from "./errors";
import { requireInTrip, requireTrip, unlinkLinksTo } from "./references";
import { tripScopedCrud, writeTransaction, type NewEntity } from "./shared";

export type NewAccommodation = NewEntity<Accommodation>;

export function createAccommodationRepository(db: TravelDatabase) {
  const crud = tripScopedCrud<Accommodation>(db, db.accommodations, {
    entityName: "Accommodation",
    async check(accommodation) {
      assertValidAccommodation(accommodation);
      await requireTrip(db, accommodation.tripId);
      await requireInTrip(db.places, accommodation.placeId, accommodation.tripId, "Place");
    },
  });

  return {
    ...crud,

    /** Deletes the accommodation; Bookings and Expenses linking to it are unlinked. */
    delete(id: string): Promise<void> {
      return writeTransaction(db, async () => {
        if (!(await db.accommodations.get(id))) throw new EntityNotFoundError("Accommodation", id);
        await unlinkLinksTo(db, "accommodation", id);
        await db.accommodations.delete(id);
      });
    },
  };
}

export type AccommodationRepository = ReturnType<typeof createAccommodationRepository>;
