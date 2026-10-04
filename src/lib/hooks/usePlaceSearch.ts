"use client";

import { useEffect, useState } from "react";
import type { LatLng } from "@/lib/domain/coordinates";
import {
  getPlaceSearchProvider,
  MIN_SEARCH_QUERY_LENGTH,
  PlaceSearchError,
  type PlaceSearchErrorKind,
  type PlaceSearchResult,
} from "@/lib/placeSearch";

export type PlaceSearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; results: PlaceSearchResult[] }
  | { status: "error"; kind: PlaceSearchErrorKind };

const DEBOUNCE_MS = 350;

/**
 * Online place search for `query`: debounced, at least MIN_SEARCH_QUERY_LENGTH
 * characters, and each new query cancels the previous request.
 */
export function usePlaceSearch(query: string, near?: LatLng): PlaceSearchState {
  const trimmed = query.trim();
  const enabled = trimmed.length >= MIN_SEARCH_QUERY_LENGTH;
  const nearKey = near === undefined ? "" : `${near.latitude.toFixed(2)},${near.longitude.toFixed(2)}`;
  const key = `${trimmed}|${nearKey}`;
  const [response, setResponse] = useState<{ key: string; state: PlaceSearchState } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const [latitude, longitude] = nearKey === "" ? [] : nearKey.split(",").map(Number);
    const timer = setTimeout(() => {
      const provider = getPlaceSearchProvider();
      provider
        .search(
          trimmed,
          {
            language: typeof navigator === "undefined" ? undefined : navigator.language,
            near: latitude === undefined ? undefined : { latitude, longitude },
          },
          controller.signal,
        )
        .then((results) => setResponse({ key, state: { status: "done", results } }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          if (!(error instanceof PlaceSearchError)) console.error("Place search failed", error);
          const kind = error instanceof PlaceSearchError ? error.kind : "unavailable";
          setResponse({ key, state: { status: "error", kind } });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, trimmed, nearKey, key]);

  if (!enabled) return { status: "idle" };
  return response?.key === key ? response.state : { status: "loading" };
}
