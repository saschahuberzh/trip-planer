import type { Accommodation, Place } from "@/lib/domain/types";
import type { StayOnDate } from "@/lib/services/accommodationSchedule";
import { formatDayDate } from "@/components/itinerary/itineraryDisplay";

/** "Check-in 14:00", "Night 2 of 3", "Check-out 11:00". */
export function stayRoleLabel(stay: StayOnDate): string {
  const { accommodation, role, night, nights } = stay;
  if (role === "check-in") return accommodation.checkInTime ? `Check-in ${accommodation.checkInTime}` : "Check-in";
  if (role === "check-out") return accommodation.checkOutTime ? `Check-out ${accommodation.checkOutTime}` : "Check-out";
  return `Night ${night} of ${nights}`;
}

/** "Fri, 12 Jun 14:00 → Sun, 14 Jun 11:00". */
export function stayDates(accommodation: Accommodation): string {
  const checkIn = `${formatDayDate(accommodation.checkInDate)}${accommodation.checkInTime ? ` ${accommodation.checkInTime}` : ""}`;
  const checkOut = `${formatDayDate(accommodation.checkOutDate)}${accommodation.checkOutTime ? ` ${accommodation.checkOutTime}` : ""}`;
  return `${checkIn} → ${checkOut}`;
}

/** Address from the linked place (authoritative) or the accommodation's own fields. */
export function stayLocation(accommodation: Accommodation, places: ReadonlyMap<string, Place>): string | undefined {
  if (accommodation.placeId !== undefined) {
    const place = places.get(accommodation.placeId);
    return place ? (place.address ?? place.name) : undefined;
  }
  return accommodation.address;
}
