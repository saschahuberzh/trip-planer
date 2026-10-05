"use client";

import { useEffect, useRef, useState } from "react";
import type { ValidBackup } from "@/lib/backup/validate";
import { deviceDisplayName } from "@/lib/cloud/backupNaming";
import { useLiveData } from "@/lib/hooks/useLiveData";
import { useOnline } from "@/lib/hooks/useOnline";
import { getCloudBackupService, type CloudVersion } from "@/lib/services/cloudBackupService";
import { Button } from "@/components/ui/Button";
import { Alert, Card, formatInstant, RestoreConfirm } from "./settingsParts";

type RestoreState =
  | { step: "closed" }
  | { step: "loading" }
  | { step: "list"; versions: CloudVersion[] }
  | { step: "checking"; version: CloudVersion }
  | { step: "invalid"; version: CloudVersion; errors: string[] }
  | { step: "confirm" | "restoring" | "failed"; version: CloudVersion; backup: ValidBackup }
  | { step: "done"; tripCount: number };

/** Settings → Cloud backup: the switch, account, status, backup now, restore, disconnect. */
export function CloudBackupSection() {
  const status = useLiveData(() => getCloudBackupService().status(), []);
  const online = useOnline();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [restore, setRestore] = useState<RestoreState>({ step: "closed" });
  const handledRedirect = useRef(false);

  // Coming back from the Dropbox sign-in: ?code=…&state=… (or ?error=…) on /settings.
  useEffect(() => {
    if (handledRedirect.current) return;
    handledRedirect.current = true;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("code") && !params.has("error")) return;
    window.history.replaceState(window.history.state, "", window.location.pathname);
    void getCloudBackupService()
      .completeConnect(params)
      .then((result) => {
        if (result.kind === "connected") setMessage({ tone: "success", text: "Dropbox is connected. Automatic backup is on." });
        if (result.kind === "failed") setMessage({ tone: "error", text: result.message });
      });
  }, []);

  async function run(action: () => Promise<void>, success?: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (success) setMessage({ tone: "success", text: success });
    } catch (error) {
      console.error("Cloud backup action failed", error);
      setMessage({ tone: "error", text: error instanceof Error && error.message ? error.message : "That didn't work. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const connect = () => run(async () => window.location.assign(await getCloudBackupService().beginConnect()));

  async function openRestore() {
    setRestore({ step: "loading" });
    try {
      setRestore({ step: "list", versions: await getCloudBackupService().listVersions() });
    } catch (error) {
      console.error("Listing cloud backups failed", error);
      setRestore({ step: "closed" });
      setMessage({ tone: "error", text: "The backups in Dropbox couldn't be listed." });
    }
  }

  async function choose(version: CloudVersion) {
    setRestore({ step: "checking", version });
    try {
      const result = await getCloudBackupService().prepareRestore(version);
      setRestore(result.ok ? { step: "confirm", version, backup: result.backup } : { step: "invalid", version, errors: result.errors });
    } catch (error) {
      console.error("Downloading the cloud backup failed", error);
      setRestore({ step: "invalid", version, errors: ["The backup couldn't be downloaded."] });
    }
  }

  async function replace(version: CloudVersion, backup: ValidBackup) {
    setRestore({ step: "restoring", version, backup });
    try {
      await getCloudBackupService().restore(version, backup);
      setRestore({ step: "done", tripCount: backup.summary.counts.trips });
    } catch (error) {
      console.error("Cloud restore failed", error);
      setRestore({ step: "failed", version, backup });
    }
  }

  if (status.status !== "ready") {
    return (
      <Card title="Cloud backup">
        {status.status === "error" ? <Alert tone="error">The cloud backup status couldn&apos;t be read.</Alert> : <p className="text-sm text-slate-500">…</p>}
      </Card>
    );
  }
  const cloud = status.data;

  if (!cloud.configured) {
    return (
      <Card title="Cloud backup">
        <p className="text-sm text-slate-600">
          Cloud backup isn&apos;t set up for this installation. Your data stays on this device; use Export backup above.
        </p>
      </Card>
    );
  }

  const label = (version: CloudVersion) =>
    `${formatInstant(version.createdAt)} · ${version.own ? "this device" : `from ${deviceDisplayName(version.deviceLabel)}`}`;

  return (
    <Card title="Cloud backup">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p id="cloud-switch-label" className="font-semibold text-slate-900">
            Automatic backup to {cloud.providerLabel}
          </p>
          <p className="mt-0.5 text-sm text-slate-600">
            {cloud.connected
              ? "After every change, a copy goes to your Dropbox (app folder only). Your data stays on this device."
              : "Off: data is only on this device. Turn on to connect Dropbox; the app only sees its own folder there."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={cloud.connected && cloud.enabled}
          aria-labelledby="cloud-switch-label"
          disabled={busy || (!cloud.connected && !online)}
          onClick={() => (cloud.connected ? void run(() => getCloudBackupService().setEnabled(!cloud.enabled)) : void connect())}
          className={`relative mt-1 inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            cloud.connected && cloud.enabled ? "bg-teal-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block size-6 rounded-full bg-white shadow transition-transform ${cloud.connected && cloud.enabled ? "translate-x-7" : "translate-x-1"}`}
          />
        </button>
      </div>

      {!cloud.connected && !online && <p className="text-sm text-slate-500">Connecting needs an internet connection.</p>}
      {!cloud.connected && cloud.lastError && <Alert tone="error">{cloud.lastError.message} Turn the switch on to connect again.</Alert>}

      {cloud.connected && (
        <>
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-slate-500">Account</dt>
              <dd className="min-w-0 truncate font-medium text-slate-900">
                {cloud.account?.name ?? "Dropbox"}
                {cloud.account?.email && <span className="font-normal text-slate-600"> · {cloud.account.email}</span>}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-slate-500">Last backup</dt>
              <dd className="font-medium text-slate-900">
                {cloud.lastBackupAt ? formatInstant(cloud.lastBackupAt) : "not yet"}
                {cloud.hasLocalChanges && <span className="font-normal text-amber-700"> · newer changes on this device</span>}
              </dd>
            </div>
          </dl>
          {!cloud.enabled && <p className="text-sm text-slate-600">Automatic backup is paused. “Back up now” still works.</p>}
          {cloud.lastError && <Alert tone="error">{cloud.lastError.message}</Alert>}
          {!online && <p className="text-sm text-slate-500">Offline: backups continue when you&apos;re back online.</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void run(() => getCloudBackupService().backupNow(), "Backed up to Dropbox.")}
              disabled={busy || !online}
              className="flex-1"
            >
              {busy ? "Working…" : "Back up now"}
            </Button>
            <Button variant="secondary" onClick={() => void openRestore()} disabled={busy || !online || restore.step !== "closed"} className="flex-1">
              Restore from Dropbox…
            </Button>
          </div>
        </>
      )}

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {restore.step !== "closed" && (
        <div className="space-y-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          {restore.step === "loading" && <p className="text-sm text-slate-600">Loading the backups…</p>}
          {restore.step === "list" &&
            (restore.versions.length === 0 ? (
              <p className="text-sm text-slate-600">There are no backups in Dropbox yet.</p>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700">Choose a backup to restore:</p>
                <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                  {restore.versions.map((version) => (
                    <li key={version.file.path}>
                      <button type="button" onClick={() => void choose(version)} className="flex min-h-11 w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-50">
                        {label(version)}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ))}
          {restore.step === "checking" && <p className="text-sm text-slate-600">Downloading and checking the backup…</p>}
          {restore.step === "invalid" && (
            <Alert tone="error">
              <p className="font-semibold">This backup can&apos;t be restored. Nothing was changed.</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {restore.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </Alert>
          )}
          {(restore.step === "confirm" || restore.step === "restoring" || restore.step === "failed") && (
            <RestoreConfirm
              label={`The backup of ${label(restore.version)}`}
              backup={restore.backup}
              restoring={restore.step === "restoring"}
              failed={restore.step === "failed"}
              onCancel={() => setRestore({ step: "closed" })}
              onConfirm={() => void replace(restore.version, restore.backup)}
            />
          )}
          {restore.step === "done" && (
            <Alert tone="success">
              Restored from Dropbox ({restore.tripCount === 1 ? "1 trip" : `${restore.tripCount} trips`}). The previous data is kept as a
              safety backup.
            </Alert>
          )}
          {restore.step !== "confirm" && restore.step !== "restoring" && restore.step !== "failed" && (
            <Button variant="ghost" onClick={() => setRestore({ step: "closed" })} className="w-full">
              Close
            </Button>
          )}
        </div>
      )}

      {cloud.connected &&
        (confirmDisconnect ? (
          <div className="space-y-2 rounded-2xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
            <p className="text-slate-700">
              Disconnect Dropbox on this device? Automatic backup stops. Your data here and the backups in Dropbox stay.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirmDisconnect(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmDisconnect(false);
                  void run(() => getCloudBackupService().disconnect(), "Dropbox is disconnected on this device.");
                }}
                className="flex-1"
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDisconnect(true)} disabled={busy} className="w-full text-red-600">
            Disconnect Dropbox
          </Button>
        ))}
    </Card>
  );
}
