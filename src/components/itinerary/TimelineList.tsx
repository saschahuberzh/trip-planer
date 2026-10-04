"use client";

import { useState, type ReactNode } from "react";
import type { Activity, Place } from "@/lib/domain/types";
import { entryRef, isSortedByTime, type TimelineEntry } from "@/lib/services/itineraryOrdering";
import { getItineraryService } from "@/lib/services/itineraryService";
import { Button } from "@/components/ui/Button";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ClockIcon,
  MapPinIcon,
  MoveIcon,
  PlusIcon,
  ReorderIcon,
  TrainIcon,
} from "@/components/ui/icons";
import { PLACE_TYPE_LABELS } from "@/components/places/placeDisplay";
import { entryTimes, entryTitle } from "./itineraryDisplay";

type TimelineListProps = {
  entries: TimelineEntry[];
  places: ReadonlyMap<string, Place>;
  /** The day's date when this list is a day (enables "Sort by time"); undefined for Unplanned. */
  sortDate?: { tripDayId: string; date: string };
  emptyState: ReactNode;
  addLabel?: string;
  onAdd: () => void;
  /** Shows a "Visit a place" action (Day View): an activity linked to a place. */
  onAddPlace?: () => void;
  onOpenActivity: (activity: Activity) => void;
  onMoveEntry: (entry: TimelineEntry) => void;
};

/**
 * One bucket's timeline in user-defined order. "Reorder" mode shows large
 * up/down/move buttons for each entry, which work reliably with touch input.
 */
export function TimelineList({
  entries,
  places,
  sortDate,
  emptyState,
  addLabel = "Add activity",
  onAdd,
  onAddPlace,
  onOpenActivity,
  onMoveEntry,
}: TimelineListProps) {
  const [reordering, setReordering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = reordering && entries.length > 0;
  const canSortByTime = sortDate !== undefined && !isSortedByTime(entries, sortDate.date);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      console.error("Failed to change the itinerary order", caught);
      setError("The order couldn't be changed. Nothing was modified.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {entries.length === 0 ? (
        <div className="px-4 py-3 text-sm text-slate-500">{emptyState}</div>
      ) : (
        <ol className="divide-y divide-slate-100" aria-busy={busy}>
          {entries.map((entry, index) => (
            <li key={`${entry.kind}:${entry.item.id}`}>
              <EntryRow
                entry={entry}
                place={entry.kind === "activity" && entry.item.placeId !== undefined ? places.get(entry.item.placeId) : undefined}
                onOpen={!editing && entry.kind === "activity" ? () => onOpenActivity(entry.item) : undefined}
                controls={
                  editing ? (
                    <div className="flex shrink-0 gap-1">
                      <IconButton
                        label={`Move ${entryTitle(entry)} up`}
                        disabled={busy || index === 0}
                        onClick={() => void run(() => getItineraryService().shiftEntry(entryRef(entry), -1))}
                      >
                        <ArrowUpIcon />
                      </IconButton>
                      <IconButton
                        label={`Move ${entryTitle(entry)} down`}
                        disabled={busy || index === entries.length - 1}
                        onClick={() => void run(() => getItineraryService().shiftEntry(entryRef(entry), 1))}
                      >
                        <ArrowDownIcon />
                      </IconButton>
                      <IconButton
                        label={`Move ${entryTitle(entry)} to another day`}
                        disabled={busy}
                        onClick={() => onMoveEntry(entry)}
                      >
                        <MoveIcon />
                      </IconButton>
                    </div>
                  ) : null
                }
              />
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p role="alert" className="mx-4 mb-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2 border-t border-slate-100 p-2">
        {editing ? (
          <>
            {sortDate !== undefined && (
              <Button
                variant="ghost"
                disabled={busy || !canSortByTime}
                onClick={() => void run(() => getItineraryService().sortDayByTime(sortDate.tripDayId))}
                className="flex-1"
              >
                <ClockIcon />
                {canSortByTime ? "Sort by time" : "Sorted by time"}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setReordering(false)} className="flex-1">
              Done
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onAdd} className="flex-1 text-teal-700">
              <PlusIcon />
              {addLabel}
            </Button>
            {onAddPlace && (
              <Button variant="ghost" onClick={onAddPlace} className="flex-1 px-2 text-teal-700">
                <MapPinIcon />
                Visit a place
              </Button>
            )}
            {entries.length > 0 && (
              <Button variant="ghost" onClick={() => setReordering(true)} className="flex-1">
                <ReorderIcon />
                Reorder
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  place,
  onOpen,
  controls,
}: {
  entry: TimelineEntry;
  place?: Place;
  onOpen?: () => void;
  controls: ReactNode;
}) {
  const { start, end } = entryTimes(entry);
  const notes = entry.item.notes;
  const content = (
    <>
      <span className="w-14 shrink-0 pt-0.5 tabular-nums">
        {start !== undefined ? (
          <>
            <span className="block text-sm font-semibold text-slate-900">{start}</span>
            {end !== undefined && <span className="block text-xs text-slate-500">{end}</span>}
          </>
        ) : (
          <span className="block text-xs font-medium text-slate-400">No time</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-medium text-slate-900">
          {entry.kind === "transport" && <TrainIcon className="size-4 shrink-0 text-slate-500" />}
          <span className="truncate">{entryTitle(entry)}</span>
        </span>
        {place !== undefined && (
          <span className="mt-0.5 flex items-center gap-1 text-sm text-teal-800">
            <MapPinIcon className="size-3.5 shrink-0" />
            <span className="truncate">
              {place.name === entryTitle(entry) ? PLACE_TYPE_LABELS[place.type] : place.name}
            </span>
          </span>
        )}
        {notes !== undefined && <span className="mt-0.5 line-clamp-2 block text-sm text-slate-500">{notes}</span>}
      </span>
    </>
  );

  const timedAccent = start !== undefined ? "border-teal-600" : "border-transparent";
  return (
    <div className={`flex min-h-14 items-center gap-2 border-l-4 pr-2 ${timedAccent}`}>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-2 py-3 pl-3 text-left">
          {content}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-2 py-3 pl-3">{content}</div>
      )}
      {controls}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-35"
    >
      {children}
    </button>
  );
}
