/**
 * What the map shows, independent of the map library (see SCREENS.md "Map"):
 * markers, the connecting line, the numbered stop list and places without coordinates.
 */
import type { LatLng } from "@/lib/domain/coordinates";
import type { Place, PlaceType } from "@/lib/domain/types";
import type { DayTimeline, Itinerary } from "@/lib/services/itineraryService";

export const MAP_VIEW_MODES = ["route", "day", "all"] as const;
export type MapViewMode = (typeof MAP_VIEW_MODES)[number];

export type LocatedPlace = Place & LatLng;

export interface MapMarker extends LatLng {
  placeId: string;
  name: string;
  type: PlaceType;
  /** Text inside the marker: stop numbers ("1", "2, 5") or day numbers ("1–3"). Empty for none. */
  label: string;
  /** "unplanned" places are drawn in a neutral style. */
  tone: "planned" | "unplanned";
}

export interface MapStop {
  /** 1-based position along the line. */
  number: number;
  place: LocatedPlace;
  /** Days of the trip this stop covers (route view) or the day (day view). */
  dayNumbers: number[];
}

export interface MapModel {
  markers: MapMarker[];
  /** Points of the connecting line, in order (may be empty). */
  line: LatLng[];
  /** Numbered stops (route and day views), in order. */
  stops: MapStop[];
  /** Places relevant to the view that have no coordinates ("not on map"). */
  unlocated: Place[];
}

export function isLocated(place: Place): place is LocatedPlace {
  return place.latitude !== undefined && place.longitude !== undefined;
}

/** Compresses day numbers: [1, 2, 3, 5] → "1–3, 5". */
export function formatDayRanges(days: readonly number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
    parts.push(start === sorted[i] ? String(start) : `${start}–${sorted[i]}`);
  }
  return parts.join(", ");
}

function unique<T>(items: Iterable<T>): T[] {
  return [...new Set(items)];
}

/** Turns an ordered list of stops into markers (one per place, all its numbers) and a line. */
function fromStops(stops: MapStop[], unlocated: Place[]): MapModel {
  const byPlace = new Map<string, MapMarker>();
  for (const stop of stops) {
    const existing = byPlace.get(stop.place.id);
    if (existing) {
      existing.label = `${existing.label}, ${stop.number}`;
      continue;
    }
    byPlace.set(stop.place.id, {
      placeId: stop.place.id,
      name: stop.place.name,
      type: stop.place.type,
      latitude: stop.place.latitude,
      longitude: stop.place.longitude,
      label: String(stop.number),
      tone: "planned",
    });
  }
  return {
    markers: [...byPlace.values()],
    line: stops.map(({ place }) => ({ latitude: place.latitude, longitude: place.longitude })),
    stops,
    unlocated,
  };
}

/**
 * Route view: places of the day of all days within the trip dates, chronologically.
 * Consecutive entries of the same place are merged into one stop covering several days.
 * Places without coordinates are skipped (and listed as unlocated).
 */
export function routeModel(itinerary: Itinerary): MapModel {
  const stops: MapStop[] = [];
  const unlocated = new Map<string, Place>();
  for (const timeline of itinerary.days) {
    for (const placeId of timeline.day.placeIds ?? []) {
      const place = itinerary.places.get(placeId);
      if (place === undefined) continue;
      if (!isLocated(place)) {
        unlocated.set(place.id, place);
        continue;
      }
      const previous = stops.at(-1);
      const dayNumber = timeline.dayNumber;
      if (previous?.place.id === place.id) {
        if (dayNumber !== null && !previous.dayNumbers.includes(dayNumber)) previous.dayNumbers.push(dayNumber);
        continue;
      }
      stops.push({ number: stops.length + 1, place, dayNumbers: dayNumber === null ? [] : [dayNumber] });
    }
  }
  return fromStops(stops, [...unlocated.values()]);
}

