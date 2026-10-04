"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { formatCoordinates } from "@/lib/domain/coordinates";
import { PLACE_TYPES, type Accommodation, type Place, type PlaceType, type Transport } from "@/lib/domain/types";
import { nightsOf } from "@/lib/services/accommodationSchedule";
import { useItinerary } from "@/lib/hooks/useItinerary";
import {
  allPlacesModel,
  dayModel,
  formatDayRanges,
  isLocated,
  MAP_VIEW_MODES,
  placeDayNumbers,
  routeModel,
  type MapModel,
  type MapViewMode,
} from "@/lib/map/mapModel";
import { appRoutePath } from "@/lib/routing/routes";
import type { DayTimeline, Itinerary } from "@/lib/services/itineraryService";
import { placesCenter } from "@/lib/services/placeFilters";
import { getPlaceService } from "@/lib/services/placeService";
import { Button } from "@/components/ui/Button";
import { ChevronRightIcon, CloseIcon, MapPinIcon } from "@/components/ui/icons";
import { inputClass } from "@/components/trips/formFields";
import { dayOptionLabel } from "@/components/itinerary/itineraryDisplay";
import { PLACE_TYPE_BADGE, PLACE_TYPE_LABELS, PLACE_TYPE_SYMBOLS } from "@/components/places/placeDisplay";
import { stayDates, stayLocation } from "@/components/accommodation/stayDisplay";
import { TransportSheet } from "@/components/itinerary/TransportSheet";
import {
  TRANSPORT_SYMBOLS,
  transportDurationLabel,
  transportTimes,
  transportTitle,
} from "@/components/itinerary/transportDisplay";
import { MapPickerSheet } from "./MapPickerSheet";
import { MapView } from "./MapView";
import { LoadError, ScreenSkeleton, TripNotFound } from "@/components/ui/ScreenState";

const VIEW_LABELS: Record<MapViewMode, string> = { route: "Route", day: "Day", all: "All places" };

/** Path of the map screen showing one day, e.g. for links from the Day View. */
export function mapDayPath(tripId: string, tripDayId: string): string {
  return `${appRoutePath({ name: "trip-section", tripId, section: "map" })}?view=day&day=${encodeURIComponent(tripDayId)}`;
}

interface MapState {
  view: MapViewMode;
  /** Day view: the day. All places view: optional day filter. */
  dayId: string | undefined;
  type: PlaceType | undefined;
}

function isViewMode(value: string | null): value is MapViewMode {
  return value !== null && (MAP_VIEW_MODES as readonly string[]).includes(value);
}

/** Reads view and day from the URL query (client only; the server never sees them). */
function initialState(days: DayTimeline[]): MapState {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const day = params.get("day") ?? undefined;
  return { view: isViewMode(view) ? view : "route", dayId: day ?? days[0]?.day.id, type: undefined };
}

/** The trip map: route, one day, or all places. */
export function MapScreen() {
  const itinerary = useItinerary();
  if (itinerary.status === "loading") return <ScreenSkeleton />;
  if (itinerary.status === "error") {
    return (
      <LoadError what="The map" />
    );
  }
  if (itinerary.data === undefined) return <TripNotFound />;
  return <MapContent itinerary={itinerary.data} />;
}

