"use client";

import type { Accommodation } from "@/lib/domain/types";
import { staysOnDate } from "@/lib/services/accommodationSchedule";
import { stayRoleLabel } from "./stayDisplay";

type StaysOnDayProps = {
  accommodations: readonly Accommodation[];
  date: string;
  onOpen: (accommodation: Accommodation) => void;
};

/** Accommodation touching this day (not part of the reorderable timeline). */
export function StaysOnDay({ accommodations, date, onOpen }: StaysOnDayProps) {
  const stays = staysOnDate(accommodations, date);
  if (stays.length === 0) return null;
  return (
    <ul className="divide-y divide-violet-100 border-y border-violet-100 bg-violet-50/50" aria-label="Accommodation">
      {stays.map((stay) => (
        <li key={stay.accommodation.id}>
          <button
            type="button"
            onClick={() => onOpen(stay.accommodation)}
            className="flex min-h-11 w-full items-center gap-2 px-4 py-1.5 text-left text-sm"
          >
            <span aria-hidden="true">🛏️</span>
            <span className="min-w-0 flex-1 truncate font-medium text-violet-950">{stay.accommodation.name}</span>
            <span className="shrink-0 text-violet-800">{stayRoleLabel(stay)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
