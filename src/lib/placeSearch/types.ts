/**
 * Provider-neutral place search (geocoding). See TECH_STACK.md "Place Search".
 * UI and services depend only on these types; provider specifics live in one
 * module per provider.
 */
import type { PlaceType } from "@/lib/domain/types";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PlaceSearchOptions {
  /** UI language, e.g. "de" or "en-GB"; providers fall back when unsupported. */
  language?: string;
  /** Soft location bias, e.g. the centre of the trip's places. */
  near?: Coordinates;
  limit?: number;
}

/** A search hit. Never persisted as-is: saving copies it into a Place. */
export interface PlaceSearchResult extends Coordinates {
  /** Provider's ID; stored as `Place.externalRef.id`. */
  externalId: string;
  name: string;
  /** Mapped from the provider's category; the user can change it. */
  suggestedType: PlaceType;
  /** One formatted line, without the name. */
  address?: string;
}

export interface PlaceSearchProvider {
  /** Stored as `Place.externalRef.provider`. */
  id: string;
  /** Shown with the results. */
  attribution: string;
  search(query: string, options: PlaceSearchOptions, signal: AbortSignal): Promise<PlaceSearchResult[]>;
}

export type PlaceSearchErrorKind = "offline" | "unavailable";

/** Search failed; the message for the user depends on `kind`. */
export class PlaceSearchError extends Error {
  constructor(
    readonly kind: PlaceSearchErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "PlaceSearchError";
  }
}

/** Minimum query length before a search request is sent. */
export const MIN_SEARCH_QUERY_LENGTH = 3;
