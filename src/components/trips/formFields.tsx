"use client";

import { useId, useMemo, type ReactNode } from "react";
import { CURRENCY_CODES } from "@/lib/domain/currency";
import { TRIP_STATUSES, type TripStatus } from "@/lib/domain/types";
import { addCountries } from "@/lib/services/tripForm";
import { CloseIcon } from "@/components/ui/icons";
import { TRIP_STATUS_LABELS, currencyName } from "./tripDisplay";

export const inputClass =
  "block min-h-11 w-full rounded-xl border-0 bg-slate-50 px-3 py-2 text-base text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-600 focus:outline-none aria-[invalid=true]:ring-red-400";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
};

/** Label, control, hint and error message with matching accessibility attributes. */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children({ id, "aria-invalid": error !== undefined, "aria-describedby": message ? messageId : undefined })}
      {message && (
        <p id={messageId} className={`text-sm ${error ? "text-red-600" : "text-slate-500"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

type CountriesFieldProps = {
  countries: string[];
  onChange: (countries: string[]) => void;
  /** Text typed but not yet added; added automatically on save. */
  draft: string;
  onDraftChange: (draft: string) => void;
};

export function CountriesField({ countries, onChange, draft, onDraftChange }: CountriesFieldProps) {
  const commit = () => {
    if (draft.trim() === "") return;
    onChange(addCountries(countries, draft));
    onDraftChange("");
  };

  return (
    <Field label="Countries" hint="Add as many as you like. Separate several with commas.">
      {(props) => (
        <div className="space-y-2">
          {countries.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Selected countries">
              {countries.map((country) => (
                <li
                  key={country}
                  className="flex items-center gap-1 rounded-full bg-teal-50 py-1 pr-1 pl-3 text-sm font-medium text-teal-900 ring-1 ring-teal-200"
                >
                  {country}
                  <button
                    type="button"
                    onClick={() => onChange(countries.filter((item) => item !== country))}
                    aria-label={`Remove ${country}`}
                    className="flex size-8 items-center justify-center rounded-full hover:bg-teal-100"
                  >
                    <CloseIcon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              {...props}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit();
                }
              }}
              onBlur={commit}
              placeholder={countries.length === 0 ? "e.g. Uzbekistan" : "Add another country"}
              autoComplete="country-name"
              enterKeyHint="done"
              className={inputClass}
            />
            <button
              type="button"
              onClick={commit}
              disabled={draft.trim() === ""}
              className="min-h-11 shrink-0 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-800 disabled:text-slate-400"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </Field>
  );
}

export function StatusField({ value, onChange }: { value: TripStatus; onChange: (status: TripStatus) => void }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-slate-700">Status</legend>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
        {TRIP_STATUSES.map((status) => (
          <label
            key={status}
            className="flex min-h-10 cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-slate-600 has-checked:bg-white has-checked:text-slate-900 has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-teal-600"
          >
            <input
              type="radio"
              name="trip-status"
              value={status}
              checked={value === status}
              onChange={() => onChange(status)}
              className="sr-only"
            />
            {TRIP_STATUS_LABELS[status]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CurrencySelect(props: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
  /** Needed when the select has no own <label> (e.g. next to an amount). */
  "aria-label"?: string;
}) {
  const { value, onChange, ...rest } = props;
  const options = useMemo(
    () =>
      CURRENCY_CODES.map((code) => ({ code, label: `${code} – ${currencyName(code)}` })),
    [],
  );
  return (
    <select {...rest} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
      {options.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
