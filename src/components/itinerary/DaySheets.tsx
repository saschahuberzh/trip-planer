"use client";

import { useState, type FormEvent } from "react";
import type { Place, TripDay } from "@/lib/domain/types";
import { dayToFormValues, validateDayDetailsForm, type DayDetailsFormValues } from "@/lib/services/itineraryForms";
import { getItineraryService, type DayTimeline } from "@/lib/services/itineraryService";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Field, inputClass } from "@/components/trips/formFields";
import { entryTitle, formatDayDateLong } from "./itineraryDisplay";

/**
 * A day's notes. Day titles are no longer offered for new days (the places of the day say
 * where you are); an existing title stays editable here so it can be changed or cleared.
 */
export function DayDetailsSheet({ day, onClose }: { day: TripDay | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={day !== null} onClose={onClose} title="Notes" dismissible={!busy}>
      {day !== null && <DayDetailsForm day={day} onBusyChange={setBusy} onDone={onClose} />}
    </Sheet>
  );
}

function DayDetailsForm({
  day,
  onBusyChange,
  onDone,
}: {
  day: TripDay;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const [values, setValues] = useState<DayDetailsFormValues>(() => dayToFormValues(day));
  const [titleError, setTitleError] = useState<string | undefined>();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    const result = validateDayDetailsForm(values);
    if (!result.ok) {
      setTitleError(result.errors.title);
      return;
    }
    setSaving(true);
    onBusyChange(true);
    try {
      await getItineraryService().updateDayDetails(day.id, result.input);
      onDone();
    } catch (error) {
      console.error("Failed to save day", error);
      setSaveError("The day couldn't be saved. Your existing data has not been changed.");
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <p className="text-sm font-medium text-slate-600">{formatDayDateLong(day.date)}</p>
      {day.title !== undefined && (
        <Field label="Title (optional)" error={titleError} hint="Clear it to show the places of the day instead">
          {(props) => (
            <input
              {...props}
              value={values.title}
              onChange={(event) => {
                setValues((current) => ({ ...current, title: event.target.value }));
                setTitleError(undefined);
              }}
              placeholder="e.g. Tashkent"
              autoComplete="off"
              enterKeyHint="done"
              className={inputClass}
            />
          )}
        </Field>
      )}
      <Field label="Notes">
        {(props) => (
          <textarea
            {...props}
            value={values.notes}
            onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
            rows={6}
            autoFocus
            placeholder="Reminders, ideas, what to pack…"
            className={inputClass}
          />
        )}
      </Field>
      {saveError && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {saveError}
        </p>
      )}
      <div className="flex gap-3 pb-[env(safe-area-inset-bottom)]">
        <Button variant="secondary" onClick={onDone} disabled={saving} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="flex-[2]">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

/** Explicit confirmation listing everything deleted with a day outside the trip dates. */
export function DeleteOutsideDaySheet({
  timeline,
  places,
  onClose,
  onDeleted,
}: {
  timeline: DayTimeline | null;
  places: ReadonlyMap<string, Place>;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  async function confirm() {
    if (timeline === null) return;
    setDeleting(true);
    setError(null);
    try {
      await getItineraryService().deleteOutsideDay(timeline.day.id);
      onDeleted?.();
      close();
    } catch (caught) {
      console.error("Failed to delete day", caught);
      setError("The day couldn't be deleted. Nothing was removed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Sheet
      open={timeline !== null}
      onClose={close}
      title="Delete day?"
      dismissible={!deleting}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={close} disabled={deleting} className="flex-1">
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void confirm()} disabled={deleting} className="flex-1">
            {deleting ? "Deleting…" : "Delete day"}
          </Button>
        </div>
      }
    >
      {timeline !== null && (
        <div className="space-y-3 text-slate-700">
          <p>
            <strong className="text-slate-900">{formatDayDateLong(timeline.day.date)}</strong>
            {timeline.day.title !== undefined && <> ({timeline.day.title})</>} will be permanently deleted from this
            device.
          </p>
          {timeline.entries.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-900">This also deletes:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {timeline.entries.map((entry) => (
                  <li key={`${entry.kind}:${entry.item.id}`}>{entryTitle(entry, places)}</li>
                ))}
              </ul>
            </div>
          )}
          {timeline.day.notes !== undefined && <p className="text-sm">The day&apos;s notes are deleted too.</p>}
          {timeline.day.placeIds !== undefined && (
            <p className="text-sm">Its places of the day stay in your places list.</p>
          )}
          <p className="text-sm text-slate-500">
            To keep these plans, move them to another day or to Unplanned instead. This can&apos;t be undone.
          </p>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
