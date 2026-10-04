"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { BackupTable } from "@/lib/backup/format";
import { backupFileName } from "@/lib/backup/serialize";
import type { ValidBackup } from "@/lib/backup/validate";
import { canShareFiles, downloadTextFile, shareTextFile } from "@/lib/files/saveFile";
import { useLiveData } from "@/lib/hooks/useLiveData";
import { APP_INFO, getBackupService } from "@/lib/services/backupService";
import { Button } from "@/components/ui/Button";
import { AlertIcon } from "@/components/ui/icons";

/** Instants (metadata) are shown in the device's time zone. */
function formatInstant(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

const EXPORT_REMINDER_DAYS = 14;
const noopSubscribe = () => () => {};

/** Settings: data (export, import, safety backups), storage durability and app info. */
export function SettingsScreen() {
  return (
    <section className="mx-auto max-w-md space-y-6 px-4 py-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <DataSection />
      <SafetyBackupsSection />
      <StorageSection />
      <ApplicationSection />
    </section>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="px-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      <div className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">{children}</div>
    </section>
  );
}

function Alert({ tone, children }: { tone: "error" | "warning" | "success"; children: ReactNode }) {
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

// ---------------------------------------------------------------------------
// Data: export and import

function DataSection() {
  const info = useLiveData(() => getBackupService().storageInfo(), []);
  const shareAvailable = useSyncExternalStore(noopSubscribe, canShareFiles, () => false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function exportBackup(mode: "download" | "share") {
    setExporting(true);
    setExportError(null);
    try {
      const service = getBackupService();
      const json = await service.exportBackupJson();
      const fileName = backupFileName();
      if (mode === "share") {
        if (await shareTextFile(json, fileName, "Travel Planner backup")) await service.recordExport();
      } else {
        downloadTextFile(json, fileName);
        await service.recordExport();
      }
    } catch (error) {
      console.error("Export failed", error);
      setExportError("The backup couldn't be created. Your data is unchanged; please try again.");
    } finally {
      setExporting(false);
    }
  }

  const lastExportAt = info.status === "ready" ? info.data.lastExportAt : undefined;
  // Only used once the data is loaded, which happens on the client.
  const [now] = useState(() => Date.now());
  const stale =
    info.status === "ready" &&
    info.data.tripCount > 0 &&
    (lastExportAt === undefined || now - new Date(lastExportAt).getTime() > EXPORT_REMINDER_DAYS * 86_400_000);

  return (
    <Card title="Data">
      <div>
        <h3 className="font-semibold text-slate-900">Export backup</h3>
        <p className="mt-0.5 text-sm text-slate-600">
          One JSON file with all trips, places, plans, bookings, expenses and cover photos.
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Last export: <strong>{lastExportAt ? formatInstant(lastExportAt) : "never"}</strong>
        </p>
      </div>
      {stale && (
        <Alert tone="warning">
          {lastExportAt === undefined ? "You haven't exported a backup yet." : `Your last backup is older than ${EXPORT_REMINDER_DAYS} days.`}{" "}
          Export regularly and keep the file somewhere safe (e.g. Files, iCloud Drive or a computer).
        </Alert>
      )}
      <div className="flex gap-2">
        <Button onClick={() => void exportBackup("download")} disabled={exporting} className="flex-1">
          {exporting ? "Creating…" : "Download backup"}
        </Button>
        {shareAvailable && (
          <Button variant="secondary" onClick={() => void exportBackup("share")} disabled={exporting} className="flex-1">
            Share / Save to Files
          </Button>
        )}
      </div>
      {exportError && <Alert tone="error">{exportError}</Alert>}
      <hr className="border-slate-100" />
      <ImportBackup />
    </Card>
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
];

type ImportState =
  | { step: "idle" }
  | { step: "validating" }
  | { step: "invalid"; fileName: string; errors: string[] }
  | { step: "valid"; fileName: string; backup: ValidBackup }
  | { step: "restoring"; fileName: string; backup: ValidBackup }
  | { step: "done"; tripCount: number; warnings: string[] }
  | { step: "failed"; fileName: string; backup: ValidBackup };

function ImportBackup() {
  const [state, setState] = useState<ImportState>({ step: "idle" });
  const input = useRef<HTMLInputElement>(null);

  async function choose(file: File) {
    setState({ step: "validating" });
    try {
      const result = await getBackupService().validateBackupText(await file.text());
      setState(result.ok ? { step: "valid", fileName: file.name, backup: result.backup } : { step: "invalid", fileName: file.name, errors: result.errors });
    } catch (error) {
      console.error("Reading the backup failed", error);
      setState({ step: "invalid", fileName: file.name, errors: ["The file couldn't be read."] });
    }
  }

  async function restore(fileName: string, backup: ValidBackup) {
    setState({ step: "restoring", fileName, backup });
    try {
      await getBackupService().restoreBackup(backup);
      setState({ step: "done", tripCount: backup.summary.counts.trips, warnings: backup.warnings });
    } catch (error) {
      console.error("Restore failed", error);
      setState({ step: "failed", fileName, backup });
    }
  }

  const reset = () => {
    setState({ step: "idle" });
    if (input.current) input.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-slate-900">Import backup (replace)</h3>
        <p className="mt-0.5 text-sm text-slate-600">
          Restores a backup file. All current data on this device is replaced; a safety backup is made first.
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Choose backup file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void choose(file);
        }}
      />
      {(state.step === "idle" || state.step === "invalid" || state.step === "done") && (
        <Button variant="secondary" onClick={() => input.current?.click()} className="w-full">
          Choose backup file…
        </Button>
      )}
      {state.step === "validating" && <p className="text-sm text-slate-600">Checking the backup…</p>}

      {state.step === "invalid" && (
        <Alert tone="error">
          <p className="font-semibold">“{state.fileName}” can&apos;t be restored. Nothing was changed.</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {state.errors.map((error) => (
              <li key={error} className="break-words">
                {error}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {(state.step === "valid" || state.step === "restoring" || state.step === "failed") && (
        <div className="space-y-3">
          <Alert tone="success">
            <p className="font-semibold">“{state.fileName}” is a valid backup.</p>
            <p>
              Exported {formatInstant(state.backup.summary.exportedAt)} (app {state.backup.summary.appVersion}).
            </p>
            <p className="mt-1">
              {COUNT_LABELS.filter(([table]) => state.backup.summary.counts[table] > 0)
                .map(([table, one, many]) => `${state.backup.summary.counts[table]} ${state.backup.summary.counts[table] === 1 ? one : many}`)
                .join(" · ") || "No travel data"}
            </p>
            {state.backup.summary.tripNames.length > 0 && <p className="mt-1">Trips: {state.backup.summary.tripNames.join(", ")}</p>}
          </Alert>
          {state.backup.warnings.length > 0 && (
            <Alert tone="warning">
              <ul className="list-disc space-y-0.5 pl-5">
                {state.backup.warnings.map((warning) => (
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
          {state.step === "failed" && <Alert tone="error">The restore failed. Your existing data is unchanged.</Alert>}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={reset} disabled={state.step === "restoring"} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void restore(state.fileName, state.backup)}
              disabled={state.step === "restoring"}
              className="flex-1"
            >
              {state.step === "restoring" ? "Restoring…" : "Replace my data"}
            </Button>
          </div>
        </div>
      )}

      {state.step === "done" && (
        <Alert tone="success">
          <p className="font-semibold">Backup restored ({state.tripCount === 1 ? "1 trip" : `${state.tripCount} trips`}).</p>
          {state.warnings.length > 0 && <p>{state.warnings.join(" ")}</p>}
          <p>The previous data is kept as a safety backup.</p>
        </Alert>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Safety backups

function SafetyBackupsSection() {
  const backups = useLiveData(() => getBackupService().listSafetyBackups(), []);
  const [error, setError] = useState<string | null>(null);

  async function exportSafety(id: string, createdAt: string) {
    setError(null);
    try {
      const json = await getBackupService().safetyBackupJson(id);
      downloadTextFile(json, backupFileName("travel-planner-safety-backup", new Date(createdAt)));
    } catch (caught) {
      console.error("Safety backup export failed", caught);
      setError("The safety backup couldn't be exported.");
    }
  }

  return (
    <Card title="Safety backups">
      <p className="text-sm text-slate-600">
        Created automatically before each import. The latest 3 are kept on this device; export one to restore it.
      </p>
      {backups.status === "ready" && backups.data.length === 0 && <p className="text-sm text-slate-500">None yet.</p>}
      {backups.status === "ready" && backups.data.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {backups.data.map((backup) => (
            <li key={backup.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">{formatInstant(backup.createdAt)}</span>
                <span className="block text-xs text-slate-500">
                  Before import · {backup.data.trips.length === 1 ? "1 trip" : `${backup.data.trips.length} trips`}
                </span>
              </span>
              <Button variant="secondary" onClick={() => void exportSafety(backup.id, backup.createdAt)} className="shrink-0">
                Export
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Storage durability

const PERSISTENCE_LABELS = {
  granted: { text: "Persistent storage granted", tone: "text-emerald-700" },
  denied: { text: "Not granted", tone: "text-amber-700" },
  unsupported: { text: "Not supported by this browser", tone: "text-amber-700" },
} as const;

function StorageSection() {
  const info = useLiveData(() => getBackupService().storageInfo(), []);
  const [requesting, setRequesting] = useState(false);
  const persistence = info.status === "ready" ? info.data.persistence : undefined;

  async function request() {
    setRequesting(true);
    try {
      await getBackupService().requestPersistentStorage();
    } catch (error) {
      console.error("Requesting persistent storage failed", error);
    } finally {
      setRequesting(false);
    }
  }

  return (
    <Card title="Storage">
      <p className="text-sm">
        Status:{" "}
        {persistence ? (
          <strong className={PERSISTENCE_LABELS[persistence.status].tone}>{PERSISTENCE_LABELS[persistence.status].text}</strong>
        ) : (
          <strong className="text-slate-700">Not requested yet</strong>
        )}
        {persistence && <span className="text-slate-500"> · checked {formatInstant(persistence.checkedAt)}</span>}
      </p>
      <p className="text-sm text-slate-600">
        Your trips are stored only on this device, in the browser&apos;s storage. Even with persistent storage, the browser or
        the operating system can remove it — on iPhone especially when storage runs low or the app isn&apos;t used for a long
        time. <strong>Export a backup regularly</strong>; the JSON file is your durable copy.
      </p>
      {persistence?.status !== "granted" && persistence?.status !== "unsupported" && (
        <Button variant="secondary" onClick={() => void request()} disabled={requesting} className="w-full">
          {requesting ? "Requesting…" : "Request persistent storage"}
        </Button>
      )}
    </Card>
  );
}

function ApplicationSection() {
  return (
    <Card title="Application">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">App version</dt>
        <dd className="text-slate-900">{APP_INFO.appVersion}</dd>
        <dt className="text-slate-500">Database version</dt>
        <dd className="text-slate-900">{APP_INFO.databaseVersion}</dd>
        <dt className="text-slate-500">Backup format</dt>
        <dd className="text-slate-900">{APP_INFO.backupVersion}</dd>
      </dl>
    </Card>
  );
}
