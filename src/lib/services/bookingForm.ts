/**
 * Create/edit booking form: values, validation, conversion to BookingInput, and
 * prefilling from a linked transport, accommodation or activity.
 */
import type { Accommodation, Activity, Booking, BookingLinkType, BookingType, Transport } from "@/lib/domain/types";
import type { BookingInput } from "./bookingService";
import { optionalText } from "./itineraryForms";
import { normalizeWebsite } from "./placeForm";
import { parsePriceInput } from "./priceInput";
import {
  parseLocalDateTimeInput,
  toLocalDateTimeValues,
  type LocalDateTimeValues,
} from "./transportForm";

const MAX_BOOKING_TEXT_LENGTH = 120;

export interface BookingFormValues {
  type: BookingType;
  title: string;
  dateTime: LocalDateTimeValues;
  price: string;
  currency: string;
  bookingReference: string;
  url: string;
  notes: string;
  link: { type: BookingLinkType; id: string } | undefined;
}

type ErrorKey = "title" | "dateTime" | "price" | "bookingReference" | "url";
export type BookingFormErrors = Partial<Record<ErrorKey, string>>;
export type BookingFormResult = { ok: true; input: BookingInput } | { ok: false; errors: BookingFormErrors };

export function emptyBookingFormValues(timeZone: string, currency: string): BookingFormValues {
  return {
    type: "other",
    title: "",
    dateTime: { date: "", time: "", timeZone },
    price: "",
    currency,
    bookingReference: "",
    url: "",
    notes: "",
    link: undefined,
  };
}

export function bookingToFormValues(booking: Booking, fallbackZone: string, fallbackCurrency: string): BookingFormValues {
  return {
    type: booking.type,
    title: booking.title,
    dateTime: toLocalDateTimeValues(booking.dateTime, fallbackZone),
    price: booking.price === undefined ? "" : String(booking.price),
    currency: booking.currency ?? fallbackCurrency,
    bookingReference: booking.bookingReference ?? "",
    url: booking.url ?? "",
    notes: booking.notes ?? "",
    link: booking.linkedEntity,
  };
}

/** The linked entity's data, for prefilling. */
export type LinkedEntity =
  | { type: "transport"; item: Transport; title: string }
  | { type: "accommodation"; item: Accommodation }
  | { type: "activity"; item: Activity };

function bookingTypeFor(entity: LinkedEntity): BookingType {
  if (entity.type === "accommodation") return "accommodation";
  if (entity.type === "activity") return "activity";
  return entity.item.type === "flight" ? "flight" : entity.item.type === "train" ? "train" : "other";
}

/**
 * Links the booking to an entity. Empty fields are filled from it (type, title, date/time,
 * price, booking reference); anything the user already entered is kept.
 */
export function applyLink(values: BookingFormValues, entity: LinkedEntity | undefined, typeTouched: boolean): BookingFormValues {
  if (entity === undefined) return { ...values, link: undefined };
  const next: BookingFormValues = { ...values, link: { type: entity.type, id: entity.item.id } };
  if (!typeTouched) next.type = bookingTypeFor(entity);
  if (next.title.trim() === "") next.title = entity.type === "transport" ? entity.title : entity.type === "accommodation" ? entity.item.name : entity.item.title;
  if (entity.type === "transport") {
    const { departure, price, currency, bookingReference } = entity.item;
    if (next.dateTime.date === "" && departure) next.dateTime = toLocalDateTimeValues(departure, departure.timeZone);
    if (next.price.trim() === "" && price !== undefined && currency !== undefined) {
      next.price = String(price);
      next.currency = currency;
    }
    if (next.bookingReference.trim() === "" && bookingReference) next.bookingReference = bookingReference;
  }
  if (entity.type === "accommodation") {
    const { checkInDate, checkInTime, price, currency, bookingReference, bookingUrl } = entity.item;
    if (next.dateTime.date === "") next.dateTime = { ...next.dateTime, date: checkInDate, time: checkInTime ?? next.dateTime.time };
    if (next.price.trim() === "" && price !== undefined && currency !== undefined) {
      next.price = String(price);
      next.currency = currency;
    }
    if (next.bookingReference.trim() === "" && bookingReference) next.bookingReference = bookingReference;
    if (next.url.trim() === "" && bookingUrl) next.url = bookingUrl;
  }
  return next;
}

function limited(text: string, errors: BookingFormErrors, key: ErrorKey): string | undefined {
  const value = optionalText(text);
  if (value !== undefined && value.length > MAX_BOOKING_TEXT_LENGTH) errors[key] = `Use at most ${MAX_BOOKING_TEXT_LENGTH} characters.`;
  return value;
}

export function validateBookingForm(values: BookingFormValues): BookingFormResult {
  const errors: BookingFormErrors = {};
  const title = limited(values.title, errors, "title");
  if (title === undefined) errors.title = "Give the booking a title.";
  const dateTime = parseLocalDateTimeInput(values.dateTime, "booking");
  if (typeof dateTime === "string") errors.dateTime = dateTime;
  const price = parsePriceInput(values.price, values.currency);
  if (!price.ok) errors.price = price.error;
  const bookingReference = limited(values.bookingReference, errors, "bookingReference");
  const url = normalizeWebsite(values.url);
  if (url === null) errors.url = "Enter a web address like example.com/…";

  if (Object.keys(errors).length > 0 || title === undefined || typeof dateTime === "string" || !price.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    input: {
      type: values.type,
      title,
      dateTime,
      price: price.price,
      currency: price.currency,
      bookingReference,
      url: url === "" || url === null ? undefined : url,
      notes: optionalText(values.notes),
      linkedEntity: values.link,
    },
  };
}
