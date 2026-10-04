"use client";

import { useState, type FormEvent } from "react";
import type { Activity, Place } from "@/lib/domain/types";
import {
  activityToFormValues,
  emptyActivityFormValues,
  UNPLANNED_VALUE,
  validateActivityForm,
  type ActivityFormErrors,
  type ActivityFormValues,
} from "@/lib/services/itineraryForms";
import { getItineraryService, type DayTimeline } from "@/lib/services/itineraryService";
import { Button } from "@/components/ui/Button";
import { CloseIcon, MapPinIcon, TrashIcon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { Field, inputClass } from "@/components/trips/formFields";
import { PLACE_TYPE_LABELS, placeLocation } from "@/components/places/placeDisplay";
import { PlacePickerSheet } from "@/components/places/PlacePickerSheet";
import { dayOptionLabel } from "./itineraryDisplay";

export type ActivitySheetTarget =
  | { mode: "create"; tripDayId: string | undefined }
  | { mode: "edit"; activity: Activity };

type ActivitySheetProps = {
  tripId: string;
  target: ActivitySheetTarget | null;
  /** Days the activity can be assigned to (in-range days and outside days). */
  days: DayTimeline[];
  places: ReadonlyMap<string, Place>;
  onClose: () => void;
};

export function ActivitySheet({ tripId, target, days, places, onClose }: ActivitySheetProps) {
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const close = () => {
    setConfirmingDelete(false);
    onClose();
  };
  const title =
    target?.mode === "edit" ? (confirmingDelete ? "Delete activity?" : "Edit activity") : "New activity";

  return (
    <Sheet open={target !== null} onClose={close} title={title} dismissible={!busy}>
      {target !== null &&
        (confirmingDelete && target.mode === "edit" ? (
          <DeleteConfirmation
            activity={target.activity}
            onBusyChange={setBusy}
            onCancel={() => setConfirmingDelete(false)}
            onDeleted={close}
          />
        ) : (
          <ActivityForm
            tripId={tripId}
            target={target}
            days={days}
            places={places}
            onBusyChange={setBusy}
            onSaved={close}
            onCancel={close}
            onDelete={() => setConfirmingDelete(true)}
          />
        ))}
    </Sheet>
  );
}

type ActivityFormProps = {
  tripId: string;
  target: ActivitySheetTarget;
  days: DayTimeline[];
  places: ReadonlyMap<string, Place>;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

function ActivityForm({ tripId, target, days, places, onBusyChange, onSaved, onCancel, onDelete }: ActivityFormProps) {
  const [values, setValues] = useState<ActivityFormValues>(() =>
    target.mode === "edit" ? activityToFormValues(target.activity) : emptyActivityFormValues(target.tripDayId),
  );
  const [errors, setErrors] = useState<ActivityFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A place created in the picker may not be in the live `places` map yet.
  const [pickedPlace, setPickedPlace] = useState<Place | undefined>();
  const selectedPlace =
    values.placeId === undefined
      ? undefined
      : (places.get(values.placeId) ?? (pickedPlace?.id === values.placeId ? pickedPlace : undefined));

  const set = <K extends keyof ActivityFormValues>(key: K, value: ActivityFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] === undefined ? current : { ...current, [key]: undefined }));
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    // A place deleted meanwhile (e.g. in another tab) is dropped instead of blocking the save.
    const result = validateActivityForm({ ...values, placeId: selectedPlace?.id });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    onBusyChange(true);
    try {
      const service = getItineraryService();
      if (target.mode === "create") await service.createActivity(tripId, result.tripDayId, result.input);
      else await service.updateActivity(target.activity.id, result.input, result.tripDayId);
      onSaved();
    } catch (error) {
      console.error("Failed to save activity", error);
      setSaveError("The activity couldn't be saved. Your existing data has not been changed.");
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <PlaceField
        tripId={tripId}
        places={places}
        place={selectedPlace}
        onChange={(place) => {
          setPickedPlace(place);
          set("placeId", place?.id);
          if (place !== undefined && values.title.trim() === "") set("title", place.name);
        }}
      />

      <Field label="Title" error={errors.title}>
        {(props) => (
          <input
            {...props}
            value={values.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder="e.g. Registan Square"
            autoComplete="off"
            enterKeyHint="done"
            className={inputClass}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <TimeField label="Start (optional)" value={values.startTime} error={errors.startTime} onChange={(v) => set("startTime", v)} />
        <TimeField label="End (optional)" value={values.endTime} error={errors.endTime} onChange={(v) => set("endTime", v)} />
      </div>
      <p className="-mt-3 text-sm text-slate-500">Local time at the activity. Leave empty if it has no fixed time.</p>

      <Field label="Day">
        {(props) => (
          <select
            {...props}
            value={values.tripDayId}
            onChange={(event) => set("tripDayId", event.target.value)}
            className={inputClass}
          >
            {days.map((timeline) => (
              <option key={timeline.day.id} value={timeline.day.id}>
                {dayOptionLabel(timeline, places)}
              </option>
            ))}
            <option value={UNPLANNED_VALUE}>Unplanned</option>
          </select>
        )}
      </Field>

      <Field label="Notes (optional)">
        {(props) => (
          <textarea
            {...props}
            value={values.notes}
            onChange={(event) => set("notes", event.target.value)}
            rows={3}
            placeholder="Tickets, opening hours, ideas…"
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
            {saving ? "Saving…" : target.mode === "create" ? "Add activity" : "Save changes"}
          </Button>
        </div>
        {target.mode === "edit" && (
          <Button variant="ghost" onClick={onDelete} disabled={saving} className="w-full text-red-600">
            <TrashIcon />
            Delete activity
          </Button>
        )}
      </div>
    </form>
  );
}

function PlaceField({
  tripId,
  places,
  place,
  onChange,
}: {
  tripId: string;
  places: ReadonlyMap<string, Place>;
  place: Place | undefined;
  onChange: (place: Place | undefined) => void;
}) {
  const [picking, setPicking] = useState(false);
  const location = place && placeLocation(place);
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-slate-700">Place (optional)</p>
      {place ? (
        <div className="flex items-center gap-2 rounded-xl bg-teal-50 py-1 pr-1 pl-3 ring-1 ring-teal-200">
          <MapPinIcon className="size-5 shrink-0 text-teal-700" />
          <span className="min-w-0 flex-1 py-1">
            <span className="block truncate font-medium text-slate-900">{place.name}</span>
            <span className="block truncate text-xs text-slate-600">
              {PLACE_TYPE_LABELS[place.type]}
              {location !== undefined && ` · ${location}`}
            </span>
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
            onClick={() => onChange(undefined)}
            aria-label="Remove place"
            className="flex size-11 items-center justify-center rounded-lg text-slate-500 hover:bg-teal-100"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-slate-50 px-3 text-left text-sm font-medium text-teal-700 ring-1 ring-slate-200"
        >
          <MapPinIcon className="size-5" />
          Choose or add a place
        </button>
      )}
      <PlacePickerSheet
        open={picking}
        title="Choose place"
        tripId={tripId}
        places={[...places.values()]}
        onPick={onChange}
        onClose={() => setPicking(false)}
      />
    </div>
  );
}

function TimeField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} error={error}>
      {(props) => (
        <div className="relative">
          <input
            {...props}
            type="time"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={`${inputClass} pr-11`}
          />
          {/* iOS time pickers have no way to clear a value. */}
          {value !== "" && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label={`Clear ${label.replace(" (optional)", "").toLowerCase()} time`}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500"
            >
              <CloseIcon className="size-4" />
            </button>
          )}
        </div>
      )}
    </Field>
  );
}

function DeleteConfirmation({
  activity,
  onBusyChange,
  onCancel,
  onDeleted,
}: {
  activity: Activity;
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
      await getItineraryService().deleteActivity(activity.id);
      onDeleted();
    } catch (caught) {
      console.error("Failed to delete activity", caught);
      setError("The activity couldn't be deleted. Nothing was removed.");
    } finally {
      setDeleting(false);
      onBusyChange(false);
    }
  }

  return (
    <div className="space-y-4 pb-[env(safe-area-inset-bottom)] text-slate-700">
      <p>
        <strong className="text-slate-900">{activity.title}</strong> will be permanently deleted from this device.
        This can&apos;t be undone.
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={deleting} className="flex-1">
          Keep
        </Button>
        <Button variant="danger" onClick={() => void confirm()} disabled={deleting} className="flex-1">
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </div>
  );
}
