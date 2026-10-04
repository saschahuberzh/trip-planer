/**
 * Create/edit transport form: raw values, validation and conversion to TransportInput.
 * Kept free of React so it can be tested directly. See SCREENS.md "Create / Edit Transport".
 */
import {
  durationMinutes,
  isCalendarDate,
  isValidTimeZone,
  localDatePart,
  localTimePart,
} from "@/lib/domain/dateTime";
import type { LocalDateTime, Transport, TransportType } from "@/lib/domain/types";
import { optionalText, normalizeTimeInput, UNPLANNED_VALUE } from "./itineraryForms";
import type { TransportInput } from "./itineraryService";
import { parsePriceInput } from "./priceInput";

const MAX_TRANSPORT_TEXT_LENGTH = 120;

/** One end of a connection: a place of the trip, or free text. */
export interface TransportEndValue {
  placeId: string | undefined;
  text: string;
}

export interface LocalDateTimeValues {
  /** "YYYY-MM-DD" or empty. */
  date: string;
  /** "HH:mm" or empty. */
  time: string;
  timeZone: string;
}

export interface TransportFormValues {
  type: TransportType;
  origin: TransportEndValue;
  destination: TransportEndValue;
  departure: LocalDateTimeValues;
  arrival: LocalDateTimeValues;
  /** Explicit duration as typed ("2:10", "2h 10", "130"); empty = calculated or none. */
  duration: string;
  price: string;
  currency: string;
  bookingReference: string;
  notes: string;
  /** TripDay ID, or UNPLANNED_VALUE. */
  tripDayId: string;
}

type ErrorKey = "origin" | "destination" | "departure" | "arrival" | "duration" | "price" | "bookingReference";
export type TransportFormErrors = Partial<Record<ErrorKey, string>>;

export type TransportFormResult =
  | { ok: true; input: TransportInput; tripDayId: string | undefined }
  | { ok: false; errors: TransportFormErrors };

function emptyDateTime(timeZone: string): LocalDateTimeValues {
  return { date: "", time: "", timeZone };
}

export function emptyTransportFormValues(tripDayId: string | undefined, timeZone: string): TransportFormValues {
  return {
    type: "train",
    origin: { placeId: undefined, text: "" },
    destination: { placeId: undefined, text: "" },
    departure: emptyDateTime(timeZone),
    arrival: emptyDateTime(timeZone),
    duration: "",
    price: "",
    currency: "",
    bookingReference: "",
    notes: "",
    tripDayId: tripDayId ?? UNPLANNED_VALUE,
  };
}

/** Form values of an optional LocalDateTime (empty date/time with `fallbackZone` when unset). */
export function toLocalDateTimeValues(value: LocalDateTime | undefined, fallbackZone: string): LocalDateTimeValues {
  return value === undefined
    ? emptyDateTime(fallbackZone)
    : { date: localDatePart(value), time: localTimePart(value), timeZone: value.timeZone };
}

export function transportToFormValues(transport: Transport, fallbackZone: string): TransportFormValues {
  return {
    type: transport.type,
    origin: { placeId: transport.originPlaceId, text: transport.originText ?? "" },
    destination: { placeId: transport.destinationPlaceId, text: transport.destinationText ?? "" },
    departure: toLocalDateTimeValues(transport.departure, fallbackZone),
    arrival: toLocalDateTimeValues(transport.arrival, transport.departure?.timeZone ?? fallbackZone),
    duration: transport.durationMinutes === undefined ? "" : formatDurationInput(transport.durationMinutes),
    price: transport.price === undefined ? "" : String(transport.price),
    currency: transport.currency ?? "",
    bookingReference: transport.bookingReference ?? "",
    notes: transport.notes ?? "",
    tripDayId: transport.tripDayId ?? UNPLANNED_VALUE,
  };
}

/** 130 → "2:10". */
function formatDurationInput(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Parses a typed duration: "2:10", "2h 10", "2 h 10 min", "2h", "45m", "45 min" or plain
 * minutes ("130"). Returns null when not understood or not positive.
 */
export function parseDurationInput(text: string): number | null {
  const value = text.trim().toLowerCase();
  let minutes: number | null = null;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{1,3}):([0-5]\d)$/.exec(value))) minutes = Number(match[1]) * 60 + Number(match[2]);
  else if ((match = /^(\d{1,3})\s*h(?:ours?|rs?)?\s*(?:(\d{1,2})\s*(?:m|min|mins|minutes?)?)?$/.exec(value))) {
    minutes = Number(match[1]) * 60 + Number(match[2] ?? 0);
  } else if ((match = /^(\d{1,4})\s*(?:m|min|mins|minutes?)?$/.exec(value))) minutes = Number(match[1]);
  return minutes !== null && minutes > 0 ? minutes : null;
}

