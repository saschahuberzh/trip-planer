"use client";

import { useId } from "react";
import { isCalendarDate } from "@/lib/domain/dateTime";
import type { LocalDateTimeValues } from "@/lib/services/transportForm";
import { inputClass } from "@/components/trips/formFields";
import { TimeZoneSelect } from "./TimeZoneSelect";

/** Optional local date, time and time zone (as on a ticket). */
export function LocalDateTimeFields({
  label,
  fallbackDate,
  value,
  error,
  suggestedZones,
  onChange,
}: {
  label: string;
  /** Date for the time zone offsets while no date is entered. */
  fallbackDate: string;
  value: LocalDateTimeValues;
  error?: string;
  suggestedZones: readonly string[];
  onChange: (value: LocalDateTimeValues) => void;
}) {
  const id = useId();
  const hasValue = value.date !== "" || value.time !== "";
  return (
    <fieldset className="space-y-1.5" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="flex w-full items-center justify-between text-sm font-medium text-slate-700">
        {label} (optional)
        {hasValue && (
          <button
            type="button"
            onClick={() => onChange({ ...value, date: "", time: "" })}
            className="min-h-9 px-2 text-sm font-semibold text-slate-500"
          >
            Clear
          </button>
        )}
      </legend>
      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <input
          type="date"
          aria-label={`${label} date`}
          aria-invalid={error !== undefined}
          value={value.date}
          onChange={(event) => onChange({ ...value, date: event.target.value })}
          className={inputClass}
        />
        <input
          type="time"
          aria-label={`${label} time`}
          aria-invalid={error !== undefined}
          value={value.time}
          onChange={(event) => onChange({ ...value, time: event.target.value })}
          className={inputClass}
        />
      </div>
      <TimeZoneSelect
        aria-label={`${label} time zone`}
        value={value.timeZone}
        suggested={suggestedZones}
        date={isCalendarDate(value.date) ? value.date : fallbackDate}
        onChange={(timeZone) => onChange({ ...value, timeZone })}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}
