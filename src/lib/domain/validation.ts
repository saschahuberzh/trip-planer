/**
 * Structural validation of persistent entities (types, enums, formats, intra-record
 * invariants). Cross-record rules (references, uniqueness) are enforced by repositories.
 */
import { isCurrencyCode } from "./currency";
import {
  compareCalendarDates,
  durationMinutes,
  isCalendarDate,
  isLocalDateTime,
  isWallClockTime,
} from "./dateTime";
import {
  BOOKING_LINK_TYPES,
  BOOKING_TYPES,
  EXPENSE_CATEGORIES,
  EXPENSE_LINK_TYPES,
  EXPENSE_STATUSES,
  IMAGE_MIME_TYPES,
  PLACE_TYPES,
  TRANSPORT_TYPES,
  TRIP_STATUSES,
  type Accommodation,
  type Activity,
  type Booking,
  type EntityMetadata,
  type Expense,
  type ImageAsset,
  type Place,
  type Transport,
  type Trip,
  type TripDay,
  type VisitedCountry,
} from "./types";

export class ValidationError extends Error {
  constructor(
    readonly entity: string,
    readonly issues: string[],
  ) {
    super(`Invalid ${entity}: ${issues.join("; ")}`);
    this.name = "ValidationError";
  }
}

/** ISO 3166-1 alpha-2 format (user-assigned codes like "XK" for Kosovo included). */
export const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

class Checker {
  readonly issues: string[] = [];

  check(ok: boolean, message: string): void {
    if (!ok) this.issues.push(message);
  }

  text(value: unknown, field: string): void {
    this.check(typeof value === "string" && value.trim() !== "", `${field} must be non-empty text`);
  }

  optionalText(value: unknown, field: string): void {
    if (value !== undefined) this.check(typeof value === "string", `${field} must be text`);
  }

  oneOf(value: unknown, allowed: readonly string[], field: string): void {
    this.check(typeof value === "string" && allowed.includes(value), `${field} is not allowed`);
  }

  date(value: unknown, field: string, optional = false): void {
    if (optional && value === undefined) return;
    this.check(isCalendarDate(value), `${field} must be a YYYY-MM-DD date`);
  }

  time(value: unknown, field: string): void {
    if (value !== undefined) this.check(isWallClockTime(value), `${field} must be HH:mm`);
  }

  localDateTime(value: unknown, field: string): void {
    if (value !== undefined) {
      this.check(isLocalDateTime(value), `${field} must be a local date/time with an IANA time zone`);
    }
  }

  number(value: unknown, field: string, { optional = false, min = -Infinity, exclusiveMin = false } = {}): void {
    if (optional && value === undefined) return;
    const ok =
      typeof value === "number" &&
      Number.isFinite(value) &&
      (exclusiveMin ? value > min : value >= min);
    this.check(ok, `${field} must be a number ${exclusiveMin ? ">" : ">="} ${min}`);
  }

  currency(value: unknown, field: string, optional = false): void {
    if (optional && value === undefined) return;
    this.check(isCurrencyCode(value), `${field} must be an ISO 4217 currency code`);
  }

  boolean(value: unknown, field: string): void {
    this.check(typeof value === "boolean", `${field} must be true or false`);
  }

  coordinates(latitude: unknown, longitude: unknown): void {
    if (latitude === undefined && longitude === undefined) return;
    this.check(
      latitude !== undefined && longitude !== undefined,
      "latitude and longitude must be set together",
    );
    this.number(latitude, "latitude", { optional: true, min: -90 });
    this.check(latitude === undefined || (latitude as number) <= 90, "latitude must be <= 90");
    this.number(longitude, "longitude", { optional: true, min: -180 });
    this.check(longitude === undefined || (longitude as number) <= 180, "longitude must be <= 180");
  }

  price(price: unknown, currency: unknown): void {
    this.number(price, "price", { optional: true, min: 0 });
    this.currency(currency, "currency", true);
    this.check(price === undefined || currency !== undefined, "price requires a currency");
  }

  metadata(entity: { id: unknown } & Partial<Record<keyof EntityMetadata, unknown>>): void {
    this.text(entity.id, "id");
    for (const field of ["createdAt", "updatedAt"] as const) {
      const value = entity[field];
      this.check(typeof value === "string" && ISO_INSTANT.test(value), `${field} must be an ISO 8601 UTC instant`);
    }
  }

  result(entity: string): void {
    if (this.issues.length > 0) throw new ValidationError(entity, this.issues);
  }
}

