"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { PLACE_TYPES, type Place } from "@/lib/domain/types";
import { usePlaceSearch } from "@/lib/hooks/usePlaceSearch";
import { getPlaceSearchProvider, type PlaceSearchResult } from "@/lib/placeSearch";
import { findSimilarPlaces, placesCenter } from "@/lib/services/placeFilters";
import {
  applySearchResult,
  emptyPlaceFormValues,
  placeToFormValues,
  validatePlaceForm,
  type PlaceFormErrors,
  type PlaceFormValues,
} from "@/lib/services/placeForm";
import { getPlaceService } from "@/lib/services/placeService";
import { Button } from "@/components/ui/Button";
import { AlertIcon, MapPinIcon, SearchIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { Field, inputClass } from "@/components/trips/formFields";
import { LocationFields } from "./LocationFields";
import { PLACE_TYPE_LABELS } from "./placeDisplay";

type PlaceFormSheetProps = {
  open: boolean;
  tripId: string;
  /** All places of the trip (duplicate hints and search bias). */
  places: readonly Place[];
  /** Absent: create a new place. */
  place?: Place;
  /** Prefills name and search when creating. */
  initialName?: string;
  onSaved?: (place: Place) => void;
  /** When set, a similar existing place can be chosen instead of creating a duplicate. */
  onUseExisting?: (place: Place) => void;
  onClose: () => void;
};

export function PlaceFormSheet({ open, place, onClose, ...props }: PlaceFormSheetProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={place ? "Edit place" : "New place"} dismissible={!busy}>
      <PlaceForm place={place} onBusyChange={setBusy} onCancel={onClose} {...props} />
    </Sheet>
  );
}

type PlaceFormProps = Omit<PlaceFormSheetProps, "open" | "onClose"> & {
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
};

