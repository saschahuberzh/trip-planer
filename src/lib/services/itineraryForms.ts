/**
 * Activity and day-details forms: raw input values, validation and conversion
 * to service input. Kept free of React so it can be tested directly.
 */
import { isWallClockTime } from "@/lib/domain/dateTime";
import type { Activity, TripDay } from "@/lib/domain/types";
import type { ActivityInput, TripDayDetailsInput } from "./itineraryService";

export const MAX_ACTIVITY_TITLE_LENGTH = 120;
export const MAX_DAY_TITLE_LENGTH = 120;

/** Form value of the day select for the Unplanned section. */
export const UNPLANNED_VALUE = "";

export interface ActivityFormValues {
  title: string;
  /** "HH:mm" or empty. */
  startTime: string;
  endTime: string;
  notes: string;
  /** TripDay ID, or UNPLANNED_VALUE. */
  tripDayId: string;
  /** Linked place ID, or undefined for none. */
  placeId: string | undefined;
}

export type ActivityFormErrors = Partial<Record<keyof ActivityFormValues, string>>;

export type ActivityFormResult =
  | { ok: true; input: ActivityInput; tripDayId: string | undefined }
  | { ok: false; errors: ActivityFormErrors };

export function emptyActivityFormValues(tripDayId: string | undefined): ActivityFormValues {
  return { title: "", startTime: "", endTime: "", notes: "", tripDayId: tripDayId ?? UNPLANNED_VALUE, placeId: undefined };
}

export function activityToFormValues(activity: Activity): ActivityFormValues {
  return {
    title: activity.title,
    startTime: activity.startTime ?? "",
    endTime: activity.endTime ?? "",
    notes: activity.notes ?? "",
    tripDayId: activity.tripDayId ?? UNPLANNED_VALUE,
    placeId: activity.placeId,
  };
}

/** Trimmed text, or undefined when empty (so optional fields are cleared). */
export function optionalText(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Normalizes a time input value: some browsers report seconds ("09:30:00").
 * Returns "" for empty input and null for anything that is not a valid time.
 */
export function normalizeTimeInput(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  const time = /^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmed) ? trimmed.slice(0, 5) : trimmed;
  return isWallClockTime(time) ? time : null;
}

export function validateActivityForm(values: ActivityFormValues): ActivityFormResult {
  const errors: ActivityFormErrors = {};

  const title = values.title.trim();
  if (title === "") errors.title = "Give the activity a title or choose a place.";
  else if (title.length > MAX_ACTIVITY_TITLE_LENGTH) {
    errors.title = `Use at most ${MAX_ACTIVITY_TITLE_LENGTH} characters.`;
  }

  const startTime = normalizeTimeInput(values.startTime);
  const endTime = normalizeTimeInput(values.endTime);
  if (startTime === null) errors.startTime = "Enter a time like 09:30.";
  if (endTime === null) errors.endTime = "Enter a time like 17:00.";
  else if (endTime !== "" && startTime === "") errors.endTime = "Add a start time as well.";

  if (Object.keys(errors).length > 0 || startTime === null || endTime === null) return { ok: false, errors };
  return {
    ok: true,
    input: {
      title,
      startTime: startTime === "" ? undefined : startTime,
      endTime: endTime === "" ? undefined : endTime,
      notes: optionalText(values.notes),
      placeId: values.placeId,
    },
    tripDayId: values.tripDayId === UNPLANNED_VALUE ? undefined : values.tripDayId,
  };
}

export interface DayDetailsFormValues {
  title: string;
  notes: string;
}

export type DayDetailsFormResult =
  | { ok: true; input: TripDayDetailsInput }
  | { ok: false; errors: Partial<Record<keyof DayDetailsFormValues, string>> };

export function dayToFormValues(day: TripDay): DayDetailsFormValues {
  return { title: day.title ?? "", notes: day.notes ?? "" };
}

export function validateDayDetailsForm(values: DayDetailsFormValues): DayDetailsFormResult {
  const title = optionalText(values.title);
  if (title !== undefined && title.length > MAX_DAY_TITLE_LENGTH) {
    return { ok: false, errors: { title: `Use at most ${MAX_DAY_TITLE_LENGTH} characters.` } };
  }
  return { ok: true, input: { title, notes: optionalText(values.notes) } };
}