/** Places of a day in order: places of the day first, then activity places in timeline order. */
export function dayPlaceSequence(timeline: DayTimeline, places: ReadonlyMap<string, Place>): Place[] {
  const ids = [
    ...(timeline.day.placeIds ?? []),
    ...timeline.entries.flatMap((entry) =>
      entry.kind === "activity" && entry.item.placeId !== undefined ? [entry.item.placeId] : [],
    ),
  ];
  const sequence: Place[] = [];
  for (const id of ids) {
    const place = places.get(id);
    // A place repeated directly (e.g. the city of the day, then an activity there) is one stop.
    if (place !== undefined && sequence.at(-1)?.id !== place.id) sequence.push(place);
  }
  return sequence;
}

/** Day view: one day's places, numbered in order and connected. */
export function dayModel(itinerary: Itinerary, tripDayId: string): MapModel {
  const timeline = [...itinerary.days, ...itinerary.outsideDays].find((candidate) => candidate.day.id === tripDayId);
  if (timeline === undefined) return { markers: [], line: [], stops: [], unlocated: [] };
  const sequence = dayPlaceSequence(timeline, itinerary.places);
  const located = sequence.filter(isLocated);
  const dayNumbers = timeline.dayNumber === null ? [] : [timeline.dayNumber];
  return fromStops(
    located.map((place, index) => ({ number: index + 1, place, dayNumbers })),
    unique(sequence.filter((place) => !isLocated(place))),
  );
}

/** Day numbers (within the trip dates) on which each place is used: as place of the day or by an activity. */
export function placeDayNumbers(itinerary: Itinerary): Map<string, number[]> {
  const result = new Map<string, number[]>();
  for (const timeline of itinerary.days) {
    if (timeline.dayNumber === null) continue;
    for (const place of dayPlaceSequence(timeline, itinerary.places)) {
      result.set(place.id, unique([...(result.get(place.id) ?? []), timeline.dayNumber]));
    }
  }
  return result;
}

export interface AllPlacesFilter {
  /** Only places used on this day; undefined = all places. */
  tripDayId?: string;
  /** Only places of this category; undefined = all categories. */
  type?: PlaceType;
}

/**
 * All places view: every place with coordinates, labelled with the days it is used on;
 * unplanned places are neutral. Optionally limited to one day and/or one category.
 */
export function allPlacesModel(itinerary: Itinerary, filter: AllPlacesFilter = {}): MapModel {
  const daysByPlace = placeDayNumbers(itinerary);
  let places = [...itinerary.places.values()];
  if (filter.tripDayId !== undefined) {
    const timeline = [...itinerary.days, ...itinerary.outsideDays].find((candidate) => candidate.day.id === filter.tripDayId);
    const onDay = new Set(timeline === undefined ? [] : dayPlaceSequence(timeline, itinerary.places).map((place) => place.id));
    places = places.filter((place) => onDay.has(place.id));
  }
  if (filter.type !== undefined) places = places.filter((place) => place.type === filter.type);
  places.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const markers = places.filter(isLocated).map((place): MapMarker => {
    const days = daysByPlace.get(place.id) ?? [];
    return {
      placeId: place.id,
      name: place.name,
      type: place.type,
      latitude: place.latitude,
      longitude: place.longitude,
      label: formatDayRanges(days),
      tone: days.length > 0 ? "planned" : "unplanned",
    };
  });
  return { markers, line: [], stops: [], unlocated: places.filter((place) => !isLocated(place)) };
}

/** South-west and north-east corners of the points, or undefined when there are none. */
export function boundsOf(points: readonly LatLng[]): { southWest: LatLng; northEast: LatLng } | undefined {
  if (points.length === 0) return undefined;
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  return {
    southWest: { latitude: Math.min(...latitudes), longitude: Math.min(...longitudes) },
    northEast: { latitude: Math.max(...latitudes), longitude: Math.max(...longitudes) },
  };
}