function PlaceForm({ tripId, places, place, initialName = "", onSaved, onUseExisting, onBusyChange, onCancel }: PlaceFormProps) {
  const [values, setValues] = useState<PlaceFormValues>(() =>
    place ? placeToFormValues(place) : emptyPlaceFormValues(initialName.trim()),
  );
  const [errors, setErrors] = useState<PlaceFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Search is open when creating; when editing it can be opened to find the location again.
  const [searching, setSearching] = useState(place === undefined);

  const set = <K extends keyof PlaceFormValues>(key: K, value: PlaceFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const similar = useMemo(
    () => (values.name.trim() === "" ? [] : findSimilarPlaces(places, values, place?.id)),
    [places, values, place?.id],
  );

  function applyResult(result: PlaceSearchResult) {
    setValues((current) => applySearchResult(current, result, getPlaceSearchProvider().id));
    setErrors({});
    setSearching(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    const result = validatePlaceForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    onBusyChange(true);
    try {
      const service = getPlaceService();
      const saved = place ? await service.updatePlace(place.id, result.input) : await service.createPlace(tripId, result.input);
      onSaved?.(saved);
      onCancel();
    } catch (error) {
      console.error("Failed to save place", error);
      setSaveError("The place couldn't be saved. Your existing data has not been changed.");
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {searching ? (
        <PlaceSearch
          initialQuery={place ? place.name : initialName}
          near={placesCenter(places)}
          onSelect={applyResult}
          onManual={(name) => {
            if (name.trim() !== "" && values.name.trim() === "") set("name", name.trim());
            setSearching(false);
          }}
          manualLabel={place ? "Cancel search" : "Enter details manually"}
        />
      ) : (
        <button
          type="button"
          onClick={() => setSearching(true)}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-slate-50 px-3 text-left text-sm font-medium text-teal-700 ring-1 ring-slate-200"
        >
          <SearchIcon className="size-4" />
          {values.externalRef ? "Filled from search · search again" : "Search for this place online"}
        </button>
      )}

      <Field label="Name" error={errors.name}>
        {(props) => (
          <input
            {...props}
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="e.g. Plov stall at Chorsu Bazaar"
            autoComplete="off"
            className={inputClass}
          />
        )}
      </Field>

      {similar.length > 0 && (
        <div role="note" className="flex gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
          <AlertIcon className="size-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1 space-y-2">
            <p>You already have {similar.length === 1 ? "a similar place" : "similar places"} in this trip:</p>
            <ul className="space-y-1">
              {similar.slice(0, 3).map((existing) => (
                <li key={existing.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{existing.name}</span>
                  {onUseExisting && (
                    <Button variant="secondary" onClick={() => onUseExisting(existing)} className="min-h-9 bg-white px-3">
                      Use this
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Field label="Type">
        {(props) => (
          <select
            {...props}
            value={values.type}
            onChange={(event) => set("type", event.target.value as PlaceFormValues["type"])}
            className={inputClass}
          >
            {PLACE_TYPES.map((type) => (
              <option key={type} value={type}>
                {PLACE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Address (optional)">
        {(props) => (
          <input
            {...props}
            value={values.address}
            onChange={(event) => set("address", event.target.value)}
            autoComplete="off"
            className={inputClass}
          />
        )}
      </Field>

      <LocationFields latitude={values.latitude} longitude={values.longitude} errors={errors} near={placesCenter(places)} onChange={(latitude, longitude) => {
        setValues((current) => ({ ...current, latitude, longitude }));
        setErrors((current) => ({ ...current, latitude: undefined, longitude: undefined }));
      }} />

      <Field label="Website (optional)" error={errors.website}>
        {(props) => (
          <input
            {...props}
            value={values.website}
            onChange={(event) => set("website", event.target.value)}
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            placeholder="example.com"
            className={inputClass}
          />
        )}
      </Field>

      <Field label="Notes (optional)">
        {(props) => (
          <textarea
            {...props}
            value={values.notes}
            onChange={(event) => set("notes", event.target.value)}
            rows={3}
            placeholder="Opening hours, what to try, tips…"
            className={inputClass}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <ToggleField label="Favorite" checked={values.favorite} onChange={(checked) => set("favorite", checked)} />
        <ToggleField label="Visited" checked={values.visited} onChange={(checked) => set("visited", checked)} />
      </div>

      {saveError && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {saveError}
        </p>
      )}

      <div className="flex gap-3 pb-[env(safe-area-inset-bottom)]">
        <Button variant="secondary" onClick={onCancel} disabled={saving} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="flex-[2]">
          {saving ? "Saving…" : place ? "Save changes" : "Save place"}
        </Button>
      </div>
    </form>
  );
}

function PlaceSearch({
  initialQuery,
  near,
  onSelect,
  onManual,
  manualLabel,
}: {
  initialQuery: string;
  near: ReturnType<typeof placesCenter>;
  onSelect: (result: PlaceSearchResult) => void;
  onManual: (query: string) => void;
  manualLabel: string;
}) {
  const searchId = useId();
  const [query, setQuery] = useState(initialQuery);
  const search = usePlaceSearch(query, near);

  return (
    <div className="space-y-2 rounded-2xl bg-teal-50/60 p-3 ring-1 ring-teal-100">
      <label className="block text-sm font-medium text-slate-700" htmlFor={searchId}>
        Search online
      </label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-3 left-3 size-5 text-slate-400" />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Enter must not submit the place form.
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder="e.g. Registan Samarkand"
          autoComplete="off"
          enterKeyHint="search"
          className={`${inputClass} bg-white pl-10`}
        />
      </div>

      <div aria-live="polite" className="text-sm">
        {search.status === "idle" && (
          <p className="text-slate-500">Type at least 3 characters. Adding the city helps.</p>
        )}
        {search.status === "loading" && <p className="text-slate-500">Searching…</p>}
        {search.status === "error" && (
          <p className="text-slate-700">
            {search.kind === "offline"
              ? "Search needs an internet connection. You can enter the place manually."
              : "Search is not available right now. You can enter the place manually."}
          </p>
        )}
        {search.status === "done" && search.results.length === 0 && (
          <p className="text-slate-700">
            Nothing found. Try a nearby street or landmark, then rename it and adjust the location — or enter the
            place manually.
          </p>
        )}
      </div>

      {search.status === "done" && search.results.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          {search.results.map((result) => (
            <li key={result.externalId}>
              <button
                type="button"
                onClick={() => onSelect(result)}
                className="flex min-h-12 w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50"
              >
                <MapPinIcon className="mt-0.5 size-4 shrink-0 text-teal-700" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{result.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {PLACE_TYPE_LABELS[result.suggestedType]}
                    {result.address !== undefined && ` · ${result.address}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => onManual(query)} className="min-h-11 text-sm font-semibold text-teal-700">
          {manualLabel}
        </button>
        {search.status === "done" && <span className="text-right text-[11px] text-slate-500">{getPlaceSearchProvider().attribution}</span>}
      </div>
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 ring-1 ring-slate-200 has-focus-visible:ring-2 has-focus-visible:ring-teal-600">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 accent-teal-700"
      />
    </label>
  );
}
