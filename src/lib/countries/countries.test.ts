import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { Topology } from "topojson-specification";
import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, countryCodeOfFeature, countryName, countryOptions, filterCountries, isKnownCountryCode } from "./countries";
import { countryFeatures, unwrapRing } from "./worldGeometry";

const require = createRequire(import.meta.url);
const topology = JSON.parse(readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8")) as Topology;

describe("country reference data", () => {
  it("lists unique two-letter codes with real names", () => {
    expect(COUNTRY_CODES.length).toBeGreaterThan(230);
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    for (const code of COUNTRY_CODES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(countryName(code)).not.toBe(code);
    }
  });

  it("maps world-atlas IDs and unnumbered features to ISO codes", () => {
    expect(countryCodeOfFeature("860", "Uzbekistan")).toBe("UZ");
    expect(countryCodeOfFeature("756", "Switzerland")).toBe("CH");
    expect(countryCodeOfFeature(undefined, "Kosovo")).toBe("XK");
    expect(countryCodeOfFeature(undefined, "N. Cyprus")).toBe("CY");
    expect(countryCodeOfFeature(undefined, "Siachen Glacier")).toBeUndefined();
    expect(isKnownCountryCode("XK")).toBe(true);
    expect(isKnownCountryCode("ZZ")).toBe(false);
  });

  it("sorts by name and searches names case- and accent-insensitively", () => {
    const options = countryOptions();
    expect(options[0].name).toBe("Afghanistan");
    expect(filterCountries(options, "cote").map((option) => option.code)).toEqual(["CI"]);
    expect(filterCountries(options, "  SWITZ ").map((option) => option.code)).toEqual(["CH"]);
    expect(filterCountries(options, "uz").map((option) => option.code)).toContain("UZ");
    expect(filterCountries(options, "")).toHaveLength(options.length);
  });
});

describe("world geometry", () => {
  it("draws every listed country and tags each feature with its code", () => {
    const { features } = countryFeatures(topology);
    const codes = new Set(features.map((feature) => feature.properties.code));
    for (const code of COUNTRY_CODES) expect(codes.has(code), code).toBe(true);
    // Only areas that are no country stay without a code.
    expect(features.filter((feature) => feature.properties.code === "").length).toBeLessThanOrEqual(2);
  });
});

describe("antimeridian", () => {
  it("continues rings past ±180 instead of jumping across the map", () => {
    expect(unwrapRing([[179, 65], [-179, 66], [-178, 64], [179, 65]])).toEqual([[179, 65], [181, 66], [182, 64], [179, 65]]);
    // A ring around the pole is left as it is.
    const polar = [[-180, -90], [180, -90], [180, -70], [-180, -70], [-180, -90]];
    expect(unwrapRing(polar)).toEqual(polar);
  });

  it("leaves no edge longer than half the world outside the polar rings", () => {
    for (const country of countryFeatures(topology).features) {
      const geometry = country.geometry;
      const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
      for (const ring of polygons.flat()) {
        if (ring.some(([, latitude]) => Math.abs(latitude) >= 89.9)) continue;
        for (let i = 1; i < ring.length; i++) expect(Math.abs(ring[i][0] - ring[i - 1][0])).toBeLessThan(180);
      }
    }
  });
});
