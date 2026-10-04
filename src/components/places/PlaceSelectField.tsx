"use client";

import { useState } from "react";
import type { Place } from "@/lib/domain/types";
import { CloseIcon, MapPinIcon } from "@/components/ui/icons";
import { PLACE_TYPE_LABELS, placeLocation } from "./placeDisplay";
import { PlacePickerSheet } from "./PlacePickerSheet";

/** Shows the selected place (change/remove) or a button to choose or create one. */
export function PlaceSelectField({
  label,
  tripId,
  places,
  place,
  onChange,
}: {
  label: string;
  tripId: string;
  places: ReadonlyMap<string, Place>;
  place: Place | undefined;
  onChange: (place: Place | undefined) => void;
}) {
  const [picking, setPicking] = useState(false);
  const location = place && placeLocation(place);
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {place ? (
        <div className="flex items-center gap-2 rounded-xl bg-teal-50 py-1 pr-1 pl-3 ring-1 ring-teal-200">
          <MapPinIcon className="size-5 shrink-0 text-teal-700" />
          <span className="min-w-0 flex-1 py-1">
            <span className="block truncate font-medium text-slate-900">{place.name}</span>
            <span className="block truncate text-xs text-slate-600">
              {PLACE_TYPE_LABELS[place.type]}
              {location !== undefined && ` · ${location}`}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="min-h-11 rounded-lg px-3 text-sm font-semibold text-teal-800 hover:bg-teal-100"
          >
            Change
          </button>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label="Remove place"
            className="flex size-11 items-center justify-center rounded-lg text-slate-500 hover:bg-teal-100"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-slate-50 px-3 text-left text-sm font-medium text-teal-700 ring-1 ring-slate-200"
        >
          <MapPinIcon className="size-5" />
          Choose or add a place
        </button>
      )}
      <PlacePickerSheet
        open={picking}
        title="Choose place"
        tripId={tripId}
        places={[...places.values()]}
        onPick={onChange}
        onClose={() => setPicking(false)}
      />
    </div>
  );
}
