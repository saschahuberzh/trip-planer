import { describe, expect, it } from "vitest";
import {
  applySearchResult,
  emptyPlaceFormValues,
  normalizeWebsite,
  placeToFormValues,
  validatePlaceForm,
} from "./placeForm";

describe("validatePlaceForm", () => {
  it("accepts a place with only a name (manual entry)", () => {
    expect(validatePlaceForm(emptyPlaceFormValues("  Plov stall  "))).toEqual({
      ok: true,
      input: {
        name: "Plov stall",
        type: "attraction",
        address: undefined,
        latitude: undefined,
        longitude: undefined,
        website: undefined,
        notes: undefined,
        favorite: false,
        visited: false,
        externalRef: undefined,
      },
    });
  });

  it("requires a name", () => {
    expect(validatePlaceForm(emptyPlaceFormValues())).toEqual({ ok: false, errors: { name: "Give the place a name." } });
  });

  it("requires both coordinates within range", () => {
    const values = emptyPlaceFormValues("X");
    expect(validatePlaceForm({ ...values, latitude: "41.3" })).toMatchObject({
      ok: false,
      errors: { longitude: "Add the longitude as well." },
    });
    expect(validatePlaceForm({ ...values, latitude: "91", longitude: "69" })).toMatchObject({
      ok: false,
      errors: { latitude: "Use a number between -90 and 90." },
    });
    expect(validatePlaceForm({ ...values, latitude: "41,3", longitude: "69.2" })).toMatchObject({
      ok: true,
      input: { latitude: 41.3, longitude: 69.2 },
    });
  });

  it("normalizes websites", () => {
    expect(normalizeWebsite("registan.uz")).toBe("https://registan.uz/");
    expect(normalizeWebsite("http://example.com/a?b=1")).toBe("http://example.com/a?b=1");
    expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsite("not a url")).toBeNull();
    expect(validatePlaceForm({ ...emptyPlaceFormValues("X"), website: "nope" }).ok).toBe(false);
  });
});

describe("applySearchResult", () => {
  it("copies the result into our own fields and keeps personal fields", () => {
    const values = { ...emptyPlaceFormValues("Reg"), notes: "Sunset!", favorite: true };
    const applied = applySearchResult(
      values,
      { externalId: "R1", name: "Registan", suggestedType: "attraction", address: "Samarkand", latitude: 39.6548123, longitude: 66.9758 },
      "photon",
    );
    expect(applied).toMatchObject({
      name: "Registan",
      address: "Samarkand",
      latitude: "39.654812",
      longitude: "66.9758",
      notes: "Sunset!",
      favorite: true,
      externalRef: { provider: "photon", id: "R1" },
    });
    // The result is a starting point: everything stays editable.
    const edited = validatePlaceForm({ ...applied, name: "Plov stall next to Registan", type: "restaurant" });
    expect(edited).toMatchObject({ ok: true, input: { name: "Plov stall next to Registan", type: "restaurant", latitude: 39.654812 } });
  });
});

describe("placeToFormValues", () => {
  it("round-trips a stored place", () => {
    const place = {
      id: "p",
      tripId: "t",
      name: "Ark",
      type: "attraction" as const,
      latitude: 39.7779,
      longitude: 64.4108,
      website: "https://ark.uz/",
      favorite: true,
      visited: false,
      externalRef: { provider: "photon", id: "W9" },
      createdAt: "2026-10-03T19:00:00.000Z",
      updatedAt: "2026-10-03T19:00:00.000Z",
    };
    expect(validatePlaceForm(placeToFormValues(place))).toMatchObject({
      ok: true,
      input: { name: "Ark", latitude: 39.7779, longitude: 64.4108, website: "https://ark.uz/", externalRef: { provider: "photon", id: "W9" } },
    });
  });
});
