import { formatCoordinates } from "@/lib/domain/coordinates";
import type { Place, PlaceType } from "@/lib/domain/types";

export const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  city: "City",
  attraction: "Sight",
  restaurant: "Food & drink",
  hotel: "Hotel",
  airport: "Airport",
  train_station: "Train station",
  custom: "Other",
};

export const PLACE_TYPE_BADGE: Record<PlaceType, string> = {
  city: "bg-indigo-100 text-indigo-800",
  attraction: "bg-rose-100 text-rose-800",
  restaurant: "bg-orange-100 text-orange-800",
  hotel: "bg-violet-100 text-violet-800",
  airport: "bg-sky-100 text-sky-800",
  train_station: "bg-emerald-100 text-emerald-800",
  custom: "bg-slate-200 text-slate-700",
};

export function hasCoordinates(place: Place): place is Place & { latitude: number; longitude: number } {
  return place.latitude !== undefined && place.longitude !== undefined;
}

/** Address, else coordinates, else undefined. */
export function placeLocation(place: Place): string | undefined {
  if (place.address !== undefined) return place.address;
  return hasCoordinates(place) ? formatCoordinates(place) : undefined;
}
