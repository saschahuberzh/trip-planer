import { describe, expect, it } from "vitest";
import { createPhotonProvider, mapPhotonFeature, photonPlaceType, photonSearchUrl } from "./photon";
import { PlaceSearchError } from "./types";

const registan = {
  type: "Feature",
  properties: {
    osm_type: "R",
    osm_id: 17141748,
    osm_key: "place",
    osm_value: "square",
    name: "Registan-Platz",
    city: "Samarkand",
    state: "Provinz Samarkand",
    country: "Usbekistan",
    postcode: "140000",
  },
  geometry: { type: "Point", coordinates: [66.9749, 39.6548] },
};

const bakery = {
  properties: {
    osm_type: "N",
    osm_id: 4118540610,
    osm_key: "shop",
    osm_value: "bakery",
    name: "Registan",
    housenumber: "9",
    street: "Dagdas iela",
    city: "Daugavpils",
    country: "Lettland",
    postcode: "LV-5401",
  },
  geometry: { coordinates: [26.5198179, 55.8751734] },
};

describe("mapPhotonFeature", () => {
  it("maps name, address, coordinates and provider ID", () => {
    expect(mapPhotonFeature(bakery)).toEqual({
      externalId: "N4118540610",
      name: "Registan",
      suggestedType: "custom",
      address: "Dagdas iela 9, LV-5401 Daugavpils, Lettland",
      latitude: 55.8751734,
      longitude: 26.5198179,
    });
    expect(mapPhotonFeature(registan)).toMatchObject({
      externalId: "R17141748",
      address: "140000 Samarkand, Usbekistan",
      latitude: 39.6548,
      longitude: 66.9749,
    });
  });

  it("names unnamed addresses and cities after their street or city", () => {
    const street = { properties: { osm_type: "W", osm_id: 1, street: "Amir Temur", country: "Uzbekistan" }, geometry: { coordinates: [69, 41] } };
    expect(mapPhotonFeature(street)).toMatchObject({ name: "Amir Temur", address: "Uzbekistan" });
    const city = { properties: { osm_type: "N", osm_id: 2, osm_key: "place", osm_value: "city", name: "Toshkent", city: "Toshkent", country: "Uzbekistan" }, geometry: { coordinates: [69.2, 41.3] } };
    expect(mapPhotonFeature(city)).toMatchObject({ name: "Toshkent", suggestedType: "city", address: "Uzbekistan" });
  });

  it("skips features without usable coordinates, ID or name", () => {
    expect(mapPhotonFeature({ ...registan, geometry: { coordinates: [] } })).toBeNull();
    expect(mapPhotonFeature({ ...registan, geometry: { coordinates: [200, 39] } })).toBeNull();
    expect(mapPhotonFeature({ ...registan, properties: { ...registan.properties, osm_id: undefined } })).toBeNull();
    expect(mapPhotonFeature({ properties: { osm_type: "N", osm_id: 3 }, geometry: { coordinates: [1, 1] } })).toBeNull();
  });
});

describe("photonPlaceType", () => {
  it("maps OSM categories to place types", () => {
    expect(photonPlaceType("place", "town")).toBe("city");
    expect(photonPlaceType("aeroway", "aerodrome")).toBe("airport");
    expect(photonPlaceType("railway", "station")).toBe("train_station");
    expect(photonPlaceType("amenity", "cafe")).toBe("restaurant");
    expect(photonPlaceType("tourism", "hostel")).toBe("hotel");
    expect(photonPlaceType("tourism", "museum")).toBe("attraction");
    expect(photonPlaceType("historic", "monument")).toBe("attraction");
    expect(photonPlaceType("place", "square")).toBe("attraction");
    expect(photonPlaceType("leisure", "park")).toBe("attraction");
    expect(photonPlaceType("leisure", "pitch")).toBe("custom");
    expect(photonPlaceType("shop", "bakery")).toBe("custom");
    expect(photonPlaceType(undefined, undefined)).toBe("custom");
  });
});

describe("photonSearchUrl", () => {
  it("sends only supported languages and an optional location bias", () => {
    const url = new URL(
      photonSearchUrl("https://photon.example/api/", "Registan", {
        language: "de-CH",
        near: { latitude: 39.654812, longitude: 66.97 },
        limit: 5,
      }),
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "Registan", limit: "5", lang: "de", lat: "39.6548", lon: "66.9700" });
    expect(new URL(photonSearchUrl("https://photon.example/api/", "x", { language: "it" })).searchParams.has("lang")).toBe(false);
  });
});

describe("createPhotonProvider", () => {
  const signal = new AbortController().signal;
  const respond = (body: unknown, status = 200) => async () =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("returns mapped results without duplicates of the same place", async () => {
    const duplicateArea = { ...registan, properties: { ...registan.properties, osm_type: "W", osm_id: 5 } };
    const provider = createPhotonProvider({
      fetch: respond({ features: [registan, registan, duplicateArea, bakery, { broken: true }] }),
      isOnline: () => true,
    });
    const results = await provider.search("Registan", {}, signal);
    expect(results.map((result) => result.externalId)).toEqual(["R17141748", "N4118540610"]);
  });

  it("reports offline without sending a request", async () => {
    let called = false;
    const provider = createPhotonProvider({
      fetch: async () => {
        called = true;
        return new Response("{}");
      },
      isOnline: () => false,
    });
    await expect(provider.search("x", {}, signal)).rejects.toMatchObject({ kind: "offline" });
    expect(called).toBe(false);
  });

  it("reports failed requests, HTTP errors and invalid responses as unavailable", async () => {
    const failing = createPhotonProvider({
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
      isOnline: () => true,
    });
    await expect(failing.search("x", {}, signal)).rejects.toBeInstanceOf(PlaceSearchError);
    await expect(createPhotonProvider({ fetch: respond({}, 429), isOnline: () => true }).search("x", {}, signal)).rejects.toMatchObject({ kind: "unavailable" });
    await expect(createPhotonProvider({ fetch: respond({ nope: 1 }), isOnline: () => true }).search("x", {}, signal)).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("passes cancellation through unchanged", async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException("Aborted", "AbortError");
    const provider = createPhotonProvider({
      fetch: async () => {
        throw abortError;
      },
      isOnline: () => true,
    });
    await expect(provider.search("x", {}, controller.signal)).rejects.toBe(abortError);
  });
});
