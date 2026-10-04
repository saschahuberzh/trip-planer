"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Accommodation, Activity, Place, Transport } from "@/lib/domain/types";
import { useItinerary } from "@/lib/hooks/useItinerary";
import { appRoutePath } from "@/lib/routing/routes";
import type { TimelineEntry } from "@/lib/services/itineraryOrdering";
import type { DayTimeline, Itinerary } from "@/lib/services/itineraryService";
import { Button } from "@/components/ui/Button";
import { AlertIcon, ChevronRightIcon, InboxIcon, MapPinIcon } from "@/components/ui/icons";
import { StaysOnDay } from "@/components/accommodation/StaysOnDay";
import { ItineraryDialogs, type ItineraryDialog } from "./ItineraryDialogs";
import { dayLabel, dayPlacesLabel, formatDayDate } from "./itineraryDisplay";
import { TimelineList } from "./TimelineList";
import { LoadError, ScreenSkeleton, TripNotFound } from "@/components/ui/ScreenState";

/** The trip's itinerary: outside-date days, all days chronologically, and Unplanned. */
export function PlanScreen() {
  const itinerary = useItinerary();

  if (itinerary.status === "loading") return <ScreenSkeleton />;
  if (itinerary.status === "error") {
    return (
      <LoadError what="The itinerary" />
    );
  }
  if (itinerary.data === undefined) return <TripNotFound />;
  return <PlanContent itinerary={itinerary.data} />;
}

function PlanContent({ itinerary }: { itinerary: Itinerary }) {
  const [dialog, setDialog] = useState<ItineraryDialog | null>(null);
  const { trip, days, outsideDays, unplanned } = itinerary;

  const openAccommodation = (accommodation: Accommodation) => setDialog({ type: "edit-accommodation", accommodation });

  const timelineHandlers = (tripDayId: string | undefined) => ({
    onAdd: () => setDialog({ type: "create-activity", tripDayId }),
    onOpenActivity: (activity: Activity) => setDialog({ type: "edit-activity", activity }),
    onMoveEntry: (entry: TimelineEntry) => setDialog({ type: "move-entry", entry }),
    onAddTransport: () => setDialog({ type: "create-transport", tripDayId }),
    onOpenTransport: (transport: Transport) => setDialog({ type: "edit-transport", transport }),
  });

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 py-5 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6 lg:space-y-0 lg:px-8 lg:py-8">
      {/* Large screens: days on the left, Unplanned fixed on the right. */}
      <div className="space-y-4">
        {trip.notes !== undefined && (
          <section aria-labelledby="trip-notes-heading" className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 id="trip-notes-heading" className="text-sm font-semibold text-slate-500">
              Trip notes
            </h2>
            <p className="mt-1 whitespace-pre-line text-slate-800">{trip.notes}</p>
          </section>
        )}
        {outsideDays.length > 0 && (
          <section aria-labelledby="outside-heading" className="space-y-3">
            <div className="flex gap-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
              <AlertIcon className="size-5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <h2 id="outside-heading" className="font-semibold">
                  Outside trip dates
                </h2>
                <p className="mt-0.5">
                  {outsideDays.length === 1 ? "This day has" : "These days have"} plans but{" "}
                  {outsideDays.length === 1 ? "is" : "are"} no longer within the trip dates. Move the items, change
                  the trip dates, or delete the day.
                </p>
                <Button variant="secondary" onClick={() => setDialog({ type: "edit-trip" })} className="mt-2 bg-white">
                  Change trip dates
                </Button>
              </div>
            </div>
            {outsideDays.map((timeline) => (
              <DayCard
                key={timeline.day.id}
                tripId={trip.id}
                timeline={timeline}
                places={itinerary.places}
                accommodations={itinerary.accommodations}
                onOpenAccommodation={openAccommodation}
                {...timelineHandlers(timeline.day.id)}
                outsideActions={
                  <div className="flex gap-2 border-t border-amber-100 p-2">
                    {timeline.entries.length > 0 && (
                      <Button
                        variant="ghost"
                        onClick={() => setDialog({ type: "move-day-entries", timeline })}
                        className="flex-1"
                      >
                        Move all items
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => setDialog({ type: "delete-day", timeline })}
                      className="flex-1 text-red-600"
                    >
                      Delete day
                    </Button>
                  </div>
                }
              />
            ))}
          </section>
        )}

        <section aria-label="Days" className="space-y-4">
          {days.map((timeline) => (
            <DayCard
              key={timeline.day.id}
              tripId={trip.id}
              timeline={timeline}
              places={itinerary.places}
              accommodations={itinerary.accommodations}
              onOpenAccommodation={openAccommodation}
              {...timelineHandlers(timeline.day.id)}
            />
          ))}
        </section>
      </div>

      <section
        aria-labelledby="unplanned-heading"
        className="rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50/40 lg:sticky lg:top-6"
      >
        <header className="flex items-center gap-2 px-4 pt-3 pb-1">
          <InboxIcon className="size-5 text-amber-600" />
          <h2 id="unplanned-heading" className="font-semibold text-slate-900">
            Unplanned
          </h2>
          {unplanned.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
              {unplanned.length}
            </span>
          )}
        </header>
        <TimelineList
          entries={unplanned}
          places={itinerary.places}
          emptyState="Ideas without a day go here. Assign them to a day whenever you're ready."
          ideas
          {...timelineHandlers(undefined)}
        />
      </section>

      <ItineraryDialogs itinerary={itinerary} dialog={dialog} onClose={() => setDialog(null)} />
    </section>
  );
}

