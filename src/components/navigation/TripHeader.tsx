"use client";

import Link from "next/link";
import { appRoutePath } from "@/lib/routing/routes";
import { useAppRoute } from "@/lib/routing/useAppRoute";

/** Trip header. Shows the trip ID from the URL until trips are stored (Phase 3). */
export function TripHeader() {
  const route = useAppRoute();
  const tripId = route !== null && "tripId" in route ? route.tripId : null;

  return (
    <header className="bg-white px-4 pt-4">
      <div className="mx-auto max-w-md">
        {tripId === null ? (
          <p className="text-xl font-semibold text-slate-400">Trip</p>
        ) : (
          <Link href={appRoutePath({ name: "trip-overview", tripId })} className="text-xl font-semibold">
            Trip
          </Link>
        )}
        <p className="mt-1 min-h-5 truncate font-mono text-xs text-slate-500" data-testid="trip-id">
          {tripId}
        </p>
      </div>
    </header>
  );
}
