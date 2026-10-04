/**
 * Shared domain types. See DATA_MODEL.md for semantics and invariants.
 *
 * Formats:
 * - calendar dates: "YYYY-MM-DD"
 * - wall-clock times: "HH:mm"
 * - instants (metadata): ISO 8601 UTC
 */

/** A date/time as experienced at a specific location. Never an instant. */
export interface LocalDateTime {
  /** "YYYY-MM-DDTHH:mm", no offset, no "Z". */
  local: string;
  /** IANA timezone, e.g. "Asia/Tashkent". */
  timeZone: string;
}

export interface EntityMetadata {
  createdAt: string;
  updatedAt: string;
}

export const TRIP_STATUSES = ["planned", "active", "completed"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export interface Trip extends EntityMetadata {
  id: string;
  name: string;
  countries: string[];
  startDate: string;
  endDate: string;
  status: TripStatus;
  baseCurrency: string;
  budgetAmount?: number;
  coverImageId?: string;
  notes?: string;
}

export interface TripDay extends EntityMetadata {
  id: string;
  tripId: string;
  date: string;
  title?: string;
  notes?: string;
  /** Places of the day, ordered (e.g. Tashkent → Samarkand). Never stored empty. */
  placeIds?: string[];
}

export const PLACE_TYPES = [
  "city",
  "attraction",
  "restaurant",
  "hotel",
  "airport",
  "train_station",
  "custom",
] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export interface Place extends EntityMetadata {
  id: string;
  tripId: string;
  name: string;
  type: PlaceType;
  address?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  notes?: string;
  favorite: boolean;
  visited: boolean;
  /** Where the place was found (informational only; never needed to use the place). */
  externalRef?: PlaceExternalRef;
}

export interface PlaceExternalRef {
  /** Search provider ID, e.g. "photon". */
  provider: string;
  /** The provider's ID for the place, e.g. "N123456". */
  id: string;
}

/** Fields shared by all entries of the itinerary timeline. */
export interface ItineraryOrdering {
  /** undefined = Unplanned. */
  tripDayId?: string;
  /** Position within the bucket; shared ordering space across entry types. */
  sortOrder: number;
}

export interface Activity extends EntityMetadata, ItineraryOrdering {
  id: string;
  tripId: string;
  placeId?: string;
  title: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export const TRANSPORT_TYPES = [
  "flight",
  "train",
  "bus",
  "car",
  "taxi",
  "ferry",
  "walking",
  "other",
] as const;
export type TransportType = (typeof TRANSPORT_TYPES)[number];

export interface Transport extends EntityMetadata, ItineraryOrdering {
  id: string;
  tripId: string;
  type: TransportType;
  originPlaceId?: string;
  destinationPlaceId?: string;
  originText?: string;
  destinationText?: string;
  departure?: LocalDateTime;
  arrival?: LocalDateTime;
  /** Explicit user-entered override; takes precedence for display. */
  durationMinutes?: number;
  price?: number;
  currency?: string;
  bookingReference?: string;
  notes?: string;
}

export interface Accommodation extends EntityMetadata {
  id: string;
  tripId: string;
  placeId?: string;
  name: string;
  type?: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  /** Location fields: only used when placeId is undefined. */
  address?: string;
  latitude?: number;
  longitude?: number;
  price?: number;
  currency?: string;
  bookingReference?: string;
  bookingUrl?: string;
  notes?: string;
}

export const BOOKING_TYPES = ["flight", "train", "accommodation", "activity", "other"] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];

export const BOOKING_LINK_TYPES = ["transport", "accommodation", "activity"] as const;
export type BookingLinkType = (typeof BOOKING_LINK_TYPES)[number];

export interface Booking extends EntityMetadata {
  id: string;
  tripId: string;
  type: BookingType;
  title: string;
  dateTime?: LocalDateTime;
  price?: number;
  currency?: string;
  bookingReference?: string;
  url?: string;
  notes?: string;
  linkedEntity?: { type: BookingLinkType; id: string };
}

export const EXPENSE_CATEGORIES = [
  "accommodation",
  "transport",
  "food",
  "activities",
  "shopping",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_STATUSES = ["planned", "paid"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_LINK_TYPES = ["transport", "accommodation", "booking", "activity"] as const;
export type ExpenseLinkType = (typeof EXPENSE_LINK_TYPES)[number];

export interface Expense extends EntityMetadata {
  id: string;
  tripId: string;
  title: string;
  category: ExpenseCategory;
  status: ExpenseStatus;
  date?: string;
  originalAmount: number;
  originalCurrency: string;
  /** Set together with amountInBaseCurrency, or neither. */
  exchangeRateToBase?: number;
  amountInBaseCurrency?: number;
  notes?: string;
  linkedEntity?: { type: ExpenseLinkType; id: string };
}

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

export interface ImageAsset extends EntityMetadata {
  id: string;
  mimeType: ImageMimeType;
  blob: Blob;
  width: number;
  height: number;
}

/** A country the user has visited (Countries tab). Not tied to a trip. */
export interface VisitedCountry extends EntityMetadata {
  /** ISO 3166-1 alpha-2 code, e.g. "UZ". Also the primary key. */
  countryCode: string;
}

export interface BackupImage {
  id: string;
  mimeType: string;
  width: number;
  height: number;
  dataBase64: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupData {
  format: "travel-planner-backup";
  version: number;
  exportedAt: string;
  appVersion: string;
  databaseVersion: number;
  trips: Trip[];
  tripDays: TripDay[];
  places: Place[];
  activities: Activity[];
  transports: Transport[];
  accommodations: Accommodation[];
  bookings: Booking[];
  expenses: Expense[];
  images: BackupImage[];
  /** Since backup format 2. */
  visitedCountries: VisitedCountry[];
}

export const SAFETY_BACKUP_REASONS = ["before_restore"] as const;
export type SafetyBackupReason = (typeof SAFETY_BACKUP_REASONS)[number];

/** Non-domain. Stored separately; restore never touches it. */
export interface SafetyBackup {
  id: string;
  createdAt: string;
  reason: SafetyBackupReason;
  data: BackupData;
}

export type StoragePersistenceStatus = "granted" | "denied" | "unsupported";

export interface StoragePersistenceRecord {
  status: StoragePersistenceStatus;
  checkedAt: string;
}

/** Typed AppMeta keys (non-domain, never included in backups). */
export interface AppMetaValues {
  storagePersistence: StoragePersistenceRecord;
  /** ISO 8601 UTC instant of the last JSON export. */
  lastExportAt: string;
}
export type AppMetaKey = keyof AppMetaValues;
