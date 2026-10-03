/**
 * Create/edit trip form: raw input values, validation and conversion to TripInput.
 * Kept free of React so it can be tested directly.
 */
import { currencyMinorUnits, isCurrencyCode } from "@/lib/domain/currency";
import { calendarDaysInclusive, compareCalendarDates, isCalendarDate } from "@/lib/domain/dateTime";
import type { Trip, TripStatus } from "@/lib/domain/types";
import type { TripInput } from "./tripService";

export interface TripFormValues {
  name: string;
  countries: string[];
  startDate: string;
  endDate: string;
  status: TripStatus;
  baseCurrency: string;
  /** As typed, e.g. "3000", "3'000.50" or "1500,5". Empty = no budget. */
  budgetAmount: string;
  notes: string;
}

export type TripFormErrors = Partial<Record<keyof TripFormValues, string>>;

export type TripFormResult = { ok: true; input: TripInput } | { ok: false; errors: TripFormErrors };

export const MAX_TRIP_NAME_LENGTH = 120;
/** Guards against typos such as a wrong year creating thousands of days. */
export const MAX_TRIP_DAYS = 366;

export function emptyTripFormValues(baseCurrency: string): TripFormValues {
  return {
    name: "",
    countries: [],
    startDate: "",
    endDate: "",
    status: "planned",
    baseCurrency,
    budgetAmount: "",
    notes: "",
  };
}

export function tripToFormValues(trip: Trip): TripFormValues {
  return {
    name: trip.name,
    countries: [...trip.countries],
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    baseCurrency: trip.baseCurrency,
    budgetAmount: trip.budgetAmount === undefined ? "" : String(trip.budgetAmount),
    notes: trip.notes ?? "",
  };
}

/** Trims countries and drops empty entries and case-insensitive duplicates. */
export function normalizeCountries(countries: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of countries) {
    const country = raw.trim().replace(/\s+/g, " ");
    const key = country.toLocaleLowerCase();
    if (country === "" || seen.has(key)) continue;
    seen.add(key);
    result.push(country);
  }
  return result;
}

/** Adds countries typed as free text; several can be separated by commas. */
export function addCountries(countries: readonly string[], text: string): string[] {
  return normalizeCountries([...countries, ...text.split(",")]);
}

/**
 * Parses an amount typed by the user. Accepts "." or "," as decimal separator and
 * spaces or apostrophes as thousands separators. Returns null if not a plain number.
 */
export function parseAmount(text: string): { value: number; decimals: number } | null {
  let normalized = text.trim().replace(/[\s'’]/g, "");
  if (normalized.includes(".") && normalized.includes(",")) normalized = normalized.replace(/,/g, "");
  else normalized = normalized.replace(",", ".");
  const match = /^\d+(?:\.(\d+))?$/.exec(normalized);
  if (!match) return null;
  return { value: Number(normalized), decimals: match[1]?.length ?? 0 };
}

export function validateTripForm(values: TripFormValues): TripFormResult {
  const errors: TripFormErrors = {};

  const name = values.name.trim();
  if (name === "") errors.name = "Give your trip a name.";
  else if (name.length > MAX_TRIP_NAME_LENGTH) {
    errors.name = `Use at most ${MAX_TRIP_NAME_LENGTH} characters.`;
  }

  const startValid = isCalendarDate(values.startDate);
  const endValid = isCalendarDate(values.endDate);
  if (!startValid) errors.startDate = "Choose a start date.";
  if (!endValid) errors.endDate = "Choose an end date.";
  if (startValid && endValid) {
    if (compareCalendarDates(values.endDate, values.startDate) < 0) {
      errors.endDate = "The end date can't be before the start date.";
    } else if (calendarDaysInclusive(values.startDate, values.endDate) > MAX_TRIP_DAYS) {
      errors.endDate = `A trip can last at most ${MAX_TRIP_DAYS} days.`;
    }
  }

  const currencyValid = isCurrencyCode(values.baseCurrency);
  if (!currencyValid) errors.baseCurrency = "Choose a currency.";

  let budgetAmount: number | undefined;
  if (values.budgetAmount.trim() !== "") {
    const amount = parseAmount(values.budgetAmount);
    if (amount === null) {
      errors.budgetAmount = "Enter a positive amount, e.g. 2500 or 2500.50.";
    } else if (currencyValid && amount.decimals > currencyMinorUnits(values.baseCurrency)) {
      const digits = currencyMinorUnits(values.baseCurrency);
      errors.budgetAmount =
        digits === 0
          ? `${values.baseCurrency} amounts have no decimal places.`
          : `${values.baseCurrency} amounts have at most ${digits} decimal places.`;
    } else {
      budgetAmount = amount.value;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const notes = values.notes.trim();
  return {
    ok: true,
    input: {
      name,
      countries: normalizeCountries(values.countries),
      startDate: values.startDate,
      endDate: values.endDate,
      status: values.status,
      baseCurrency: values.baseCurrency,
      budgetAmount,
      notes: notes === "" ? undefined : notes,
    },
  };
}
