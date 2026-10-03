import { describe, expect, it } from "vitest";
import { currencyMinorUnits, isCurrencyCode } from "./currency";
import type { Accommodation, Expense, Transport, Trip } from "./types";
import {
  ValidationError,
  assertValidAccommodation,
  assertValidExpense,
  assertValidTransport,
  assertValidTrip,
} from "./validation";

const meta = { createdAt: "2026-10-03T19:00:00.000Z", updatedAt: "2026-10-03T19:00:00.000Z" };

const trip: Trip = {
  id: "t1",
  name: "Central Asia",
  countries: ["Uzbekistan", "Kazakhstan", "Kyrgyzstan"],
  startDate: "2026-06-12",
  endDate: "2026-06-30",
  status: "planned",
  baseCurrency: "CHF",
  ...meta,
};

function issuesOf(fn: () => void): string[] {
  try {
    fn();
    return [];
  } catch (error) {
    if (error instanceof ValidationError) return error.issues;
    throw error;
  }
}

describe("currency", () => {
  it("validates ISO 4217 codes", () => {
    for (const code of ["CHF", "EUR", "UZS", "KZT", "KGS", "JPY", "USD"]) {
      expect(isCurrencyCode(code)).toBe(true);
    }
    expect(isCurrencyCode("chf")).toBe(false);
    expect(isCurrencyCode("XXX")).toBe(false);
    expect(isCurrencyCode("ABC")).toBe(false);
  });

  it("knows minor-unit precision", () => {
    expect(currencyMinorUnits("CHF")).toBe(2);
    expect(currencyMinorUnits("JPY")).toBe(0);
    expect(currencyMinorUnits("KWD")).toBe(3);
    expect(() => currencyMinorUnits("ABC")).toThrow(RangeError);
  });
});

describe("assertValidTrip", () => {
  it("accepts a multi-country trip", () => {
    expect(issuesOf(() => assertValidTrip(trip))).toEqual([]);
  });

  it("rejects invalid dates, currency and metadata", () => {
    const issues = issuesOf(() =>
      assertValidTrip({
        ...trip,
        name: " ",
        endDate: "2026-06-11",
        baseCurrency: "chf",
        createdAt: "2026-10-03",
      }),
    );
    expect(issues).toEqual([
      "createdAt must be an ISO 8601 UTC instant",
      "name must be non-empty text",
      "endDate must not be before startDate",
      "baseCurrency must be an ISO 4217 currency code",
    ]);
  });
});

describe("assertValidTransport", () => {
  const transport: Transport = { id: "x", tripId: "t1", type: "flight", sortOrder: 0, ...meta };

  it("requires LocalDateTime with IANA zones", () => {
    expect(
      issuesOf(() =>
        assertValidTransport({
          ...transport,
          departure: { local: "2026-06-12T08:00", timeZone: "Asia/Tashkent" },
          arrival: { local: "2026-06-12T08:00Z", timeZone: "Europe/Zurich" },
        }),
      ),
    ).toEqual(["arrival must be a local date/time with an IANA time zone"]);
  });

  it("requires a currency for a price and a positive whole duration", () => {
    expect(issuesOf(() => assertValidTransport({ ...transport, price: 120, durationMinutes: 0 }))).toEqual([
      "durationMinutes must be a positive whole number",
      "price requires a currency",
    ]);
  });
});

describe("assertValidAccommodation", () => {
  const accommodation: Accommodation = {
    id: "a",
    tripId: "t1",
    name: "Hotel",
    checkInDate: "2026-06-12",
    checkOutDate: "2026-06-14",
    ...meta,
  };

  it("forbids own location fields when a place is linked", () => {
    expect(
      issuesOf(() => assertValidAccommodation({ ...accommodation, placeId: "p", address: "Street 1" })),
    ).toEqual(["address and coordinates must be empty when a place is linked"]);
  });

  it("requires complete, in-range coordinates", () => {
    expect(issuesOf(() => assertValidAccommodation({ ...accommodation, latitude: 41.3 }))).toEqual([
      "latitude and longitude must be set together",
    ]);
    expect(
      issuesOf(() => assertValidAccommodation({ ...accommodation, latitude: 91, longitude: 69.2 })),
    ).toEqual(["latitude must be <= 90"]);
  });

  it("requires check-out on or after check-in", () => {
    expect(
      issuesOf(() => assertValidAccommodation({ ...accommodation, checkOutDate: "2026-06-11" })),
    ).toEqual(["checkOutDate must not be before checkInDate"]);
  });
});

describe("assertValidExpense", () => {
  const expense: Expense = {
    id: "e",
    tripId: "t1",
    title: "Dinner",
    category: "food",
    status: "paid",
    originalAmount: 800000,
    originalCurrency: "UZS",
    ...meta,
  };

  it("accepts unconverted and converted foreign expenses", () => {
    expect(issuesOf(() => assertValidExpense(expense, "CHF"))).toEqual([]);
    expect(
      issuesOf(() => assertValidExpense({ ...expense, exchangeRateToBase: 0.000065, amountInBaseCurrency: 52 }, "CHF")),
    ).toEqual([]);
  });

  it("requires conversion fields together", () => {
    expect(issuesOf(() => assertValidExpense({ ...expense, exchangeRateToBase: 0.000065 }, "CHF"))).toEqual([
      "exchangeRateToBase and amountInBaseCurrency must be set together",
    ]);
  });

  it("requires rate 1 for base-currency expenses", () => {
    const chf = { ...expense, originalAmount: 220, originalCurrency: "CHF" };
    expect(issuesOf(() => assertValidExpense({ ...chf, exchangeRateToBase: 1, amountInBaseCurrency: 220 }, "CHF"))).toEqual([]);
    expect(issuesOf(() => assertValidExpense(chf, "CHF"))).toEqual([
      "expenses in the base currency must have rate 1 and an equal base amount",
    ]);
  });

  it("requires a positive original amount", () => {
    expect(issuesOf(() => assertValidExpense({ ...expense, originalAmount: 0 }, "CHF"))).toEqual([
      "originalAmount must be a number > 0",
    ]);
  });
});
