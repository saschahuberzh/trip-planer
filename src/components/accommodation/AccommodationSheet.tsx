"use client";

import { useState, type FormEvent } from "react";
import { addDays } from "@/lib/domain/dateTime";
import type { Accommodation, Place } from "@/lib/domain/types";
import {
  accommodationToFormValues,
  emptyAccommodationFormValues,
  validateAccommodationForm,
  type AccommodationFormErrors,
  type AccommodationFormValues,
} from "@/lib/services/accommodationForm";
import { nightsOf, overlappingStays, type StayOverlap } from "@/lib/services/accommodationSchedule";
import { getAccommodationService } from "@/lib/services/accommodationService";
import { placesCenter } from "@/lib/services/placeFilters";
import { Button } from "@/components/ui/Button";
import { ConfirmBody } from "@/components/ui/ConfirmBody";
import { AlertIcon, TrashIcon } from "@/components/ui/icons";
import { formatDayDate } from "@/components/itinerary/itineraryDisplay";
import { Sheet } from "@/components/ui/Sheet";
import { PriceField } from "@/components/forms/PriceField";
import { Field, inputClass } from "@/components/trips/formFields";
import { LocationFields } from "@/components/places/LocationFields";
import { PlaceSelectField } from "@/components/places/PlaceSelectField";
import { useLiveData } from "@/lib/hooks/useLiveData";

export type AccommodationSheetTarget =
  | { mode: "create"; checkInDate: string }
  | { mode: "edit"; accommodation: Accommodation };

type AccommodationSheetProps = {
  tripId: string;
  baseCurrency: string;
  places: ReadonlyMap<string, Place>;
  /** The trip's accommodations, to warn about overlapping nights. */
  stays: readonly Accommodation[];
  target: AccommodationSheetTarget | null;
  onClose: () => void;
};

const TYPE_SUGGESTIONS = ["Hotel", "Guesthouse", "Hostel", "Apartment", "Homestay", "Yurt camp", "Night train"];

export function AccommodationSheet({ target, onClose, ...props }: AccommodationSheetProps) {
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const close = () => {
    setDeleting(false);
    onClose();
  };
  const title = deleting ? "Delete accommodation?" : target?.mode === "edit" ? "Edit accommodation" : "New accommodation";
  return (
    <Sheet open={target !== null} onClose={close} title={title} dismissible={!busy}>
      {target !== null &&
        (deleting && target.mode === "edit" ? (
          <DeleteAccommodation
            accommodation={target.accommodation}
            onBusyChange={setBusy}
            onCancel={() => setDeleting(false)}
            onDeleted={close}
          />
        ) : (
          <AccommodationForm {...props} target={target} onBusyChange={setBusy} onDone={close} onDelete={() => setDeleting(true)} />
        ))}
    </Sheet>
  );
}

type AccommodationFormProps = Omit<AccommodationSheetProps, "target" | "onClose"> & {
  target: AccommodationSheetTarget;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
  onDelete: () => void;
};