export function assertValidTrip(trip: Trip): void {
  const c = new Checker();
  c.metadata(trip);
  c.text(trip.name, "name");
  c.check(
    Array.isArray(trip.countries) &&
      trip.countries.every((country) => typeof country === "string" && country.trim() !== ""),
    "countries must be a list of non-empty text",
  );
  c.date(trip.startDate, "startDate");
  c.date(trip.endDate, "endDate");
  if (isCalendarDate(trip.startDate) && isCalendarDate(trip.endDate)) {
    c.check(compareCalendarDates(trip.endDate, trip.startDate) >= 0, "endDate must not be before startDate");
  }
  c.oneOf(trip.status, TRIP_STATUSES, "status");
  c.currency(trip.baseCurrency, "baseCurrency");
  c.number(trip.budgetAmount, "budgetAmount", { optional: true, min: 0 });
  c.optionalText(trip.coverImageId, "coverImageId");
  c.optionalText(trip.notes, "notes");
  c.result("trip");
}

export function assertValidTripDay(day: TripDay): void {
  const c = new Checker();
  c.metadata(day);
  c.text(day.tripId, "tripId");
  c.date(day.date, "date");
  c.optionalText(day.title, "title");
  c.optionalText(day.notes, "notes");
  if (day.placeIds !== undefined) {
    const ids: unknown = day.placeIds;
    c.check(
      Array.isArray(ids) && ids.length > 0 && ids.every((id) => typeof id === "string" && id.trim() !== ""),
      "placeIds must be a non-empty list of IDs",
    );
    c.check(!Array.isArray(ids) || new Set(ids).size === ids.length, "placeIds must not contain duplicates");
  }
  c.result("trip day");
}

export function assertValidPlace(place: Place): void {
  const c = new Checker();
  c.metadata(place);
  c.text(place.tripId, "tripId");
  c.text(place.name, "name");
  c.oneOf(place.type, PLACE_TYPES, "type");
  c.optionalText(place.address, "address");
  c.coordinates(place.latitude, place.longitude);
  c.optionalText(place.website, "website");
  c.optionalText(place.notes, "notes");
  c.boolean(place.favorite, "favorite");
  c.boolean(place.visited, "visited");
  if (place.externalRef !== undefined) {
    c.check(typeof place.externalRef === "object" && place.externalRef !== null, "externalRef must be an object");
    c.text(place.externalRef?.provider, "externalRef.provider");
    c.text(place.externalRef?.id, "externalRef.id");
  }
  c.result("place");
}

function checkOrdering(c: Checker, entry: Activity | Transport): void {
  c.text(entry.tripId, "tripId");
  c.optionalText(entry.tripDayId, "tripDayId");
  c.number(entry.sortOrder, "sortOrder");
}

export function assertValidActivity(activity: Activity): void {
  const c = new Checker();
  c.metadata(activity);
  checkOrdering(c, activity);
  c.optionalText(activity.placeId, "placeId");
  c.text(activity.title, "title");
  c.time(activity.startTime, "startTime");
  c.time(activity.endTime, "endTime");
  c.optionalText(activity.notes, "notes");
  c.result("activity");
}

export function assertValidTransport(transport: Transport): void {
  const c = new Checker();
  c.metadata(transport);
  checkOrdering(c, transport);
  c.oneOf(transport.type, TRANSPORT_TYPES, "type");
  c.optionalText(transport.originPlaceId, "originPlaceId");
  c.optionalText(transport.destinationPlaceId, "destinationPlaceId");
  c.optionalText(transport.originText, "originText");
  c.optionalText(transport.destinationText, "destinationText");
  c.check(
    transport.originPlaceId === undefined || transport.originText === undefined,
    "origin is either a place or text, not both",
  );
  c.check(
    transport.destinationPlaceId === undefined || transport.destinationText === undefined,
    "destination is either a place or text, not both",
  );
  c.localDateTime(transport.departure, "departure");
  c.localDateTime(transport.arrival, "arrival");
  if (isLocalDateTime(transport.departure) && isLocalDateTime(transport.arrival)) {
    c.check(durationMinutes(transport.departure, transport.arrival) >= 0, "arrival must not be before departure");
  }
  if (transport.durationMinutes !== undefined) {
    c.check(
      Number.isInteger(transport.durationMinutes) && transport.durationMinutes > 0,
      "durationMinutes must be a positive whole number",
    );
  }
  c.price(transport.price, transport.currency);
  c.optionalText(transport.bookingReference, "bookingReference");
  c.optionalText(transport.notes, "notes");
  c.result("transport");
}

