"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Booking } from "@/lib/domain/types";
import { useItinerary } from "@/lib/hooks/useItinerary";
import { useLiveData } from "@/lib/hooks/useLiveData";
import { getBookingService, groupBookings } from "@/lib/services/bookingService";
import type { Itinerary } from "@/lib/services/itineraryService";
import { Button } from "@/components/ui/Button";
import { ChevronRightIcon, PlusIcon } from "@/components/ui/icons";
import { formatMoney } from "@/components/trips/tripDisplay";
import { BOOKING_TYPE_LABELS, BOOKING_TYPE_SYMBOLS, bookingLinkOptions, formatBookingDateTime, linkKey, type LinkOption } from "./bookingDisplay";
import { BookingSheet, type BookingSheetTarget } from "./BookingSheet";
import { LoadError, ScreenSkeleton, TripNotFound } from "@/components/ui/ScreenState";

/** The trip's bookings: upcoming, without date, past. */
export function BookingsScreen() {
  const itinerary = useItinerary();
  if (itinerary.status === "loading") return <ScreenSkeleton />;
  if (itinerary.status === "error") {
    return (
      <LoadError what="Bookings" />
    );
  }
  if (itinerary.data === undefined) return <TripNotFound />;
  return <BookingsContent itinerary={itinerary.data} />;
}

function BookingsContent({ itinerary }: { itinerary: Itinerary }) {
  const tripId = itinerary.trip.id;
  const bookings = useLiveData(() => getBookingService().listBookings(tripId), [tripId]);
  const [target, setTarget] = useState<BookingSheetTarget | null>(null);
  // "Now" is fixed while the screen is open; grouping doesn't jump while you look at it.
  const [now] = useState(() => Date.now());
  const options = useMemo(() => new Map(bookingLinkOptions(itinerary).map((option) => [option.key, option])), [itinerary]);

  if (bookings.status === "loading") return <ScreenSkeleton />;
  if (bookings.status === "error") {
    return (
      <LoadError what="Bookings" />
    );
  }
  const groups = groupBookings(bookings.data, now);
  const linkOf = (booking: Booking) =>
    booking.linkedEntity ? options.get(linkKey(booking.linkedEntity.type, booking.linkedEntity.id)) : undefined;
  const sections = [
    { title: "Upcoming", items: groups.upcoming },
    { title: "Without date", items: groups.withoutDate },
    { title: "Past", items: groups.past },
  ].filter((section) => section.items.length > 0);

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 py-5 lg:max-w-6xl lg:px-8 lg:py-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {bookings.data.length === 0 ? "No bookings yet" : `${bookings.data.length} booking${bookings.data.length === 1 ? "" : "s"}`}
        </p>
        <Button onClick={() => setTarget({ mode: "create" })} className="shrink-0">
          <PlusIcon />
          Add
        </Button>
      </div>

      {bookings.data.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-3xl" aria-hidden="true">
            🎟️
          </p>
          <h2 className="mt-2 text-lg font-semibold">Keep your bookings at hand</h2>
          <p className="mt-1 text-slate-600">
            Tickets, reservations and confirmations with reference numbers — available offline.
          </p>
          <Button onClick={() => setTarget({ mode: "create" })} className="mt-4 w-full">
            <PlusIcon />
            Add booking
          </Button>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.title} aria-label={section.title} className="space-y-2">
            <h2 className="px-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">{section.title}</h2>
            <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
              {section.items.map((booking) => (
                <li key={booking.id}>
                  <BookingCard booking={booking} link={linkOf(booking)} past={section.title === "Past"} onOpen={() => setTarget({ mode: "edit", booking })} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <BookingSheet itinerary={itinerary} bookings={bookings.data} target={target} onClose={() => setTarget(null)} />
    </section>
  );
}

function BookingCard({ booking, link, past, onOpen }: { booking: Booking; link?: LinkOption; past: boolean; onOpen: () => void }) {
  return (
    <div className={`rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 ${past ? "opacity-75" : ""}`}>
      <button type="button" onClick={onOpen} className="flex w-full gap-3 px-4 pt-3 pb-2 text-left">
        <span aria-hidden="true" className="text-2xl">
          {BOOKING_TYPE_SYMBOLS[booking.type]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold tracking-wide text-slate-500 uppercase">{BOOKING_TYPE_LABELS[booking.type]}</span>
          <span className="block truncate text-lg font-semibold text-slate-900">{booking.title}</span>
          <span className="block text-sm text-slate-700">
            {booking.dateTime ? formatBookingDateTime(booking.dateTime) : "No date"}
          </span>
          {(booking.bookingReference || booking.price !== undefined) && (
            <span className="block text-sm text-slate-600">
              {[
                booking.bookingReference ? `Ref ${booking.bookingReference}` : undefined,
                booking.price !== undefined && booking.currency !== undefined ? formatMoney(booking.price, booking.currency) : undefined,
              ]
                .filter((part) => part !== undefined)
                .join(" · ")}
            </span>
          )}
        </span>
      </button>
      {(link || booking.url) && (
        <div className="flex divide-x divide-slate-100 border-t border-slate-100">
          {link && (
            <Link href={link.href} className="flex min-h-11 min-w-0 flex-1 items-center gap-1 px-4 text-sm font-medium text-teal-700">
              <span className="truncate">{link.label}</span>
              <ChevronRightIcon className="size-4 shrink-0" />
            </Link>
          )}
          {booking.url && (
            <a
              href={booking.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 shrink-0 items-center px-4 text-sm font-semibold text-teal-700"
            >
              Open ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