function AccommodationForm({ tripId, baseCurrency, places, stays, target, onBusyChange, onDone, onDelete }: AccommodationFormProps) {
  const [values, setValues] = useState<AccommodationFormValues>(() =>
    target.mode === "edit"
      ? accommodationToFormValues(target.accommodation, baseCurrency)
      : emptyAccommodationFormValues(target.checkInDate, addDays(target.checkInDate, 1), baseCurrency),
  );
  const [errors, setErrors] = useState<AccommodationFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A place created in the picker may not be in the live `places` map yet.
  const [pickedPlace, setPickedPlace] = useState<Place | undefined>();
  const place =
    values.placeId === undefined ? undefined : (places.get(values.placeId) ?? (pickedPlace?.id === values.placeId ? pickedPlace : undefined));

  const set = <K extends keyof AccommodationFormValues>(key: K, value: AccommodationFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (key in current ? { ...current, [key]: undefined } : current));
  };

  const valid = validateAccommodationForm(values);
  const nights = valid.ok ? nightsOf(valid.input) : undefined;
  // A warning only: two stays on one night can be deliberate (e.g. two rooms).
  const overlaps = valid.ok
    ? overlappingStays(stays, { id: target.mode === "edit" ? target.accommodation.id : undefined, ...valid.input })
    : [];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    // A place deleted meanwhile (e.g. in another tab) is dropped instead of blocking the save.
    const result = validateAccommodationForm({ ...values, placeId: place?.id });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    onBusyChange(true);
    try {
      const service = getAccommodationService();
      if (target.mode === "create") await service.createAccommodation(tripId, result.input);
      else await service.updateAccommodation(target.accommodation.id, result.input);
      onDone();
    } catch (error) {
      console.error("Failed to save accommodation", error);
      setSaveError("The accommodation couldn't be saved. Your existing data has not been changed.");
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <PlaceSelectField
        label="Place (optional, shows it on the map)"
        tripId={tripId}
        places={places}
        place={place}
        onChange={(picked) => {
          setPickedPlace(picked);
          set("placeId", picked?.id);
          if (picked !== undefined && values.name.trim() === "") set("name", picked.name);
        }}
      />

      <Field label="Name" error={errors.name}>
        {(props) => (
          <input
            {...props}
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="e.g. Hotel Uzbekistan"
            autoComplete="off"
            className={inputClass}
          />
        )}
      </Field>

      <Field label="Type (optional)" error={errors.type}>
        {(props) => (
          <>
            <input
              {...props}
              list={`${props.id}-types`}
              value={values.type}
              onChange={(event) => set("type", event.target.value)}
              placeholder="Hotel, guesthouse, yurt camp…"
              autoComplete="off"
              className={inputClass}
            />
            <datalist id={`${props.id}-types`}>
              {TYPE_SUGGESTIONS.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </>
        )}
      </Field>

      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <Field label="Check-in" error={errors.checkInDate}>
          {(props) => (
            <input
              {...props}
              type="date"
              value={values.checkInDate}
              onChange={(event) => {
                const checkInDate = event.target.value;
                setValues((current) => ({
                  ...current,
                  checkInDate,
                  // Keep the stay valid while picking: move check-out along.
                  checkOutDate:
                    checkInDate !== "" && (current.checkOutDate === "" || current.checkOutDate < checkInDate)
                      ? addDays(checkInDate, 1)
                      : current.checkOutDate,
                }));
                setErrors((current) => ({ ...current, checkInDate: undefined, checkOutDate: undefined }));
              }}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Time (opt.)" error={errors.checkInTime}>
          {(props) => (
            <input {...props} type="time" value={values.checkInTime} onChange={(event) => set("checkInTime", event.target.value)} className={inputClass} />
          )}
        </Field>
        <Field label="Check-out" error={errors.checkOutDate}>
          {(props) => (
            <input
              {...props}
              type="date"
              min={values.checkInDate || undefined}
              value={values.checkOutDate}
              onChange={(event) => set("checkOutDate", event.target.value)}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Time (opt.)" error={errors.checkOutTime}>
          {(props) => (
            <input {...props} type="time" value={values.checkOutTime} onChange={(event) => set("checkOutTime", event.target.value)} className={inputClass} />
          )}
        </Field>
      </div>
      {nights !== undefined && (
        <p className="-mt-3 text-sm text-slate-600">{nights === 0 ? "No night (day use)" : nights === 1 ? "1 night" : `${nights} nights`}</p>
      )}
      {overlaps.length > 0 && (
        <p role="status" className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
          <AlertIcon className="size-5 shrink-0 text-amber-600" />
          <span>
            Overlaps with {overlaps.map(overlapLabel).join(", ")}. You can still save it, e.g. for a second room.
          </span>
        </p>
      )}

      {place === undefined && (
        <div className="space-y-3">
          <Field label="Address (optional)">
            {(props) => (
              <input
                {...props}
                value={values.address}
                onChange={(event) => set("address", event.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            )}
          </Field>
          <LocationFields
            latitude={values.latitude}
            longitude={values.longitude}
            errors={errors}
            near={placesCenter([...places.values()])}
            onChange={(latitude, longitude) => {
              setValues((current) => ({ ...current, latitude, longitude }));
              setErrors((current) => ({ ...current, latitude: undefined, longitude: undefined }));
            }}
          />
        </div>
      )}

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

      <Field label="Booking link (optional)" error={errors.bookingUrl}>
        {(props) => (
          <input
            {...props}
            value={values.bookingUrl}
            onChange={(event) => set("bookingUrl", event.target.value)}
            inputMode="url"
            autoCapitalize="none"
            autoComplete="off"
            placeholder="booking.com/…"
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
            placeholder="Breakfast, wifi, how to get there…"
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
            {saving ? "Saving…" : target.mode === "create" ? "Add accommodation" : "Save changes"}
          </Button>
        </div>
        {target.mode === "edit" && (
          <Button variant="ghost" onClick={onDelete} disabled={saving} className="w-full text-red-600">
            <TrashIcon />
            Delete accommodation
          </Button>
        )}
      </div>
    </form>
  );
}

function DeleteAccommodation({
  accommodation,
  onBusyChange,
  onCancel,
  onDeleted,
}: {
  accommodation: Accommodation;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const links = useLiveData(
    () => getAccommodationService().getLinks(accommodation.id, accommodation.tripId),
    [accommodation.id, accommodation.tripId],
  );
  const linked = links.status === "ready" ? links.data.bookings.length + links.data.expenses.length : 0;

  async function confirm() {
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      await getAccommodationService().deleteAccommodation(accommodation.id);
      onDeleted();
    } catch (caught) {
      console.error("Failed to delete accommodation", caught);
      setError("The accommodation couldn't be deleted. Nothing was removed.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <ConfirmBody
      error={error}
      busy={busy || links.status === "loading"}
      cancelLabel="Keep"
      confirmLabel={busy ? "Deleting…" : "Delete"}
      danger
      onCancel={onCancel}
      onConfirm={() => void confirm()}
    >
      <strong className="text-slate-900">{accommodation.name}</strong> will be permanently deleted from this device.
      {linked > 0 &&
        ` ${linked === 1 ? "1 linked booking or expense is" : `${linked} linked bookings/expenses are`} kept without the link.`}{" "}
      This can&apos;t be undone.
    </ConfirmBody>
  );
}

/** e.g. "Hotel Uzbekistan (night of Sun, 13 Jun)". */
function overlapLabel({ accommodation, nights }: StayOverlap): string {
  const first = formatDayDate(nights[0]);
  const range = nights.length === 1 ? `night of ${first}` : `nights of ${first} – ${formatDayDate(nights[nights.length - 1])}`;
  return `${accommodation.name} (${range})`;
}
