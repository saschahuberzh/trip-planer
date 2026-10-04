"use client";

import { useState } from "react";
import { compareCalendarDates } from "@/lib/domain/dateTime";
import type { Accommodation } from "@/lib/domain/types";
import { useItinerary } from "@/lib/hooks/useItinerary";
import { nightCoverage, nightsOf } from "@/lib/services/accommodationSchedule";
import type { Itinerary } from "@/lib/services/itineraryService";
import { Button } from "@/components/ui/Button";
import { MapPinIcon, PlusIcon } from "@/components/ui/icons";
import { formatMoney } from "@/components/trips/tripDisplay";
import { AccommodationSheet, type AccommodationSheetTarget } from "./AccommodationSheet";
import { stayDates, stayLocation } from "./stayDisplay";
import { LoadError, ScreenSkeleton, TripNotFound } from "@/components/ui/ScreenState";

/** All accommodation of the trip, chronologically. */
export function AccommodationScreen() {
  const itinerary = useItinerary();
  if (itinerary.status === "loading") return <ScreenSkeleton />;
  if (itinerary.status === "error") {
    return (
      <LoadError what="Accommodation" />
    );
  }
  if (itinerary.data === undefined) return <TripNotFound />;
  return <AccommodationContent itinerary={itinerary.data} />;
}

/** Suggested check-in for a new stay: the last check-out, else the trip start. */
function nextCheckIn(itinerary: Itinerary): string {
  const last = itinerary.accommodations.at(-1);
  if (last === undefined) return itinerary.trip.startDate;
  const candidate = last.checkOutDate;
  return compareCalendarDates(candidate, itinerary.trip.endDate) > 0 ? itinerary.trip.endDate : candidate;
}

function AccommodationContent({ itinerary }: { itinerary: Itinerary }) {
  const [target, setTarget] = useState<AccommodationSheetTarget | null>(null);
  const { trip, accommodations, places } = itinerary;
  const coverage = nightCoverage(trip, accommodations);
  const tripNights = coverage.nights;
  const openNights = coverage.uncovered.length;

  return (
    <section className="mx-auto max-w-md space-y-3 px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {tripNights === 0
            ? "Day trip"
            : openNights === 0
              ? `All ${tripNights} nights covered`
              : `${openNights} of ${tripNights} nights without accommodation`}
        </p>
        <Button onClick={() => setTarget({ mode: "create", checkInDate: nextCheckIn(itinerary) })} className="shrink-0">
          <PlusIcon />
          Add
        </Button>
      </div>

      {accommodations.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-3xl" aria-hidden="true">
            🛏️
          </p>
          <h2 className="mt-2 text-lg font-semibold">Where do you sleep?</h2>
          <p className="mt-1 text-slate-600">Add hotels, guesthouses or night trains. They appear on the days of your stay.</p>
          <Button onClick={() => setTarget({ mode: "create", checkInDate: trip.startDate })} className="mt-4 w-full">
            <PlusIcon />
            Add accommodation
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {accommodations.map((accommodation) => (
            <li key={accommodation.id}>
              <AccommodationCard
                accommodation={accommodation}
                location={stayLocation(accommodation, places)}
                onOpen={() => setTarget({ mode: "edit", accommodation })}
              />
            </li>
          ))}
        </ul>
      )}

      <AccommodationSheet
        tripId={trip.id}
        baseCurrency={trip.baseCurrency}
        places={places}
        target={target}
        onClose={() => setTarget(null)}
      />
    </section>
  );
}

function AccommodationCard({
  accommodation,
  location,
  onOpen,
}: {
  accommodation: Accommodation;
  location: string | undefined;
  onOpen: () => void;
}) {
  const nights = nightsOf(accommodation);
  return (
    <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <button type="button" onClick={onOpen} className="block w-full px-4 pt-3 pb-2 text-left">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-lg font-semibold text-slate-900">{accommodation.name}</span>
          {accommodation.type && (
            <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
              {accommodation.type}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-slate-700">{stayDates(accommodation)}</span>
        <span className="block text-sm text-slate-500">
          {nights === 0 ? "No night" : nights === 1 ? "1 night" : `${nights} nights`}
          {accommodation.price !== undefined &&
            accommodation.currency !== undefined &&
            ` · ${formatMoney(accommodation.price, accommodation.currency)}`}
          {accommodation.bookingReference && ` · Ref ${accommodation.bookingReference}`}
        </span>
        <span className={`mt-1 flex items-center gap-1 text-sm ${location ? "text-slate-600" : "text-amber-700"}`}>
          <MapPinIcon className="size-4 shrink-0" />
          <span className="truncate">{location ?? "No location"}</span>
        </span>
      </button>
      {accommodation.bookingUrl && (
        <a
          href={accommodation.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center border-t border-slate-100 px-4 text-sm font-semibold text-teal-700"
        >
          Open booking ↗
        </a>
      )}
    </div>
  );
}