type DayCardProps = {
  tripId: string;
  timeline: DayTimeline;
  places: ReadonlyMap<string, Place>;
  accommodations: readonly Accommodation[];
  onOpenAccommodation: (accommodation: Accommodation) => void;
  onAdd: () => void;
  onOpenActivity: (activity: Activity) => void;
  onMoveEntry: (entry: TimelineEntry) => void;
  onAddTransport: () => void;
  onOpenTransport: (transport: Transport) => void;
  outsideActions?: ReactNode;
};

function DayCard({ tripId, timeline, outsideActions, accommodations, onOpenAccommodation, ...handlers }: DayCardProps) {
  const { day } = timeline;
  const placesLabel = dayPlacesLabel(day, handlers.places);
  return (
    <article
      className={`overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ${timeline.outside ? "ring-amber-300" : "ring-slate-200"}`}
    >
      <Link
        href={appRoutePath({ name: "trip-day", tripId, dayId: day.id })}
        className="flex items-center gap-3 px-4 pt-3 pb-2 hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold tracking-wide uppercase ${timeline.outside ? "text-amber-700" : "text-teal-700"}`}>
            {dayLabel(timeline)}
          </p>
          <h2 className="truncate text-lg font-semibold text-slate-900">
            {formatDayDate(day.date)}
            {(day.title ?? placesLabel) !== undefined && (
              <span className="font-normal text-slate-600"> · {day.title ?? placesLabel}</span>
            )}
          </h2>
          {day.title !== undefined && placesLabel !== undefined && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-teal-800">
              <MapPinIcon className="size-3.5 shrink-0" />
              <span className="truncate">{placesLabel}</span>
            </p>
          )}
          {day.notes !== undefined && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{day.notes}</p>}
        </div>
        <ChevronRightIcon className="size-5 shrink-0 text-slate-400" />
      </Link>
      <StaysOnDay accommodations={accommodations} date={day.date} onOpen={onOpenAccommodation} />
      <TimelineList
        entries={timeline.entries}
        sortDate={{ tripDayId: day.id, date: day.date }}
        emptyState="Nothing planned yet."
        {...handlers}
      />
      {outsideActions}
    </article>
  );
}
