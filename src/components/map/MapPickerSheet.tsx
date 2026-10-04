"use client";

import { useState } from "react";
import { formatCoordinates, type LatLng } from "@/lib/domain/coordinates";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { MapView } from "./MapView";

type MapPickerSheetProps = {
  open: boolean;
  title: string;
  /** Current position of the place, if any. */
  position: LatLng | null;
  /** Where to start when there is no position (e.g. the trip's other places). */
  near?: LatLng;
  onConfirm: (position: LatLng) => Promise<void> | void;
  onClose: () => void;
};

/** Set or correct a position by tapping the map or dragging the pin. */
export function MapPickerSheet({ open, title, onClose, ...props }: MapPickerSheetProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={title} dismissible={!busy}>
      <MapPicker {...props} onBusyChange={setBusy} onDone={onClose} />
    </Sheet>
  );
}

function MapPicker({
  position: initial,
  near,
  onConfirm,
  onBusyChange,
  onDone,
}: Omit<MapPickerSheetProps, "open" | "title" | "onClose"> & { onBusyChange: (busy: boolean) => void; onDone: () => void }) {
  const [position, setPosition] = useState<LatLng | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function confirm() {
    if (position === null) return;
    setSaving(true);
    onBusyChange(true);
    setError(null);
    try {
      await onConfirm(position);
      onDone();
    } catch (caught) {
      console.error("Failed to set position", caught);
      setError("The position couldn't be saved. Nothing was changed.");
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return (
    <div className="space-y-3 pb-[env(safe-area-inset-bottom)]">
      <p className="text-sm text-slate-600">
        {position === null ? "Tap the map where the place is." : "Tap the map or drag the pin to adjust."}
      </p>
      <MapView
        markers={[]}
        initialCenter={initial ?? near}
        picker={{ position, onChange: setPosition }}
        className="h-[52dvh] min-h-64 rounded-2xl"
      />
      <p className="min-h-5 font-mono text-sm text-slate-700" aria-live="polite">
        {position === null ? "" : formatCoordinates(position)}
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onDone} disabled={saving} className="flex-1">
          Cancel
        </Button>
        <Button onClick={() => void confirm()} disabled={saving || position === null} className="flex-[2]">
          {saving ? "Saving…" : "Use this position"}
        </Button>
      </div>
    </div>
  );
}