export function assertValidAccommodation(accommodation: Accommodation): void {
  const c = new Checker();
  c.metadata(accommodation);
  c.text(accommodation.tripId, "tripId");
  c.optionalText(accommodation.placeId, "placeId");
  c.text(accommodation.name, "name");
  c.optionalText(accommodation.type, "type");
  c.date(accommodation.checkInDate, "checkInDate");
  c.date(accommodation.checkOutDate, "checkOutDate");
  if (isCalendarDate(accommodation.checkInDate) && isCalendarDate(accommodation.checkOutDate)) {
    c.check(
      compareCalendarDates(accommodation.checkOutDate, accommodation.checkInDate) >= 0,
      "checkOutDate must not be before checkInDate",
    );
  }
  c.time(accommodation.checkInTime, "checkInTime");
  c.time(accommodation.checkOutTime, "checkOutTime");
  if (accommodation.placeId !== undefined) {
    c.check(
      accommodation.address === undefined &&
        accommodation.latitude === undefined &&
        accommodation.longitude === undefined,
      "address and coordinates must be empty when a place is linked",
    );
  }
  c.optionalText(accommodation.address, "address");
  c.coordinates(accommodation.latitude, accommodation.longitude);
  c.price(accommodation.price, accommodation.currency);
  c.optionalText(accommodation.bookingReference, "bookingReference");
  c.optionalText(accommodation.bookingUrl, "bookingUrl");
  c.optionalText(accommodation.notes, "notes");
  c.result("accommodation");
}

function checkLink(c: Checker, link: { type: unknown; id: unknown } | undefined, types: readonly string[]): void {
  if (link === undefined) return;
  c.oneOf(link.type, types, "linkedEntity.type");
  c.text(link.id, "linkedEntity.id");
}

export function assertValidBooking(booking: Booking): void {
  const c = new Checker();
  c.metadata(booking);
  c.text(booking.tripId, "tripId");
  c.oneOf(booking.type, BOOKING_TYPES, "type");
  c.text(booking.title, "title");
  c.localDateTime(booking.dateTime, "dateTime");
  c.price(booking.price, booking.currency);
  c.optionalText(booking.bookingReference, "bookingReference");
  c.optionalText(booking.url, "url");
  c.optionalText(booking.notes, "notes");
  checkLink(c, booking.linkedEntity, BOOKING_LINK_TYPES);
  c.result("booking");
}

/**
 * @param baseCurrency the owning trip's base currency, for the rate-1 rule.
 */
export function assertValidExpense(expense: Expense, baseCurrency: string): void {
  const c = new Checker();
  c.metadata(expense);
  c.text(expense.tripId, "tripId");
  c.text(expense.title, "title");
  c.oneOf(expense.category, EXPENSE_CATEGORIES, "category");
  c.oneOf(expense.status, EXPENSE_STATUSES, "status");
  c.date(expense.date, "date", true);
  c.number(expense.originalAmount, "originalAmount", { min: 0, exclusiveMin: true });
  c.currency(expense.originalCurrency, "originalCurrency");
  c.number(expense.exchangeRateToBase, "exchangeRateToBase", { optional: true, min: 0, exclusiveMin: true });
  c.number(expense.amountInBaseCurrency, "amountInBaseCurrency", { optional: true, min: 0 });
  const converted = expense.exchangeRateToBase !== undefined;
  c.check(
    converted === (expense.amountInBaseCurrency !== undefined),
    "exchangeRateToBase and amountInBaseCurrency must be set together",
  );
  if (expense.originalCurrency === baseCurrency) {
    c.check(
      expense.exchangeRateToBase === 1 && expense.amountInBaseCurrency === expense.originalAmount,
      "expenses in the base currency must have rate 1 and an equal base amount",
    );
  }
  c.optionalText(expense.notes, "notes");
  checkLink(c, expense.linkedEntity, EXPENSE_LINK_TYPES);
  c.result("expense");
}

export function assertValidImageAsset(image: ImageAsset): void {
  const c = new Checker();
  c.metadata(image);
  c.oneOf(image.mimeType, IMAGE_MIME_TYPES, "mimeType");
  c.check(typeof Blob !== "undefined" && image.blob instanceof Blob, "blob must be a Blob");
  for (const field of ["width", "height"] as const) {
    c.check(Number.isInteger(image[field]) && image[field] > 0, `${field} must be a positive whole number`);
  }
  c.result("image");
}

export function assertValidVisitedCountry(country: VisitedCountry): void {
  const c = new Checker();
  c.check(typeof country.countryCode === "string" && COUNTRY_CODE_PATTERN.test(country.countryCode), "countryCode must be a two-letter ISO 3166-1 code");
  for (const field of ["createdAt", "updatedAt"] as const) {
    const value = country[field];
    c.check(typeof value === "string" && ISO_INSTANT.test(value), `${field} must be an ISO 8601 UTC instant`);
  }
  c.result("visited country");
}
