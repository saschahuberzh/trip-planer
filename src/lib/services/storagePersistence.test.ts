import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TravelDatabase } from "@/lib/db/database";
import { createAppMetaRepository, type AppMetaRepository } from "@/lib/repositories/appMetaRepository";
import { ensurePersistentStorage } from "./storagePersistence";

let db: TravelDatabase;
let appMeta: AppMetaRepository;

beforeEach(() => {
  db = new TravelDatabase(`persist-test-${crypto.randomUUID()}`);
  appMeta = createAppMetaRepository(db);
});

afterEach(async () => {
  await db.delete();
});

describe("ensurePersistentStorage", () => {
  it("requests persistence and records a grant", async () => {
    const storage = { persisted: vi.fn(async () => false), persist: vi.fn(async () => true) };
    const record = await ensurePersistentStorage(appMeta, storage);
    expect(record.status).toBe("granted");
    expect(storage.persist).toHaveBeenCalledOnce();
    expect(await appMeta.get("storagePersistence")).toEqual(record);
  });

  it("does not request again when already persisted", async () => {
    const storage = { persisted: vi.fn(async () => true), persist: vi.fn(async () => true) };
    expect((await ensurePersistentStorage(appMeta, storage)).status).toBe("granted");
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it("records denial, failures and missing support", async () => {
    const denied = { persisted: async () => false, persist: async () => false };
    expect((await ensurePersistentStorage(appMeta, denied)).status).toBe("denied");

    const failing = { persisted: async () => false, persist: () => Promise.reject(new Error("nope")) };
    expect((await ensurePersistentStorage(appMeta, failing)).status).toBe("denied");

    expect((await ensurePersistentStorage(appMeta, undefined)).status).toBe("unsupported");
    expect((await appMeta.get("storagePersistence"))?.status).toBe("unsupported");
  });
});
