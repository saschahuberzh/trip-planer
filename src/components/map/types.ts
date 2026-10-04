import type { LatLng } from "@/lib/domain/coordinates";
import type { MapMarker, MapSegment } from "@/lib/map/mapModel";

/**
 * Provider-neutral map props. Screens depend only on these; the map library
 * (currently MapLibre) is an implementation detail of MapView.
 */
export interface MapViewProps {
  markers: readonly MapMarker[];
  /** Straight segments between stops; segments with a transport show its symbol. */
  segments?: readonly MapSegment[];
  selectedPlaceId?: string | null;
  selectedStayId?: string | null;
  /** Called with a place ID, or null when the empty map is tapped. */
  onSelectPlace?: (placeId: string | null) => void;
  /** Called when an accommodation marker is tapped. */
  onSelectStay?: (accommodationId: string) => void;
  /** Called when a transport symbol is tapped. */
  onSelectTransport?: (transportId: string) => void;
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
