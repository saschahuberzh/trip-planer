import type { AppMetaRecord, TravelDatabase } from "@/lib/db/database";
import { nowInstant } from "@/lib/domain/dateTime";
import type { AppMetaKey, AppMetaValues } from "@/lib/domain/types";

/** Local application state that is not travel data; excluded from backups and restore. */
export function createAppMetaRepository(db: TravelDatabase) {
  return {
    async get<K extends AppMetaKey>(key: K): Promise<AppMetaValues[K] | undefined> {
      const record = await db.appMeta.get(key);
      // Records are written only through `set`, which pairs each key with its value type.
      return record?.value as AppMetaValues[K] | undefined;
    },

    async set<K extends AppMetaKey>(key: K, value: AppMetaValues[K]): Promise<void> {
      const record = { key, value, updatedAt: nowInstant() } as AppMetaRecord;
      await db.appMeta.put(record);
    },

    async remove(key: AppMetaKey): Promise<void> {
      await db.appMeta.delete(key);
    },
  };
}

export type AppMetaRepository = ReturnType<typeof createAppMetaRepository>;
