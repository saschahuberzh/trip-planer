"use client";

// MapLibre implementation of MapView. Loaded lazily (client only) by MapView.
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type GeoJSONSource,
} from "./maplibreSetup";
import { useEffect, useRef, useState } from "react";
import { boundsOf, type MapMarker, type MapSegment } from "@/lib/map/mapModel";
import { MAP_STYLE_URL } from "@/lib/map/config";
import type { LatLng } from "@/lib/domain/coordinates";
import { TRANSPORT_SYMBOLS, TRANSPORT_TYPE_LABELS } from "@/components/itinerary/transportDisplay";
import { PLACE_TYPE_SYMBOLS } from "@/components/places/placeDisplay";
import { MARKER_COLORS, ROUTE_LINE_COLOR, STAY_MARKER_COLOR, UNPLANNED_MARKER_COLOR } from "./markerColors";
import type { MapViewProps } from "./types";

const LINE_SOURCE = "trip-line";
const WORLD: LatLng = { latitude: 30, longitude: 20 };

type Status = "loading" | "ready" | "failed";

/** Text and colour of a marker: days/numbers, else the category symbol; 🛏️ for accommodation. */
function markerLook(marker: MapMarker): { text: string; color: string; ariaLabel: string } {
  if (marker.kind === "stay") return { text: "🛏️", color: STAY_MARKER_COLOR, ariaLabel: `${marker.name} (accommodation)` };
  const color = marker.tone === "unplanned" ? UNPLANNED_MARKER_COLOR : MARKER_COLORS[marker.type];
  return marker.label === ""
    ? { text: PLACE_TYPE_SYMBOLS[marker.type], color, ariaLabel: marker.name }
    : { text: marker.label, color, ariaLabel: `${marker.name} (${marker.label})` };
}

function markerElement(marker: MapMarker, selected: boolean, onSelect?: () => void): HTMLElement {
  const element = document.createElement(onSelect ? "button" : "div");
  const { text, color, ariaLabel } = markerLook(marker);
  const wide = text.length > 3;
  Object.assign(element.style, {
    minWidth: "28px",
    width: wide ? "auto" : "28px",
    height: "28px",
    padding: wide ? "0 7px" : "0",
    borderRadius: "999px",
    background: color,
    color: "white",
    font: "600 12px/24px system-ui, -apple-system, sans-serif",
    textAlign: "center",
    whiteSpace: "nowrap",
    border: "2px solid white",
    boxShadow: selected ? `0 0 0 3px ${color}, 0 2px 6px rgb(0 0 0 / 0.35)` : "0 1px 4px rgb(0 0 0 / 0.35)",
    cursor: onSelect ? "pointer" : "default",
    // Accommodations sit below places, so day labels stay readable where they overlap.
    zIndex: selected ? "3" : marker.kind === "stay" ? "1" : "2",
  });
  element.textContent = text;
  element.setAttribute("aria-label", ariaLabel);
  if (onSelect) {
    element.setAttribute("type", "button");
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelect();
    });
  }
  return element;
}

/** Line style per segment: no transport dashed, flights dotted, other transports solid. */
function segmentStyle(segment: MapSegment): "plain" | "flight" | "ground" {
  if (segment.transport === undefined) return "plain";
  return segment.transport.type === "flight" ? "flight" : "ground";
}

function segmentData(segments: readonly MapSegment[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: segments.map((segment) => ({
      type: "Feature",
      properties: { style: segmentStyle(segment) },
      geometry: {
        type: "LineString",
        coordinates: [
          [segment.from.longitude, segment.from.latitude],
          [segment.to.longitude, segment.to.latitude],
        ],
      },
    })),
  };
}

function transportElement(segment: MapSegment & { transport: NonNullable<MapSegment["transport"]> }, onSelect?: (id: string) => void): HTMLElement {
  const element = document.createElement(onSelect ? "button" : "div");
  Object.assign(element.style, {
    width: "30px",
    height: "30px",
    borderRadius: "999px",
    background: "white",
    border: `2px solid ${ROUTE_LINE_COLOR}`,
    font: "15px/26px system-ui, -apple-system, sans-serif",
    textAlign: "center",
    boxShadow: "0 1px 4px rgb(0 0 0 / 0.3)",
    cursor: onSelect ? "pointer" : "default",
  });
  element.textContent = TRANSPORT_SYMBOLS[segment.transport.type];
  element.setAttribute("aria-label", TRANSPORT_TYPE_LABELS[segment.transport.type]);
  if (onSelect) {
    element.setAttribute("type", "button");
    const id = segment.transport.id;
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelect(id);
    });
  }
  return element;
}

export default function MapLibreMapView({
  markers,
  segments = [],
  selectedPlaceId = null,
  selectedStayId = null,
  onSelectPlace,
  onSelectStay,
  onSelectTransport,
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
  const onSelectTransportRef = useRef(onSelectTransport);
  const onSelectStayRef = useRef(onSelectStay);
  const pickerRef = useRef(picker);
  useEffect(() => {
    onSelectRef.current = onSelectPlace;
    onSelectTransportRef.current = onSelectTransport;
    onSelectStayRef.current = onSelectStay;
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
      const selectable = !picker && (marker.kind === "place" ? onSelectPlace : onSelectStay) !== undefined;
      const element = markerElement(
        marker,
        marker.kind === "place" ? marker.placeId === selectedPlaceId : marker.accommodationId === selectedStayId,
        selectable
          ? () =>
              marker.kind === "place"
                ? onSelectRef.current?.(marker.placeId)
                : onSelectStayRef.current?.(marker.accommodationId)
          : undefined,
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
    // Transport symbols at segment midpoints.
    for (const segment of segments) {
      if (segment.transport === undefined) continue;
      const element = transportElement(
        { ...segment, transport: segment.transport },
        onSelectTransport && !picker ? (id) => onSelectTransportRef.current?.(id) : undefined,
      );
      created.push(
        new Marker({ element })
          .setLngLat([(segment.from.longitude + segment.to.longitude) / 2, (segment.from.latitude + segment.to.latitude) / 2])
          .addTo(map),
      );
    }
    return () => created.forEach((marker) => marker.remove());
  }, [markers, segments, selectedPlaceId, selectedStayId, onSelectPlace, onSelectStay, onSelectTransport, picker, status]);

  // Connecting segments (need the style): one layer per line style.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const data = segmentData(segments);
    const source = map.getSource<GeoJSONSource>(LINE_SOURCE);
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource(LINE_SOURCE, { type: "geojson", data });
    const styles: [string, number[] | undefined][] = [
      ["plain", [2, 1.5]],
      ["flight", [0.1, 2]],
      ["ground", undefined],
    ];
    for (const [style, dash] of styles) {
      map.addLayer({
        id: `${LINE_SOURCE}-${style}`,
        type: "line",
        source: LINE_SOURCE,
        filter: ["==", ["get", "style"], style],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ROUTE_LINE_COLOR,
          "line-width": style === "plain" ? 3 : 4,
          "line-opacity": style === "plain" ? 0.7 : 0.9,
          ...(dash ? { "line-dasharray": dash } : {}),
        },
      });
    }
  }, [segments, status]);

  // Fit to markers and line whenever fitKey changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitKey === undefined) return;
    const bounds = boundsOf([...markers, ...segments.flatMap((segment) => [segment.from, segment.to])]);
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
    // Only an explicit fitKey change refits (plus once when the map is ready and sized);
    // marker updates (e.g. selection) must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, status === "ready"]);

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
