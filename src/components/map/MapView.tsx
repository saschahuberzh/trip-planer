"use client";

import { Component, lazy, Suspense, type ReactNode } from "react";
import type { MapViewProps } from "./types";

export type { MapViewProps } from "./types";

// The map library is large and browser-only: load it on demand.
const MapLibreMapView = lazy(() => import("./MapLibreMapView"));

/**
 * Interactive map. Any failure (library not loadable, no WebGL, no tiles offline)
 * stays inside this component and shows a short message instead.
 */
export function MapView(props: MapViewProps) {
  const className = props.className ?? "";
  return (
    <MapErrorBoundary fallback={<MapUnavailable className={className} />}>
      <Suspense fallback={<div className={`flex items-center justify-center bg-slate-100 text-sm text-slate-600 ${className}`}>Loading map…</div>}>
        <MapLibreMapView {...props} />
      </Suspense>
    </MapErrorBoundary>
  );
}

function MapUnavailable({ className }: { className: string }) {
  return (
    <div className={`flex items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-600 ${className}`}>
      The map can&apos;t be shown right now (it needs an internet connection the first time). Your places and
      coordinates are listed below.
    </div>
  );
}

/** Keeps any map failure inside the map area. */
export class MapErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Map failed", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
