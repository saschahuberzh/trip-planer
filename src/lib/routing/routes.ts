// Route definitions shared by the client (route hook, navigation) and the
// service worker (offline route templates). Must stay free of React, Next.js
// and DOM imports so it can be bundled into the service worker and next.config.

export const TRIP_SECTIONS = [
  "plan",
  "map",
  "places",
  "budget",
  "accommodation",
  "bookings",
] as const;

export type TripSection = (typeof TRIP_SECTIONS)[number];

export type AppRoute =
  | { name: "trips" }
  | { name: "countries" }
  | { name: "settings" }
  | { name: "trip-overview"; tripId: string }
  | { name: "trip-section"; tripId: string; section: TripSection }
  | { name: "trip-day"; tripId: string; dayId: string }
  | { name: "trip-place"; tripId: string; placeId: string };

/**
 * Placeholder ID used to prerender one HTML template per trip route.
 * The service worker serves these templates for any ID while offline;
 * client code reads the real ID from the URL.
 */
export const ROUTE_TEMPLATE_ID = "_template";

export const OFFLINE_FALLBACK_PATH = "/~offline";

function isTripSection(value: string): value is TripSection {
  return (TRIP_SECTIONS as readonly string[]).includes(value);
}

function decodeSegment(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment);
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

/** Parses an app pathname. Returns null for paths that are not app routes. */
export function parseAppRoute(pathname: string): AppRoute | null {
  const rawSegments = pathname.split("/").filter((segment) => segment !== "");
  const segments: string[] = [];
  for (const raw of rawSegments) {
    const decoded = decodeSegment(raw);
    if (decoded === null) return null;
    segments.push(decoded);
  }

  if (segments.length === 0) return { name: "trips" };
  if (segments.length === 1 && segments[0] === "settings") return { name: "settings" };
  if (segments.length === 1 && segments[0] === "countries") return { name: "countries" };
  if (segments[0] !== "trips" || segments.length < 2 || segments.length > 4) return null;

  const [, tripId, section, childId] = segments;
  if (section === undefined) return { name: "trip-overview", tripId };
  if (!isTripSection(section)) return null;
  if (childId === undefined) return { name: "trip-section", tripId, section };
  if (section === "plan") return { name: "trip-day", tripId, dayId: childId };
  if (section === "places") return { name: "trip-place", tripId, placeId: childId };
  return null;
}

/** Builds the pathname for a route. */
export function appRoutePath(route: AppRoute): string {
  switch (route.name) {
    case "trips":
      return "/";
    case "countries":
      return "/countries";
    case "settings":
      return "/settings";
    case "trip-overview":
      return `/trips/${encodeURIComponent(route.tripId)}`;
    case "trip-section":
      return `/trips/${encodeURIComponent(route.tripId)}/${route.section}`;
    case "trip-day":
      return `/trips/${encodeURIComponent(route.tripId)}/plan/${encodeURIComponent(route.dayId)}`;
    case "trip-place":
      return `/trips/${encodeURIComponent(route.tripId)}/places/${encodeURIComponent(route.placeId)}`;
  }
}

/** The trip section a route belongs to (day → plan, place → places). */
export function tripSectionOf(route: AppRoute): TripSection | null {
  switch (route.name) {
    case "trip-section":
      return route.section;
    case "trip-day":
      return "plan";
    case "trip-place":
      return "places";
    default:
      return null;
  }
}

/** Replaces every ID in the route with the template ID. */
function toTemplateRoute(route: AppRoute): AppRoute {
  switch (route.name) {
    case "trips":
    case "countries":
    case "settings":
      return route;
    case "trip-overview":
      return { ...route, tripId: ROUTE_TEMPLATE_ID };
    case "trip-section":
      return { ...route, tripId: ROUTE_TEMPLATE_ID };
    case "trip-day":
      return { ...route, tripId: ROUTE_TEMPLATE_ID, dayId: ROUTE_TEMPLATE_ID };
    case "trip-place":
      return { ...route, tripId: ROUTE_TEMPLATE_ID, placeId: ROUTE_TEMPLATE_ID };
  }
}

/**
 * Returns the precached page that can render the given pathname offline,
 * or null if the pathname is not an app route.
 */
export function templatePathFor(pathname: string): string | null {
  const route = parseAppRoute(pathname);
  return route === null ? null : appRoutePath(toTemplateRoute(route));
}

/** Every page HTML that the service worker precaches. */
export const PRECACHED_PAGE_PATHS: readonly string[] = [
  appRoutePath({ name: "trips" }),
  appRoutePath({ name: "countries" }),
  appRoutePath({ name: "settings" }),
  appRoutePath({ name: "trip-overview", tripId: ROUTE_TEMPLATE_ID }),
  ...TRIP_SECTIONS.map((section) =>
    appRoutePath({ name: "trip-section", tripId: ROUTE_TEMPLATE_ID, section }),
  ),
  appRoutePath({ name: "trip-day", tripId: ROUTE_TEMPLATE_ID, dayId: ROUTE_TEMPLATE_ID }),
  appRoutePath({ name: "trip-place", tripId: ROUTE_TEMPLATE_ID, placeId: ROUTE_TEMPLATE_ID }),
  OFFLINE_FALLBACK_PATH,
];
