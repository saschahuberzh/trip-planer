/**
 * Accommodation use cases: the trip's accommodations (chronological), create/edit/delete.
 * Accommodations are not part of the ordered timeline; days show them via staysOnDate.
 */
import type { Accommodation, Booking, Expense } from "@/lib/domain/types";
import { getRepositories, type NewEntity, type Repositories } from "@/lib/repositories";
import { sortAccommodations } from "./accommodationSchedule";

/** Accommodation fields edited by the user. */
export type AccommodationInput = Omit<NewEntity<Accommodation>, "tripId">;

export interface AccommodationLinks {
  bookings: Booking[];
  expenses: Expense[];
}

export function createAccommodationService(repos: Repositories) {
  return {
    async listAccommodations(tripId: string): Promise<Accommodation[]> {
      return sortAccommodations(await repos.accommodations.listByTrip(tripId));
    },

    createAccommodation(tripId: string, input: AccommodationInput): Promise<Accommodation> {
      return repos.accommodations.create({ ...input, tripId });
    },

    updateAccommodation(id: string, input: AccommodationInput): Promise<Accommodation> {
      // Every key is listed so that cleared optional fields are removed.
      return repos.accommodations.update(id, {
        name: input.name,
        type: input.type,
        checkInDate: input.checkInDate,
        checkInTime: input.checkInTime,
        checkOutDate: input.checkOutDate,
        checkOutTime: input.checkOutTime,
        placeId: input.placeId,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        price: input.price,
        currency: input.currency,
        bookingReference: input.bookingReference,
        bookingUrl: input.bookingUrl,
        notes: input.notes,
      });
    },

    /** Bookings and expenses linking to the accommodation (they are unlinked on delete). */
    async getLinks(id: string, tripId: string): Promise<AccommodationLinks> {
      const linksTo = <T extends { linkedEntity?: { type: string; id: string } }>(items: T[]) =>
        items.filter((item) => item.linkedEntity?.type === "accommodation" && item.linkedEntity.id === id);
      const [bookings, expenses] = await Promise.all([repos.bookings.listByTrip(tripId), repos.expenses.listByTrip(tripId)]);
      return { bookings: linksTo(bookings), expenses: linksTo(expenses) };
    },

    /** Deletes the accommodation; bookings and expenses linking to it are kept and unlinked. */
    deleteAccommodation(id: string): Promise<void> {
      return repos.accommodations.delete(id);
    },
  };
}

export type AccommodationService = ReturnType<typeof createAccommodationService>;

let service: AccommodationService | null = null;

export function getAccommodationService(): AccommodationService {
  service ??= createAccommodationService(getRepositories());
  return service;
}
