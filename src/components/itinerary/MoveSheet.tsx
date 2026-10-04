"use client";

import { useState } from "react";
import type { DayTimeline } from "@/lib/services/itineraryService";
import { InboxIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { dayOptionLabel } from "./itineraryDisplay";

type MoveSheetProps = {
  open: boolean;
  title: string;
  description: string;
  /** Destination days (within the trip dates). */
  days: DayTimeline[];
  /** The current bucket, which is not offered as a destination. `undefined` = Unplanned. */
  currentTripDayId: string | undefined;
  /** Moves to the chosen bucket (`undefined` = Unplanned). */
  onMove: (tripDayId: string | undefined) => Promise<void>;
  onClose: () => void;
};

/** One-tap destination picker: any day or Unplanned. Entries are added at the end. */
export function MoveSheet({ open, title, description, days, currentTripDayId, onMove, onClose }: MoveSheetProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  async function move(tripDayId: string | undefined) {
    setBusy(true);
    setError(null);
    try {
      await onMove(tripDayId);
      close();
    } catch (caught) {
      console.error("Failed to move itinerary entries", caught);
      setError("Moving failed. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  const option = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-slate-50 disabled:opacity-40";

  return (
    <Sheet open={open} onClose={close} title={title} dismissible={!busy}>
      <p className="mb-3 text-sm text-slate-600">{description}</p>
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="divide-y divide-slate-100 pb-[env(safe-area-inset-bottom)]" aria-busy={busy}>
        {days.map((timeline) => {
          const current = timeline.day.id === currentTripDayId;
          return (
            <li key={timeline.day.id}>
              <button type="button" disabled={busy || current} onClick={() => void move(timeline.day.id)} className={option}>
                <span className="flex-1 truncate font-medium text-slate-900">{dayOptionLabel(timeline)}</span>
                <span className="shrink-0 text-sm text-slate-500">
                  {current ? "Current" : timeline.entries.length === 0 ? "Empty" : `${timeline.entries.length}`}
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            disabled={busy || currentTripDayId === undefined}
            onClick={() => void move(undefined)}
            className={option}
          >
            <InboxIcon className="size-5 text-amber-600" />
            <span className="flex-1 font-medium text-slate-900">Unplanned</span>
            {currentTripDayId === undefined && <span className="text-sm text-slate-500">Current</span>}
          </button>
        </li>
      </ul>
    </Sheet>
  );
}
