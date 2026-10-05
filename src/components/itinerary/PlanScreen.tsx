"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { deviceToday, formatCalendarDate } from "@/lib/domain/dateTime";
import type { Accommodation, Activity, Place, Transport } from "@/lib/domain/types";
import { useItinerary } from "@/lib/hooks/useItinerary";
import { appRoutePath } from "@/lib/routing/routes";
import type { TimelineEntry } from "@/lib/services/itineraryOrdering";
import type { DayTimeline, Itinerary } from "@/lib/services/itineraryService";
import { initialCalendarMonth, tripCalendar } from "@/lib/services/tripCalendar";
import { Button } from "@/components/ui/Button";
import { AlertIcon, ChevronRightIcon, InboxIcon, MapPinIcon, PlusIcon } from "@/components/ui/icons";
import { StaysOnDay } from "@/components/accommodation/StaysOnDay";
import { ItineraryDialogs, type ItineraryDialog } from "./ItineraryDialogs";
import { dayLabel, dayPlacesLabel, formatDayDate } from "./itineraryDisplay";
import { AddChoices, TimelineList } from "./TimelineList";
import { TripCalendarView } from "./TripCalendarView";
import { LoadError, ScreenSkeleton, TripNotFound } from "@/components/ui/ScreenState";

// Display order of the switch; "calendar" is the default view.
const PLAN_VIEWS = ["calendar", "days"] as const;
type PlanView = (typeof PLAN_VIEWS)[number];
const PLAN_VIEW_LABELS: Record<PlanView, string> = { days: "Days", calendar: "Calendar" };

/** Reads view and calendar month from the URL query (client only; the server never sees it). */
function initialQuery(): { view: PlanView; month: string | null } {
  const params = new URLSearchParams(window.location.search);
  return { view: params.get("view") === "days" ? "days" : "calendar", month: params.get("month") };
}

