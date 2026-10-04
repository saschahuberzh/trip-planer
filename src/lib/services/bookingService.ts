/**
 * Booking use cases: grouping (upcoming / past / without date), create/edit/delete, and
 * the entries a booking can link to. Booking prices are informational only.
 */
import { localDateTimeToEpochMs } from "@/lib/domain/dateTime";
import type { Booking } from "@/lib/domain/types";
import { getRepositories, type NewEntity, type Repositories } from "@/lib/repositories";

/** Booking fields edited by the user. */
export type BookingInput = Omit<NewEntity<Booking>, "tripId">;

export interface BookingGroups {
  /** Soonest first. */
  upcoming: Booking[];
  /** Most recent first. */
  past: Booking[];
  withoutDate: Booking[];
}

/** Splits bookings at `nowMs`, comparing each local date/time as the instant it occurs in its time zone. */
export function groupBookings(bookings: readonly Booking[], nowMs: number): BookingGroups {
  const dated = bookings
    .filter((booking): booking is Booking & { dateTime: NonNullable<Booking["dateTime"]> } => booking.dateTime !== undefined)
    .map((booking) => ({ booking, at: localDateTimeToEpochMs(booking.dateTime) }));
  const byTitle = (a: Booking, b: Booking) => a.title.localeCompare(b.title);
  return {
    upcoming: dated
      .filter((item) => item.at >= nowMs)
      .sort((a, b) => a.at - b.at || byTitle(a.booking, b.booking))
      .map((item) => item.booking),
    past: dated
      .filter((item) => item.at < nowMs)
      .sort((a, b) => b.at - a.at || byTitle(a.booking, b.booking))
      .map((item) => item.booking),
    withoutDate: bookings.filter((booking) => booking.dateTime === undefined).sort(byTitle),
  };
}

export function createBookingService(repos: Repositories) {
  return {
    listBookings(tripId: string): Promise<Booking[]> {
      return repos.bookings.listByTrip(tripId);
    },

    createBooking(tripId: string, input: BookingInput): Promise<Booking> {
      return repos.bookings.create({ ...input, tripId });
    },

    updateBooking(id: string, input: BookingInput): Promise<Booking> {
      // Every key is listed so that cleared optional fields are removed.
      return repos.bookings.update(id, {
        type: input.type,
        title: input.title,
        dateTime: input.dateTime,
        price: input.price,
        currency: input.currency,
        bookingReference: input.bookingReference,
        url: input.url,
        notes: input.notes,
        linkedEntity: input.linkedEntity,
      });
    },

    /** Deletes the booking; expenses linking to it are kept and unlinked. */
    deleteBooking(id: string): Promise<void> {
      return repos.bookings.delete(id);
    },
  };
}

export type BookingService = ReturnType<typeof createBookingService>;

let service: BookingService | null = null;

export function getBookingService(): BookingService {
  service ??= createBookingService(getRepositories());
  return service;
}
