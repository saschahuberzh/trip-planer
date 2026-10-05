"use client";

import type { Accommodation } from "@/lib/domain/types";
import { nightStaysOnDate, staysOnDate } from "@/lib/services/accommodationSchedule";
import { stayRoleLabel } from "./stayDisplay";

type StaysOnDayProps = {
  accommodations: readonly Accommodation[];
  date: string;
  onOpen: (accommodation: Accommodation) => void;
  /**
   * "night" (default): where the traveller sleeps, shown after the day's entries.
   * "check-out": stays ending that day, shown before the entries (Plan day list).
   * "all": check-outs first, then the night's stay (Day View accommodation card).
   */
  show?: "night" | "check-out" | "all";
};

/** Accommodation of a day (not part of the reorderable timeline): the night's stay, or check-outs. */
export function StaysOnDay({ accommodations, date, onOpen, show = "night" }: StaysOnDayProps) {
  const stays =
    show === "night"
      ? nightStaysOnDate(accommodations, date)
      : show === "all"
        ? staysOnDate(accommodations, date)
        : staysOnDate(accommodations, date).filter((stay) => stay.role === "check-out");
  if (stays.length === 0) return null;
  return (
    <ul
      className={`divide-y divide-slate-100 border-slate-100 ${show === "check-out" ? "border-b" : show === "night" ? "border-t" : ""}`}
      aria-label={show === "check-out" ? "Check-out" : "Accommodation"}
    >
      {stays.map((stay) => (
        <li key={stay.accommodation.id}>
          <button
            type="button"
            onClick={() => onOpen(stay.accommodation)}
            className="flex min-h-11 w-full items-center gap-2 px-4 py-1.5 text-left text-sm hover:bg-slate-50"
          >
            <span aria-hidden="true">🛏️</span>
            <span className="min-w-0 flex-1 truncate font-medium text-violet-900">{stay.accommodation.name}</span>
            <span className="shrink-0 text-violet-700">{stayRoleLabel(stay)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
