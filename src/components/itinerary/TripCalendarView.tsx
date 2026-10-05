"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { deviceToday, formatCalendarDate } from "@/lib/domain/dateTime";
import { appRoutePath } from "@/lib/routing/routes";
import type { CalendarDay, CalendarPlace, TripCalendar } from "@/lib/services/tripCalendar";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

// One colour per place (cycled). Literal class names so Tailwind generates them.
// No violet: it marks accommodation (as elsewhere in the app).
const PLACE_COLORS = [
  { tint: "bg-teal-50", bar: "bg-teal-500" },
  { tint: "bg-sky-50", bar: "bg-sky-500" },
  { tint: "bg-amber-50", bar: "bg-amber-500" },
  { tint: "bg-pink-50", bar: "bg-pink-500" },
  { tint: "bg-rose-50", bar: "bg-rose-500" },
  { tint: "bg-lime-50", bar: "bg-lime-600" },
  { tint: "bg-orange-50", bar: "bg-orange-500" },
  { tint: "bg-indigo-50", bar: "bg-indigo-500" },
] as const;

const colorOf = (place: CalendarPlace) => PLACE_COLORS[place.colorIndex % PLACE_COLORS.length];

/** A Monday-to-Sunday week, for the weekday header (any week works). */
const SAMPLE_WEEK = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06", "2024-01-07"];

type TripCalendarViewProps = {
  tripId: string;
  calendar: TripCalendar;
  /** "YYYY-MM": the month shown (one at a time). */
  month: string;
  onMonthChange: (month: string) => void;
};

