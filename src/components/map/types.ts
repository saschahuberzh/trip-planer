import type { LatLng } from "@/lib/domain/coordinates";
import type { MapMarker } from "@/lib/map/mapModel";

/**
 * Provider-neutral map props. Screens depend only on these; the map library
 * (currently MapLibre) is an implementation detail of MapView.
 */
export interface MapViewProps {
  markers: readonly MapMarker[];
  /** Straight line through these points, in order. */
  line?: readonly LatLng[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (placeId: string | null) => void;
  /** The map fits to its markers/line whenever this value changes. */
  fitKey?: string;
  /** Centre when there is nothing to fit. */
  initialCenter?: LatLng;
  /** false: a static preview (no panning/zooming). */
  interactive?: boolean;
  /** Pin mode: one draggable pin; tapping the map moves it. */
  picker?: { position: LatLng | null; onChange: (position: LatLng) => void };
  className?: string;
}
