import type { Table } from "dexie";
import type { TravelDatabase } from "@/lib/db/database";
import { nowInstant } from "@/lib/domain/dateTime";
import type { EntityMetadata } from "@/lib/domain/types";
import { EntityNotFoundError } from "./errors";

/** Input for creating an entity: repositories assign `id`, `createdAt`, `updatedAt`. */
export type NewEntity<T> = Omit<T, "id" | "createdAt" | "updatedAt">;

/**
 * Partial update. A key present with value `undefined` clears that optional field.
 * `id`, `tripId` and metadata are never changed through a patch.
 */
export type EntityPatch<T, Fixed extends keyof T = never> = Partial<
  Omit<T, "id" | "tripId" | "createdAt" | "updatedAt" | Fixed>
>;

export interface TripScopedEntity extends EntityMetadata {
  id: string;
  tripId: string;
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Drops keys whose value is `undefined`, so cleared optional fields are not stored. */
export function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as T;
}

/** Runs `fn` in one read-write transaction spanning all domain tables. */
export function writeTransaction<R>(db: TravelDatabase, fn: () => Promise<R>): Promise<R> {
  return db.transaction("rw", db.domainTables, fn);
}

interface TripScopedCrudOptions<T extends TripScopedEntity> {
  entityName: string;
  /** Structural validation plus reference checks; runs inside the write transaction. */
  check: (entity: T) => Promise<void>;
}

/** Shared get/list/create/update for entities owned by a trip. */
export function tripScopedCrud<T extends TripScopedEntity, Fixed extends keyof T = never>(
  db: TravelDatabase,
  table: Table<T, string>,
  { entityName, check }: TripScopedCrudOptions<T>,
) {
  return {
    get(id: string): Promise<T | undefined> {
      return table.get(id);
    },

    listByTrip(tripId: string): Promise<T[]> {
      return table.where("tripId").equals(tripId).toArray();
    },

    create(input: NewEntity<T>): Promise<T> {
      return writeTransaction(db, async () => {
        const now = nowInstant();
        // NewEntity<T> plus the assigned fields is exactly T.
        const entity = withoutUndefined({ ...input, id: newId(), createdAt: now, updatedAt: now }) as T;
        await check(entity);
        await table.add(entity);
        return entity;
      });
    },

    update(id: string, patch: EntityPatch<T, Fixed>): Promise<T> {
      return writeTransaction(db, async () => {
        const existing = await table.get(id);
        if (!existing) throw new EntityNotFoundError(entityName, id);
        const entity = withoutUndefined({
          ...existing,
          ...patch,
          id: existing.id,
          tripId: existing.tripId,
          createdAt: existing.createdAt,
          updatedAt: nowInstant(),
        });
        await check(entity);
        await table.put(entity);
        return entity;
      });
    },
  };
}
