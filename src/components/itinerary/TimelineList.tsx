"use client";

import { useState, type ReactNode } from "react";
import type { Activity, Place, Transport } from "@/lib/domain/types";
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
import { TRANSPORT_SYMBOLS, transportDurationLabel } from "./transportDisplay";

type TimelineListProps = {
  entries: TimelineEntry[];
  places: ReadonlyMap<string, Place>;
  /** The day's date when this list is a day (enables "Sort by time"); undefined for Unplanned. */
  sortDate?: { tripDayId: string; date: string };
  emptyState: ReactNode;
  /** Unplanned: "Add idea" instead of "Add activity". */
  ideas?: boolean;
  onAdd: () => void;
  /** Shows a "Visit a place" action (Day View): an activity linked to a place. */
  onAddPlace?: () => void;
  onAddTransport: () => void;
  onOpenActivity: (activity: Activity) => void;
  onOpenTransport: (transport: Transport) => void;
  onMoveEntry: (entry: TimelineEntry) => void;
  /**
   * "footer": "+ Add" and "Reorder" below the entries (Day View, Unplanned).
   * "none": entries only; adding happens elsewhere (Plan day list header).
   */
  controls?: "footer" | "none";
};

/**
 * One bucket's timeline in user-defined order, drawn along a vertical line (filled dots for
 * timed entries). "Reorder" mode shows large up/down/move buttons for each entry, which work
 * reliably with touch input.
 */
