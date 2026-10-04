/**
 * Shared date/time utilities. See DATA_MODEL.md "Date and Time Formats".
 *
 * Calendar dates, wall-clock times and LocalDateTimes are NOT instants: they are
 * never parsed with `new Date(string)` and never interpreted in the device timezone.
 * Internally they are mapped onto UTC epoch values purely as a neutral number line.
 */
import type { LocalDateTime } from "./types";

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WALL_CLOCK_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;
// Named IANA zones only; rejects offset strings such as "+05:00" that Intl also accepts.
const TIME_ZONE_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** Current instant as ISO 8601 UTC (metadata only). */
export function nowInstant(): string {
  return new Date().toISOString();
}

/** Date.UTC without its 0–99 → 1900–1999 year mapping. */
function utcDateMs(year: number, monthIndex: number, day: number): number {
  return new Date(0).setUTCFullYear(year, monthIndex, day);
}

// ---------------------------------------------------------------------------
// Calendar dates (YYYY-MM-DD)

function calendarDateParts(date: string): [number, number, number] | null {
  const match = CALENDAR_DATE.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(utcDateMs(year, month, 0)).getUTCDate();
  return day <= daysInMonth ? [year, month, day] : null;
}

export function isCalendarDate(value: unknown): value is string {
  return typeof value === "string" && calendarDateParts(value) !== null;
}

function calendarDateToUtcMs(date: string): number {
  const parts = calendarDateParts(date);
  if (!parts) throw new RangeError(`Invalid calendar date: ${date}`);
  const [year, month, day] = parts;
  return utcDateMs(year, month - 1, day);
}

function utcMsToCalendarDate(ms: number): string {
  const d = new Date(ms);
  const year = String(d.getUTCFullYear()).padStart(4, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Negative if a < b, 0 if equal, positive if a > b. */
export function compareCalendarDates(a: string, b: string): number {
  return calendarDateToUtcMs(a) - calendarDateToUtcMs(b);
}

export function addDays(date: string, days: number): string {
  return utcMsToCalendarDate(calendarDateToUtcMs(date) + days * MS_PER_DAY);
}

/** All dates from start to end, inclusive. Empty if end < start. */
export function eachDateInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const endMs = calendarDateToUtcMs(end);
  for (let ms = calendarDateToUtcMs(start); ms <= endMs; ms += MS_PER_DAY) {
    dates.push(utcMsToCalendarDate(ms));
  }
  return dates;
}

export function formatCalendarDate(
  date: string,
  locale?: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    calendarDateToUtcMs(date),
  );
}

// ---------------------------------------------------------------------------
// Wall-clock times (HH:mm)

export function isWallClockTime(value: unknown): value is string {
  return typeof value === "string" && WALL_CLOCK_TIME.test(value);
}

// ---------------------------------------------------------------------------
// Time zones

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !TIME_ZONE_NAME.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      era: "short",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** UTC offset of `timeZone` at the given instant, in milliseconds. */
function zoneOffsetMs(epochMs: number, timeZone: string): number {
  const fields: Record<string, number> = {};
  let bc = false;
  for (const part of zoneFormatter(timeZone).formatToParts(epochMs)) {
    if (part.type === "era") bc = part.value.startsWith("B");
    else if (part.type !== "literal") fields[part.type] = Number(part.value);
  }
  const year = bc ? 1 - fields.year : fields.year;
  const wallMs = utcDateMs(year, fields.month - 1, fields.day);
  const asUtc = wallMs + ((fields.hour * 60 + fields.minute) * 60 + fields.second) * 1000;
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

// ---------------------------------------------------------------------------
// LocalDateTime

export function isLocalDateTimeString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = LOCAL_DATE_TIME.exec(value);
  return match !== null && isCalendarDate(match[1]) && isWallClockTime(match[2]);
}

export function isLocalDateTime(value: unknown): value is LocalDateTime {
  if (typeof value !== "object" || value === null) return false;
  const { local, timeZone } = value as Record<string, unknown>;
  return isLocalDateTimeString(local) && isValidTimeZone(timeZone);
}

function localWallMs(local: string): number {
  const match = LOCAL_DATE_TIME.exec(local);
  if (!match || !isLocalDateTimeString(local)) {
    throw new RangeError(`Invalid local date/time: ${local}`);
  }
  const [hours, minutes] = match[2].split(":").map(Number);
  return calendarDateToUtcMs(match[1]) + (hours * 60 + minutes) * MS_PER_MINUTE;
}

/**
 * The instant at which `value.local` occurs in `value.timeZone`.
 *
 * Wall times skipped by a DST gap resolve forward by the gap length; ambiguous
 * wall times in a DST overlap resolve to the earlier instant.
 */
export function localDateTimeToEpochMs(value: LocalDateTime): number {
  if (!isValidTimeZone(value.timeZone)) {
    throw new RangeError(`Invalid time zone: ${value.timeZone}`);
  }
  const wall = localWallMs(value.local);
  const offsetBefore = zoneOffsetMs(wall - MS_PER_DAY, value.timeZone);
  const offsetAfter = zoneOffsetMs(wall + MS_PER_DAY, value.timeZone);
  const candidates = [offsetBefore, offsetAfter]
    .map((offset) => wall - offset)
    .filter((instant) => zoneOffsetMs(instant, value.timeZone) === wall - instant)
    .sort((a, b) => a - b);
  return candidates.length > 0 ? candidates[0] : wall - offsetBefore;
}

/** Timezone-aware minutes from departure to arrival (negative if arrival is earlier). */
export function durationMinutes(departure: LocalDateTime, arrival: LocalDateTime): number {
  return Math.round(
    (localDateTimeToEpochMs(arrival) - localDateTimeToEpochMs(departure)) / MS_PER_MINUTE,
  );
}

/** Formats the local date/time exactly as entered (no timezone conversion). */
export function formatLocalDateTime(
  value: LocalDateTime,
  locale?: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    localWallMs(value.local),
  );
}

/** Number of calendar days from start to end, inclusive (e.g. a 3-day trip). */
export function calendarDaysInclusive(start: string, end: string): number {
  return Math.round((calendarDateToUtcMs(end) - calendarDateToUtcMs(start)) / MS_PER_DAY) + 1;
}

/** Formats a calendar date range compactly, e.g. "12–14 Jun 2026". */
export function formatCalendarDateRange(
  start: string,
  end: string,
  locale?: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).formatRange(
    calendarDateToUtcMs(start),
    calendarDateToUtcMs(end),
  );
}

/** Calendar date part of a LocalDateTime ("YYYY-MM-DD"). */
export function localDatePart(value: LocalDateTime): string {
  return value.local.slice(0, 10);
}

/** Wall-clock time part of a LocalDateTime ("HH:mm"). */
export function localTimePart(value: LocalDateTime): string {
  return value.local.slice(11, 16);
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((calendarDateToUtcMs(to) - calendarDateToUtcMs(from)) / MS_PER_DAY);
}

/** e.g. 130 → "2 h 10 min", 45 → "45 min", 120 → "2 h". */
export function formatDurationMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The device's IANA time zone (only used as a default suggestion). */
export function deviceTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** UTC offset label of a time zone at a local date/time, e.g. "GMT+5". */
export function timeZoneOffsetLabel(timeZone: string, at: LocalDateTime | undefined = undefined): string {
  const instant = at === undefined ? Date.now() : localDateTimeToEpochMs(at);
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(instant)
    .find((item) => item.type === "timeZoneName");
  return part?.value ?? "";
}
