"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type { Place, TripDay } from "@/lib/domain/types";
import { appRoutePath } from "@/lib/routing/routes";
import { moveWithin } from "@/lib/services/itineraryOrdering";
import { getItineraryService } from "@/lib/services/itineraryService";
import { CloseIcon, MapPinIcon, PencilIcon, PlusIcon, SwapIcon } from "@/components/ui/icons";
import { PlacePickerSheet } from "@/components/places/PlacePickerSheet";

type DayPlaceChipsProps = {
  tripId: string;
  day: TripDay;
  places: ReadonlyMap<string, Place>;
};

const chipClass = "inline-flex min-h-9 max-w-full items-center gap-1 rounded-full px-3 text-sm font-medium";

/**
 * Where the traveller is that day (e.g. Tashkent → Samarkand), edited in place: "+ Place"
 * adds one; the pencil switches to editing, where each chip can be removed and neighbours
 * swapped (enough to reach any order).
 */
export function DayPlaceChips({ tripId, day, places }: DayPlaceChipsProps) {
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = (day.placeIds ?? []).filter((id) => places.has(id));
  const nameOf = (id: string) => places.get(id)?.name ?? "";

  async function save(next: string[]) {
    setBusy(true);
    setError(null);
    try {
      await getItineraryService().setDayPlaces(day.id, next);
    } catch (caught) {
      console.error("Failed to update places of the day", caught);
      setError("The places of the day couldn't be changed. Nothing was modified.");
      throw caught;
    } finally {
      setBusy(false);
    }
  }
  const run = (next: string[]) => void save(next).catch(() => {});

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Places of the day" aria-busy={busy} className="flex flex-wrap items-center gap-1.5">
        {ids.map((id, index) => (
          <Fragment key={id}>
            {index > 0 &&
              (editing ? (
                <button
                  type="button"
                  aria-label={`Swap ${nameOf(ids[index - 1])} and ${nameOf(id)}`}
                  title="Swap"
                  disabled={busy}
                  onClick={() => run(moveWithin(ids, index, index - 1))}
                  className="flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                >
                  <SwapIcon className="size-4" />
                </button>
              ) : (
                <span aria-hidden="true" className="text-slate-400">
                  →
                </span>
              ))}
            {editing ? (
              <span className={`${chipClass} bg-white pr-1 text-teal-800 ring-1 ring-slate-200`}>
                <span className="truncate">{nameOf(id)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${nameOf(id)} from this day`}
                  disabled={busy}
                  onClick={() => run(ids.filter((other) => other !== id))}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-teal-50 disabled:opacity-40"
                >
                  <CloseIcon className="size-4" />
                </button>
              </span>
            ) : (
              <Link
                href={appRoutePath({ name: "trip-place", tripId, placeId: id })}
                className={`${chipClass} bg-white text-teal-800 ring-1 ring-slate-200 hover:bg-teal-50`}
              >
                <MapPinIcon className="size-3.5 shrink-0" />
                <span className="truncate">{nameOf(id)}</span>
              </Link>
            )}
          </Fragment>
        ))}

        {/* "+ Place" and the edit control wrap together, never the pencil alone. */}
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Add place of the day"
            disabled={busy}
            onClick={() => setPicking(true)}
            className={`${chipClass} border border-dashed border-slate-300 bg-white/60 text-slate-600 hover:border-teal-600 hover:text-teal-700 disabled:opacity-40`}
          >
            <PlusIcon className="size-4" />
            {ids.length === 0 ? "Add place of the day" : "Place"}
          </button>

          {ids.length > 0 &&
            (editing ? (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50"
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                aria-label="Edit places of the day"
                title="Edit places of the day"
                onClick={() => setEditing(true)}
                className="flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/60"
              >
                <PencilIcon className="size-4" />
              </button>
            ))}
        </span>
      </div>

      {ids.length === 0 && (
        <p className="text-sm text-slate-500">Where are you this day? Add the city — or two on a travel day.</p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <PlacePickerSheet
        open={picking}
        title="Place of the day"
        tripId={tripId}
        places={[...places.values()]}
        onPick={async (place) => {
          if (!ids.includes(place.id)) await save([...ids, place.id]);
        }}
        onClose={() => setPicking(false)}
      />
    </div>
  );
}