export function TimelineList({
  entries,
  places,
  sortDate,
  emptyState,
  ideas = false,
  onAdd,
  onAddPlace,
  onAddTransport,
  onOpenActivity,
  onOpenTransport,
  onMoveEntry,
  controls = "footer",
}: TimelineListProps) {
  const [reordering, setReordering] = useState(false);
  const [adding, setAdding] = useState(false);
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
        <div className="px-4 py-3 text-sm text-slate-600">{emptyState}</div>
      ) : (
        <ol className="py-1" aria-busy={busy}>
          {entries.map((entry, index) => (
            <li key={`${entry.kind}:${entry.item.id}`}>
              <EntryRow
                entry={entry}
                place={entry.kind === "activity" && entry.item.placeId !== undefined ? places.get(entry.item.placeId) : undefined}
                places={places}
                onOpen={
                  editing
                    ? undefined
                    : entry.kind === "activity"
                      ? () => onOpenActivity(entry.item)
                      : () => onOpenTransport(entry.item)
                }
                controls={
                  editing ? (
                    <div className="flex shrink-0 gap-1">
                      <IconButton
                        label={`Move ${entryTitle(entry, places)} up`}
                        disabled={busy || index === 0}
                        onClick={() => void run(() => getItineraryService().shiftEntry(entryRef(entry), -1))}
                      >
                        <ArrowUpIcon />
                      </IconButton>
                      <IconButton
                        label={`Move ${entryTitle(entry, places)} down`}
                        disabled={busy || index === entries.length - 1}
                        onClick={() => void run(() => getItineraryService().shiftEntry(entryRef(entry), 1))}
                      >
                        <ArrowDownIcon />
                      </IconButton>
                      <IconButton
                        label={`Move ${entryTitle(entry, places)} to another day`}
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

      {controls === "footer" &&
        (editing ? (
          <div className="flex gap-2 px-2 pb-2">
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
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 px-2 pb-1">
              <button
                type="button"
                aria-expanded={adding}
                onClick={() => setAdding((open) => !open)}
                className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-teal-700 hover:bg-slate-50"
              >
                <PlusIcon className={`size-5 transition-transform ${adding ? "rotate-45" : ""}`} />
                Add
              </button>
              <span className="flex-1" />
              {entries.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setReordering(true);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <ReorderIcon className="size-4" />
                  Reorder
                </button>
              )}
            </div>
            {adding && (
              <AddChoices
                ideas={ideas}
                onAdd={onAdd}
                onAddPlace={onAddPlace}
                onAddTransport={onAddTransport}
                onChosen={() => setAdding(false)}
              />
            )}
          </div>
        ))}
    </div>
  );
}

/** What can be added to a day (or Unplanned); shown inline after "+ Add". */
export function AddChoices({
  ideas = false,
  onAdd,
  onAddPlace,
  onAddTransport,
  onChosen,
}: {
  ideas?: boolean;
  onAdd: () => void;
  onAddPlace?: () => void;
  onAddTransport: () => void;
  /** Called after a choice, e.g. to close the menu. */
  onChosen?: () => void;
}) {
  const choose = (action: () => void) => () => {
    onChosen?.();
    action();
  };
  return (
    <div className="flex gap-2 px-2 pb-2">
      <Choice label={ideas ? "Add idea" : "Add activity"} text={ideas ? "Idea" : "Activity"} onClick={choose(onAdd)}>
        <PlusIcon />
      </Choice>
      {onAddPlace && (
        <Choice label="Visit a place" text="Place" onClick={choose(onAddPlace)}>
          <MapPinIcon />
        </Choice>
      )}
      <Choice label="Add transport" text="Transport" onClick={choose(onAddTransport)}>
        <TrainIcon />
      </Choice>
    </div>
  );
}

function Choice({ label, text, onClick, children }: { label: string; text: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl bg-teal-50 px-1 text-xs font-semibold text-teal-800 hover:bg-teal-100"
    >
      {children}
      {text}
    </button>
  );
}

function EntryRow({
  entry,
  place,
  places,
  onOpen,
  controls,
}: {
  entry: TimelineEntry;
  place?: Place;
  places: ReadonlyMap<string, Place>;
  onOpen?: () => void;
  controls: ReactNode;
}) {
  const { start, end, arrivalDays } = entryTimes(entry);
  const duration = entry.kind === "transport" ? transportDurationLabel(entry.item) : undefined;
  const notes = entry.item.notes;
  const content = (
    <>
      <span className="w-12 shrink-0 pt-0.5 text-right tabular-nums">
        {start !== undefined ? (
          <>
            <span className="block text-sm font-semibold text-slate-900">{start}</span>
            {end !== undefined && (
              <span className="block text-xs text-slate-500">
                {end}
                {arrivalDays > 0 && <span className="font-semibold text-amber-700"> +{arrivalDays}</span>}
              </span>
            )}
          </>
        ) : (
          <span className="block pt-0.5 text-xs font-medium text-slate-500">No time</span>
        )}
      </span>
      {/* The timeline: a line through all entries, a filled dot for timed ones. */}
      <Rail dot={start !== undefined ? "bg-teal-600" : "border-2 border-slate-300 bg-white"} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-medium text-slate-900">
          {entry.kind === "transport" && (
            <span aria-hidden="true" className="shrink-0">
              {TRANSPORT_SYMBOLS[entry.item.type]}
            </span>
          )}
          <span className="truncate">{entryTitle(entry, places)}</span>
        </span>
        {(duration !== undefined || arrivalDays > 0 || (entry.kind === "transport" && entry.item.bookingReference)) && (
          <span className="mt-0.5 block truncate text-sm text-slate-600">
            {[
              duration,
              arrivalDays > 0 ? `arrives +${arrivalDays} ${arrivalDays === 1 ? "day" : "days"}` : undefined,
              entry.kind === "transport" && entry.item.bookingReference ? `Ref ${entry.item.bookingReference}` : undefined,
            ]
              .filter((part) => part !== undefined)
              .join(" · ")}
          </span>
        )}
        {place !== undefined && (
          <span className="mt-0.5 flex items-center gap-1 text-sm text-teal-800">
            <MapPinIcon className="size-3.5 shrink-0" />
            <span className="truncate">
              {place.name === entryTitle(entry, places) ? PLACE_TYPE_LABELS[place.type] : place.name}
            </span>
          </span>
        )}
        {notes !== undefined && <span className="mt-0.5 line-clamp-2 block text-sm text-slate-500">{notes}</span>}
      </span>
    </>
  );

  return (
    <div className="flex min-h-14 items-center gap-2 overflow-hidden pr-2">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-2 text-left hover:bg-slate-50">
          {content}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-2">{content}</div>
      )}
      {controls}
    </div>
  );
}

/** The vertical line through a day and the entry's dot. */
function Rail({ dot }: { dot: string }) {
  return (
    <span aria-hidden="true" className="relative flex w-3 shrink-0 justify-center self-stretch">
      <span className="absolute -inset-y-3 w-px bg-slate-200" />
      <span className={`relative mt-1.5 size-2.5 rounded-full ${dot}`} />
    </span>
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
