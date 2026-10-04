"use client";

import { useAppRoute } from "@/lib/routing/useAppRoute";
import { getPlaceService, type TripPlaces } from "@/lib/services/placeService";
import { useLiveData, type LiveData } from "./useLiveData";

/** Places of the trip identified by the current URL; `data` undefined if no such trip. */
export function useTripPlaces(): LiveData<TripPlaces | undefined> {
  const route = useAppRoute();
  const tripId = route !== null && "tripId" in route ? route.tripId : null;
  const places = useLiveData(
    async () => (tripId === null ? undefined : getPlaceService().listPlaces(tripId)),
    [tripId],
  );
  return tripId === null ? { status: "loading" } : places;
}
