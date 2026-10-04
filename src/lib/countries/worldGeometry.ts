import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { countryCodeOfFeature } from "./countries";

export interface CountryFeatureProperties {
  /** ISO 3166-1 alpha-2, or "" for areas that are no country (e.g. Siachen Glacier). */
  code: string;
}

export type CountryFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, CountryFeatureProperties>;

type Ring = GeoJSON.Position[];

/**
 * Rings that cross the antimeridian (Russia, Fiji) jump from +180 to -180; a flat map
 * would draw those edges across the whole world. Unwrapping continues them past ±180
 * instead. Rings along the pole (Antarctica) jump by design and are kept as they are.
 */
export function unwrapRing(ring: Ring): Ring {
  if (ring.some(([, latitude]) => Math.abs(latitude) >= 89.9)) return ring;
  let offset = 0;
  const unwrapped = ring.map(([longitude, latitude], index) => {
    if (index > 0) {
      const previous = ring[index - 1][0];
      if (longitude - previous > 180) offset -= 360;
      else if (previous - longitude > 180) offset += 360;
    }
    return [longitude + offset, latitude];
  });
  // Keep the ring on the side of the map where most of it lies.
  const west = unwrapped.every(([longitude]) => longitude < -180);
  const east = unwrapped.every(([longitude]) => longitude > 180);
  return west || east ? unwrapped.map(([longitude, latitude]) => [longitude + (west ? 360 : -360), latitude]) : unwrapped;
}

function unwrapGeometry(geometry: GeoJSON.Geometry): GeoJSON.Geometry {
  if (geometry.type === "Polygon") return { ...geometry, coordinates: geometry.coordinates.map(unwrapRing) };
  if (geometry.type === "MultiPolygon") {
    return { ...geometry, coordinates: geometry.coordinates.map((polygon) => polygon.map(unwrapRing)) };
  }
  return geometry;
}

/** world-atlas "countries" topology → GeoJSON features tagged with their country code. */
export function countryFeatures(topology: Topology): CountryFeatureCollection {
  const countries = topology.objects.countries as GeometryCollection<{ name?: string }>;
  const collection = feature(topology, countries);
  return {
    type: "FeatureCollection",
    features: collection.features.map((country) => ({
      type: "Feature",
      geometry: unwrapGeometry(country.geometry),
      properties: { code: countryCodeOfFeature(country.id, country.properties?.name) ?? "" },
    })),
  };
}
