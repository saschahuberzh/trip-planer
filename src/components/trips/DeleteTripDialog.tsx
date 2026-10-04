"use client";

import { useState } from "react";
import type { Trip } from "@/lib/domain/types";
import { useLiveData } from "@/lib/hooks/useLiveData";
import { getTripService, type TripDeletionSummary } from "@/lib/services/tripService";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

type DeleteTripDialogProps = {
  trip: Trip | null;
  onClose: () => void;
  onDeleted?: () => void;
};

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Human-readable list of what deleting the trip removes; empty categories omitted. */
function describeDeletion(summary: TripDeletionSummary): string[] {
  const items = [
    summary.days > 0 && plural(summary.days, "itinerary day"),
    summary.activities > 0 && plural(summary.activities, "activity", "activities"),
    summary.transports > 0 && plural(summary.transports, "transport"),
    summary.places > 0 && plural(summary.places, "place"),
    summary.accommodations > 0 && plural(summary.accommodations, "accommodation"),
    summary.bookings > 0 && plural(summary.bookings, "booking"),
    summary.expenses > 0 && plural(summary.expenses, "expense"),
    summary.coverImage && "the cover photo",
  ];
  return items.filter((item): item is string => typeof item === "string");
}

/** Explicit confirmation listing everything that will be deleted. */
export function DeleteTripDialog({ trip, onClose, onDeleted }: DeleteTripDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tripId = trip?.id ?? null;
  const summary = useLiveData(
    async () => (tripId === null ? null : getTripService().getDeletionSummary(tripId)),
    [tripId],
  );

  const close = () => {
    setError(null);
    onClose();
  };

  async function confirm() {
    if (tripId === null) return;
    setDeleting(true);
    setError(null);
    try {
      await getTripService().deleteTrip(tripId);
      onDeleted?.();
      onClose();
    } catch (caught) {
      console.error("Failed to delete trip", caught);
      setError("The trip couldn't be deleted. Nothing was removed.");
    } finally {
      setDeleting(false);
    }
  }

  const items = summary.status === "ready" && summary.data !== null ? describeDeletion(summary.data) : [];

  return (
    <Sheet
      open={trip !== null}
      onClose={close}
      title="Delete trip?"
      dismissible={!deleting}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={close} disabled={deleting} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => void confirm()}
            disabled={deleting || summary.status !== "ready"}
            className="flex-1"
          >
            {deleting ? "Deleting…" : "Delete trip"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-slate-700">
        <p>
          <strong className="text-slate-900">{trip?.name}</strong> will be permanently deleted from this device.
        </p>
        {items.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-900">This also deletes:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-sm text-slate-500">This can&apos;t be undone.</p>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
