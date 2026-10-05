/**
 * Cloud backup use cases (IMPLEMENTATION_PLAN.md Phase 12): connect/disconnect, backup now,
 * automatic backup after changes, versions, and restore through the same validation and
 * Replace flow (with safety backup) as a local import.
 *
 * Local IndexedDB stays the source of truth. A cloud backup is a copy; "newer data from
 * another device" is only ever loaded after the user confirms (Replace, never merge).
 * State (tokens, status) lives in AppMeta: this device only, never in backups.
 */
import { APP_VERSION } from "@/lib/app";
import { serializeBackup } from "@/lib/backup/serialize";
import type { BackupValidationResult, ValidBackup } from "@/lib/backup/validate";
import { backupName, deviceLabelFrom, parseBackupName } from "@/lib/cloud/backupNaming";
import { createDropboxProvider } from "@/lib/cloud/dropboxProvider";
import { codeChallengeFor, randomUrlSafe } from "@/lib/cloud/pkce";
import { dataSignature } from "@/lib/cloud/signature";
import { versionsToDelete } from "@/lib/cloud/policy";
import { CloudAuthError, CloudRateLimitError, CloudRequestError, type CloudBackupFile, type CloudBackupProvider } from "@/lib/cloud/types";
import { DATABASE_VERSION } from "@/lib/db/schema";
import { nowInstant } from "@/lib/domain/dateTime";
import type { CloudBackupState } from "@/lib/domain/types";
import { getRepositories, type Repositories } from "@/lib/repositories";
import { getBackupService, type BackupService } from "./backupService";

/** A sign-in that hasn't come back within this time is ignored. */
const CONNECT_TIMEOUT_MS = 30 * 60_000;

export interface CloudVersion {
  file: CloudBackupFile;
  createdAt: string;
  deviceLabel: string;
  /** Made by this device. */
  own: boolean;
}

export interface CloudStatus {
  configured: boolean;
  providerLabel: string;
  connected: boolean;
  enabled: boolean;
  account?: { name: string; email?: string };
  lastBackupAt?: string;
  lastError?: { at: string; message: string };
  /** Local travel data changed since the last backup / restore. */
  hasLocalChanges: boolean;
  /** Fingerprint of the local travel data; changes with every edit (schedules the backup). */
  localSignature?: string;
  /** The provider asked to wait until then (rate limit). */
  backoffUntil?: string;
}

export type RemoteCheck = { kind: "up-to-date" } | { kind: "newer"; version: CloudVersion; localChanges: boolean };

export type AutoBackupResult = "off" | "no-changes" | "waiting" | "uploaded" | "newer-remote";

export type ConnectResult = { kind: "none" } | { kind: "connected" } | { kind: "failed"; message: string };

interface Options {
  repos: Repositories;
  backup: BackupService;
  provider: CloudBackupProvider;
  deviceLabel: string;
}

const INITIAL_STATE: CloudBackupState = { provider: "dropbox", enabled: false };

function errorMessage(error: unknown): string {
  if (error instanceof CloudAuthError) return "Dropbox needs to be connected again.";
  if (error instanceof CloudRequestError) return error.message;
  return "Something went wrong with the cloud backup.";
}

