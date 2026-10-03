import { getDatabaseStatus, openDatabase, subscribeDatabaseStatus } from "@/lib/db/connection";
import { getRepositories } from "@/lib/repositories";
import { ensurePersistentStorage } from "./storagePersistence";

export { getDatabaseStatus, subscribeDatabaseStatus };
export type { DatabaseStatus } from "@/lib/db/connection";

/**
 * Opens the local database at app startup (running migrations) and, once the user
 * has travel data, requests persistent storage if that has not been recorded yet.
 */
export async function initializeLocalData(): Promise<void> {
  const status = await openDatabase();
  if (status.state !== "ready") return;
  try {
    const { trips, appMeta } = getRepositories();
    if ((await trips.count()) > 0 && (await appMeta.get("storagePersistence")) === undefined) {
      await ensurePersistentStorage(appMeta);
    }
  } catch (error) {
    // Persistence is best-effort and must never block access to local data.
    console.error("Failed to request persistent storage", error);
  }
}
