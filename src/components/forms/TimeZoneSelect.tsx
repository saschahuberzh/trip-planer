"use client";

import { useState } from "react";
import { timeZoneOffsetLabel } from "@/lib/domain/dateTime";
import { availableCommonTimeZones, timeZoneCities } from "@/lib/domain/timeZones";
import { inputClass } from "@/components/trips/formFields";

const MORE = "__more__";

const labels = new Map<string, { text: string; offset: number }>();

/** "GMT+5 · Tashkent, Samarkand, Almaty, Karachi", with the offset on `date` (YYYY-MM-DD). */
function describe(timeZone: string, date: string): { text: string; offset: number } {
  const key = `${timeZone}|${date}`;
  let entry = labels.get(key);
  if (entry === undefined) {
    const gmt = timeZoneOffsetLabel(timeZone, { local: `${date}T12:00`, timeZone }) || "GMT";
    const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(gmt);
    const offset = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) : 0;
    entry = { text: `${gmt} · ${timeZoneCities(timeZone)}`, offset };
    labels.set(key, entry);
  }
  return entry;
}

let allZones: string[] | null = null;

type TimeZoneSelectProps = {
  id?: string;
  value: string;
  onChange: (timeZone: string) => void;
  /** Shown first: zones used in this trip and the device's. */
  suggested: readonly string[];
  /** Date (YYYY-MM-DD) for which offsets are shown, e.g. the departure date (daylight saving). */
  date: string;
  "aria-label"?: string;
};

/**
 * Time zone picker: zones used in the trip first, then one zone per UTC offset and
 * daylight-saving rule. "More time zones…" switches to the full IANA list.
 */
export function TimeZoneSelect({ id, value, onChange, suggested, date, ...rest }: TimeZoneSelectProps) {
  const [showAll, setShowAll] = useState(false);
  const byOffset = (a: string, b: string) => describe(a, date).offset - describe(b, date).offset;
  const top = [...new Set([value, ...suggested].filter((zone) => zone !== ""))];
  let others: string[];
  if (showAll) {
    allZones ??= Intl.supportedValuesOf("timeZone");
    others = allZones.filter((zone) => !top.includes(zone)).sort(byOffset);
  } else {
    others = availableCommonTimeZones()
      .map((entry) => entry.timeZone)
      .filter((zone) => !top.includes(zone))
      .sort(byOffset);
  }

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => {
        if (event.target.value === MORE) setShowAll(true);
        else onChange(event.target.value);
      }}
      className={inputClass}
      {...rest}
    >
      <optgroup label="Suggested">
        {top.map((zone) => (
          <option key={zone} value={zone}>
            {describe(zone, date).text}
          </option>
        ))}
      </optgroup>
      <optgroup label={showAll ? "All time zones" : "Other regions"}>
        {others.map((zone) => (
          <option key={zone} value={zone}>
            {describe(zone, date).text}
          </option>
        ))}
      </optgroup>
      {!showAll && <option value={MORE}>More time zones…</option>}
    </select>
  );
}
