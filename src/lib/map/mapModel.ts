/**
 * What the map shows, independent of the map library (see SCREENS.md "Map"):
 * markers, the connecting line, the numbered stop list and places without coordinates.
 */
import type { LatLng } from "@/lib/domain/coordinates";
import type { Accommodation, Place, PlaceType, Transport, TransportType } from "@/lib/domain/types";
import { staysOnDate } from "@/lib/services/accommodationSchedule";
import type { DayTimeline, Itinerary } from "@/lib/services/itineraryService";

export const MAP_VIEW_MODES = ["route", "day", "all"] as const;
export type MapViewMode = (typeof MAP_VIEW_MODES)[number];

export type LocatedPlace = Place & LatLng;

export interface PlaceMarker extends LatLng {
  kind: "place";
  placeId: string;
  name: string;
  type: PlaceType;
  /**
   * Text inside the marker: days in the route view ("1–3, 7"), stop numbers in the day
   * view ("1", "2, 5"). Empty in the all places view (the category symbol is shown).
   */
  label: string;
  /** Days of the trip the place is used on (for lists and details). */
  dayNumbers: number[];
  /** "unplanned" places are drawn in a neutral style. */
  tone: "planned" | "unplanned";
}

/** An accommodation (at its linked place or its own coordinates); not numbered. */
export interface StayMarker extends LatLng {
  kind: "stay";
  accommodationId: string;
  name: string;
}

export type MapMarker = PlaceMarker | StayMarker;

