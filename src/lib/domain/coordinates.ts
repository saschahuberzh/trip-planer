/**
 * Coordinates (WGS 84 decimal degrees): validation, formatting and parsing of
 * pasted map links or "lat, lng" text. Works offline: no link is ever fetched.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type CoordinatesParseResult =
  | { ok: true; coordinates: LatLng }
  | { ok: false; reason: "short-link" | "not-found" };

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

/** Six decimals ≈ 0.1 m, enough for any place. */
export function formatCoordinate(value: number): string {
  return String(Number(value.toFixed(6)));
}

export function formatCoordinates({ latitude, longitude }: LatLng): string {
  return `${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`;
}

/** Parses one decimal coordinate typed by the user ("41.31", "41,31", " -0.5 "). */
export function parseCoordinateNumber(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^[+-]?\d{1,3}(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

const NUMBER = String.raw`[+-]?\d{1,3}(?:\.\d+)?`;
const PAIR = String.raw`(${NUMBER})\s*,\s*(${NUMBER})`;

/** Patterns in order of precision; each captures latitude then longitude. */
const LINK_PATTERNS: RegExp[] = [
  // Google Maps place pin: …!3d41.3111!4d69.2797
  new RegExp(String.raw`!3d(${NUMBER})!4d(${NUMBER})`),
  // OpenStreetMap marker: ?mlat=…&mlon=…
  new RegExp(String.raw`[?&]mlat=(${NUMBER}).*?[?&]mlon=(${NUMBER})`),
  // Query parameters: Google q/query/destination/daddr, Apple ll/q/coordinate/sll
  new RegExp(String.raw`[?&](?:q|query|ll|sll|coordinate|destination|daddr|center|center_ll)=(?:loc:)?${PAIR}`),
  // Google Maps viewport: /@41.3111,69.2797,15z
  new RegExp(String.raw`@${PAIR}`),
  // OpenStreetMap: #map=15/41.3111/69.2797
  new RegExp(String.raw`#map=\d+(?:\.\d+)?/(${NUMBER})/(${NUMBER})`),
  // geo: URI
  new RegExp(String.raw`^geo:${PAIR}`),
];

const PLAIN_PAIR = new RegExp(String.raw`^\s*(${NUMBER})\s*[,;\s]\s*(${NUMBER})\s*$`);

/** Short links redirect to the real URL and can't be resolved without a request. */
const SHORT_LINK_HOSTS = ["maps.app.goo.gl", "goo.gl", "g.co", "maps.apple", "apple.co"];

function decode(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, " "));
  } catch {
    return text;
  }
}

function toLatLng(latitude: string, longitude: string): LatLng | null {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return isValidLatitude(lat) && isValidLongitude(lng) ? { latitude: lat, longitude: lng } : null;
}

function isShortLink(text: string): boolean {
  try {
    const { hostname } = new URL(text);
    return SHORT_LINK_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

/**
 * Reads coordinates from a pasted map link (Google Maps, Apple Maps, OpenStreetMap,
 * geo: URIs) or from plain "lat, lng" text.
 */
export function parseCoordinatesFromText(input: string): CoordinatesParseResult {
  const text = input.trim();
  const plain = PLAIN_PAIR.exec(text);
  if (plain) {
    const coordinates = toLatLng(plain[1], plain[2]);
    return coordinates ? { ok: true, coordinates } : { ok: false, reason: "not-found" };
  }
  const decoded = decode(text);
  for (const pattern of LINK_PATTERNS) {
    const match = pattern.exec(decoded);
    const coordinates = match ? toLatLng(match[1], match[2]) : null;
    if (coordinates) return { ok: true, coordinates };
  }
  return { ok: false, reason: isShortLink(text) ? "short-link" : "not-found" };
}
