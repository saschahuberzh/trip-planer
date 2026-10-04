"use client";

import Link from "next/link";
import { useState } from "react";
import { PLACE_TYPES, type PlaceType } from "@/lib/domain/types";
import { useTripPlaces } from "@/lib/hooks/useTripPlaces";
import { appRoutePath } from "@/lib/routing/routes";
import { filterPlaces, PLACE_STATUS_FILTERS, type PlaceFilter, type PlaceStatusFilter } from "@/lib/services/placeFilters";
import { getPlaceService, type PlaceSummary, type TripPlaces } from "@/lib/services/placeService";
import { Button } from "@/components/ui/Button";
import { CheckCircleIcon, MapPinIcon, PlusIcon, SearchIcon, StarIcon } from "@/components/ui/icons";
import { inputClass } from "@/components/trips/formFields";
import { PLACE_TYPE_BADGE, PLACE_TYPE_LABELS, placeLocation } from "./placeDisplay";
import { PlaceFormSheet } from "./PlaceFormSheet";
import { LoadError, ScreenSkeleton, TripNotFound } from "@/components/ui/ScreenState";

const STATUS_LABELS: Record<PlaceStatusFilter, string> = {
  all: "All",
  favorites: "Favorites",
  planned: "Planned",
  unplanned: "Unplanned",
  visited: "Visited",
  unvisited: "Not visited",
};

const EMPTY_FILTER: PlaceFilter = { query: "", status: "all", type: undefined };

/** The trip's list of places to visit: search, filters, favorite/visited. */
export function PlacesScreen() {
  const data = useTripPlaces();
  if (data.status === "loading") return <ScreenSkeleton />;
  if (data.status === "error") {
    return (
      <LoadError what="Places" />
    );
  }
  if (data.data === undefined) return <TripNotFound />;
  return <PlacesContent data={data.data} />;
}

function PlacesContent({ data }: { data: TripPlaces }) {
  const [filter, setFilter] = useState<PlaceFilter>(EMPTY_FILTER);
  const [creating, setCreating] = useState(false);
  const { trip, places } = data;
  const visible = filterPlaces(places, filter);
  const filtered = filter.query.trim() !== "" || filter.status !== "all" || filter.type !== undefined;
  const allPlaces = places.map((item) => item.place);

  return (
    <section className="mx-auto max-w-md space-y-3 px-4 py-5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-3 left-3 size-5 text-slate-400" />
          <input
            type="search"
            value={filter.query}
            onChange={(event) => setFilter((current) => ({ ...current, query: event.target.value }))}
            placeholder="Search your places"
            aria-label="Search your places"
            autoComplete="off"
            className={`${inputClass} bg-white pl-10`}
          />
        </div>
        <Button onClick={() => setCreating(true)} className="shrink-0">
          <PlusIcon />
          Add
        </Button>
      </div>

      {places.length > 0 && (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Filter">
            {PLACE_STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                role="radio"
                aria-checked={filter.status === status}
                onClick={() => setFilter((current) => ({ ...current, status }))}
                className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm font-medium ${
                  filter.status === status ? "bg-teal-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter.type ?? ""}
              onChange={(event) =>
                setFilter((current) => ({
                  ...current,
                  type: event.target.value === "" ? undefined : (event.target.value as PlaceType),
                }))
              }
              aria-label="Category"
              className={`${inputClass} w-auto flex-1 bg-white`}
            >
              <option value="">All categories</option>
              {PLACE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PLACE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <p className="shrink-0 text-sm text-slate-500" aria-live="polite">
              {visible.length} of {places.length}
            </p>
          </div>
        </>
      )}

      {places.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <MapPinIcon className="mx-auto size-8 text-teal-700" />
          <h2 className="mt-2 text-lg font-semibold">Collect places to visit</h2>
          <p className="mt-1 text-slate-600">
            Search sights, restaurants or cities online, or add them manually. Add them to days whenever you&apos;re
            ready.
          </p>
          <Button onClick={() => setCreating(true)} className="mt-4 w-full">
            <PlusIcon />
            Add your first place
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="font-medium text-slate-800">No places match</p>
          {filtered && (
            <Button variant="secondary" onClick={() => setFilter(EMPTY_FILTER)} className="mt-3">
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          {visible.map((item) => (
            <PlaceRow key={item.place.id} tripId={trip.id} item={item} />
          ))}
        </ul>
      )}

      <PlaceFormSheet
        open={creating}
        tripId={trip.id}
        places={allPlaces}
        initialName={filter.query}
        onClose={() => setCreating(false)}
      />
    </section>
  );
}

function PlaceRow({ tripId, item }: { tripId: string; item: PlaceSummary }) {
  const { place, usages, dayStops, planned } = item;
  const location = placeLocation(place);
  const days = [
    ...new Set(
      [...dayStops.map((stop) => stop.dayNumber), ...usages.map((usage) => usage.dayNumber)].filter(
        (day): day is number => day !== null,
      ),
    ),
  ].sort((a, b) => a - b);
  const [error, setError] = useState(false);

  const toggle = (action: () => Promise<unknown>) => {
    setError(false);
    action().catch((caught: unknown) => {
      console.error("Failed to update place", caught);
      setError(true);
    });
  };

  return (
    <li className="flex items-center gap-1 pr-2">
      <Link
        href={appRoutePath({ name: "trip-place", tripId, placeId: place.id })}
        className="flex min-w-0 flex-1 flex-col gap-0.5 py-3 pl-4 hover:bg-slate-50"
      >
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-slate-900">{place.name}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PLACE_TYPE_BADGE[place.type]}`}>
            {PLACE_TYPE_LABELS[place.type]}
          </span>
        </span>
        <span className={`truncate text-sm ${location === undefined ? "text-amber-700" : "text-slate-500"}`}>
          {location ?? "No location yet"}
        </span>
        <span className="text-xs font-medium text-slate-500">
          {planned ? (days.length > 0 ? `Day ${days.join(", ")}` : "Planned") : "Not planned yet"}
          {error && <span className="text-red-600"> · Change not saved</span>}
        </span>
      </Link>
      <button
        type="button"
        aria-pressed={place.favorite}
        aria-label={`Favorite ${place.name}`}
        onClick={() => toggle(() => getPlaceService().setFavorite(place.id, !place.favorite))}
        className={`flex size-11 shrink-0 items-center justify-center rounded-full ${place.favorite ? "text-amber-500" : "text-slate-300"}`}
      >
        <StarIcon fill={place.favorite ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        aria-pressed={place.visited}
        aria-label={`Visited ${place.name}`}
        onClick={() => toggle(() => getPlaceService().setVisited(place.id, !place.visited))}
        className={`flex size-11 shrink-0 items-center justify-center rounded-full ${place.visited ? "text-emerald-600" : "text-slate-300"}`}
      >
        <CheckCircleIcon />
      </button>
    </li>
  );
}