/** Plan → Calendar: where the traveller is on each day, coloured by place, one month at a time. */
export function TripCalendarView({ tripId, calendar, month, onMonthChange }: TripCalendarViewProps) {
  const today = deviceToday();
  const index = Math.max(0, calendar.months.findIndex((entry) => entry.month === month));
  const shown = calendar.months[index];
  const previous = calendar.months[index - 1];
  const next = calendar.months[index + 1];
  const monthName = (key: string) => formatCalendarDate(`${key}-01`, undefined, { month: "long", year: "numeric" });
  const dayPath = (tripDayId: string) => appRoutePath({ name: "trip-day", tripId, dayId: tripDayId });
  const placeCount = new Set(calendar.stays.map((stay) => stay.placeId)).size;

  return (
    <div className="space-y-4">
      <section aria-label="Calendar" className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200 lg:p-4">
        <div className="flex items-center gap-2 pb-2">
          <h2 aria-live="polite" className="min-w-0 flex-1 px-1 font-semibold text-slate-900">
            {monthName(shown.month)}
          </h2>
          <MonthButton target={previous?.month} label={previous && `Previous month: ${monthName(previous.month)}`} onSelect={onMonthChange}>
            <ChevronLeftIcon />
          </MonthButton>
          <MonthButton target={next?.month} label={next && `Next month: ${monthName(next.month)}`} onSelect={onMonthChange}>
            <ChevronRightIcon />
          </MonthButton>
        </div>
        <div className="grid grid-cols-7 gap-1 lg:gap-2" role="presentation">
          {SAMPLE_WEEK.map((date) => (
            <div key={date} aria-hidden="true" className="pb-1 text-center text-xs font-medium text-slate-500">
              {formatCalendarDate(date, undefined, { weekday: "short" })}
            </div>
          ))}
          {shown.weeks.flat().map((cell, position) =>
            cell === null ? (
              <div key={`pad-${position}`} aria-hidden="true" className="h-16 lg:h-24" />
            ) : (
              <CalendarCell key={cell.date} cell={cell} today={cell.date === today} href={cell.trip && dayPath(cell.trip.tripDayId)} />
            ),
          )}
        </div>
      </section>

      {calendar.stays.length === 0 ? (
        <section aria-labelledby="stays-heading" className="rounded-3xl bg-white px-4 pt-3 pb-4 shadow-sm ring-1 ring-slate-200">
          <h2 id="stays-heading" className="pb-1 text-sm font-semibold text-slate-500">
            Where you are
          </h2>
          <p className="text-sm text-slate-600">
            Add places of the day (open a day → “Add place of the day”) to see where you are on each day.
          </p>
        </section>
      ) : (
        // Collapsed by default: the calendar already shows the places; this adds days and nights.
        <details className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <summary className="flex min-h-12 list-none items-center gap-2 px-4 py-2 [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
            <h2 className="flex-1 text-sm font-semibold text-slate-500">Where you are</h2>
            <span className="text-sm text-slate-500">
              {placeCount} {placeCount === 1 ? "place" : "places"}
            </span>
          </summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {calendar.stays.map((stay) => {
              const days = stay.firstDayNumber === stay.lastDayNumber ? `${stay.firstDayNumber}` : `${stay.firstDayNumber}–${stay.lastDayNumber}`;
              return (
                <li key={`${stay.placeId}-${stay.firstDayNumber}`} className="flex min-h-12 items-center gap-3 px-4 py-2">
                  <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ${colorOf(stay).bar}`} />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{stay.name}</span>
                  <span className="shrink-0 text-sm text-slate-500">
                    {stay.firstDayNumber === stay.lastDayNumber ? "Day" : "Days"} {days}
                    {stay.nights > 0 && ` · ${stay.nights} ${stay.nights === 1 ? "night" : "nights"}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Previous/next month; disabled at the trip's first and last month. */
function MonthButton({
  target,
  label,
  onSelect,
  children,
}: {
  target: string | undefined;
  label: string | undefined;
  onSelect: (month: string) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={target === undefined}
      onClick={() => target !== undefined && onSelect(target)}
      aria-label={label ?? "No more months in this trip"}
      className="flex size-11 items-center justify-center rounded-xl text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:text-slate-300 disabled:ring-slate-100 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/** Box and inner spacing shared by all day boxes, so the day numbers line up. */
const CELL_BOX = "relative h-16 min-w-0 overflow-hidden rounded-xl lg:h-24";
const CELL_CONTENT = "flex h-full min-w-0 flex-col px-1 pt-2 pb-1 lg:px-2 lg:pt-3 lg:pb-2";
const CELL_NUMBER = "text-xs leading-4 lg:text-sm lg:leading-5";

function CalendarCell({ cell, today, href }: { cell: CalendarDay; today: boolean; href: string | undefined }) {
  const dayOfMonth = Number(cell.date.slice(8));
  const todayRing = today ? "ring-2 ring-teal-700" : "";

  // Days outside the trip: same box, greyed out like a disabled control, not tappable.
  if (cell.trip === undefined || href === undefined) {
    return (
      <div aria-hidden="true" className={`${CELL_BOX} bg-slate-100 ${todayRing}`}>
        <span className={CELL_CONTENT}>
          <span className={`${CELL_NUMBER} text-slate-600`}>{dayOfMonth}</span>
        </span>
      </div>
    );
  }

  const sleepsAt = cell.places.at(-1);
  const names = cell.places.map((place) => place.name).join(" → ");
  const fullDate = formatCalendarDate(cell.date, undefined, { weekday: "short", day: "numeric", month: "short" });
  return (
    <Link
      href={href}
      aria-label={`Day ${cell.trip.dayNumber}, ${fullDate}${names ? `: ${names}` : ""}, ${cell.trip.hasStay ? "accommodation booked" : "no accommodation"}`}
      className={`${CELL_BOX} block ring-1 ring-slate-200 hover:ring-slate-400 ${
        sleepsAt ? colorOf(sleepsAt).tint : "bg-white"
      } ${todayRing}`}
    >
      {/* One colour bar per place of the day (travel days show both), over the top edge. */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 flex h-1.5">
        {cell.places.map((place) => (
          <span key={place.placeId} className={`flex-1 ${colorOf(place).bar}`} />
        ))}
      </span>
      <span className={CELL_CONTENT}>
        <span className="flex items-center justify-between gap-1">
          <span className={`${CELL_NUMBER} font-semibold text-slate-900`}>{dayOfMonth}</span>
          {/* Accommodation for this night: violet; none: grey. */}
          <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${cell.trip.hasStay ? "bg-violet-500" : "bg-slate-300"}`} />
        </span>
        {cell.places.map((place) => (
          <span key={place.placeId} className="truncate text-[0.65rem] leading-tight text-slate-700 lg:text-xs">
            {place.name}
          </span>
        ))}
      </span>
    </Link>
  );
}
