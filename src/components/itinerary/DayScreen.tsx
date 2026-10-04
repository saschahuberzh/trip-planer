"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useItinerary } from "@/lib/hooks/useItinerary";
import { appRoutePath } from "@/lib/routing/routes";
import { useAppRoute } from "@/lib/routing/useAppRoute";
import type { DayTimeline, Itinerary } from "@/lib/services/itineraryService";
import { Button, buttonClass } from "@/components/ui/Button";
import { AlertIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon } from "@/components/ui/icons";
import { DayMapPreview } from "@/components/map/DayMapPreview";
import { StaysOnDay } from "@/components/accommodation/StaysOnDay";
import { DayPlacesCard } from "./DayPlacesCard";
import { ItineraryDialogs, type ItineraryDialog } from "./ItineraryDialogs";
import { dayLabel, formatDayDate, formatDayDateLong } from "./itineraryDisplay";
import { TimelineList } from "./TimelineList";
import { LoadError, ScreenMessage, ScreenSkeleton, TripNotFound } from "@/components/ui/ScreenState";

/** One day: date, title, notes and its ordered timeline. */
export function DayScreen() {
  const route = useAppRoute();
  const itinerary = useItinerary();
  const dayId = route?.name === "trip-day" ? route.dayId : null;

  if (itinerary.status === "loading" || dayId === null) return <ScreenSkeleton />;
  if (itinerary.status === "error") {
    return (
      <LoadError what="This day" />
    );
  }
  if (itinerary.data === undefined) return <TripNotFound />;

  const { days, outsideDays, trip } = itinerary.data;
  const index = days.findIndex((timeline) => timeline.day.id === dayId);
  const timeline = index >= 0 ? days[index] : outsideDays.find((candidate) => candidate.day.id === dayId);
  if (timeline === undefined) {
    return (
      <ScreenMessage title="Day not found">
        This day is no longer part of the trip. Its items may have been moved or the trip dates changed.
        <Link
          href={appRoutePath({ name: "trip-section", tripId: trip.id, section: "plan" })}
          className={buttonClass("primary", "mt-4 w-full")}
        >
          Back to itinerary
        </Link>
      </ScreenMessage>
    );
  }
  return (
    <DayContent
      itinerary={itinerary.data}
      timeline={timeline}
      previous={index > 0 ? days[index - 1] : undefined}
      next={index >= 0 && index < days.length - 1 ? days[index + 1] : undefined}
    />
  );
}

type DayContentProps = {
  itinerary: Itinerary;
  timeline: DayTimeline;
  previous?: DayTimeline;
  next?: DayTimeline;
};

function DayContent({ itinerary, timeline, previous, next }: DayContentProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<ItineraryDialog | null>(null);
  const { trip } = itinerary;
  const { day } = timeline;
  const planPath = appRoutePath({ name: "trip-section", tripId: trip.id, section: "plan" });
  const dayPath = (target: DayTimeline) => appRoutePath({ name: "trip-day", tripId: trip.id, dayId: target.day.id });

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 py-5">
      <nav aria-label="Days" className="flex items-center justify-between gap-2">
        <Link href={planPath} className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl pr-3 pl-1 text-sm font-medium text-teal-700">
          <ChevronLeftIcon />
          All days
        </Link>
        <div className="flex gap-1">
          <DayStepLink target={previous} href={previous && dayPath(previous)} direction="previous" />
          <DayStepLink target={next} href={next && dayPath(next)} direction="next" />
        </div>
      </nav>

      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold tracking-wide uppercase ${timeline.outside ? "text-amber-700" : "text-teal-700"}`}>
            {dayLabel(timeline)}
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{formatDayDateLong(day.date)}</h2>
          {day.title !== undefined && <p className="mt-0.5 text-lg text-slate-700">{day.title}</p>}
        </div>
        <Button variant="secondary" onClick={() => setDialog({ type: "edit-day", day })} aria-label="Edit day title and notes">
          <PencilIcon />
          Edit
        </Button>
      </header>

      {timeline.outside && (
        <div role="note" className="space-y-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
          <p className="flex gap-2">
            <AlertIcon className="size-5 shrink-0 text-amber-600" />
            This day is outside the trip dates. Move its items, change the trip dates, or delete the day.
          </p>
          <div className="flex flex-wrap gap-2">
            {timeline.entries.length > 0 && (
              <Button variant="secondary" onClick={() => setDialog({ type: "move-day-entries", timeline })} className="bg-white">
                Move all items
              </Button>
            )}
            <Button variant="secondary" onClick={() => setDialog({ type: "edit-trip" })} className="bg-white">
              Change dates
            </Button>
            <Button variant="secondary" onClick={() => setDialog({ type: "delete-day", timeline })} className="bg-white text-red-600">
              Delete day
            </Button>
          </div>
        </div>
      )}

      <DayPlacesCard tripId={trip.id} day={day} places={itinerary.places} />

      <section aria-labelledby="day-stay-heading" className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <h3 id="day-stay-heading" className="px-4 pt-3 pb-2 text-sm font-semibold text-slate-500">
          Accommodation
        </h3>
        <StaysOnDay
          accommodations={itinerary.accommodations}
          date={day.date}
          onOpen={(accommodation) => setDialog({ type: "edit-accommodation", accommodation })}
        />
        <div className="p-2">
          <Button
            variant="ghost"
            onClick={() => setDialog({ type: "create-accommodation", checkInDate: day.date })}
            className="w-full text-teal-700"
          >
            <PlusIcon />
            Add accommodation
          </Button>
        </div>
      </section>

      <DayMapPreview itinerary={itinerary} tripDayId={day.id} />

      {day.notes !== undefined ? (
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-sm font-semibold text-slate-500">Notes</h3>
          <p className="mt-1 whitespace-pre-line text-slate-800">{day.notes}</p>
        </div>
      ) : null}

      <section aria-label="Timeline" className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <TimelineList
          entries={timeline.entries}
          places={itinerary.places}
          sortDate={{ tripDayId: day.id, date: day.date }}
          emptyState={
            <div className="py-4 text-center">
              <p className="font-medium text-slate-700">Nothing planned for this day yet</p>
              <p className="mt-1">Add activities with or without a time.</p>
            </div>
          }
          onAdd={() => setDialog({ type: "create-activity", tripDayId: day.id })}
          onAddPlace={() => setDialog({ type: "add-place", tripDayId: day.id })}
          onOpenActivity={(activity) => setDialog({ type: "edit-activity", activity })}
          onMoveEntry={(entry) => setDialog({ type: "move-entry", entry })}
          onAddTransport={() => setDialog({ type: "create-transport", tripDayId: day.id })}
          onOpenTransport={(transport) => setDialog({ type: "edit-transport", transport })}
        />
      </section>

      <ItineraryDialogs
        itinerary={itinerary}
        dialog={dialog}
        onClose={() => setDialog(null)}
        onDayDeleted={() => router.replace(planPath)}
      />
    </section>
  );
}

function DayStepLink({
  target,
  href,
  direction,
}: {
  target?: DayTimeline;
  href?: string;
  direction: "previous" | "next";
}) {
  const icon = direction === "previous" ? <ChevronLeftIcon /> : <ChevronRightIcon />;
  const className = "flex size-11 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200";
  if (target === undefined || href === undefined) {
    return (
      <span aria-hidden="true" className={`${className} text-slate-300`}>
        {icon}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={`${direction === "previous" ? "Previous" : "Next"} day: ${formatDayDate(target.day.date)}`}
      className={`${className} text-slate-700 hover:bg-slate-50`}
    >
      {icon}
    </Link>
  );
}