/** undefined when nothing entered, the LocalDateTime when complete, or an error message. */
export function parseLocalDateTimeInput(values: LocalDateTimeValues, label: string): LocalDateTime | undefined | string {
  const time = normalizeTimeInput(values.time);
  const hasDate = values.date.trim() !== "";
  if (!hasDate && time === "") return undefined;
  if (!hasDate || !isCalendarDate(values.date)) return `Choose the ${label} date.`;
  if (time === "" || time === null) return `Add the ${label} time (local time).`;
  if (!isValidTimeZone(values.timeZone)) return "Choose a time zone.";
  return { local: `${values.date}T${time}`, timeZone: values.timeZone };
}

function parseEnd(value: TransportEndValue): { placeId?: string; text?: string } | string {
  if (value.placeId !== undefined) return { placeId: value.placeId };
  const text = optionalText(value.text);
  if (text !== undefined && text.length > MAX_TRANSPORT_TEXT_LENGTH) return `Use at most ${MAX_TRANSPORT_TEXT_LENGTH} characters.`;
  return { text };
}

export function validateTransportForm(values: TransportFormValues): TransportFormResult {
  const errors: TransportFormErrors = {};

  const origin = parseEnd(values.origin);
  const destination = parseEnd(values.destination);
  if (typeof origin === "string") errors.origin = origin;
  if (typeof destination === "string") errors.destination = destination;

  const departure = parseLocalDateTimeInput(values.departure, "departure");
  const arrival = parseLocalDateTimeInput(values.arrival, "arrival");
  if (typeof departure === "string") errors.departure = departure;
  if (typeof arrival === "string") errors.arrival = arrival;
  if (typeof departure === "object" && typeof arrival === "object" && durationMinutes(departure, arrival) < 0) {
    errors.arrival = "Arrival is before departure (check the dates and time zones).";
  }

  let duration: number | undefined;
  if (values.duration.trim() !== "") {
    const parsed = parseDurationInput(values.duration);
    if (parsed === null) errors.duration = "Enter a duration like 2:30 or 2h 30.";
    else duration = parsed;
  }

  const price = parsePriceInput(values.price, values.currency);
  if (!price.ok) errors.price = price.error;

  const bookingReference = optionalText(values.bookingReference);
  if (bookingReference !== undefined && bookingReference.length > MAX_TRANSPORT_TEXT_LENGTH) {
    errors.bookingReference = `Use at most ${MAX_TRANSPORT_TEXT_LENGTH} characters.`;
  }

  if (
    Object.keys(errors).length > 0 ||
    typeof origin === "string" ||
    typeof destination === "string" ||
    typeof departure === "string" ||
    typeof arrival === "string" ||
    !price.ok
  ) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    input: {
      type: values.type,
      originPlaceId: origin.placeId,
      originText: origin.text,
      destinationPlaceId: destination.placeId,
      destinationText: destination.text,
      departure,
      arrival,
      durationMinutes: duration,
      price: price.price,
      currency: price.currency,
      bookingReference,
      notes: optionalText(values.notes),
    },
    tripDayId: values.tripDayId === UNPLANNED_VALUE ? undefined : values.tripDayId,
  };
}

/** Displayed duration: an explicit value, else calculated from departure and arrival. */
export function transportDurationMinutes(transport: Pick<Transport, "durationMinutes" | "departure" | "arrival">): number | undefined {
  if (transport.durationMinutes !== undefined) return transport.durationMinutes;
  if (transport.departure === undefined || transport.arrival === undefined) return undefined;
  return durationMinutes(transport.departure, transport.arrival);
}

/**
 * Time zone suggested for a new transport: the most recently changed one used in this
 * trip, else the device's.
 */
export function defaultTimeZone(transports: readonly Transport[], deviceZone: string): string {
  let latest: { updatedAt: string; timeZone: string } | undefined;
  for (const transport of transports) {
    const timeZone = transport.arrival?.timeZone ?? transport.departure?.timeZone;
    if (timeZone !== undefined && (latest === undefined || transport.updatedAt > latest.updatedAt)) {
      latest = { updatedAt: transport.updatedAt, timeZone };
    }
  }
  return latest?.timeZone ?? deviceZone;
}
