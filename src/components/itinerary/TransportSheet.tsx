"use client";

import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { deviceTimeZone, durationMinutes, formatDurationMinutes, isCalendarDate } from "@/lib/domain/dateTime";
import { TRANSPORT_TYPES, type Place, type Transport } from "@/lib/domain/types";
import { UNPLANNED_VALUE } from "@/lib/services/itineraryForms";
import { getItineraryService, type DayTimeline, type Itinerary } from "@/lib/services/itineraryService";
import {
  defaultTimeZone,
  emptyTransportFormValues,
  transportToFormValues,
  validateTransportForm,
  type LocalDateTimeValues,
  type TransportEndValue,
  type TransportFormErrors,
  type TransportFormValues,
} from "@/lib/services/transportForm";
import { Button } from "@/components/ui/Button";
import { CloseIcon, MapPinIcon, TrashIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { CurrencySelect, Field, inputClass } from "@/components/trips/formFields";
import { PlacePickerSheet } from "@/components/places/PlacePickerSheet";
import { dayOptionLabel } from "./itineraryDisplay";
import { TimeZoneSelect } from "./TimeZoneSelect";
import { TRANSPORT_SYMBOLS, TRANSPORT_TYPE_LABELS } from "./transportDisplay";

export type TransportSheetTarget =
  | { mode: "create"; tripDayId: string | undefined }
  | { mode: "edit"; transport: Transport };

type TransportSheetProps = {
  itinerary: Itinerary;
  target: TransportSheetTarget | null;
  onClose: () => void;
};

type Step =
  | { name: "form" }
  | { name: "delete" }
  | { name: "suggest"; tripDayId: string; placeIds: string[] };

/** Create/edit/delete a transport; afterwards optionally set the day's places (SCREENS.md 5a). */
export function TransportSheet({ itinerary, target, onClose }: TransportSheetProps) {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>({ name: "form" });
  const close = () => {
    setStep({ name: "form" });
    onClose();
  };
  const title =
    step.name === "suggest"
      ? "Places of the day"
      : step.name === "delete"
        ? "Delete transport?"
        : target?.mode === "edit"
          ? "Edit transport"
          : "New transport";

  return (
    <Sheet open={target !== null} onClose={close} title={title} dismissible={!busy}>
      {target !== null && step.name === "form" && (
        <TransportForm
          itinerary={itinerary}
          target={target}
          onBusyChange={setBusy}
          onSaved={(suggestion) => (suggestion ? setStep({ name: "suggest", ...suggestion }) : close())}
          onCancel={close}
          onDelete={() => setStep({ name: "delete" })}
        />
      )}
      {target?.mode === "edit" && step.name === "delete" && (
        <DeleteTransport transport={target.transport} onBusyChange={setBusy} onCancel={() => setStep({ name: "form" })} onDeleted={close} />
      )}
      {step.name === "suggest" && (
        <SuggestDayPlaces itinerary={itinerary} tripDayId={step.tripDayId} placeIds={step.placeIds} onBusyChange={setBusy} onDone={close} />
      )}
    </Sheet>
  );
}

type TransportFormProps = {
  itinerary: Itinerary;
  target: TransportSheetTarget;
  onBusyChange: (busy: boolean) => void;
  onSaved: (suggestion: { tripDayId: string; placeIds: string[] } | undefined) => void;
  onCancel: () => void;
  onDelete: () => void;
};

function allTransports(itinerary: Itinerary): Transport[] {
  return [...itinerary.days, ...itinerary.outsideDays]
    .flatMap((timeline) => timeline.entries)
    .concat(itinerary.unplanned)
    .flatMap((entry) => (entry.kind === "transport" ? [entry.item] : []));
}

function TransportForm({ itinerary, target, onBusyChange, onSaved, onCancel, onDelete }: TransportFormProps) {
  const { trip, days, outsideDays, places } = itinerary;
  const transports = useMemo(() => allTransports(itinerary), [itinerary]);
  const device = useMemo(() => deviceTimeZone(), []);
  const suggestedZones = useMemo(
    () => [
      ...new Set(transports.flatMap((t) => [t.departure?.timeZone, t.arrival?.timeZone]).filter((z): z is string => z !== undefined)),
      device,
    ],
    [transports, device],
  );
  const [values, setValues] = useState<TransportFormValues>(() => {
    const zone = defaultTimeZone(transports, device);
    if (target.mode === "edit") return transportToFormValues(target.transport, zone);
    return { ...emptyTransportFormValues(target.tripDayId, zone), currency: trip.baseCurrency };
  });
  const [errors, setErrors] = useState<TransportFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDuration, setShowDuration] = useState(values.duration !== "");

  const currentDayId = target.mode === "edit" ? target.transport.tripDayId : undefined;
  const dayChoices = [...days, ...outsideDays.filter((timeline) => timeline.day.id === currentDayId)];

  const set = <K extends keyof TransportFormValues>(key: K, value: TransportFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (key in current ? { ...current, [key]: undefined } : current));
  };

  const setDeparture = (departure: LocalDateTimeValues) => {
    setValues((current) => {
      const next = { ...current, departure };
      // Preselect the day of the departure date when the date changes.
      if (departure.date !== current.departure.date) {
        const day = dayChoices.find((timeline) => timeline.day.date === departure.date);
        if (day) next.tripDayId = day.day.id;
        // Arrival usually on the same date; suggest it while it's empty.
        if (current.arrival.date === "") next.arrival = { ...current.arrival, date: departure.date };
      }
      return next;
    });
    setErrors((current) => ({ ...current, departure: undefined, arrival: undefined }));
  };

  // Offsets in the time zone lists are shown for this date until a date is entered.
  const referenceDate =
    dayChoices.find((timeline) => timeline.day.id === values.tripDayId)?.day.date ?? trip.startDate;

  const parsed = validateTransportForm(values);
  const calculated =
    parsed.ok && parsed.input.departure && parsed.input.arrival
      ? durationMinutes(parsed.input.departure, parsed.input.arrival)
      : undefined;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    // A place deleted meanwhile is dropped instead of blocking the save.
    const checked = {
      ...values,
      origin: values.origin.placeId !== undefined && !places.has(values.origin.placeId) ? { placeId: undefined, text: "" } : values.origin,
      destination:
        values.destination.placeId !== undefined && !places.has(values.destination.placeId)
          ? { placeId: undefined, text: "" }
          : values.destination,
    };
    const result = validateTransportForm(checked);
    if (!result.ok) {
      setErrors(result.errors);
      if (result.errors.duration) setShowDuration(true);
      return;
    }
    setSaving(true);
    onBusyChange(true);
    try {
      const service = getItineraryService();
      const saved =
        target.mode === "create"
          ? await service.createTransport(trip.id, result.tripDayId, result.input)
          : await service.updateTransport(target.transport.id, result.input, result.tripDayId);
      const { tripDayId } = saved.transport;
      onSaved(
        saved.suggestedDayPlaces && tripDayId !== undefined
          ? { tripDayId, placeIds: saved.suggestedDayPlaces }
          : undefined,
      );
    } catch (error) {
      console.error("Failed to save transport", error);
      setSaveError("The transport couldn't be saved. Your existing data has not been changed.");
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-slate-700">Type</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {TRANSPORT_TYPES.map((type) => (
            <label
              key={type}
              className="flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl bg-slate-50 text-xs font-medium text-slate-600 ring-1 ring-slate-200 has-checked:bg-teal-50 has-checked:text-teal-900 has-checked:ring-2 has-checked:ring-teal-600"
            >
              <input
                type="radio"
                name="transport-type"
                value={type}
                checked={values.type === type}
                onChange={() => set("type", type)}
                className="sr-only"
              />
              <span aria-hidden="true" className="text-lg leading-6">
                {TRANSPORT_SYMBOLS[type]}
              </span>
              {TRANSPORT_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
      </fieldset>

      <EndField
        label="From"
        tripId={trip.id}
        places={places}
        value={values.origin}
        error={errors.origin}
        onChange={(origin) => set("origin", origin)}
      />
      <div className="-my-3 flex justify-center">
        <button
          type="button"
          onClick={() => setValues((current) => ({ ...current, origin: current.destination, destination: current.origin }))}
          className="min-h-9 rounded-full px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50"
        >
          ⇅ Swap
        </button>
      </div>
      <EndField
        label="To"
        tripId={trip.id}
        places={places}
        value={values.destination}
        error={errors.destination}
        onChange={(destination) => set("destination", destination)}
      />

      <DateTimeFields
        label="Departure"
        fallbackDate={referenceDate}
        value={values.departure}
        error={errors.departure}
        suggestedZones={suggestedZones}
        onChange={setDeparture}
      />
      <DateTimeFields
        label="Arrival"
        fallbackDate={values.departure.date || referenceDate}
        value={values.arrival}
        error={errors.arrival}
        suggestedZones={[values.departure.timeZone, ...suggestedZones]}
        onChange={(arrival) => set("arrival", arrival)}
      />
      <p className="-mt-3 text-sm text-slate-500">Local times as on the ticket. Time zones matter for flights.</p>

      <div className="space-y-1.5">
        <p className="text-sm text-slate-700">
          Duration:{" "}
          <strong>
            {parsed.ok && parsed.input.durationMinutes !== undefined
              ? `${formatDurationMinutes(parsed.input.durationMinutes)} (entered)`
              : calculated !== undefined
                ? formatDurationMinutes(calculated)
                : "—"}
          </strong>
        </p>
        {showDuration ? (
          <Field
            label="Duration (optional)"
            error={errors.duration}
            hint="Only when exact times are unknown. Overrides the calculated duration."
          >
            {(props) => (
              <input
                {...props}
                value={values.duration}
                onChange={(event) => set("duration", event.target.value)}
                placeholder="e.g. 2:30"
                autoComplete="off"
                className={inputClass}
              />
            )}
          </Field>
        ) : (
          <button type="button" onClick={() => setShowDuration(true)} className="min-h-11 text-sm font-semibold text-teal-700">
            Enter duration manually
          </button>
        )}
      </div>

      <Field label="Day">
        {(props) => (
          <select {...props} value={values.tripDayId} onChange={(event) => set("tripDayId", event.target.value)} className={inputClass}>
            {dayChoices.map((timeline: DayTimeline) => (
              <option key={timeline.day.id} value={timeline.day.id}>
                {dayOptionLabel(timeline, places)}
              </option>
            ))}
            <option value={UNPLANNED_VALUE}>Unplanned</option>
          </select>
        )}
      </Field>

      <Field label="Price (optional)" error={errors.price} hint="For your information only; not counted in the budget.">
        {(props) => (
          <div className="flex gap-2">
            <input
              {...props}
              value={values.price}
              onChange={(event) => set("price", event.target.value)}
              inputMode="decimal"
              placeholder="e.g. 25"
              autoComplete="off"
              className={`${inputClass} flex-1`}
            />
            <div className="w-28 shrink-0">
              <CurrencySelect
                id={`${props.id}-currency`}
                aria-invalid={false}
                value={values.currency}
                onChange={(currency) => set("currency", currency)}
              />
            </div>
          </div>
        )}
      </Field>

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

      <Field label="Notes (optional)">
        {(props) => (
          <textarea
            {...props}
            value={values.notes}
            onChange={(event) => set("notes", event.target.value)}
            rows={2}
            placeholder="Seat, platform, terminal…"
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
          <Button variant="secondary" onClick={onCancel} disabled={saving} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="flex-[2]">
            {saving ? "Saving…" : target.mode === "create" ? "Add transport" : "Save changes"}
          </Button>
        </div>
        {target.mode === "edit" && (
          <Button variant="ghost" onClick={onDelete} disabled={saving} className="w-full text-red-600">
            <TrashIcon />
            Delete transport
          </Button>
        )}
      </div>
    </form>
  );
}

function EndField({
  label,
  tripId,
  places,
  value,
  error,
  onChange,
}: {
  label: string;
  tripId: string;
  places: ReadonlyMap<string, Place>;
  value: TransportEndValue;
  error?: string;
  onChange: (value: TransportEndValue) => void;
}) {
  const [picking, setPicking] = useState(false);
  const place = value.placeId === undefined ? undefined : places.get(value.placeId);
  return (
    <Field label={label} error={error}>
      {(props) => (
        <div>
          {place ? (
            <div className="flex items-center gap-2 rounded-xl bg-teal-50 py-1 pr-1 pl-3 ring-1 ring-teal-200">
              <MapPinIcon className="size-5 shrink-0 text-teal-700" />
              <span id={props.id} className="min-w-0 flex-1 truncate font-medium text-slate-900">
                {place.name}
              </span>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="min-h-11 rounded-lg px-3 text-sm font-semibold text-teal-800 hover:bg-teal-100"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => onChange({ placeId: undefined, text: "" })}
                aria-label={`Remove ${label.toLowerCase()} place`}
                className="flex size-11 items-center justify-center rounded-lg text-slate-500 hover:bg-teal-100"
              >
                <CloseIcon className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                {...props}
                value={value.text}
                onChange={(event) => onChange({ placeId: undefined, text: event.target.value })}
                placeholder="Place or text, e.g. Bus station North"
                autoComplete="off"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setPicking(true)}
                aria-label={`Choose ${label.toLowerCase()} place`}
                className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-teal-700"
              >
                <MapPinIcon className="size-4" />
                Place
              </button>
            </div>
          )}
          <PlacePickerSheet
            open={picking}
            title={label === "From" ? "From where?" : "To where?"}
            tripId={tripId}
            places={[...places.values()]}
            onPick={(picked) => onChange({ placeId: picked.id, text: "" })}
            onClose={() => setPicking(false)}
          />
        </div>
      )}
    </Field>
  );
}

