import { nowInstant } from "@/lib/domain/dateTime";
import type { BackupData, BackupImage } from "@/lib/domain/types";
import type { DomainSnapshot } from "@/lib/repositories";
import { blobToBase64 } from "./base64";
import { BACKUP_FORMAT, BACKUP_VERSION } from "./format";

/** Complete backup of a snapshot: all travel data, images as base64 (BACKUP-001). */
export async function serializeBackup(
  snapshot: DomainSnapshot,
  meta: { appVersion: string; databaseVersion: number },
): Promise<BackupData> {
  const images = await Promise.all(
    snapshot.images.map(
      async (image): Promise<BackupImage> => ({
        id: image.id,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        dataBase64: await blobToBase64(image.blob),
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
      }),
    ),
  );
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowInstant(),
    appVersion: meta.appVersion,
    databaseVersion: meta.databaseVersion,
    trips: snapshot.trips,
    tripDays: snapshot.tripDays,
    places: snapshot.places,
    activities: snapshot.activities,
    transports: snapshot.transports,
    accommodations: snapshot.accommodations,
    bookings: snapshot.bookings,
    expenses: snapshot.expenses,
    images,
  };
}

/** File name like "travel-planner-backup-2026-10-04-1530.json" (device-local time, only a label). */
export function backupFileName(prefix = "travel-planner-backup", date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${prefix}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
}
