"use client";

import type { Trip } from "@/lib/domain/types";
import { useAppRoute } from "@/lib/routing/useAppRoute";
import { getTripService } from "@/lib/services/tripService";
import { useLiveData, type LiveData } from "./useLiveData";

/**
 * The trip identified by the current URL (read via the shared route hook).
 * `data` is undefined when no trip with that ID exists on this device.
 */
export function useCurrentTrip(): LiveData<Trip | undefined> {
  const route = useAppRoute();
  const tripId = route !== null && "tripId" in route ? route.tripId : null;
  const trip = useLiveData(
    async () => (tripId === null ? undefined : getTripService().getTrip(tripId)),
    [tripId],
  );
  // Until hydration the trip ID is unknown.
  return tripId === null ? { status: "loading" } : trip;
}
