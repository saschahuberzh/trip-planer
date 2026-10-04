"use client";

import { lazy, Suspense } from "react";
import { MapErrorBoundary } from "@/components/map/MapView";

export interface WorldMapProps {
  /** ISO codes of visited countries (filled). */
  visited: readonly string[];
  /** Outlined country. */
  selected: string | null;
  /** Tap on a country (its code) or on the sea (null). */
  onSelect: (code: string | null) => void;
  className?: string;
}

// The map library and the outlines are large and browser-only: load them on demand.
const WorldMapLibreView = lazy(() => import("./WorldMapLibreView"));

/** World map of country outlines; any failure stays inside the map area. */
export function WorldMap(props: WorldMapProps) {
  const className = props.className ?? "";
  return (
    <MapErrorBoundary
      fallback={
        <div className={`flex items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-600 ${className}`}>
          The world map can&apos;t be shown on this device. You can still mark countries in the list.
        </div>
      }
    >
      <Suspense fallback={<div className={`flex items-center justify-center bg-slate-100 text-sm text-slate-500 ${className}`}>Loading map…</div>}>
        <WorldMapLibreView {...props} />
      </Suspense>
    </MapErrorBoundary>
  );
}
