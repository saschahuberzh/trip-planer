import { describe, expect, it } from "vitest";
import type { Trip } from "@/lib/domain/types";
import {
  MAX_TRIP_DAYS,
  addCountries,
  emptyTripFormValues,
  parseAmount,
  tripToFormValues,
  validateTripForm,
  type TripFormValues,
} from "./tripForm";

const valid: TripFormValues = {
  ...emptyTripFormValues("CHF"),
  name: "  Central Asia ",
  countries: ["Uzbekistan", " kazakhstan "],
  startDate: "2026-06-12",
  endDate: "2026-06-14",
};

describe("validateTripForm", () => {
  it("produces trimmed trip input", () => {
    expect(validateTripForm({ ...valid, budgetAmount: "3'000.50", notes: "  " })).toEqual({
      ok: true,
      input: {
        name: "Central Asia",
        countries: ["Uzbekistan", "kazakhstan"],
        startDate: "2026-06-12",
        endDate: "2026-06-14",
        status: "planned",
        baseCurrency: "CHF",
        budgetAmount: 3000.5,
        notes: undefined,
      },
    });
  });

  it("allows a trip without countries or budget", () => {
    const result = validateTripForm({ ...valid, countries: [] });
    expect(result).toMatchObject({ ok: true, input: { countries: [], budgetAmount: undefined } });
  });

  it("reports missing and inconsistent values", () => {
    expect(validateTripForm(emptyTripFormValues("CHF"))).toEqual({
      ok: false,
      errors: { name: expect.any(String), startDate: expect.any(String), endDate: expect.any(String) },
    });
    const reversed = validateTripForm({ ...valid, endDate: "2026-06-11" });
    expect(reversed).toMatchObject({ ok: false, errors: { endDate: "The end date can't be before the start date." } });
  });

  it("limits the trip length", () => {
    expect(validateTripForm({ ...valid, endDate: "2027-06-12" }).ok).toBe(true);
    expect(validateTripForm({ ...valid, endDate: "2027-06-13" })).toMatchObject({
      ok: false,
      errors: { endDate: `A trip can last at most ${MAX_TRIP_DAYS} days.` },
    });
  });

  it("validates the budget against the base currency's precision", () => {
    expect(validateTripForm({ ...valid, budgetAmount: "-5" }).ok).toBe(false);
    expect(validateTripForm({ ...valid, budgetAmount: "abc" }).ok).toBe(false);
    expect(validateTripForm({ ...valid, budgetAmount: "10.555" }).ok).toBe(false);
    expect(validateTripForm({ ...valid, baseCurrency: "JPY", budgetAmount: "300000.5" })).toMatchObject({
      ok: false,
      errors: { budgetAmount: "JPY amounts have no decimal places." },
    });
    expect(validateTripForm({ ...valid, baseCurrency: "JPY", budgetAmount: "300 000" })).toMatchObject({
      ok: true,
      input: { budgetAmount: 300000 },
    });
  });

  it("rejects unknown currencies", () => {
    expect(validateTripForm({ ...valid, baseCurrency: "XYZ" })).toMatchObject({
      ok: false,
      errors: { baseCurrency: expect.any(String) },
    });
  });
});

describe("parseAmount", () => {
  it("accepts common decimal and thousands separators", () => {
    expect(parseAmount("2500")).toEqual({ value: 2500, decimals: 0 });
    expect(parseAmount("2500,5")).toEqual({ value: 2500.5, decimals: 1 });
    expect(parseAmount("2,500.50")).toEqual({ value: 2500.5, decimals: 2 });
    expect(parseAmount("2’500")).toEqual({ value: 2500, decimals: 0 });
    expect(parseAmount("1e3")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});

describe("countries", () => {
  it("adds comma-separated countries without duplicates", () => {
    expect(addCountries(["Uzbekistan"], " Kazakhstan,  uzbekistan , Kyrgyz   Republic,")).toEqual([
      "Uzbekistan",
      "Kazakhstan",
      "Kyrgyz Republic",
    ]);
  });
});

describe("tripToFormValues", () => {
  it("round-trips a stored trip", () => {
    const trip: Trip = {
      id: "t1",
      name: "Japan",
      countries: ["Japan"],
      startDate: "2026-04-01",
      endDate: "2026-04-10",
      status: "planned",
      baseCurrency: "JPY",
      budgetAmount: 450000,
      createdAt: "2026-10-03T19:00:00.000Z",
      updatedAt: "2026-10-03T19:00:00.000Z",
    };
    const result = validateTripForm(tripToFormValues(trip));
    expect(result).toMatchObject({ ok: true, input: { budgetAmount: 450000, countries: ["Japan"] } });
  });
});
