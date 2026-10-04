import { formatLocalDateTime } from "@/lib/domain/dateTime";
import type { BookingLinkType, BookingType, ExpenseLinkType, LocalDateTime } from "@/lib/domain/types";
import { appRoutePath } from "@/lib/routing/routes";
import type { LinkedEntity } from "@/lib/services/bookingForm";
import type { DayTimeline, Itinerary } from "@/lib/services/itineraryService";
import { formatDayDate } from "@/components/itinerary/itineraryDisplay";
import { transportTitle } from "@/components/itinerary/transportDisplay";

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  flight: "Flight",
  train: "Train",
  accommodation: "Accommodation",
  activity: "Activity",
  other: "Other",
};

export const BOOKING_TYPE_SYMBOLS: Record<BookingType, string> = {
  flight: "✈️",
  train: "🚆",
  accommodation: "🛏️",
  activity: "🎟️",
  other: "📄",
};

/** "Sat, 13 Jun 2026, 09:30 · Tashkent" — local time as entered, with the zone's city. */
export function formatBookingDateTime(value: LocalDateTime): string {
  const when = formatLocalDateTime(value, undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${when} · ${value.timeZone.split("/").at(-1)?.replace(/_/g, " ") ?? value.timeZone}`;
}

export interface LinkOption {
  key: string;
  type: BookingLinkType;
  id: string;
  label: string;
  /** Where to open the linked entry. */
  href: string;
  /** Day of the entry (YYYY-MM-DD), when it is on a day. */
  date?: string;
  entity: LinkedEntity;
}

export function linkKey(type: BookingLinkType | ExpenseLinkType, id: string): string {
  return `${type}:${id}`;
}

/** Everything a booking can link to: transports, accommodations and activities of the trip. */
export function bookingLinkOptions(itinerary: Itinerary): LinkOption[] {
  const { trip, places } = itinerary;
  const timelines: { timeline?: DayTimeline; entries: DayTimeline["entries"] }[] = [
    ...[...itinerary.days, ...itinerary.outsideDays].map((timeline) => ({ timeline, entries: timeline.entries })),
    { entries: itinerary.unplanned },
  ];
  const options: LinkOption[] = [];
  for (const { timeline, entries } of timelines) {
    const when = timeline ? formatDayDate(timeline.day.date) : "Unplanned";
    const href = timeline
      ? appRoutePath({ name: "trip-day", tripId: trip.id, dayId: timeline.day.id })
      : appRoutePath({ name: "trip-section", tripId: trip.id, section: "plan" });
    for (const entry of entries) {
      if (entry.kind === "transport") {
        const title = transportTitle(entry.item, places);
        options.push({
          key: linkKey("transport", entry.item.id),
          type: "transport",
          id: entry.item.id,
          label: `${title} · ${when}`,
          href,
          date: timeline?.day.date,
          entity: { type: "transport", item: entry.item, title },
        });
      } else {
        options.push({
          key: linkKey("activity", entry.item.id),
          type: "activity",
          id: entry.item.id,
          label: `${entry.item.title} · ${when}`,
          href,
          date: timeline?.day.date,
          entity: { type: "activity", item: entry.item },
        });
      }
    }
  }
  for (const accommodation of itinerary.accommodations) {
    options.push({
      key: linkKey("accommodation", accommodation.id),
      type: "accommodation",
      id: accommodation.id,
      label: `${accommodation.name} · ${formatDayDate(accommodation.checkInDate)}`,
      href: appRoutePath({ name: "trip-section", tripId: trip.id, section: "accommodation" }),
      date: accommodation.checkInDate,
      entity: { type: "accommodation", item: accommodation },
    });
  }
  return options;
}