function DateTimeFields({
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

function DeleteTransport({
  transport,
  onBusyChange,
  onCancel,
  onDeleted,
}: {
  transport: Transport;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setDeleting(true);
    onBusyChange(true);
    setError(null);
    try {
      await getItineraryService().deleteTransport(transport.id);
      onDeleted();
    } catch (caught) {
      console.error("Failed to delete transport", caught);
      setError("The transport couldn't be deleted. Nothing was removed.");
    } finally {
      setDeleting(false);
      onBusyChange(false);
    }
  }

  return (
    <ConfirmBody
      error={error}
      busy={deleting}
      cancelLabel="Keep"
      confirmLabel={deleting ? "Deleting…" : "Delete"}
      danger
      onCancel={onCancel}
      onConfirm={() => void confirm()}
    >
      This {TRANSPORT_TYPE_LABELS[transport.type].toLowerCase()} will be permanently deleted from this device. Bookings
      and expenses linked to it are kept without the link. This can&apos;t be undone.
    </ConfirmBody>
  );
}

function SuggestDayPlaces({
  itinerary,
  tripDayId,
  placeIds,
  onBusyChange,
  onDone,
}: {
  itinerary: Itinerary;
  tripDayId: string;
  placeIds: string[];
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = placeIds.map((id) => itinerary.places.get(id)?.name ?? "?").join(" → ");
  const timeline = [...itinerary.days, ...itinerary.outsideDays].find((candidate) => candidate.day.id === tripDayId);

  async function apply() {
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      await getItineraryService().setDayPlaces(tripDayId, placeIds);
      onDone();
    } catch (caught) {
      console.error("Failed to set places of the day", caught);
      setError("The places of the day couldn't be set. Nothing was changed.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <ConfirmBody error={error} busy={busy} cancelLabel="No" confirmLabel="Yes, set them" onCancel={onDone} onConfirm={() => void apply()}>
      Saved. Set the places of the day for{" "}
      <strong className="text-slate-900">{timeline ? dayOptionLabel(timeline, itinerary.places) : "this day"}</strong> to{" "}
      <strong className="text-slate-900">{names}</strong>? They form your route on the map.
    </ConfirmBody>
  );
}

function ConfirmBody({
  children,
  error,
  busy,
  cancelLabel,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  children: ReactNode;
  error: string | null;
  busy: boolean;
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-4 pb-[env(safe-area-inset-bottom)] text-slate-700">
      <p>{children}</p>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={busy} className="flex-1">
          {cancelLabel}
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy} className="flex-1">
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
