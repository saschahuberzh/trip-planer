"use client";

import Link from "next/link";
import { useCurrentTrip } from "@/lib/hooks/useCurrentTrip";
import { appRoutePath } from "@/lib/routing/routes";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { tripCountries, tripDates } from "@/components/trips/tripDisplay";

/** Trip name, countries and dates for every trip screen. */
export function TripHeader() {
  const trip = useCurrentTrip();

  return (
    <header className="bg-white px-4 pt-3 lg:px-0 lg:pt-6">
      <div className="mx-auto max-w-md lg:max-w-6xl lg:px-8">
        <Link
          href={appRoutePath({ name: "trips" })}
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl pr-3 pl-1 text-sm font-medium text-teal-700"
        >
          <ChevronLeftIcon />
          Trips
        </Link>
        {trip.status === "ready" && trip.data !== undefined ? (
          <Link href={appRoutePath({ name: "trip-overview", tripId: trip.data.id })} className="block">
            <h1 className="truncate text-2xl font-bold tracking-tight">{trip.data.name}</h1>
            {trip.data.countries.length > 0 && (
              <p className="mt-0.5 truncate text-sm text-slate-600">{tripCountries(trip.data)}</p>
            )}
            <p className="truncate text-sm text-slate-500">{tripDates(trip.data)}</p>
          </Link>
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
