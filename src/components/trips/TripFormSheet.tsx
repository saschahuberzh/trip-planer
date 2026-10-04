"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { compareCalendarDates, formatCalendarDate, isCalendarDate } from "@/lib/domain/dateTime";
import type { Trip, TripDay } from "@/lib/domain/types";
import {
  addCountries,
  emptyTripFormValues,
  tripToFormValues,
  validateTripForm,
  type TripFormErrors,
  type TripFormValues,
} from "@/lib/services/tripForm";
import { getTripService, type CoverImageChange } from "@/lib/services/tripService";
import { Button } from "@/components/ui/Button";
import { AlertIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { CoverImageField } from "./CoverImageField";
import { CountriesField, CurrencySelect, Field, StatusField, inputClass } from "./formFields";

type TripFormSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Absent: create a new trip. */
  trip?: Trip;
  /** Base currency preselected for new trips. */
  defaultBaseCurrency?: string;
  onSaved?: (trip: Trip) => void;
};

export function TripFormSheet({ open, onClose, trip, defaultBaseCurrency = "EUR", onSaved }: TripFormSheetProps) {
  const [saving, setSaving] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={trip ? "Edit trip" : "New trip"} dismissible={!saving}>
      <TripForm
        trip={trip}
        defaultBaseCurrency={defaultBaseCurrency}
        onSavingChange={setSaving}
        onSaved={(saved) => {
          onSaved?.(saved);
          onClose();
        }}
        onCancel={onClose}
      />
    </Sheet>
  );
}

type TripFormProps = {
  trip?: Trip;
  defaultBaseCurrency: string;
  onSavingChange: (saving: boolean) => void;
  onSaved: (trip: Trip) => void;
  onCancel: () => void;
};

