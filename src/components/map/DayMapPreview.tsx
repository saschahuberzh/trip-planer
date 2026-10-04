"use client";

import Link from "next/link";
import { useMemo } from "react";
import { dayModel } from "@/lib/map/mapModel";
import type { Itinerary } from "@/lib/services/itineraryService";
import { ChevronRightIcon } from "@/components/ui/icons";
import { mapDayPath } from "./MapScreen";
import { MapView } from "./MapView";

/** Static map of one day's places with a link to the full map. Hidden when nothing is located. */
export function DayMapPreview({ itinerary, tripDayId }: { itinerary: Itinerary; tripDayId: string }) {
  const model = useMemo(() => dayModel(itinerary, tripDayId), [itinerary, tripDayId]);
  if (model.markers.length === 0) return null;
  return (
    <section aria-label="Map of this day" className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <MapView markers={model.markers} line={model.line} fitKey={tripDayId} interactive={false} className="h-44" />
      <Link
        href={mapDayPath(itinerary.trip.id, tripDayId)}
        className="flex min-h-11 items-center justify-between px-4 text-sm font-semibold text-teal-700 hover:bg-slate-50"
      >
        Open on map
        <ChevronRightIcon className="size-4" />
      </Link>
    </section>
  );
}
