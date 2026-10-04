/**
 * Create/edit accommodation form: values, validation and conversion to AccommodationInput.
 * Location: a linked Place (authoritative) or the accommodation's own address/coordinates.
 */
import { formatCoordinate, isValidLatitude, isValidLongitude, parseCoordinateNumber } from "@/lib/domain/coordinates";
import { compareCalendarDates, isCalendarDate } from "@/lib/domain/dateTime";
import type { Accommodation } from "@/lib/domain/types";
import type { AccommodationInput } from "./accommodationService";
import { normalizeTimeInput, optionalText } from "./itineraryForms";
import { normalizeWebsite } from "./placeForm";
import { parsePriceInput } from "./priceInput";

const MAX_ACCOMMODATION_TEXT_LENGTH = 120;

export interface AccommodationFormValues {
  name: string;
  /** Free text, e.g. "Hotel", "Guesthouse", "Yurt camp". */
  type: string;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  /** Linked place; when set, the own location fields below are ignored. */
  placeId: string | undefined;
  address: string;
  latitude: string;
  longitude: string;
  price: string;
  currency: string;
  bookingReference: string;
  bookingUrl: string;
  notes: string;
}

type ErrorKey =
  | "name"
  | "type"
  | "checkInDate"
  | "checkInTime"
  | "checkOutDate"
  | "checkOutTime"
  | "latitude"
  | "longitude"
  | "price"
  | "bookingReference"
  | "bookingUrl";
export type AccommodationFormErrors = Partial<Record<ErrorKey, string>>;

export type AccommodationFormResult = { ok: true; input: AccommodationInput } | { ok: false; errors: AccommodationFormErrors };

export function emptyAccommodationFormValues(checkInDate: string, checkOutDate: string, currency: string): AccommodationFormValues {
  return {
    name: "",
    type: "",
    checkInDate,
    checkInTime: "",
    checkOutDate,
    checkOutTime: "",
    placeId: undefined,
    address: "",
    latitude: "",
    longitude: "",
    price: "",
    currency,
    bookingReference: "",
    bookingUrl: "",
    notes: "",
  };
}

export function accommodationToFormValues(accommodation: Accommodation, fallbackCurrency: string): AccommodationFormValues {
  return {
    name: accommodation.name,
    type: accommodation.type ?? "",
    checkInDate: accommodation.checkInDate,
    checkInTime: accommodation.checkInTime ?? "",
    checkOutDate: accommodation.checkOutDate,
    checkOutTime: accommodation.checkOutTime ?? "",
    placeId: accommodation.placeId,
    address: accommodation.address ?? "",
    latitude: accommodation.latitude === undefined ? "" : formatCoordinate(accommodation.latitude),
    longitude: accommodation.longitude === undefined ? "" : formatCoordinate(accommodation.longitude),
    price: accommodation.price === undefined ? "" : String(accommodation.price),
    currency: accommodation.currency ?? fallbackCurrency,
    bookingReference: accommodation.bookingReference ?? "",
    bookingUrl: accommodation.bookingUrl ?? "",
    notes: accommodation.notes ?? "",
  };
}

function limited(text: string, errors: AccommodationFormErrors, key: ErrorKey): string | undefined {
  const value = optionalText(text);
  if (value !== undefined && value.length > MAX_ACCOMMODATION_TEXT_LENGTH) {
    errors[key] = `Use at most ${MAX_ACCOMMODATION_TEXT_LENGTH} characters.`;
  }
  return value;
}

export function validateAccommodationForm(values: AccommodationFormValues): AccommodationFormResult {
  const errors: AccommodationFormErrors = {};

  const name = limited(values.name, errors, "name");
  if (name === undefined) errors.name = "Give the accommodation a name.";
  const type = limited(values.type, errors, "type");

  if (!isCalendarDate(values.checkInDate)) errors.checkInDate = "Choose the check-in date.";
  if (!isCalendarDate(values.checkOutDate)) errors.checkOutDate = "Choose the check-out date.";
  else if (isCalendarDate(values.checkInDate) && compareCalendarDates(values.checkOutDate, values.checkInDate) < 0) {
    errors.checkOutDate = "Check-out can't be before check-in.";
  }
  const checkInTime = normalizeTimeInput(values.checkInTime);
  const checkOutTime = normalizeTimeInput(values.checkOutTime);
  if (checkInTime === null) errors.checkInTime = "Enter a time like 14:00.";
  if (checkOutTime === null) errors.checkOutTime = "Enter a time like 11:00.";

  // Own location fields are only used without a linked place.
  let address: string | undefined;
  let latitude: number | undefined;
  let longitude: number | undefined;
  if (values.placeId === undefined) {
    address = optionalText(values.address);
    if (values.latitude.trim() !== "" || values.longitude.trim() !== "") {
      const lat = parseCoordinateNumber(values.latitude);
      const lng = parseCoordinateNumber(values.longitude);
      if (lat === null || !isValidLatitude(lat)) errors.latitude = "Use a number between -90 and 90.";
      else latitude = lat;
      if (lng === null || !isValidLongitude(lng)) errors.longitude = "Use a number between -180 and 180.";
      else longitude = lng;
    }
  }

  const price = parsePriceInput(values.price, values.currency);
  if (!price.ok) errors.price = price.error;
  const bookingReference = limited(values.bookingReference, errors, "bookingReference");
  const bookingUrl = normalizeWebsite(values.bookingUrl);
  if (bookingUrl === null) errors.bookingUrl = "Enter a web address like booking.com/…";

  if (Object.keys(errors).length > 0 || name === undefined || !price.ok || checkInTime === null || checkOutTime === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    input: {
      name,
      type,
      checkInDate: values.checkInDate,
      checkInTime: checkInTime === "" ? undefined : checkInTime,
      checkOutDate: values.checkOutDate,
      checkOutTime: checkOutTime === "" ? undefined : checkOutTime,
      placeId: values.placeId,
      address,
      latitude,
      longitude,
      price: price.price,
      currency: price.currency,
      bookingReference,
      bookingUrl: bookingUrl === "" || bookingUrl === null ? undefined : bookingUrl,
      notes: optionalText(values.notes),
    },
  };
}