function TripForm({ trip, defaultBaseCurrency, onSavingChange, onSaved, onCancel }: TripFormProps) {
  const [values, setValues] = useState<TripFormValues>(() =>
    trip ? tripToFormValues(trip) : emptyTripFormValues(defaultBaseCurrency),
  );
  const [countryDraft, setCountryDraft] = useState("");
  const [cover, setCover] = useState<CoverImageChange>({ type: "keep" });
  const [processingImage, setProcessingImage] = useState(false);
  const [errors, setErrors] = useState<TripFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Days with user data the user agreed to keep outside the new dates.
  const [outsideDays, setOutsideDays] = useState<TripDay[] | null>(null);
  // Base currency change the user is asked to confirm (expense conversions change).
  const [currencyChange, setCurrencyChange] = useState<CurrencyChange | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Incremented on each failed submit so the first invalid field is brought into view.
  const [invalidSubmits, setInvalidSubmits] = useState(0);
  const hasErrors = Object.values(errors).some((error) => error !== undefined);

  useEffect(() => {
    if (invalidSubmits === 0) return;
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.scrollIntoView({ block: "center", behavior: "smooth" });
    field?.focus({ preventScroll: true });
  }, [invalidSubmits]);

  const set = <K extends keyof TripFormValues>(key: K, value: TripFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] === undefined ? current : { ...current, [key]: undefined }));
    if (key === "startDate" || key === "endDate") setOutsideDays(null);
    if (key === "baseCurrency") setCurrencyChange(null);
  };

  const setStartDate = (startDate: string) => {
    set("startDate", startDate);
    // Keep the range valid while picking: move the end date along if needed.
    if (
      isCalendarDate(startDate) &&
      (!isCalendarDate(values.endDate) || compareCalendarDates(values.endDate, startDate) < 0)
    ) {
      set("endDate", startDate);
    }
  };

  const setBusy = (busy: boolean) => {
    setSaving(busy);
    onSavingChange(busy);
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    const result = validateTripForm({ ...values, countries: addCountries(values.countries, countryDraft) });
    if (!result.ok) {
      setErrors(result.errors);
      setInvalidSubmits((count) => count + 1);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const service = getTripService();
      if (!trip) {
        onSaved(await service.createTrip(result.input, cover.type === "replace" ? cover.image : undefined));
        return;
      }
      const preview = await service.previewTripChange(trip.id, result.input);
      const currencyAffects = preview.clearedConversions > 0 || preview.expensesInNewBase > 0;
      const needsCurrencyConfirmation = preview.baseCurrencyChanges && currencyAffects && currencyChange === null;
      const needsDaysConfirmation = preview.daysOutsideRange.length > 0 && outsideDays === null;
      if (needsCurrencyConfirmation || needsDaysConfirmation) {
        // Tell the user before saving; the next submit confirms.
        if (needsCurrencyConfirmation) {
          setCurrencyChange({
            from: trip.baseCurrency,
            to: result.input.baseCurrency,
            cleared: preview.clearedConversions,
            inNewBase: preview.expensesInNewBase,
          });
        }
        if (needsDaysConfirmation) setOutsideDays(preview.daysOutsideRange);
        return;
      }
      onSaved((await service.updateTrip(trip.id, result.input, cover)).trip);
    } catch (error) {
      console.error("Failed to save trip", error);
      setSaveError("The trip couldn't be saved. Your existing data has not been changed.");
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = saving
    ? "Saving…"
    : !trip
      ? "Create trip"
      : currencyChange
        ? "Change currency and save"
        : outsideDays
          ? "Keep days and save"
          : "Save changes";

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
      <Field label="Trip name" error={errors.name}>
        {(props) => (
          <input
            {...props}
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="e.g. Silk Road 2026"
            autoComplete="off"
            enterKeyHint="next"
            className={inputClass}
          />
        )}
      </Field>

      <CountriesField
        countries={values.countries}
        onChange={(countries) => set("countries", countries)}
        draft={countryDraft}
        onDraftChange={setCountryDraft}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" error={errors.startDate}>
          {(props) => (
            <input
              {...props}
              type="date"
              value={values.startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="End" error={errors.endDate}>
          {(props) => (
            <input
              {...props}
              type="date"
              value={values.endDate}
              min={values.startDate || undefined}
              onChange={(event) => set("endDate", event.target.value)}
              className={inputClass}
            />
          )}
        </Field>
      </div>

      <StatusField value={values.status} onChange={(status) => set("status", status)} />

      <Field
        label="Base currency"
        error={errors.baseCurrency}
        hint="Used for your budget and totals. You can still record costs in any currency."
      >
        {(props) => (
          <CurrencySelect {...props} value={values.baseCurrency} onChange={(code) => set("baseCurrency", code)} />
        )}
      </Field>

      <Field label="Budget (optional)" error={errors.budgetAmount}>
        {(props) => (
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-500">
              {values.baseCurrency}
            </span>
            <input
              {...props}
              value={values.budgetAmount}
              onChange={(event) => set("budgetAmount", event.target.value)}
              inputMode="decimal"
              placeholder="e.g. 3000"
              autoComplete="off"
              className={`${inputClass} pl-14`}
            />
          </div>
        )}
      </Field>

      <CoverImageField
        storedImageId={trip?.coverImageId}
        value={cover}
        onChange={setCover}
        onProcessingChange={setProcessingImage}
      />

      <Field label="Notes (optional)">
        {(props) => (
          <textarea
            {...props}
            value={values.notes}
            onChange={(event) => set("notes", event.target.value)}
            rows={3}
            placeholder="Visa, vaccinations, ideas…"
            className={inputClass}
          />
        )}
      </Field>

      {currencyChange && <CurrencyChangeWarning change={currencyChange} />}
      {outsideDays && <OutsideDaysWarning days={outsideDays} />}

      {hasErrors && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Please check the highlighted fields.
        </p>
      )}

      {saveError && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {saveError}
        </p>
      )}

      <div className="flex gap-3 pb-[env(safe-area-inset-bottom)]">
        <Button variant="secondary" onClick={onCancel} disabled={saving} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={saving || processingImage} className="flex-[2]">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

interface CurrencyChange {
  from: string;
  to: string;
  /** Converted expenses whose conversion is cleared. */
  cleared: number;
  /** Expenses already in the new base currency (rate 1). */
  inNewBase: number;
}

function CurrencyChangeWarning({ change }: { change: CurrencyChange }) {
  const { from, to, cleared, inNewBase } = change;
  return (
    <div role="alert" className="flex gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
      <AlertIcon className="size-5 shrink-0 text-amber-600" />
      <div className="space-y-1">
        <p className="font-semibold">
          Change base currency from {from} to {to}?
        </p>
        {cleared > 0 && (
          <p>
            {cleared === 1 ? "1 expense conversion refers" : `${cleared} expense conversions refer`} to {from} and will be
            cleared. Amounts in their original currency are kept; you can enter new rates to {to} later.
          </p>
        )}
        {inNewBase > 0 && (
          <p>
            {inNewBase === 1 ? "1 expense is" : `${inNewBase} expenses are`} in {to} and will be counted at rate 1.
          </p>
        )}
      </div>
    </div>
  );
}

function OutsideDaysWarning({ days }: { days: TripDay[] }) {
  const dates = days.map((day) => formatCalendarDate(day.date)).join(", ");
  return (
    <div role="alert" className="flex gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
      <AlertIcon className="size-5 shrink-0 text-amber-600" />
      <p>
        {days.length === 1 ? "1 day with plans is" : `${days.length} days with plans are`} outside the new dates (
        {dates}). {days.length === 1 ? "It" : "They"} will be kept and shown as “Outside trip dates” so nothing is
        lost.
      </p>
    </div>
  );
}
