/**
 * The active place search provider. Switching providers (MapTiler, Geoapify,
 * Google Places, …) means adding a provider module and selecting it here.
 */
import { createPhotonProvider, DEFAULT_PHOTON_URL } from "./photon";
import type { PlaceSearchProvider } from "./types";

export * from "./types";

let provider: PlaceSearchProvider | null = null;

export function getPlaceSearchProvider(): PlaceSearchProvider {
  provider ??= createPhotonProvider({ baseUrl: process.env.NEXT_PUBLIC_PHOTON_URL || DEFAULT_PHOTON_URL });
  return provider;
}
