/**
 * JSON backup use cases (IMPLEMENTATION_PLAN.md Phase 11): export, validate, Replace
 * restore with a safety backup, safety backup export, and storage information.
 */
import { APP_VERSION } from "@/lib/app";
import { BACKUP_VERSION } from "@/lib/backup/format";
import { serializeBackup } from "@/lib/backup/serialize";
import { parseBackupText, validateBackup, type BackupValidationResult, type ValidBackup } from "@/lib/backup/validate";
import { DATABASE_VERSION } from "@/lib/db/schema";
import { nowInstant } from "@/lib/domain/dateTime";
import type { BackupData, SafetyBackup, StoragePersistenceRecord } from "@/lib/domain/types";
import { EntityNotFoundError, getRepositories, type Repositories } from "@/lib/repositories";
import { ensurePersistentStorage, type PersistentStorageApi } from "./storagePersistence";

/** Versions shown in Settings. */
export const APP_INFO = { appVersion: APP_VERSION, databaseVersion: DATABASE_VERSION, backupVersion: BACKUP_VERSION } as const;

export interface StorageInfo {
  persistence?: StoragePersistenceRecord;
  lastExportAt?: string;
  tripCount: number;
}

export function createBackupService(repos: Repositories) {
  async function currentBackup(): Promise<BackupData> {
    // Read in one transaction, then encode images outside of it (async work would end it).
    return serializeBackup(await repos.backup.readAll(), { appVersion: APP_VERSION, databaseVersion: DATABASE_VERSION });
  }

  return {
    /** The complete backup as JSON text (BACKUP-001). Call `recordExport` once it was saved. */
    async exportBackupJson(): Promise<string> {
      return JSON.stringify(await currentBackup());
    },

    /** Remembers the last export (AppMeta, never part of backups). */
    async recordExport(at = nowInstant()): Promise<void> {
      await repos.appMeta.set("lastExportAt", at);
    },

    /** Complete validation of a backup file's text; nothing is modified. */
    validateBackupText(text: string): Promise<BackupValidationResult> {
      const parsed = parseBackupText(text);
      return parsed === undefined
        ? Promise.resolve({ ok: false, errors: ["The file is not valid JSON."] })
        : validateBackup(parsed);
    },

    /**
     * Replace restore of a validated backup: first a safety backup of the current data,
     * then all travel data is replaced in one transaction. If the replace fails, the
     * existing data remains unchanged (the safety backup is kept either way).
     */
    async restoreBackup(backup: ValidBackup): Promise<SafetyBackup> {
      const safety = await repos.safetyBackups.create(await currentBackup(), "before_restore");
      await repos.backup.replaceAll(backup.data);
      return safety;
    },

    /** Newest first; the most recent 3 are kept. */
    listSafetyBackups(): Promise<SafetyBackup[]> {
      return repos.safetyBackups.list();
    },

    async safetyBackupJson(id: string): Promise<string> {
      const backup = await repos.safetyBackups.get(id);
      if (!backup) throw new EntityNotFoundError("Safety backup", id);
      return JSON.stringify(backup.data);
    },

    async storageInfo(): Promise<StorageInfo> {
      const [persistence, lastExportAt, tripCount] = await Promise.all([
        repos.appMeta.get("storagePersistence"),
        repos.appMeta.get("lastExportAt"),
        repos.trips.count(),
      ]);
      return { persistence, lastExportAt, tripCount };
    },

    /** Asks the browser for persistent storage again (e.g. after the user installed the app). */
    requestPersistentStorage(storage?: PersistentStorageApi): Promise<StoragePersistenceRecord> {
      return ensurePersistentStorage(repos.appMeta, storage);
    },
  };
}

export type BackupService = ReturnType<typeof createBackupService>;

let service: BackupService | null = null;

export function getBackupService(): BackupService {
  service ??= createBackupService(getRepositories());
  return service;
}
