/**
 * Place list search, filters and duplicate detection (pure functions).
 */
import type { LatLng } from "@/lib/domain/coordinates";
import type { Place, PlaceType } from "@/lib/domain/types";

export const PLACE_STATUS_FILTERS = ["all", "favorites", "planned", "unplanned", "visited", "unvisited"] as const;
export type PlaceStatusFilter = (typeof PLACE_STATUS_FILTERS)[number];

export interface PlaceFilter {
  query: string;
  status: PlaceStatusFilter;
  /** undefined = all types. */
  type: PlaceType | undefined;
}

export interface FilterablePlace {
  place: Place;
  planned: boolean;
}

/** Lowercase, without diacritics, punctuation or repeated spaces ("Shah-i-Zinda" → "shah i zinda"). */
export function normalizeName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function matchesStatus(item: FilterablePlace, status: PlaceStatusFilter): boolean {
  switch (status) {
    case "all":
      return true;
    case "favorites":
      return item.place.favorite;
    case "planned":
      return item.planned;
    case "unplanned":
      return !item.planned;
    case "visited":
      return item.place.visited;
    case "unvisited":
      return !item.place.visited;
  }
}

/** Every word of the query must appear in the name, address or notes. */
function matchesQuery(place: Place, query: string): boolean {
  const words = normalizeName(query).split(" ").filter((word) => word !== "");
  if (words.length === 0) return true;
  const haystack = normalizeName([place.name, place.address ?? "", place.notes ?? ""].join(" "));
  return words.every((word) => haystack.includes(word));
}

export function filterPlaces<T extends FilterablePlace>(items: readonly T[], filter: PlaceFilter): T[] {
  return items.filter(
    (item) =>
      matchesStatus(item, filter.status) &&
      (filter.type === undefined || item.place.type === filter.type) &&
      matchesQuery(item.place, filter.query),
  );
}

/** Sorted by name, case- and accent-insensitive. */
export function sortPlacesByName<T extends FilterablePlace>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.place.name.localeCompare(b.place.name, undefined, { sensitivity: "base" }));
}

/**
 * Existing places that look like the same place as `candidate`: same provider ID,
 * or a matching name. Used to suggest an existing place instead of a duplicate.
 */
export function findSimilarPlaces(
  places: readonly Place[],
  candidate: { name: string; externalRef?: Place["externalRef"] },
  excludeId?: string,
): Place[] {
  const name = normalizeName(candidate.name);
  return places.filter((place) => {
    if (place.id === excludeId) return false;
    const ref = candidate.externalRef;
    if (ref !== undefined && place.externalRef?.provider === ref.provider && place.externalRef.id === ref.id) return true;
    if (name.length < 3) return false;
    const other = normalizeName(place.name);
    if (other === name) return true;
    const [shorter, longer] = other.length < name.length ? [other, name] : [name, other];
    return shorter.length >= 4 && longer.includes(shorter);
  });
}

/** Centre of the places with coordinates (soft search bias), or undefined if none. */
export function placesCenter(places: readonly Place[]): LatLng | undefined {
  const located = places.filter(
    (place): place is Place & LatLng => place.latitude !== undefined && place.longitude !== undefined,
  );
  if (located.length === 0) return undefined;
  return {
    latitude: located.reduce((sum, place) => sum + place.latitude, 0) / located.length,
    longitude: located.reduce((sum, place) => sum + place.longitude, 0) / located.length,
  };
}
