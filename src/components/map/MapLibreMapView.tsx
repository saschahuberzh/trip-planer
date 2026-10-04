"use client";

// MapLibre implementation of MapView. Loaded lazily (client only) by MapView.
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AttributionControl,
  getVersion,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { boundsOf, type MapMarker } from "@/lib/map/mapModel";
import { MAP_STYLE_URL } from "@/lib/map/config";
import type { LatLng } from "@/lib/domain/coordinates";
import { MARKER_COLORS, ROUTE_LINE_COLOR, UNPLANNED_MARKER_COLOR } from "./markerColors";
import type { MapViewProps } from "./types";

// MapLibre derives its worker URL from import.meta.url, which bundling breaks;
// scripts/copy-maplibre-worker.mjs publishes the worker under this path.
setWorkerUrl(`/vendor/maplibre-gl/${getVersion()}/maplibre-gl-worker.mjs`);

const LINE_SOURCE = "trip-line";
const WORLD: LatLng = { latitude: 30, longitude: 20 };

type Status = "loading" | "ready" | "failed";

function markerElement(marker: MapMarker, selected: boolean, onSelect?: (id: string) => void): HTMLElement {
  const element = document.createElement(onSelect ? "button" : "div");
  const color = marker.tone === "unplanned" ? UNPLANNED_MARKER_COLOR : MARKER_COLORS[marker.type];
  const size = marker.label.length > 3 ? "auto" : "28px";
  Object.assign(element.style, {
    minWidth: "28px",
    width: size,
    height: "28px",
    padding: marker.label.length > 3 ? "0 7px" : "0",
    borderRadius: "999px",
    background: color,
    color: "white",
    font: "600 12px/28px system-ui, -apple-system, sans-serif",
    textAlign: "center",
    border: "2px solid white",
    boxShadow: selected ? `0 0 0 3px ${color}, 0 2px 6px rgb(0 0 0 / 0.35)` : "0 1px 4px rgb(0 0 0 / 0.35)",
    cursor: onSelect ? "pointer" : "default",
    zIndex: selected ? "2" : "1",
  });
  element.textContent = marker.label;
  element.setAttribute("aria-label", marker.label ? `${marker.name} (${marker.label})` : marker.name);
  if (onSelect) {
    element.setAttribute("type", "button");
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelect(marker.placeId);
    });
  }
  return element;
}

function lineData(line: readonly LatLng[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: line.map((point) => [point.longitude, point.latitude]) },
  };
}

export default function MapLibreMapView({
  markers,
  line = [],
  selectedPlaceId = null,
  onSelectPlace,
  fitKey,
  initialCenter,
  interactive = true,
  picker,
  className = "",
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [tilesFailing, setTilesFailing] = useState(false);
  // Latest callbacks, so map listeners registered once always call the current ones.
  const onSelectRef = useRef(onSelectPlace);
  const pickerRef = useRef(picker);
  useEffect(() => {
    onSelectRef.current = onSelectPlace;
    pickerRef.current = picker;
  });

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let map: MapLibreMap;
    try {
      const center = picker?.position ?? initialCenter ?? WORLD;
      map = new MapLibreMap({
        container,
        style: MAP_STYLE_URL,
        center: [center.longitude, center.latitude],
        zoom: picker?.position || initialCenter ? 11 : 1.5,
        interactive,
        attributionControl: false,
        cooperativeGestures: false,
      });
    } catch (error) {
      // e.g. WebGL not available. MapView's error boundary shows the fallback.
      throw new Error("Map could not be created", { cause: error });
    }
    mapRef.current = map;
    map.addControl(new AttributionControl({ compact: true }));
    if (interactive) map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      // Small static previews: keep the attribution behind its (i) button.
      if (!interactive) container.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      setStatus("ready");
    });
    map.on("error", (event) => {
      // Before the style loaded the map can't work at all; later errors are usually tiles.
      if (!map.isStyleLoaded()) setStatus((current) => (current === "ready" ? current : "failed"));
      else setTilesFailing(true);
      console.warn("Map error", event.error);
    });
    map.on("click", (event) => {
      const currentPicker = pickerRef.current;
      if (currentPicker) currentPicker.onChange({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
      else onSelectRef.current?.(null);
    });

    // Sheets and tabs change the container size without a window resize.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Markers (and the picker pin). DOM markers don't need the style to be loaded.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const created: Marker[] = [];
    for (const marker of markers) {
      const element = markerElement(
        marker,
        marker.placeId === selectedPlaceId,
        onSelectPlace && !picker ? (id) => onSelectRef.current?.(id) : undefined,
      );
      created.push(new Marker({ element }).setLngLat([marker.longitude, marker.latitude]).addTo(map));
    }
    if (picker?.position) {
      const pin = new Marker({ color: ROUTE_LINE_COLOR, draggable: true })
        .setLngLat([picker.position.longitude, picker.position.latitude])
        .addTo(map);
      pin.on("dragend", () => {
        const { lat, lng } = pin.getLngLat();
        pickerRef.current?.onChange({ latitude: lat, longitude: lng });
      });
      created.push(pin);
    }
    return () => created.forEach((marker) => marker.remove());
  }, [markers, selectedPlaceId, onSelectPlace, picker, status]);

  // Connecting line (needs the style).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const data = lineData(line.length > 1 ? line : []);
    const source = map.getSource<GeoJSONSource>(LINE_SOURCE);
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource(LINE_SOURCE, { type: "geojson", data });
    map.addLayer({
      id: LINE_SOURCE,
      type: "line",
      source: LINE_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": ROUTE_LINE_COLOR, "line-width": 3, "line-opacity": 0.8, "line-dasharray": [2, 1.5] },
    });
  }, [line, status]);

  // Fit to markers and line whenever fitKey changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitKey === undefined) return;
    const bounds = boundsOf([...markers, ...line]);
    if (!bounds) return;
    const { southWest: sw, northEast: ne } = bounds;
    if (sw.latitude === ne.latitude && sw.longitude === ne.longitude) {
      map.jumpTo({ center: [sw.longitude, sw.latitude], zoom: 12 });
      return;
    }
    map.fitBounds(new LngLatBounds([sw.longitude, sw.latitude], [ne.longitude, ne.latitude]), {
      padding: 48,
      maxZoom: 14,
      animate: false,
    });
    // Only an explicit fitKey change refits; marker updates (e.g. selection) must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {/* MapLibre's CSS makes its container position: relative; size it explicitly. */}
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-sm text-slate-500">Loading map…</p>
      )}
      {status === "failed" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-600">
          The map can&apos;t be shown right now{typeof navigator !== "undefined" && !navigator.onLine ? " — it needs an internet connection" : ""}.
          Your places and coordinates are listed below.
        </div>
      )}
      {status === "ready" && tilesFailing && (
        <p className="pointer-events-none absolute inset-x-3 top-3 rounded-lg bg-white/90 px-3 py-1.5 text-center text-xs text-slate-600 shadow-sm">
          Some map tiles couldn&apos;t load (no internet?). Markers are still correct.
        </p>
      )}
    </div>
  );
}