export function createCloudBackupService({ repos, backup, provider, deviceLabel }: Options) {
  const state = async (): Promise<CloudBackupState> => (await repos.appMeta.get("cloudBackup")) ?? INITIAL_STATE;
  const update = async (change: Partial<CloudBackupState>) => repos.appMeta.set("cloudBackup", { ...(await state()), ...change });

  async function deviceId(): Promise<string> {
    const existing = await repos.appMeta.get("deviceId");
    if (existing) return existing;
    const id = randomUrlSafe(6).toLowerCase().replace(/[^a-z0-9]/g, "").padEnd(6, "0").slice(0, 6);
    await repos.appMeta.set("deviceId", id);
    return id;
  }

  async function localSignature(): Promise<string> {
    return dataSignature(await repos.backup.readAll());
  }

  async function hasLocalChanges(current: CloudBackupState): Promise<boolean> {
    if (current.synced) return (await localSignature()) !== current.synced.signature;
    // Never synced: only real data counts as a change.
    return (await repos.trips.count()) > 0;
  }

  /**
   * Records a failure; a rejected sign-in also forgets the tokens so the UI offers "Connect".
   * A rate limit is no error for the user: the app just waits as long as the provider asked.
   */
  async function recordFailure(error: unknown): Promise<never> {
    if (error instanceof CloudRateLimitError) {
      await update({ backoffUntil: new Date(Date.now() + error.retryAfterSeconds * 1000).toISOString() });
      throw error;
    }
    if (error instanceof CloudAuthError) await repos.appMeta.remove("cloudAuth");
    await update({ lastError: { at: nowInstant(), message: errorMessage(error) } });
    throw error;
  }

  async function versions(): Promise<CloudVersion[]> {
    const mine = await deviceId();
    return (await provider.listBackups())
      .flatMap((file): CloudVersion[] => {
        const info = parseBackupName(file.name);
        return info ? [{ file, createdAt: info.createdAt, deviceLabel: info.deviceLabel, own: info.deviceId === mine }] : [];
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function upload(): Promise<void> {
    const snapshot = await repos.backup.readAll();
    const data = await serializeBackup(snapshot, { appVersion: APP_VERSION, databaseVersion: DATABASE_VERSION });
    const name = backupName(data.exportedAt, deviceLabel, await deviceId());
    try {
      const file = await provider.uploadBackup(name, JSON.stringify(data));
      const createdAt = parseBackupName(file.name)?.createdAt ?? data.exportedAt;
      await update({
        lastBackupAt: data.exportedAt,
        synced: { fileName: file.name, createdAt, signature: dataSignature(snapshot) },
        lastError: undefined,
        backoffUntil: undefined,
      });
    } catch (error) {
      return recordFailure(error);
    }
    // Thin out old versions (see lib/cloud/policy.ts); a failed cleanup never fails the backup.
    try {
      for (const old of versionsToDelete(await versions(), Date.now())) await provider.deleteBackup(old.file);
    } catch (error) {
      console.warn("Old cloud backups couldn't be deleted", error);
    }
  }

  async function checkRemote(): Promise<RemoteCheck> {
    const current = await state();
    let newest: CloudVersion | undefined;
    try {
      newest = (await versions())[0];
    } catch (error) {
      return recordFailure(error);
    }
    if (newest === undefined || newest.own) return { kind: "up-to-date" };
    if (current.synced && (newest.file.name === current.synced.fileName || newest.createdAt <= current.synced.createdAt)) {
      return { kind: "up-to-date" };
    }
    return { kind: "newer", version: newest, localChanges: await hasLocalChanges(current) };
  }

  return {
    /**
     * For live queries: all reads start at once, before the first await, because Dexie's
     * liveQuery only observes reads started in its own async context (a read started after
     * awaiting another async function would not re-run the query when travel data changes).
     */
    async status(): Promise<CloudStatus> {
      if (!provider.configured) {
        return { configured: false, providerLabel: provider.label, connected: false, enabled: false, hasLocalChanges: false };
      }
      const [current, connected, snapshot, tripCount] = await Promise.all([
        state(),
        provider.isConnected(),
        repos.backup.readAll(),
        repos.trips.count(),
      ]);
      const signature = dataSignature(snapshot);
      const changed = current.synced ? signature !== current.synced.signature : tripCount > 0;
      return {
        configured: true,
        providerLabel: provider.label,
        connected,
        enabled: current.enabled,
        account: current.account,
        lastBackupAt: current.lastBackupAt,
        lastError: current.lastError,
        hasLocalChanges: connected && changed,
        localSignature: signature,
        backoffUntil: current.backoffUntil,
      };
    },

    /** Starts the sign-in; returns the provider URL the browser navigates to. */
    async beginConnect(): Promise<string> {
      const codeVerifier = randomUrlSafe(48);
      const pendingState = randomUrlSafe(16);
      await repos.appMeta.set("cloudConnectPending", { state: pendingState, codeVerifier, startedAt: nowInstant() });
      return provider.authorizationUrl({ state: pendingState, codeChallenge: await codeChallengeFor(codeVerifier) });
    },

    /** Handles the provider's redirect back (query parameters of the return URL). */
    async completeConnect(params: URLSearchParams): Promise<ConnectResult> {
      const code = params.get("code");
      const returnedState = params.get("state");
      const providerError = params.get("error");
      if (code === null && providerError === null) return { kind: "none" };
      const pending = await repos.appMeta.get("cloudConnectPending");
      await repos.appMeta.remove("cloudConnectPending");
      if (providerError !== null) {
        return { kind: "failed", message: providerError === "access_denied" ? "Dropbox access wasn't allowed." : "Connecting Dropbox failed." };
      }
      const fresh = pending !== undefined && Date.now() - new Date(pending.startedAt).getTime() < CONNECT_TIMEOUT_MS;
      if (!pending || !fresh || pending.state !== returnedState || code === null) {
        return { kind: "failed", message: "The Dropbox sign-in couldn't be matched to this app. Please connect again." };
      }
      try {
        await provider.completeAuthorization(code, pending.codeVerifier);
        const account = await provider.account();
        await update({ account, enabled: true, lastError: undefined });
        return { kind: "connected" };
      } catch (error) {
        await repos.appMeta.remove("cloudAuth");
        return { kind: "failed", message: errorMessage(error) };
      }
    },

    async setEnabled(enabled: boolean): Promise<void> {
      await update({ enabled });
    },

    /** Forgets the sign-in on this device; the backups stay in Dropbox. */
    async disconnect(): Promise<void> {
      await provider.disconnect();
      await repos.appMeta.set("cloudBackup", { ...INITIAL_STATE });
    },

    /** Uploads the current data now (also "keep this device's data" after a conflict). */
    backupNow: upload,

    /**
     * After local changes: uploads when enabled and connected, unless the cloud has newer data
     * from another device (then the user decides; nothing is uploaded or replaced silently).
     */
    async autoBackup(): Promise<AutoBackupResult> {
      const current = await state();
      if (!current.enabled || !provider.configured || !(await provider.isConnected())) return "off";
      if (current.backoffUntil !== undefined && Date.parse(current.backoffUntil) > Date.now()) return "waiting";
      if (!(await hasLocalChanges(current))) return "no-changes";
      if ((await checkRemote()).kind === "newer") return "newer-remote";
      await upload();
      return "uploaded";
    },

    /** Whether the cloud holds a newer backup from another device than this device's data. */
    checkRemote,

    async listVersions(): Promise<CloudVersion[]> {
      try {
        return await versions();
      } catch (error) {
        return recordFailure(error);
      }
    },

    /** Downloads and validates a backup; nothing is modified. */
    async prepareRestore(version: CloudVersion): Promise<BackupValidationResult> {
      let text: string;
      try {
        text = await provider.downloadBackup(version.file);
      } catch (error) {
        return recordFailure(error);
      }
      return backup.validateBackupText(text);
    },

    /** Replace restore (safety backup first); afterwards this device is in sync with that backup. */
    async restore(version: CloudVersion, valid: ValidBackup): Promise<void> {
      await backup.restoreBackup(valid);
      await update({ synced: { fileName: version.file.name, createdAt: version.createdAt, signature: await localSignature() }, lastError: undefined });
    },
  };
}

export type CloudBackupService = ReturnType<typeof createCloudBackupService>;

let service: CloudBackupService | null = null;

/** The app's cloud backup (browser only): Dropbox, configured by NEXT_PUBLIC_DROPBOX_APP_KEY. */
export function getCloudBackupService(): CloudBackupService {
  if (service) return service;
  const repos = getRepositories();
  const provider = createDropboxProvider({
    appKey: process.env.NEXT_PUBLIC_DROPBOX_APP_KEY || undefined,
    // Must be registered as a redirect URI in the Dropbox app settings.
    redirectUri: `${window.location.origin}/settings`,
    tokens: {
      get: () => repos.appMeta.get("cloudAuth"),
      set: (tokens) => repos.appMeta.set("cloudAuth", tokens),
      clear: () => repos.appMeta.remove("cloudAuth"),
    },
  });
  service = createCloudBackupService({
    repos,
    backup: getBackupService(),
    provider,
    deviceLabel: deviceLabelFrom(navigator.userAgent, navigator.maxTouchPoints),
  });
  return service;
}
