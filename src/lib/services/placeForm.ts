/**
 * Create/edit place form: raw input values, applying search results, validation and
 * conversion to PlaceInput. Kept free of React so it can be tested directly.
 */
import { formatCoordinate, isValidLatitude, isValidLongitude, parseCoordinateNumber } from "@/lib/domain/coordinates";
import type { Place, PlaceExternalRef, PlaceType } from "@/lib/domain/types";
import type { PlaceSearchResult } from "@/lib/placeSearch/types";
import { optionalText } from "./itineraryForms";
import type { PlaceInput } from "./placeService";

export const MAX_PLACE_NAME_LENGTH = 120;

export interface PlaceFormValues {
  name: string;
  type: PlaceType;
  address: string;
  /** As typed; both empty = no coordinates. */
  latitude: string;
  longitude: string;
  website: string;
  notes: string;
  favorite: boolean;
  visited: boolean;
  externalRef: PlaceExternalRef | undefined;
}

export type PlaceFormErrors = Partial<Record<"name" | "latitude" | "longitude" | "website", string>>;

export type PlaceFormResult = { ok: true; input: PlaceInput } | { ok: false; errors: PlaceFormErrors };

export function emptyPlaceFormValues(name = ""): PlaceFormValues {
  return {
    name,
    type: "attraction",
    address: "",
    latitude: "",
    longitude: "",
    website: "",
    notes: "",
    favorite: false,
    visited: false,
    externalRef: undefined,
  };
}

export function placeToFormValues(place: Place): PlaceFormValues {
  return {
    name: place.name,
    type: place.type,
    address: place.address ?? "",
    latitude: place.latitude === undefined ? "" : formatCoordinate(place.latitude),
    longitude: place.longitude === undefined ? "" : formatCoordinate(place.longitude),
    website: place.website ?? "",
    notes: place.notes ?? "",
    favorite: place.favorite,
    visited: place.visited,
    externalRef: place.externalRef,
  };
}

/**
 * Copies a search result into the form. Name, type, address and coordinates are
 * replaced; website, notes, favorite and visited are kept.
 */
export function applySearchResult(values: PlaceFormValues, result: PlaceSearchResult, providerId: string): PlaceFormValues {
  return {
    ...values,
    name: result.name,
    type: result.suggestedType,
    address: result.address ?? "",
    latitude: formatCoordinate(result.latitude),
    longitude: formatCoordinate(result.longitude),
    externalRef: { provider: providerId, id: result.externalId },
  };
}

/** Adds "https://" to web addresses typed without a scheme. Returns null if invalid. */
export function normalizeWebsite(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function validatePlaceForm(values: PlaceFormValues): PlaceFormResult {
  const errors: PlaceFormErrors = {};

  const name = values.name.trim();
  if (name === "") errors.name = "Give the place a name.";
  else if (name.length > MAX_PLACE_NAME_LENGTH) errors.name = `Use at most ${MAX_PLACE_NAME_LENGTH} characters.`;

  let latitude: number | undefined;
  let longitude: number | undefined;
  const hasLatitude = values.latitude.trim() !== "";
  const hasLongitude = values.longitude.trim() !== "";
  if (hasLatitude || hasLongitude) {
    const lat = parseCoordinateNumber(values.latitude);
    const lng = parseCoordinateNumber(values.longitude);
    if (!hasLatitude) errors.latitude = "Add the latitude as well.";
    else if (lat === null || !isValidLatitude(lat)) errors.latitude = "Use a number between -90 and 90.";
    else latitude = lat;
    if (!hasLongitude) errors.longitude = "Add the longitude as well.";
    else if (lng === null || !isValidLongitude(lng)) errors.longitude = "Use a number between -180 and 180.";
    else longitude = lng;
  }

  const website = normalizeWebsite(values.website);
  if (website === null) errors.website = "Enter a web address like example.com.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      name,
      type: values.type,
      address: optionalText(values.address),
      latitude,
      longitude,
      website: website === "" || website === null ? undefined : website,
      notes: optionalText(values.notes),
      favorite: values.favorite,
      visited: values.visited,
      externalRef: values.externalRef,
    },
  };
}