function MapContent({ itinerary }: { itinerary: Itinerary }) {
  const { trip, days, outsideDays, places } = itinerary;
  const [state, setState] = useState<MapState>(() => initialState(days));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTransportId, setSelectedTransportId] = useState<string | null>(null);
  const [editingTransport, setEditingTransport] = useState<Transport | null>(null);
  const [selectedStayId, setSelectedStayId] = useState<string | null>(null);
  const selectPlace = useCallback((id: string | null) => {
    setSelectedId(id);
    setSelectedTransportId(null);
    setSelectedStayId(null);
  }, []);
  const selectTransport = useCallback((id: string) => {
    setSelectedTransportId(id);
    setSelectedId(null);
    setSelectedStayId(null);
  }, []);
  const selectStay = useCallback((id: string) => {
    setSelectedStayId(id);
    setSelectedId(null);
    setSelectedTransportId(null);
  }, []);
  const [fitRequest, setFitRequest] = useState(0);
  const [locating, setLocating] = useState<Place | null>(null);
  const dayChoices = [...days, ...outsideDays.filter((timeline) => timeline.day.id === state.dayId)];

  const update = (change: Partial<MapState>) => {
    const next = { ...state, ...change };
    setState(next);
    setSelectedId(null);
    setSelectedTransportId(null);
    setSelectedStayId(null);
    const params = new URLSearchParams({ view: next.view });
    if (next.dayId !== undefined && next.view !== "route") params.set("day", next.dayId);
    window.history.replaceState(window.history.state, "", `?${params.toString()}`);
  };

  const model: MapModel = useMemo(() => {
    if (state.view === "route") return routeModel(itinerary);
    if (state.view === "day") return state.dayId === undefined ? routeModel(itinerary) : dayModel(itinerary, state.dayId);
    return allPlacesModel(itinerary, { tripDayId: state.dayId, type: state.type });
  }, [itinerary, state]);

  const daysByPlace = useMemo(() => placeDayNumbers(itinerary), [itinerary]);
  const selected = selectedId === null ? undefined : places.get(selectedId);
  const selectedStay =
    selectedStayId === null ? undefined : itinerary.accommodations.find((stay) => stay.id === selectedStayId);
  const selectedTransport = selectedTransportId === null ? undefined : findTransport([...days, ...outsideDays], selectedTransportId);
  const fitKey = `${state.view}|${state.dayId ?? ""}|${state.type ?? ""}|${fitRequest}`;
  const allLocated = [...places.values()].filter(isLocated);

  return (
    <section className="mx-auto max-w-3xl space-y-3 px-4 py-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Map view">
        {MAP_VIEW_MODES.map((view) => (
          <button
            key={view}
            type="button"
            role="radio"
            aria-checked={state.view === view}
            onClick={() => update({ view, dayId: view === "day" ? (state.dayId ?? days[0]?.day.id) : view === "all" ? undefined : state.dayId })}
            className={`min-h-10 rounded-lg text-sm font-medium ${state.view === view ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            {VIEW_LABELS[view]}
          </button>
        ))}
      </div>

      {state.view !== "route" && (
        <div className="flex gap-2">
          <select
            aria-label="Day"
            value={state.dayId ?? ""}
            onChange={(event) => update({ dayId: event.target.value === "" ? undefined : event.target.value })}
            className={`${inputClass} min-w-0 flex-1 bg-white`}
          >
            {state.view === "all" && <option value="">All days</option>}
            {dayChoices.map((timeline) => (
              <option key={timeline.day.id} value={timeline.day.id}>
                {dayOptionLabel(timeline, places)}
              </option>
            ))}
          </select>
          {state.view === "all" && (
            <select
              aria-label="Category"
              value={state.type ?? ""}
              onChange={(event) => update({ type: event.target.value === "" ? undefined : (event.target.value as PlaceType) })}
              className={`${inputClass} w-auto max-w-[45%] bg-white`}
            >
              <option value="">All categories</option>
              {PLACE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PLACE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="relative">
        <MapView
          markers={model.markers}
          segments={model.segments}
          selectedPlaceId={selectedId}
          selectedStayId={selectedStayId}
          onSelectPlace={selectPlace}
          onSelectStay={selectStay}
          onSelectTransport={selectTransport}
          fitKey={fitKey}
          initialCenter={placesCenter(allLocated)}
          className="h-[55dvh] min-h-72 rounded-3xl ring-1 ring-slate-200"
        />
        {model.markers.length > 0 && (
          <button
            type="button"
            onClick={() => setFitRequest((count) => count + 1)}
            className="absolute top-2.5 left-2.5 min-h-9 rounded-lg bg-white px-3 text-sm font-semibold text-slate-700 shadow ring-1 ring-slate-200"
          >
            Fit
          </button>
        )}
      </div>

      {selected !== undefined && (
        <SelectedPlace
          tripId={trip.id}
          place={selected}
          days={daysByPlace.get(selected.id) ?? []}
          onClose={() => setSelectedId(null)}
        />
      )}

      {selectedTransport !== undefined && (
        <SelectedTransport
          transport={selectedTransport.transport}
          timeline={selectedTransport.timeline}
          places={places}
          onEdit={() => setEditingTransport(selectedTransport.transport)}
          onClose={() => setSelectedTransportId(null)}
        />
      )}

      {selectedStay !== undefined && (
        <SelectedStay
          tripId={trip.id}
          accommodation={selectedStay}
          location={stayLocation(selectedStay, places)}
          onClose={() => setSelectedStayId(null)}
        />
      )}

      <ViewEmptyState view={state.view} model={model} tripId={trip.id} hasPlaces={places.size > 0} />

      {model.stops.length > 0 && (
        <ol className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200" aria-label="Stops">
          {model.stops.map((stop) => (
            <li key={`${stop.number}-${stop.place.id}`}>
              <button
                type="button"
                onClick={() => selectPlace(stop.place.id)}
                className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50"
              >
                {state.view === "route" ? (
                  <span className="flex h-7 min-w-14 shrink-0 items-center justify-center rounded-full bg-teal-700 px-2 text-xs font-semibold whitespace-nowrap text-white">
                    {stop.dayNumbers.length > 0 ? `Day ${formatDayRanges(stop.dayNumbers)}` : "—"}
                  </span>
                ) : (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white">
                    {stop.number}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{stop.place.name}</span>
                  <span className="block truncate font-mono text-xs text-slate-500">{formatCoordinates(stop.place)}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {state.view === "all" && model.markers.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200" aria-label="Places on the map">
          {model.markers.map((marker) =>
            marker.kind === "place" ? (
              <li key={`place:${marker.placeId}`}>
                <button
                  type="button"
                  onClick={() => selectPlace(marker.placeId)}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50"
                >
                  <span aria-hidden="true">{PLACE_TYPE_SYMBOLS[marker.type]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">{marker.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {marker.dayNumbers.length === 0 ? "Not planned" : `Day ${formatDayRanges(marker.dayNumbers)}`} ·{" "}
                      <span className="font-mono">{formatCoordinates(marker)}</span>
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PLACE_TYPE_BADGE[marker.type]}`}>
                    {PLACE_TYPE_LABELS[marker.type]}
                  </span>
                </button>
              </li>
            ) : (
              <li key={`stay:${marker.accommodationId}`}>
                <button
                  type="button"
                  onClick={() => selectStay(marker.accommodationId)}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50"
                >
                  <span aria-hidden="true">🛏️</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">{marker.name}</span>
                    <span className="block truncate font-mono text-xs text-slate-500">{formatCoordinates(marker)}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">Stay</span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {model.unlocated.length > 0 && (
        <section aria-labelledby="unlocated-heading" className="rounded-3xl bg-white shadow-sm ring-1 ring-amber-200">
          <h2 id="unlocated-heading" className="px-4 pt-3 text-sm font-semibold text-amber-800">
            Not on map
          </h2>
          <p className="px-4 text-sm text-slate-500">These places have no position yet.</p>
          <ul className="divide-y divide-slate-100">
            {model.unlocated.map((place) => (
              <li key={place.id} className="flex items-center gap-2 py-2 pr-2 pl-4">
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{place.name}</span>
                <Button variant="secondary" onClick={() => setLocating(place)} className="shrink-0">
                  <MapPinIcon />
                  Set position
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <MapPickerSheet
        open={locating !== null}
        title={locating === null ? "Set position" : `Position of ${locating.name}`}
        position={null}
        near={placesCenter(allLocated)}
        onConfirm={async (position) => {
          if (locating !== null) await getPlaceService().setPlaceLocation(locating.id, position);
        }}
        onClose={() => setLocating(null)}
      />

      <TransportSheet
        itinerary={itinerary}
        target={editingTransport === null ? null : { mode: "edit", transport: editingTransport }}
        onClose={() => setEditingTransport(null)}
      />
    </section>
  );
}

function SelectedPlace({ tripId, place, days, onClose }: { tripId: string; place: Place; days: number[]; onClose: () => void }) {
  return (
    <div className="flex gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200" aria-live="polite">
      <div className="min-w-0 flex-1">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLACE_TYPE_BADGE[place.type]}`}>
          {PLACE_TYPE_LABELS[place.type]}
        </span>
        <h2 className="mt-1.5 truncate text-lg font-semibold text-slate-900">{place.name}</h2>
        {place.address !== undefined && <p className="truncate text-sm text-slate-600">{place.address}</p>}
        <p className="text-sm text-slate-500">
          {days.length > 0 ? `Day ${formatDayRanges(days)}` : "Not planned yet"}
          {isLocated(place) && <span className="font-mono"> · {formatCoordinates(place)}</span>}
        </p>
        <Link
          href={appRoutePath({ name: "trip-place", tripId, placeId: place.id })}
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-teal-700"
        >
          Open place
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close place details"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function SelectedStay({
  tripId,
  accommodation,
  location,
  onClose,
}: {
  tripId: string;
  accommodation: Accommodation;
  location: string | undefined;
  onClose: () => void;
}) {
  const nights = nightsOf(accommodation);
  return (
    <div className="flex gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-violet-200" aria-live="polite">
      <span aria-hidden="true" className="text-2xl">
        🛏️
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold text-slate-900">{accommodation.name}</h2>
        <p className="text-sm text-slate-600">{stayDates(accommodation)}</p>
        <p className="text-sm text-slate-500">
          {nights === 0 ? "No night" : nights === 1 ? "1 night" : `${nights} nights`}
          {location !== undefined && ` · ${location}`}
        </p>
        <Link
          href={appRoutePath({ name: "trip-section", tripId, section: "accommodation" })}
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-teal-700"
        >
          Open accommodation
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close accommodation details"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function SelectedTransport({
  transport,
  timeline,
  places,
  onEdit,
  onClose,
}: {
  transport: Transport;
  timeline: DayTimeline;
  places: ReadonlyMap<string, Place>;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { start, end, arrivalDays } = transportTimes(transport);
  const duration = transportDurationLabel(transport);
  const times = [
    start === undefined ? undefined : `${start} ${transport.departure ? timeZoneCity(transport.departure.timeZone) : ""}`.trim(),
    end === undefined ? undefined : `${end}${arrivalDays > 0 ? ` (+${arrivalDays})` : ""} ${transport.arrival ? timeZoneCity(transport.arrival.timeZone) : ""}`.trim(),
  ].filter((part) => part !== undefined);
  return (
    <div className="flex gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200" aria-live="polite">
      <span aria-hidden="true" className="text-2xl">
        {TRANSPORT_SYMBOLS[transport.type]}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold text-slate-900">{transportTitle(transport, places)}</h2>
        <p className="text-sm text-slate-600">{dayOptionLabel(timeline, places)}</p>
        {times.length > 0 && <p className="text-sm text-slate-600">{times.join(" → ")}</p>}
        <p className="text-sm text-slate-500">
          {[duration, transport.bookingReference ? `Ref ${transport.bookingReference}` : undefined]
            .filter((part) => part !== undefined)
            .join(" · ")}
        </p>
        <Button variant="secondary" onClick={onEdit} className="mt-2">
          Edit transport
        </Button>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close transport details"
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function findTransport(timelines: DayTimeline[], id: string): { transport: Transport; timeline: DayTimeline } | undefined {
  for (const timeline of timelines) {
    for (const entry of timeline.entries) {
      if (entry.kind === "transport" && entry.item.id === id) return { transport: entry.item, timeline };
    }
  }
  return undefined;
}

/** "Asia/Tashkent" → "Tashkent" (times are local to that zone). */
function timeZoneCity(timeZone: string): string {
  return timeZone.split("/").at(-1)?.replace(/_/g, " ") ?? timeZone;
}

function ViewEmptyState({ view, model, tripId, hasPlaces }: { view: MapViewMode; model: MapModel; tripId: string; hasPlaces: boolean }) {
  if (model.markers.length > 0) return null;
  let message: ReactNode;
  if (!hasPlaces) {
    message = (
      <>
        No places yet.{" "}
        <Link href={appRoutePath({ name: "trip-section", tripId, section: "places" })} className="font-semibold text-teal-700 underline">
          Add places
        </Link>{" "}
        to see them on the map.
      </>
    );
  } else if (view === "route") {
    message = (
      <>
        No route yet. Add <strong>places of the day</strong> to your days (e.g. the city you&apos;re in) in the{" "}
        <Link href={appRoutePath({ name: "trip-section", tripId, section: "plan" })} className="font-semibold text-teal-700 underline">
          itinerary
        </Link>
        .
      </>
    );
  } else if (view === "day") {
    message = "No places with a position on this day. Add places of the day or activities with a place.";
  } else {
    message = "No places with a position match this filter.";
  }
  return <p className="rounded-3xl bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">{message}</p>;
}
