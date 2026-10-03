import { Dexie } from "dexie";
import { TravelDatabase } from "./database";

export type DatabaseStatus =
  | { state: "closed" }
  | { state: "opening" }
  | { state: "ready" }
  /** Our upgrade waits for other tabs running an older version to close. */
  | { state: "blocked" }
  /** Another tab upgraded the database; this tab closed its connection. */
  | { state: "reload-required" }
  | { state: "error"; message: string };

/**
 * Closes `db` when another connection needs to upgrade it, so older tabs never block
 * an upgrade, and reports connection state changes.
 */
export function attachConnectionHandlers(
  db: Dexie,
  onStatus: (status: DatabaseStatus) => void,
): void {
  db.on("versionchange", () => {
    // Keeps auto-open disabled: this tab's code no longer matches the schema.
    db.close();
    onStatus({ state: "reload-required" });
    return false;
  });
  db.on("blocked", () => onStatus({ state: "blocked" }));
  db.on("ready", () => onStatus({ state: "ready" }), true);
}

export function describeOpenError(error: unknown): string {
  if (error instanceof Dexie.VersionError) {
    return "Your data was saved by a newer version of the app. Reload to update the app; your data has not been changed.";
  }
  if (error instanceof Dexie.MissingAPIError) {
    return "This browser does not provide local storage (IndexedDB). Private browsing modes can disable it.";
  }
  return "The local database could not be opened. Your data has not been changed. Try reloading the app.";
}

let database: TravelDatabase | null = null;
let status: DatabaseStatus = { state: "closed" };
const listeners = new Set<() => void>();

function setStatus(next: DatabaseStatus): void {
  status = next;
  for (const listener of listeners) listener();
}

export function getDatabaseStatus(): DatabaseStatus {
  return status;
}

export function subscribeDatabaseStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The app's database connection (browser only). Opens lazily on first query. */
export function getDatabase(): TravelDatabase {
  if (database === null) {
    database = new TravelDatabase();
    attachConnectionHandlers(database, setStatus);
  }
  return database;
}

/** Opens the database and runs pending migrations. Never deletes data on failure. */
export async function openDatabase(): Promise<DatabaseStatus> {
  const db = getDatabase();
  if (db.isOpen()) return status;
  setStatus({ state: "opening" });
  try {
    await db.open();
    setStatus({ state: "ready" });
  } catch (error) {
    console.error("Failed to open database", error);
    setStatus({ state: "error", message: describeOpenError(error) });
  }
  return status;
}
