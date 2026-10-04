"use client";

import { useState } from "react";
import { useCurrentTrip } from "@/lib/hooks/useCurrentTrip";
import { PencilIcon } from "@/components/ui/icons";
import { TripFormSheet } from "@/components/trips/TripFormSheet";
import { tripCountries, tripDates } from "@/components/trips/tripDisplay";

/**
 * Trip name, countries and dates for every trip screen, with editing. Back to the trips
 * list is in the global navigation; deleting a trip is in the trips list.
 */
export function TripHeader() {
  const trip = useCurrentTrip();
  const [editing, setEditing] = useState(false);

  return (
    <header className="bg-white px-4 pt-5 lg:px-0 lg:pt-8">
      <div className="mx-auto max-w-md lg:max-w-6xl lg:px-8">
        {trip.status === "ready" && trip.data !== undefined ? (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold tracking-tight">{trip.data.name}</h1>
              {trip.data.countries.length > 0 && (
                <p className="mt-0.5 truncate text-sm text-slate-600">{tripCountries(trip.data)}</p>
              )}
              <p className="truncate text-sm text-slate-500">{tripDates(trip.data)}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit trip"
              className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <PencilIcon />
            </button>
            <TripFormSheet open={editing} onClose={() => setEditing(false)} trip={trip.data} />
          </div>
        ) : (
          <div className="min-h-[3.25rem]">
            {trip.status === "loading" ? (
              <div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-lg bg-slate-200" />
            ) : (
              <h1 className="text-2xl font-bold tracking-tight text-slate-500">
                {trip.status === "error" ? "Trip" : "Trip not found"}
              </h1>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
