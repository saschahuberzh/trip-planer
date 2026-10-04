"use client";

import { useState } from "react";
import type { Place } from "@/lib/domain/types";
import { normalizeName } from "@/lib/services/placeFilters";
import { MapPinIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { inputClass } from "@/components/trips/formFields";
import { PLACE_TYPE_BADGE, PLACE_TYPE_LABELS, placeLocation } from "./placeDisplay";
import { PlaceFormSheet } from "./PlaceFormSheet";

type PlacePickerSheetProps = {
  open: boolean;
  title: string;
  tripId: string;
  places: readonly Place[];
  /** Called with the chosen place (existing or newly created). */
  onPick: (place: Place) => Promise<void> | void;
  onClose: () => void;
};

/** Choose one of the trip's places or create a new one. */
export function PlacePickerSheet({ open, title, onClose, ...props }: PlacePickerSheetProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={title} dismissible={!busy}>
      <PlacePicker {...props} onBusyChange={setBusy} onDone={onClose} />
    </Sheet>
  );
}

function PlacePicker({
  tripId,
  places,
  onPick,
  onBusyChange,
  onDone,
}: Omit<PlacePickerSheetProps, "open" | "title" | "onClose"> & { onBusyChange: (busy: boolean) => void; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const words = normalizeName(query).split(" ").filter((word) => word !== "");
  const matches = [...places]
    .filter((place) => {
      const text = normalizeName(`${place.name} ${place.address ?? ""}`);
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  async function pick(place: Place) {
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      await onPick(place);
      onDone();
    } catch (caught) {
      console.error("Failed to use place", caught);
      setError("That didn't work. Nothing was changed.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <div className="space-y-3 pb-[env(safe-area-inset-bottom)]">
      <button
        type="button"
        onClick={() => setCreating(true)}
        disabled={busy}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-teal-700 px-4 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
      >
        <PlusIcon />
        <span className="flex-1 text-left">{query.trim() === "" ? "New place" : `New place “${query.trim()}”`}</span>
      </button>

      {places.length > 0 && (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-3 left-3 size-5 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find in your places"
            aria-label="Find in your places"
            autoComplete="off"
            className={`${inputClass} pl-10`}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {places.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          No places in this trip yet. Create one — search online or enter it manually.
        </p>
      ) : matches.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">No saved place matches. Create it as a new place.</p>
      ) : (
        <ul className="divide-y divide-slate-100" aria-busy={busy}>
          {matches.map((place) => {
            const location = placeLocation(place);
            return (
              <li key={place.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void pick(place)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
                >
                  <MapPinIcon className="size-5 shrink-0 text-teal-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">{place.name}</span>
                    <span className="block truncate text-xs text-slate-500">{location ?? "No location"}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PLACE_TYPE_BADGE[place.type]}`}>
                    {PLACE_TYPE_LABELS[place.type]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <PlaceFormSheet
        open={creating}
        tripId={tripId}
        places={places}
        initialName={query}
        onSaved={(place) => void pick(place)}
        onUseExisting={(place) => {
          setCreating(false);
          void pick(place);
        }}
        onClose={() => setCreating(false)}
      />
    </div>
  );
}