/** A straight segment between two consecutive stops; `transport` when a transport connects them. */
export interface MapSegment {
  from: LatLng;
  to: LatLng;
  transport?: { id: string; type: TransportType };
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
  /** Segments between consecutive stops, in order (may be empty). */
  segments: MapSegment[];
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

const toLatLng = (place: LocatedPlace): LatLng => ({ latitude: place.latitude, longitude: place.longitude });

/** Where an accommodation is: its linked place (authoritative) or its own coordinates. */
export function stayPosition(accommodation: Accommodation, places: ReadonlyMap<string, Place>): LatLng | undefined {
  if (accommodation.placeId !== undefined) {
    const place = places.get(accommodation.placeId);
    return place && isLocated(place) ? toLatLng(place) : undefined;
  }
  if (accommodation.latitude === undefined || accommodation.longitude === undefined) return undefined;
  return { latitude: accommodation.latitude, longitude: accommodation.longitude };
}

/** Markers for accommodations with a position, skipping those at places already shown. */
function stayMarkers(
  accommodations: readonly Accommodation[],
  places: ReadonlyMap<string, Place>,
  shownPlaceIds: ReadonlySet<string>,
): StayMarker[] {
  return accommodations.flatMap((accommodation): StayMarker[] => {
    if (accommodation.placeId !== undefined && shownPlaceIds.has(accommodation.placeId)) return [];
    const position = stayPosition(accommodation, places);
    return position ? [{ kind: "stay", accommodationId: accommodation.id, name: accommodation.name, ...position }] : [];
  });
}

/**
 * Turns an ordered list of stops into markers (one per place) and segments. Markers are
 * labelled with the stop numbers ("numbers") or with the days covered ("days").
 * `connectionInto(i)` returns the transport arriving at stop i from stop i - 1, if any.
 */
function fromStops(
  stops: MapStop[],
  unlocated: Place[],
  labels: "numbers" | "days",
  connectionInto: (index: number) => Transport | undefined,
): MapModel {
  const byPlace = new Map<string, PlaceMarker>();
  const numbers = new Map<string, number[]>();
  for (const stop of stops) {
    numbers.set(stop.place.id, [...(numbers.get(stop.place.id) ?? []), stop.number]);
    const existing = byPlace.get(stop.place.id);
    if (existing) {
      existing.dayNumbers = unique([...existing.dayNumbers, ...stop.dayNumbers]);
      continue;
    }
    byPlace.set(stop.place.id, {
      kind: "place",
      placeId: stop.place.id,
      name: stop.place.name,
      type: stop.place.type,
      latitude: stop.place.latitude,
      longitude: stop.place.longitude,
      label: "",
      dayNumbers: [...stop.dayNumbers],
      tone: "planned",
    });
  }
  for (const marker of byPlace.values()) {
    marker.label = labels === "days" ? formatDayRanges(marker.dayNumbers) : (numbers.get(marker.placeId) ?? []).join(", ");
  }
  const segments = stops.slice(1).map((stop, i): MapSegment => {
    const transport = connectionInto(i + 1);
    return {
      from: toLatLng(stops[i].place),
      to: toLatLng(stop.place),
      ...(transport ? { transport: { id: transport.id, type: transport.type } } : {}),
    };
  });
  return { markers: [...byPlace.values()], segments, stops, unlocated };
}

/** Transports of days within the trip dates, with their day number. */
function datedTransports(itinerary: Itinerary): { transport: Transport; dayNumber: number }[] {
  return itinerary.days.flatMap(({ dayNumber, entries }) => {
    if (dayNumber === null) return [];
    return entries.flatMap((entry) => (entry.kind === "transport" ? [{ transport: entry.item, dayNumber }] : []));
  });
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
  // A segment shows a transport going from its first to its second stop on a day between them.
  const transports = datedTransports(itinerary);
  return fromStops(stops, [...unlocated.values()], "days", (index) => {
    const from = stops[index - 1];
    const to = stops[index];
    const earliest = Math.max(...from.dayNumbers);
    const latest = Math.min(...to.dayNumbers);
    return transports.find(
      ({ transport, dayNumber }) =>
        transport.originPlaceId === from.place.id &&
        transport.destinationPlaceId === to.place.id &&
        dayNumber >= earliest &&
        dayNumber <= latest,
    )?.transport;
  });
}

/** One place visited during a day; `arrivedBy` when reached by a transport from the previous node. */
export interface DayNode {
  place: Place;
  arrivedBy?: Transport;
}

/**
 * A day's places in order. The timeline gives the order: activity places, and for transports
 * their origin and destination. Places of the day that come before the timeline's first
 * known place are put in front (e.g. "Samarkand", then the sights of the day); with an empty
 * timeline the places of the day are the sequence. Directly repeated places are one node.
 */
export function dayPlaceNodes(timeline: DayTimeline, places: ReadonlyMap<string, Place>): DayNode[] {
  const timelineNodes: DayNode[] = [];
  for (const entry of timeline.entries) {
    if (entry.kind === "activity") {
      const place = entry.item.placeId === undefined ? undefined : places.get(entry.item.placeId);
      if (place) timelineNodes.push({ place });
      continue;
    }
    const origin = entry.item.originPlaceId === undefined ? undefined : places.get(entry.item.originPlaceId);
    const destination = entry.item.destinationPlaceId === undefined ? undefined : places.get(entry.item.destinationPlaceId);
    if (origin) timelineNodes.push({ place: origin });
    if (destination) timelineNodes.push({ place: destination, ...(origin ? { arrivedBy: entry.item } : {}) });
  }

  const dayPlaces = (timeline.day.placeIds ?? []).flatMap((id) => {
    const place = places.get(id);
    return place ? [place] : [];
  });
  const timelineIds = new Set(timelineNodes.map((node) => node.place.id));
  const firstCovered = dayPlaces.findIndex((place) => timelineIds.has(place.id));
  const prefix = (firstCovered === -1 ? dayPlaces : dayPlaces.slice(0, firstCovered)).map((place): DayNode => ({ place }));

  const nodes: DayNode[] = [];
  for (const node of [...prefix, ...timelineNodes]) {
    const previous = nodes.at(-1);
    if (previous?.place.id === node.place.id) continue;
    nodes.push(node);
  }
  return nodes;
}

/** A day's places in order (see dayPlaceNodes). */
export function dayPlaceSequence(timeline: DayTimeline, places: ReadonlyMap<string, Place>): Place[] {
  return dayPlaceNodes(timeline, places).map((node) => node.place);
}

/** Day view: one day's places, numbered in order and connected; transports label their segment. */
export function dayModel(itinerary: Itinerary, tripDayId: string): MapModel {
  const timeline = [...itinerary.days, ...itinerary.outsideDays].find((candidate) => candidate.day.id === tripDayId);
  if (timeline === undefined) return { markers: [], segments: [], stops: [], unlocated: [] };
  const nodes = dayPlaceNodes(timeline, itinerary.places);
  const located = nodes.filter((node): node is DayNode & { place: LocatedPlace } => isLocated(node.place));
  const dayNumbers = timeline.dayNumber === null ? [] : [timeline.dayNumber];
  const model = fromStops(
    located.map((node, index) => ({ number: index + 1, place: node.place, dayNumbers })),
    unique(nodes.map((node) => node.place).filter((place) => !isLocated(place))),
    "numbers",
    (index) => {
      const transport = located[index].arrivedBy;
      // Only when the previous stop shown is really where the transport left from.
      return transport?.originPlaceId === located[index - 1].place.id ? transport : undefined;
    },
  );
  // Where you sleep before and after this day (check-out, night, check-in).
  const stays = staysOnDate(itinerary.accommodations, timeline.day.date).map((stay) => stay.accommodation);
  const shown = new Set(located.map((node) => node.place.id));
  return { ...model, markers: [...model.markers, ...stayMarkers(stays, itinerary.places, shown)] };
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
 * All places view: every place with coordinates (unlabelled; the category symbol is shown),
 * unplanned places neutral, plus accommodations. Optionally limited to one day (its places
 * and the accommodations of that date) and/or one category (accommodations count as hotels).
 */
export function allPlacesModel(itinerary: Itinerary, filter: AllPlacesFilter = {}): MapModel {
  const daysByPlace = placeDayNumbers(itinerary);
  let places = [...itinerary.places.values()];
  let stays: readonly Accommodation[] = itinerary.accommodations;
  if (filter.tripDayId !== undefined) {
    const timeline = [...itinerary.days, ...itinerary.outsideDays].find((candidate) => candidate.day.id === filter.tripDayId);
    const onDay = new Set(timeline === undefined ? [] : dayPlaceSequence(timeline, itinerary.places).map((place) => place.id));
    places = places.filter((place) => onDay.has(place.id));
    stays = timeline === undefined ? [] : staysOnDate(stays, timeline.day.date).map((stay) => stay.accommodation);
  }
  if (filter.type !== undefined) {
    places = places.filter((place) => place.type === filter.type);
    if (filter.type !== "hotel") stays = [];
  }
  places.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  // A place that is an accommodation's location is shown once, as the accommodation.
  const stayMarkerList = stayMarkers(stays, itinerary.places, new Set());
  const stayPlaceIds = new Set(stays.flatMap((stay) => (stay.placeId === undefined ? [] : [stay.placeId])));
  const placeMarkers = places
    .filter(isLocated)
    .filter((place) => !stayPlaceIds.has(place.id))
    .map((place): PlaceMarker => {
      const days = daysByPlace.get(place.id) ?? [];
      return {
        kind: "place",
        placeId: place.id,
        name: place.name,
        type: place.type,
        latitude: place.latitude,
        longitude: place.longitude,
        label: "",
        dayNumbers: days,
        tone: days.length > 0 ? "planned" : "unplanned",
      };
    });
  return {
    markers: [...placeMarkers, ...stayMarkerList],
    segments: [],
    stops: [],
    unlocated: places.filter((place) => !isLocated(place)),
  };
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
