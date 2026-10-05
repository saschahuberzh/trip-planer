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
    <section aria-label="Map of this day" className="relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <MapView markers={model.markers} segments={model.segments} showLines={false} fitKey={tripDayId} interactive={false} className="h-48" />
      {/* The whole preview opens the map; the label shows that it can be tapped. */}
      <Link href={mapDayPath(itinerary.trip.id, tripDayId)} aria-label="Open on map" className="absolute inset-0 z-10">
        <span className="absolute right-3 bottom-3 inline-flex min-h-9 items-center gap-1 rounded-full bg-white/95 px-3 text-sm font-semibold text-teal-700 shadow-sm ring-1 ring-slate-200">
          Open map
          <ChevronRightIcon className="size-4" />
        </span>
      </Link>
    </section>
  );
}
