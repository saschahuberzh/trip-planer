"use client";

import { useEffect } from "react";
import { useAppRoute } from "@/lib/routing/useAppRoute";
import { getItineraryService, type Itinerary } from "@/lib/services/itineraryService";
import { useLiveData, type LiveData } from "./useLiveData";

/**
 * The itinerary of the trip identified by the current URL. `data` is undefined when
 * no trip with that ID exists. Missing TripDays of the trip range are created once
 * per trip (and empty days outside the range removed); days with user data are kept.
 */
export function useItinerary(): LiveData<Itinerary | undefined> {
  const route = useAppRoute();
  const tripId = route !== null && "tripId" in route ? route.tripId : null;

  useEffect(() => {
    if (tripId === null) return;
    getItineraryService()
      .ensureTripDays(tripId)
      .catch((error: unknown) => console.error("Failed to create missing trip days", error));
  }, [tripId]);

  const itinerary = useLiveData(
    async () => (tripId === null ? undefined : getItineraryService().getItinerary(tripId)),
    [tripId],
  );
  return tripId === null ? { status: "loading" } : itinerary;
}
