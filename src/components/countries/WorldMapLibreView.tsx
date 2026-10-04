"use client";

// MapLibre world map of country outlines. Loaded lazily (client only) by WorldMap.
// Needs no tiles: the outlines are bundled, so the map works offline.
import type { Topology } from "topojson-specification";
import { useEffect, useRef, useState } from "react";
import { countryFeatures } from "@/lib/countries/worldGeometry";
import {
  AttributionControl,
  Map as MapLibreMap,
  NavigationControl,
  type ExpressionSpecification,
  type FilterSpecification,
} from "@/components/map/maplibreSetup";
import worldAtlas from "world-atlas/countries-50m.json";
import type { WorldMapProps } from "./WorldMap";

const SOURCE = "countries";
const FILL_LAYER = "countries-fill";
const SELECTED_LAYER = "countries-selected";
// Tailwind teal-600 / slate-200 / slate-100 / teal-900.
const VISITED_COLOR = "#0d9488";
const LAND_COLOR = "#e2e8f0";
const SEA_COLOR = "#f8fafc";
const SELECTED_COLOR = "#134e4a";
/** Everything but most of Antarctica. */
const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-170, -57],
  [190, 80],
];

/** Outline only the selected country. Areas without a code (e.g. Siachen Glacier) never match. */
function selectedFilter(selected: string | null): FilterSpecification {
  return selected === null ? ["boolean", false] : ["==", ["get", "code"], selected];
}

function fillColor(visited: readonly string[]): ExpressionSpecification {
  return ["case", ["in", ["get", "code"], ["literal", visited]], VISITED_COLOR, LAND_COLOR];
}

export default function WorldMapLibreView({ visited, selected, onSelect, className = "" }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  const initial = useRef({ visited, selected });
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: { version: 8, sources: {}, layers: [{ id: "sea", type: "background", paint: { "background-color": SEA_COLOR } }] },
        bounds: WORLD_BOUNDS,
        fitBoundsOptions: { padding: 8 },
        renderWorldCopies: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
      });
    } catch (error) {
      // e.g. WebGL not available. WorldMap's error boundary shows the fallback.
      throw new Error("World map could not be created", { cause: error });
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new AttributionControl({ compact: true, customAttribution: "Natural Earth" }));
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource(SOURCE, { type: "geojson", data: countryFeatures(worldAtlas as unknown as Topology) });
      map.addLayer({ id: FILL_LAYER, type: "fill", source: SOURCE, paint: { "fill-color": fillColor(initial.current.visited) } });
      map.addLayer({ id: "countries-border", type: "line", source: SOURCE, paint: { "line-color": "#ffffff", "line-width": 0.6 } });
      map.addLayer({
        id: SELECTED_LAYER,
        type: "line",
        source: SOURCE,
        filter: selectedFilter(initial.current.selected),
        paint: { "line-color": SELECTED_COLOR, "line-width": 2 },
      });
      setReady(true);
    });
    map.on("click", (event) => {
      const [feature] = map.queryRenderedFeatures(event.point, { layers: [FILL_LAYER] });
      const code = feature?.properties.code;
      onSelectRef.current(typeof code === "string" && code !== "" ? code : null);
    });
    // Pointer cursor over countries (mouse only; harmless on touch).
    map.on("mousemove", FILL_LAYER, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", FILL_LAYER, () => (map.getCanvas().style.cursor = ""));

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setPaintProperty(FILL_LAYER, "fill-color", fillColor(visited));
  }, [visited, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter(SELECTED_LAYER, selectedFilter(selected));
  }, [selected, ready]);

  return (
    <div className={`relative overflow-hidden bg-slate-50 ${className}`}>
      {/* MapLibre's CSS makes its container position: relative; size it explicitly. */}
      <div ref={containerRef} className="h-full w-full" />
      {!ready && <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-sm text-slate-500">Loading map…</p>}
    </div>
  );
}
