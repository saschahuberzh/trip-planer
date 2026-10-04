export const APP_NAME = "Travel Planner";
/** From package.json (set in next.config.ts); "dev" in tests. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
export const APP_SHORT_NAME = "Travel";
export const APP_DESCRIPTION = "Plan trips day by day: itinerary, places, map, bookings and budget. Works offline.";
export const THEME_COLOR = "#0f766e";
export const BACKGROUND_COLOR = "#f8fafc";

/** Icons in public/icons (generated from public/icons/icon.svg); precached for offline use. */
export const APP_ICON_PATHS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32.png",
] as const;
