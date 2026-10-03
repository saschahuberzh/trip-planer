"use client";

import Link from "next/link";
import type { Trip } from "@/lib/domain/types";
import { appRoutePath } from "@/lib/routing/routes";
import { MoreIcon } from "@/components/ui/icons";
import { TripCoverImage } from "./TripCoverImage";
import { TRIP_STATUS_BADGE, TRIP_STATUS_LABELS, tripCountries, tripDates, tripDuration } from "./tripDisplay";

type TripCardProps = {
  trip: Trip;
  onShowActions: (trip: Trip) => void;
};

export function TripCard({ trip, onShowActions }: TripCardProps) {
  return (
    <article className="relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <Link
        href={appRoutePath({ name: "trip-overview", tripId: trip.id })}
        className="block focus-visible:outline-2 focus-visible:outline-teal-700"
      >
        <TripCoverImage imageId={trip.coverImageId} seed={trip.id} label={trip.name} className="h-36 w-full" />
        <div className="space-y-1 px-4 pt-3 pb-4">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TRIP_STATUS_BADGE[trip.status]}`}>
              {TRIP_STATUS_LABELS[trip.status]}
            </span>
            <span className="text-xs text-slate-500">{tripDuration(trip)}</span>
          </div>
          <h3 className="truncate text-lg font-semibold">{trip.name}</h3>
          {trip.countries.length > 0 && <p className="truncate text-sm text-slate-600">{tripCountries(trip)}</p>}
          <p className="text-sm text-slate-500">{tripDates(trip)}</p>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onShowActions(trip)}
        aria-label={`Actions for ${trip.name}`}
        className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm backdrop-blur hover:bg-white"
      >
        <MoreIcon />
      </button>
    </article>
  );
}