/** The trip's itinerary (days or calendar), outside-date days, and Unplanned. */
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
  const [query] = useState(initialQuery);
  const [view, setView] = useState<PlanView>(query.view);
  const calendar = useMemo(() => tripCalendar(itinerary), [itinerary]);
  const [chosenMonth, setChosenMonth] = useState<string | null>(query.month);
  // A month outside the trip (e.g. after changing its dates) falls back to the default.
  const month = calendar.months.some((entry) => entry.month === chosenMonth)
    ? (chosenMonth ?? "")
    : (initialCalendarMonth(calendar, deviceToday()) ?? "");
  const { trip, days, outsideDays, unplanned } = itinerary;

  // View and month are kept in the URL so back navigation and reloads return to them.
  const updateUrl = (nextView: PlanView, nextMonth: string) => {
    const search = nextView === "days" ? "?view=days" : `?view=calendar&month=${nextMonth}`;
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}`);
  };
  const changeView = (next: PlanView) => {
    setView(next);
    updateUrl(next, month);
  };
  const changeMonth = (next: string) => {
    setChosenMonth(next);
    updateUrl(view, next);
  };

  const openAccommodation = (accommodation: Accommodation) => setDialog({ type: "edit-accommodation", accommodation });

  const timelineHandlers = (tripDayId: string | undefined) => ({
    onAdd: () => setDialog({ type: "create-activity", tripDayId }),
    onOpenActivity: (activity: Activity) => setDialog({ type: "edit-activity", activity }),
    onMoveEntry: (entry: TimelineEntry) => setDialog({ type: "move-entry", entry }),
    onAddTransport: () => setDialog({ type: "create-transport", tripDayId }),
    onAddPlace: tripDayId === undefined ? undefined : () => setDialog({ type: "add-place", tripDayId }),
    onOpenTransport: (transport: Transport) => setDialog({ type: "edit-transport", transport }),
  });

  return (
    <section className="mx-auto max-w-md space-y-4 px-4 py-5 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6 lg:space-y-0 lg:px-8 lg:py-8">
      {/* Large screens: days on the left, Unplanned fixed on the right. */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Plan view">
          {PLAN_VIEWS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={view === option}
              onClick={() => changeView(option)}
              className={`min-h-10 rounded-lg text-sm font-medium ${view === option ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
            >
              {PLAN_VIEW_LABELS[option]}
            </button>
          ))}
        </div>
        {trip.notes !== undefined && (
          <section aria-labelledby="trip-notes-heading" className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 id="trip-notes-heading" className="text-sm font-semibold text-slate-500">
              Trip notes
            </h2>
            <p className="mt-1 whitespace-pre-line text-slate-800">{trip.notes}</p>
          </section>
        )}
        {view === "calendar" && (
          <>
            {outsideDays.length > 0 && (
              <p className="flex gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
                <AlertIcon className="size-5 shrink-0 text-amber-600" />
                {outsideDays.length === 1 ? "1 day with plans is" : `${outsideDays.length} days with plans are`} outside the
                trip dates. See Days.
              </p>
            )}
            <TripCalendarView tripId={trip.id} calendar={calendar} month={month} onMonthChange={changeMonth} />
          </>
        )}
        {view === "days" && outsideDays.length > 0 && (
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

        {view === "days" && (
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
        )}
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
  onAddPlace?: () => void;
  onOpenActivity: (activity: Activity) => void;
  onMoveEntry: (entry: TimelineEntry) => void;
  onAddTransport: () => void;
  onOpenTransport: (transport: Transport) => void;
  outsideActions?: ReactNode;
};

/**
 * One day in the agenda, as one card: a header (sticks to the top while scrolling through
 * the day) with a date tile and "+", then the entries along the timeline and the
 * accommodation. Reordering happens in the Day View.
 */
function DayCard({ tripId, timeline, outsideActions, accommodations, onOpenAccommodation, ...handlers }: DayCardProps) {
  const [adding, setAdding] = useState(false);
  const { day } = timeline;
  const placesLabel = dayPlacesLabel(day, handlers.places);
  const heading = day.title ?? placesLabel;
  const label = dayLabel(timeline);
  return (
    // overflow-clip (not hidden) keeps the rounded corners without breaking the sticky header.
    <article
      aria-label={`${label}, ${formatDayDate(day.date)}`}
      className={`overflow-clip rounded-3xl bg-white shadow-sm ring-1 ${timeline.outside ? "ring-amber-300" : "ring-slate-200"}`}
    >
      <header className="sticky top-[env(safe-area-inset-top)] z-[5] flex items-center gap-2 rounded-t-3xl border-b border-slate-200 bg-slate-50/95 py-2 pr-2 pl-3 backdrop-blur">
        <Link
          href={appRoutePath({ name: "trip-day", tripId, dayId: day.id })}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl hover:bg-slate-100"
        >
          <DateTile date={day.date} outside={timeline.outside} />
          <span className="min-w-0 flex-1">
            <span className={`block text-xs font-semibold tracking-wide uppercase ${timeline.outside ? "text-amber-700" : "text-teal-700"}`}>
              {label}
            </span>
            <span className="block truncate font-semibold text-slate-900">{heading ?? formatDayDate(day.date)}</span>
            {day.title !== undefined && placesLabel !== undefined && (
              <span className="flex items-center gap-1 text-sm text-teal-800">
                <MapPinIcon className="size-3.5 shrink-0" />
                <span className="truncate">{placesLabel}</span>
              </span>
            )}
          </span>
          <ChevronRightIcon className="size-5 shrink-0 text-slate-400" />
        </Link>
        <button
          type="button"
          aria-label={`Add to ${label}`}
          aria-expanded={adding}
          onClick={() => setAdding((open) => !open)}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm ring-1 ring-slate-200 hover:bg-teal-50"
        >
          <PlusIcon className={`size-5 transition-transform ${adding ? "rotate-45" : ""}`} />
        </button>
      </header>
      <div>
        {adding && (
          <div className="border-b border-slate-100 pt-2">
            <AddChoices
              onAdd={handlers.onAdd}
              onAddPlace={handlers.onAddPlace}
              onAddTransport={handlers.onAddTransport}
              onChosen={() => setAdding(false)}
            />
          </div>
        )}
        {/* The day in order: morning check-out, entries, where you sleep. */}
        <StaysOnDay accommodations={accommodations} date={day.date} onOpen={onOpenAccommodation} show="check-out" />
        <TimelineList
          entries={timeline.entries}
          sortDate={{ tripDayId: day.id, date: day.date }}
          emptyState="Nothing planned yet."
          controls="none"
          {...handlers}
        />
        <StaysOnDay accommodations={accommodations} date={day.date} onOpen={onOpenAccommodation} />
        {outsideActions}
      </div>
    </article>
  );
}

/** Calendar-style date: weekday, day of the month and month. */
function DateTile({ date, outside }: { date: string; outside: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex w-12 shrink-0 flex-col items-center rounded-xl bg-white py-1 shadow-sm ring-1 ${outside ? "ring-amber-300" : "ring-slate-200"}`}
    >
      <span className={`text-[0.65rem] leading-3 font-semibold uppercase ${outside ? "text-amber-700" : "text-teal-700"}`}>
        {formatCalendarDate(date, undefined, { weekday: "short" })}
      </span>
      <span className="text-lg leading-6 font-bold text-slate-900">{Number(date.slice(8))}</span>
      <span className="text-[0.65rem] leading-3 font-medium text-slate-600 uppercase">
        {formatCalendarDate(date, undefined, { month: "short" })}
      </span>
    </span>
  );
}
