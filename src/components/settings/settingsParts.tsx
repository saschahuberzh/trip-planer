"use client";

import type { ReactNode } from "react";
import type { BackupTable } from "@/lib/backup/format";
import type { ValidBackup } from "@/lib/backup/validate";
import { Button } from "@/components/ui/Button";
import { AlertIcon } from "@/components/ui/icons";

// Building blocks shared by the Settings sections.

/** Instants (metadata) are shown in the device's time zone. */
export function formatInstant(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="px-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      <div className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">{children}</div>
    </section>
  );
}

export function Alert({ tone, children }: { tone: "error" | "warning" | "success"; children: ReactNode }) {
  const styles = {
    error: "bg-red-50 text-red-800 ring-red-200",
    warning: "bg-amber-50 text-amber-950 ring-amber-200",
    success: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  }[tone];
  return (
    <div role={tone === "success" ? "status" : "alert"} className={`rounded-xl p-3 text-sm ring-1 ${styles}`}>
      {children}
    </div>
  );
}

const COUNT_LABELS: [BackupTable, string, string][] = [
  ["trips", "trip", "trips"],
  ["tripDays", "day", "days"],
  ["places", "place", "places"],
  ["activities", "activity", "activities"],
  ["transports", "transport", "transports"],
  ["accommodations", "accommodation", "accommodations"],
  ["bookings", "booking", "bookings"],
  ["expenses", "expense", "expenses"],
  ["images", "photo", "photos"],
  ["visitedCountries", "visited country", "visited countries"],
];

/** Summary of a validated backup and the explicit Replace confirmation (file import and cloud restore). */
export function RestoreConfirm({
  label,
  backup,
  restoring,
  failed,
  onCancel,
  onConfirm,
}: {
  label: string;
  backup: ValidBackup;
  restoring: boolean;
  failed: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-3">
      <Alert tone="success">
        <p className="font-semibold">{label} is a valid backup.</p>
        <p>
          Exported {formatInstant(backup.summary.exportedAt)} (app {backup.summary.appVersion}).
        </p>
        <p className="mt-1">
          {COUNT_LABELS.filter(([table]) => backup.summary.counts[table] > 0)
            .map(([table, one, many]) => `${backup.summary.counts[table]} ${backup.summary.counts[table] === 1 ? one : many}`)
            .join(" · ") || "No travel data"}
        </p>
        {backup.summary.tripNames.length > 0 && <p className="mt-1">Trips: {backup.summary.tripNames.join(", ")}</p>}
      </Alert>
      {backup.warnings.length > 0 && (
        <Alert tone="warning">
          <ul className="list-disc space-y-0.5 pl-5">
            {backup.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      )}
      <div className="flex gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200">
        <AlertIcon className="size-5 shrink-0 text-red-600" />
        <p>
          <strong>All current data on this device will be replaced</strong> by this backup. A safety backup of the current
          data is created first and listed below.
        </p>
      </div>
      {failed && <Alert tone="error">The restore failed. Your existing data is unchanged.</Alert>}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={restoring} className="flex-1">
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={restoring} className="flex-1">
          {restoring ? "Restoring…" : "Replace my data"}
        </Button>
      </div>
    </div>
  );
}
