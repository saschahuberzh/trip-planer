import type { TravelDatabase } from "@/lib/db/database";
import { nowInstant } from "@/lib/domain/dateTime";
import type { BackupData, SafetyBackup, SafetyBackupReason } from "@/lib/domain/types";
import { newId } from "./shared";

const SAFETY_BACKUP_LIMIT = 3;

/** Safety backups live in their own table, which restore never touches. */
export function createSafetyBackupRepository(db: TravelDatabase) {
  return {
    /** Newest first. */
    list(): Promise<SafetyBackup[]> {
      return db.safetyBackups.orderBy("createdAt").reverse().toArray();
    },

    get(id: string): Promise<SafetyBackup | undefined> {
      return db.safetyBackups.get(id);
    },

    /** Stores a backup and keeps only the most recent SAFETY_BACKUP_LIMIT. */
    create(data: BackupData, reason: SafetyBackupReason): Promise<SafetyBackup> {
      return db.transaction("rw", db.safetyBackups, async () => {
        const backup: SafetyBackup = { id: newId(), createdAt: nowInstant(), reason, data };
        await db.safetyBackups.add(backup);
        const outdated = await db.safetyBackups
          .orderBy("createdAt")
          .reverse()
          .offset(SAFETY_BACKUP_LIMIT)
          .primaryKeys();
        await db.safetyBackups.bulkDelete(outdated);
        return backup;
      });
    },
  };
}

export type SafetyBackupRepository = ReturnType<typeof createSafetyBackupRepository>;
