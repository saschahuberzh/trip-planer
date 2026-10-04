"use client";

import { useMemo, useState, type FormEvent } from "react";
import { deviceTimeZone } from "@/lib/domain/dateTime";
import { BOOKING_TYPES, type Booking, type Transport } from "@/lib/domain/types";
import {
  applyLink,
  bookingToFormValues,
  emptyBookingFormValues,
  validateBookingForm,
  type BookingFormErrors,
  type BookingFormValues,
} from "@/lib/services/bookingForm";
import { getBookingService } from "@/lib/services/bookingService";
import type { Itinerary } from "@/lib/services/itineraryService";
import { defaultTimeZone } from "@/lib/services/transportForm";
import { Button } from "@/components/ui/Button";
import { ConfirmBody } from "@/components/ui/ConfirmBody";
import { TrashIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { LocalDateTimeFields } from "@/components/forms/LocalDateTimeFields";
import { PriceField } from "@/components/forms/PriceField";
import { Field, inputClass } from "@/components/trips/formFields";
import { BOOKING_TYPE_LABELS, BOOKING_TYPE_SYMBOLS, bookingLinkOptions, linkKey } from "./bookingDisplay";

export type BookingSheetTarget = { mode: "create" } | { mode: "edit"; booking: Booking };

type BookingSheetProps = {
  itinerary: Itinerary;
  bookings: readonly Booking[];
  target: BookingSheetTarget | null;
  onClose: () => void;
};

export function BookingSheet({ target, onClose, ...props }: BookingSheetProps) {
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const close = () => {
    setDeleting(false);
    onClose();
  };
  const title = deleting ? "Delete booking?" : target?.mode === "edit" ? "Edit booking" : "New booking";
  return (
    <Sheet open={target !== null} onClose={close} title={title} dismissible={!busy}>
      {target !== null &&
        (deleting && target.mode === "edit" ? (
          <DeleteBooking booking={target.booking} onBusyChange={setBusy} onCancel={() => setDeleting(false)} onDeleted={close} />
        ) : (
          <BookingForm {...props} target={target} onBusyChange={setBusy} onDone={close} onDelete={() => setDeleting(true)} />
        ))}
    </Sheet>
  );
}

type BookingFormProps = Omit<BookingSheetProps, "target" | "onClose"> & {
  target: BookingSheetTarget;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
  onDelete: () => void;
};

function BookingForm({ itinerary, bookings, target, onBusyChange, onDone, onDelete }: BookingFormProps) {
  const { trip } = itinerary;
  const options = useMemo(() => bookingLinkOptions(itinerary), [itinerary]);
  const transports = useMemo(
    () => options.flatMap((option): Transport[] => (option.entity.type === "transport" ? [option.entity.item] : [])),
    [options],
  );
  const zone = useMemo(() => {
    const fromBookings = bookings.find((booking) => booking.dateTime)?.dateTime?.timeZone;
    return defaultTimeZone(transports, fromBookings ?? deviceTimeZone());
  }, [bookings, transports]);
  const [values, setValues] = useState<BookingFormValues>(() =>
    target.mode === "edit"
      ? bookingToFormValues(target.booking, zone, trip.baseCurrency)
      : emptyBookingFormValues(zone, trip.baseCurrency),
  );
  const [typeTouched, setTypeTouched] = useState(target.mode === "edit");
  const [errors, setErrors] = useState<BookingFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof BookingFormValues>(key: K, value: BookingFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (key in current ? { ...current, [key]: undefined } : current));
  };

  const currentKey = values.link ? linkKey(values.link.type, values.link.id) : "";
  const linkMissing = values.link !== undefined && !options.some((option) => option.key === currentKey);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    // A linked entry deleted meanwhile is dropped instead of blocking the save.
    const result = validateBookingForm(linkMissing ? { ...values, link: undefined } : values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    onBusyChange(true);
    try {
      const service = getBookingService();
      if (target.mode === "create") await service.createBooking(trip.id, result.input);
      else await service.updateBooking(target.booking.id, result.input);
      onDone();
    } catch (error) {
      console.error("Failed to save booking", error);
      setSaveError("The booking couldn't be saved. Your existing data has not been changed.");
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  const groups = [
    { label: "Transport", type: "transport" },
    { label: "Accommodation", type: "accommodation" },
    { label: "Activities", type: "activity" },
  ] as const;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Field label="For (optional)" hint="Linking fills in empty fields from the entry.">
        {(props) => (
          <select
            {...props}
            value={linkMissing ? "" : currentKey}
            onChange={(event) => {
              const option = options.find((candidate) => candidate.key === event.target.value);
              setValues((current) => applyLink(current, option?.entity, typeTouched));
              setErrors({});
            }}
            className={inputClass}
          >
            <option value="">Nothing linked</option>
            {groups.map((group) => {
              const items = options.filter((option) => option.type === group.type);
              return items.length === 0 ? null : (
                <optgroup key={group.type} label={group.label}>
                  {items.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        )}
      </Field>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-slate-700">Type</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {BOOKING_TYPES.map((type) => (
            <label
              key={type}
              className="flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl bg-slate-50 px-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 has-checked:bg-teal-50 has-checked:text-teal-900 has-checked:ring-2 has-checked:ring-teal-600"
            >
              <input
                type="radio"
                name="booking-type"
                value={type}
                checked={values.type === type}
                onChange={() => {
                  setTypeTouched(true);
                  set("type", type);
                }}
                className="sr-only"
              />
              <span aria-hidden="true" className="text-lg leading-6">
                {BOOKING_TYPE_SYMBOLS[type]}
              </span>
              <span className="max-w-full truncate">{type === "accommodation" ? "Stay" : BOOKING_TYPE_LABELS[type]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Title" error={errors.title}>
        {(props) => (
          <input
            {...props}
            value={values.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder="e.g. Afrosiyob train tickets"
            autoComplete="off"
            className={inputClass}
          />
        )}
      </Field>

      <LocalDateTimeFields
        label="Date & time"
        fallbackDate={trip.startDate}
        value={values.dateTime}
        error={errors.dateTime}
        suggestedZones={[zone]}
        onChange={(dateTime) => set("dateTime", dateTime)}
      />

      <PriceField
        amount={values.price}
        currency={values.currency}
        error={errors.price}
        onAmountChange={(price) => set("price", price)}
        onCurrencyChange={(currency) => set("currency", currency)}
      />

      <Field label="Booking reference (optional)" error={errors.bookingReference}>
        {(props) => (
          <input
            {...props}
            value={values.bookingReference}
            onChange={(event) => set("bookingReference", event.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            className={inputClass}
          />
        )}
      </Field>

      <Field label="Link (optional)" error={errors.url}>
        {(props) => (
          <input
            {...props}
            value={values.url}
            onChange={(event) => set("url", event.target.value)}
            inputMode="url"
            autoCapitalize="none"
            autoComplete="off"
            placeholder="Confirmation or ticket page"
            className={inputClass}
          />
        )}
      </Field>

      <Field label="Notes (optional)">
        {(props) => (
          <textarea
            {...props}
            value={values.notes}
            onChange={(event) => set("notes", event.target.value)}
            rows={2}
            placeholder="Seats, PIN for e-ticket, what to show…"
            className={inputClass}
          />
        )}
      </Field>

      {saveError && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {saveError}
        </p>
      )}

      <div className="space-y-3 pb-[env(safe-area-inset-bottom)]">
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onDone} disabled={saving} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="flex-[2]">
            {saving ? "Saving…" : target.mode === "create" ? "Add booking" : "Save changes"}
          </Button>
        </div>
        {target.mode === "edit" && (
          <Button variant="ghost" onClick={onDelete} disabled={saving} className="w-full text-red-600">
            <TrashIcon />
            Delete booking
          </Button>
        )}
      </div>
    </form>
  );
}

function DeleteBooking({
  booking,
  onBusyChange,
  onCancel,
  onDeleted,
}: {
  booking: Booking;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      await getBookingService().deleteBooking(booking.id);
      onDeleted();
    } catch (caught) {
      console.error("Failed to delete booking", caught);
      setError("The booking couldn't be deleted. Nothing was removed.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <ConfirmBody
      error={error}
      busy={busy}
      cancelLabel="Keep"
      confirmLabel={busy ? "Deleting…" : "Delete"}
      danger
      onCancel={onCancel}
      onConfirm={() => void confirm()}
    >
      <strong className="text-slate-900">{booking.title}</strong> will be permanently deleted from this device. The linked
      entry and any expenses stay. This can&apos;t be undone.
    </ConfirmBody>
  );
}
