import type { TravelDatabase } from "@/lib/db/database";
import type { Booking } from "@/lib/domain/types";
import { assertValidBooking } from "@/lib/domain/validation";
import { EntityNotFoundError } from "./errors";
import { requireLinkedEntity, requireTrip, unlinkLinksTo } from "./references";
import { tripScopedCrud, writeTransaction, type NewEntity } from "./shared";

export type NewBooking = NewEntity<Booking>;

export function createBookingRepository(db: TravelDatabase) {
  const crud = tripScopedCrud<Booking>(db, db.bookings, {
    entityName: "Booking",
    async check(booking) {
      assertValidBooking(booking);
      await requireTrip(db, booking.tripId);
      await requireLinkedEntity(db, booking.linkedEntity, booking.tripId);
    },
  });

  return {
    ...crud,

    /** Deletes the booking; Expenses linking to it are unlinked. */
    delete(id: string): Promise<void> {
      return writeTransaction(db, async () => {
        if (!(await db.bookings.get(id))) throw new EntityNotFoundError("Booking", id);
        await unlinkLinksTo(db, "booking", id);
        await db.bookings.delete(id);
      });
    },
  };
}

export type BookingRepository = ReturnType<typeof createBookingRepository>;
