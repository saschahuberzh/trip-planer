/**
 * Photon (komoot) place search provider: OpenStreetMap data, no API key.
 * https://photon.komoot.io — a fair-use public service; keep request volume low.
 */
import type { PlaceType } from "@/lib/domain/types";
import {
  PlaceSearchError,
  type PlaceSearchOptions,
  type PlaceSearchProvider,
  type PlaceSearchResult,
} from "./types";

const PHOTON_PROVIDER_ID = "photon";
export const DEFAULT_PHOTON_URL = "https://photon.komoot.io/api/";

/** Languages Photon accepts; any other `lang` value is rejected with HTTP 400. */
const PHOTON_LANGUAGES = new Set(["de", "en", "fr"]);
const DEFAULT_LIMIT = 8;

interface PhotonProperties {
  osm_type?: string;
  osm_id?: number;
  osm_key?: string;
  osm_value?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  district?: string;
  locality?: string;
  state?: string;
  country?: string;
}

interface PhotonFeature {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: PhotonProperties;
}

const CITY_VALUES = new Set(["city", "town", "village", "hamlet", "suburb", "municipality"]);
const RESTAURANT_VALUES = new Set(["restaurant", "cafe", "fast_food", "bar", "pub", "food_court", "ice_cream", "biergarten"]);
const HOTEL_VALUES = new Set(["hotel", "hostel", "guest_house", "motel", "apartment", "chalet", "camp_site"]);
const ATTRACTION_KEYS = new Set(["historic", "natural"]);
const ATTRACTION_LEISURE = new Set(["park", "garden", "nature_reserve", "water_park"]);
const ATTRACTION_TOURISM = new Set(["attraction", "museum", "viewpoint", "gallery", "artwork", "theme_park", "zoo"]);

/** Maps an OSM category to our place type. */
export function photonPlaceType(key: string | undefined, value: string | undefined): PlaceType {
  if (key === "place" && value !== undefined && CITY_VALUES.has(value)) return "city";
  if (key === "aeroway" && (value === "aerodrome" || value === "terminal")) return "airport";
  if ((key === "railway" && (value === "station" || value === "halt")) || (key === "public_transport" && value === "station")) {
    return "train_station";
  }
  if (key === "amenity" && value !== undefined && RESTAURANT_VALUES.has(value)) return "restaurant";
  if (key === "tourism" && value !== undefined && HOTEL_VALUES.has(value)) return "hotel";
  if (key === "tourism" && value !== undefined && ATTRACTION_TOURISM.has(value)) return "attraction";
  if (key !== undefined && ATTRACTION_KEYS.has(key)) return "attraction";
  if (key === "leisure" && value !== undefined && ATTRACTION_LEISURE.has(value)) return "attraction";
  if ((key === "amenity" && value === "place_of_worship") || (key === "place" && value === "square")) return "attraction";
  return "custom";
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function unique(parts: (string | undefined)[]): string[] {
  const result: string[] = [];
  for (const part of parts) {
    if (part !== undefined && !result.includes(part)) result.push(part);
  }
  return result;
}

/** Converts one Photon GeoJSON feature; returns null for unusable features. */
export function mapPhotonFeature(feature: PhotonFeature): PlaceSearchResult | null {
  const properties = feature.properties ?? {};
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [longitude, latitude] = coordinates;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const osmType = text(properties.osm_type);
  if (osmType === undefined || typeof properties.osm_id !== "number") return null;

  const street = text(properties.street);
  const streetLine = street === undefined ? undefined : unique([street, text(properties.housenumber)]).join(" ");
  const cityLine = unique([text(properties.postcode), text(properties.city) ?? text(properties.locality)]).join(" ") || undefined;
  const name = text(properties.name) ?? streetLine ?? text(properties.city) ?? text(properties.state) ?? text(properties.country);
  if (name === undefined) return null;

  const addressParts = unique([
    streetLine,
    cityLine,
    cityLine === undefined ? text(properties.state) : undefined,
    text(properties.country),
  ]).filter((part) => part !== name);

  return {
    externalId: `${osmType}${properties.osm_id}`,
    name,
    suggestedType: photonPlaceType(text(properties.osm_key), text(properties.osm_value)),
    address: addressParts.length > 0 ? addressParts.join(", ") : undefined,
    latitude,
    longitude,
  };
}

/** Builds the request URL for a query. */
export function photonSearchUrl(baseUrl: string, query: string, options: PlaceSearchOptions): string {
  const url = new URL(baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(options.limit ?? DEFAULT_LIMIT));
  const language = options.language?.toLowerCase().split("-")[0];
  if (language !== undefined && PHOTON_LANGUAGES.has(language)) url.searchParams.set("lang", language);
  if (options.near !== undefined) {
    url.searchParams.set("lat", options.near.latitude.toFixed(4));
    url.searchParams.set("lon", options.near.longitude.toFixed(4));
  }
  return url.toString();
}

type FetchFunction = (input: string, init: { signal: AbortSignal }) => Promise<Response>;

export function createPhotonProvider({
  baseUrl = DEFAULT_PHOTON_URL,
  fetch: fetchFn = (input, init) => fetch(input, init),
  isOnline = () => typeof navigator === "undefined" || navigator.onLine,
}: { baseUrl?: string; fetch?: FetchFunction; isOnline?: () => boolean } = {}): PlaceSearchProvider {
  return {
    id: PHOTON_PROVIDER_ID,
    attribution: "Search by Photon · © OpenStreetMap contributors",

    async search(query, options, signal) {
      if (!isOnline()) throw new PlaceSearchError("offline", "No internet connection");
      let response: Response;
      try {
        response = await fetchFn(photonSearchUrl(baseUrl, query, options), { signal });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new PlaceSearchError(isOnline() ? "unavailable" : "offline", "Place search request failed");
      }
      if (!response.ok) throw new PlaceSearchError("unavailable", `Place search failed with HTTP ${response.status}`);

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new PlaceSearchError("unavailable", "Place search returned an invalid response");
      }
      const features = (body as { features?: unknown } | null)?.features;
      if (!Array.isArray(features)) throw new PlaceSearchError("unavailable", "Place search returned an invalid response");

      const results: PlaceSearchResult[] = [];
      const seen = new Set<string>();
      for (const feature of features as PhotonFeature[]) {
        const result = typeof feature === "object" && feature !== null ? mapPhotonFeature(feature) : null;
        if (result === null) continue;
        // The same place often exists as several OSM objects (e.g. node and area).
        const nearbyKey = `${result.name}|${result.latitude.toFixed(3)}|${result.longitude.toFixed(3)}`;
        if (seen.has(result.externalId) || seen.has(nearbyKey)) continue;
        seen.add(result.externalId);
        seen.add(nearbyKey);
        results.push(result);
      }
      return results;
    },
  };
}
