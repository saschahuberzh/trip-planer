"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Place, TripDay } from "@/lib/domain/types";
import { appRoutePath } from "@/lib/routing/routes";
import { moveWithin } from "@/lib/services/itineraryOrdering";
import { getItineraryService } from "@/lib/services/itineraryService";
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, MapPinIcon, PlusIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { PLACE_TYPE_LABELS } from "@/components/places/placeDisplay";
import { PlacePickerSheet } from "@/components/places/PlacePickerSheet";

type DayPlacesCardProps = {
  tripId: string;
  day: TripDay;
  places: ReadonlyMap<string, Place>;
};

/** Where the traveller is that day (e.g. Tashkent → Samarkand): add, reorder, remove. */
export function DayPlacesCard({ tripId, day, places }: DayPlacesCardProps) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = (day.placeIds ?? []).filter((id) => places.has(id));

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
    <section aria-labelledby="day-places-heading" className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <h3 id="day-places-heading" className="px-4 pt-3 text-sm font-semibold text-slate-500">
        Places of the day
      </h3>
      {ids.length === 0 ? (
        <p className="px-4 pt-1 pb-2 text-sm text-slate-500">
          Where are you this day? Add the city — or two on a travel day. They form your route on the map.
        </p>
      ) : (
        <ol className="divide-y divide-slate-100" aria-busy={busy}>
          {ids.map((id, index) => {
            const place = places.get(id);
            if (place === undefined) return null;
            return (
              <li key={id} className="flex items-center gap-1 pr-2">
                <Link
                  href={appRoutePath({ name: "trip-place", tripId, placeId: id })}
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 pl-4"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{place.name}</span>
                    <span className="block text-xs text-slate-500">{PLACE_TYPE_LABELS[place.type]}</span>
                  </span>
                </Link>
                {ids.length > 1 && (
                  <>
                    <SmallButton
                      label={`Move ${place.name} up`}
                      disabled={busy || index === 0}
                      onClick={() => run(moveWithin(ids, index, index - 1))}
                    >
                      <ArrowUpIcon className="size-4" />
                    </SmallButton>
                    <SmallButton
                      label={`Move ${place.name} down`}
                      disabled={busy || index === ids.length - 1}
                      onClick={() => run(moveWithin(ids, index, index + 1))}
                    >
                      <ArrowDownIcon className="size-4" />
                    </SmallButton>
                  </>
                )}
                <SmallButton
                  label={`Remove ${place.name} from this day`}
                  disabled={busy}
                  onClick={() => run(ids.filter((other) => other !== id))}
                >
                  <CloseIcon className="size-4" />
                </SmallButton>
              </li>
            );
          })}
        </ol>
      )}
      {error && (
        <p role="alert" className="mx-4 mb-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="border-t border-slate-100 p-2">
        <Button variant="ghost" onClick={() => setPicking(true)} disabled={busy} className="w-full text-teal-700">
          {ids.length === 0 ? <MapPinIcon /> : <PlusIcon />}
          {ids.length === 0 ? "Add place of the day" : "Add another place"}
        </Button>
      </div>
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
    </section>
  );
}

function SmallButton({
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
      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
