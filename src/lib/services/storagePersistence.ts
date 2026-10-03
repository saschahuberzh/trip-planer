import { nowInstant } from "@/lib/domain/dateTime";
import type { StoragePersistenceRecord } from "@/lib/domain/types";
import type { AppMetaRepository } from "@/lib/repositories/appMetaRepository";

/** The subset of `navigator.storage` used here; undefined when unsupported. */
export type PersistentStorageApi = Pick<StorageManager, "persist" | "persisted">;

function browserStorageApi(): PersistentStorageApi | undefined {
  if (typeof navigator === "undefined") return undefined;
  const storage: StorageManager | undefined = navigator.storage;
  return typeof storage?.persist === "function" ? storage : undefined;
}

/**
 * Requests persistent storage (once granted, it is not requested again) and records
 * the result in AppMeta. Persistence reduces, but does not remove, the risk that the
 * browser or OS evicts local data; JSON export remains the durable backup.
 */
export async function ensurePersistentStorage(
  appMeta: AppMetaRepository,
  storage: PersistentStorageApi | undefined = browserStorageApi(),
): Promise<StoragePersistenceRecord> {
  let status: StoragePersistenceRecord["status"] = "unsupported";
  if (storage) {
    try {
      status = (await storage.persisted()) || (await storage.persist()) ? "granted" : "denied";
    } catch {
      status = "denied";
    }
  }
  const record: StoragePersistenceRecord = { status, checkedAt: nowInstant() };
  await appMeta.set("storagePersistence", record);
  return record;
}
