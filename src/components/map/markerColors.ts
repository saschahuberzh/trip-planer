import type { PlaceType } from "@/lib/domain/types";

/** Marker fill per category (kept in sync with PLACE_TYPE_BADGE hues). */
export const MARKER_COLORS: Record<PlaceType, string> = {
  city: "#4f46e5",
  attraction: "#e11d48",
  restaurant: "#ea580c",
  hotel: "#7c3aed",
  airport: "#0284c7",
  train_station: "#059669",
  custom: "#475569",
};

export const UNPLANNED_MARKER_COLOR = "#94a3b8";
export const ROUTE_LINE_COLOR = "#0f766e";
