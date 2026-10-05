"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deviceDisplayName } from "@/lib/cloud/backupNaming";
import { autoBackupDelay, REMOTE_CHECK_INTERVAL_MS } from "@/lib/cloud/policy";
import { useLiveData } from "@/lib/hooks/useLiveData";
import { useOnline } from "@/lib/hooks/useOnline";
import { getCloudBackupService, type CloudVersion } from "@/lib/services/cloudBackupService";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

type Prompt =
  | { step: "ask"; version: CloudVersion; localChanges: boolean }
  | { step: "working"; version: CloudVersion; localChanges: boolean }
  | { step: "error"; version: CloudVersion; localChanges: boolean; message: string };

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * Runs the automatic cloud backup in the background (only when switched on and online) and
 * offers newer data from another device. Nothing is replaced without the user's confirmation.
 * Timing (lib/cloud/policy.ts): after edits pause, at most every few minutes, right away when
 * the app is left, and never while the provider asked to wait.
 */
export function CloudBackupAgent() {
  const status = useLiveData(() => getCloudBackupService().status(), []);
  const online = useOnline();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const dismissed = useRef(new Set<string>());
  const lastCheck = useRef(0);
  // Separate flags: a remote check must never make a due backup skip (and vice versa).
  const checking = useRef(false);
  const backingUp = useRef(false);
  const lastChangeAt = useRef(0);
  const previousSignature = useRef<string | undefined>(undefined);

  const cloud = status.status === "ready" ? status.data : undefined;
  const active = cloud !== undefined && cloud.configured && cloud.connected && cloud.enabled && online;

  const offer = useCallback((version: CloudVersion, localChanges: boolean) => {
    if (!dismissed.current.has(version.file.name)) setPrompt({ step: "ask", version, localChanges });
  }, []);

  const backoffUntil = cloud?.backoffUntil === undefined ? undefined : Date.parse(cloud.backoffUntil);
  const checkRemote = useCallback(async () => {
    if (checking.current || Date.now() - lastCheck.current < REMOTE_CHECK_INTERVAL_MS) return;
    lastCheck.current = Date.now();
    checking.current = true;
    try {
      const result = await getCloudBackupService().checkRemote();
      if (result.kind === "newer") offer(result.version, result.localChanges);
    } catch (error) {
      console.warn("Checking the cloud backup failed", error);
    } finally {
      checking.current = false;
    }
  }, [offer]);

  // On start, when the app comes back to the foreground, and when the connection returns.
  useEffect(() => {
    if (!active) return;
    void checkRemote();
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkRemote();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [active, checkRemote]);

  const runAutoBackup = useCallback(async () => {
    if (backingUp.current) return;
    backingUp.current = true;
    try {
      if ((await getCloudBackupService().autoBackup()) === "newer-remote") {
        const result = await getCloudBackupService().checkRemote();
        if (result.kind === "newer") offer(result.version, result.localChanges);
      }
    } catch (error) {
      // Recorded in the status (Settings shows it; a rate limit just delays); retried later.
      console.warn("Automatic cloud backup failed", error);
    } finally {
      backingUp.current = false;
    }
  }, [offer]);

  // Every edit changes the data's signature and restarts the quiet period. Runs before the
  // scheduling effect below (effects run in declaration order).
  const signature = cloud?.localSignature;
  useEffect(() => {
    if (signature === previousSignature.current) return;
    if (previousSignature.current !== undefined) lastChangeAt.current = Date.now();
    previousSignature.current = signature;
  }, [signature]);

  // After local changes: back up once edits have paused (and not too often).
  const hasLocalChanges = cloud?.hasLocalChanges ?? false;
  const lastBackupAt = cloud?.lastBackupAt === undefined ? undefined : Date.parse(cloud.lastBackupAt);
  useEffect(() => {
    if (!active || !hasLocalChanges) return;
    const delay = autoBackupDelay({ now: Date.now(), lastChangeAt: lastChangeAt.current, lastBackupAt, backoffUntil });
    const timer = window.setTimeout(() => void runAutoBackup(), delay);
    return () => window.clearTimeout(timer);
  }, [active, hasLocalChanges, signature, lastBackupAt, backoffUntil, runAutoBackup]);

  // Leaving the app (other app, lock, close): back up now, so the other device gets the latest.
  useEffect(() => {
    if (!active || !hasLocalChanges) return;
    const leave = () => {
      if (document.visibilityState !== "hidden") return;
      if (autoBackupDelay({ now: Date.now(), lastChangeAt: lastChangeAt.current, lastBackupAt, backoffUntil, leaving: true }) === 0) {
        void runAutoBackup();
      }
    };
    document.addEventListener("visibilitychange", leave);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", leave);
      window.removeEventListener("pagehide", leave);
    };
  }, [active, hasLocalChanges, lastBackupAt, backoffUntil, runAutoBackup]);

  const close = () => {
    if (prompt) dismissed.current.add(prompt.version.file.name);
    setPrompt(null);
  };

  async function load(version: CloudVersion, localChanges: boolean) {
    setPrompt({ step: "working", version, localChanges });
    try {
      const service = getCloudBackupService();
      const result = await service.prepareRestore(version);
      if (!result.ok) {
        setPrompt({ step: "error", version, localChanges, message: "That backup can't be restored. Nothing was changed." });
        return;
      }
      await service.restore(version, result.backup);
      setPrompt(null);
    } catch (error) {
      console.error("Loading the cloud backup failed", error);
      setPrompt({ step: "error", version, localChanges, message: "Loading failed. Your data on this device is unchanged." });
    }
  }

  async function keepThisDevice(version: CloudVersion, localChanges: boolean) {
    setPrompt({ step: "working", version, localChanges });
    try {
      await getCloudBackupService().backupNow();
      setPrompt(null);
    } catch (error) {
      console.error("Backing up this device failed", error);
      setPrompt({ step: "error", version, localChanges, message: "The backup failed. Your data on this device is unchanged." });
    }
  }

  const working = prompt?.step === "working";
  return (
    <Sheet
      open={prompt !== null}
      onClose={close}
      title="Newer data in Dropbox"
      dismissible={!working}
      footer={
        prompt && (
          <div className="flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
            <Button variant="danger" onClick={() => void load(prompt.version, prompt.localChanges)} disabled={working}>
              {working ? "Working…" : "Load it (replace data on this device)"}
            </Button>
            {prompt.localChanges && (
              <Button variant="secondary" onClick={() => void keepThisDevice(prompt.version, prompt.localChanges)} disabled={working}>
                Keep this device&apos;s data and back it up
              </Button>
            )}
            <Button variant="ghost" onClick={close} disabled={working}>
              Not now
            </Button>
          </div>
        )
      }
    >
      {prompt && (
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Your {deviceDisplayName(prompt.version.deviceLabel)} backed up newer data on{" "}
            <strong>{dateFormat.format(new Date(prompt.version.createdAt))}</strong>.
          </p>
          <p>Loading it replaces all travel data on this device. A safety backup of the current data is made first (Settings).</p>
          {prompt.localChanges && (
            <p className="rounded-xl bg-amber-50 p-3 text-amber-950 ring-1 ring-amber-200">
              This device also has changes that aren&apos;t in Dropbox. Loading replaces them (they stay in the safety backup); or keep
              this device&apos;s data and make it the newest backup.
            </p>
          )}
          {prompt.step === "error" && <p className="rounded-xl bg-red-50 p-3 text-red-800 ring-1 ring-red-200">{prompt.message}</p>}
        </div>
      )}
    </Sheet>
  );
}
