/**
 * Map tile configuration (public, browser-side). Any vector style URL that MapLibre
 * understands works; keys, if a provider needs one, must be browser keys only.
 * Default: OpenFreeMap (OpenStreetMap data, no API key).
 */
const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL;
