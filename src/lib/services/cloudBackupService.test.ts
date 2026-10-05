import { liveQuery } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backupName } from "@/lib/cloud/backupNaming";
import { CloudAuthError, CloudRateLimitError, type CloudBackupFile, type CloudBackupProvider } from "@/lib/cloud/types";
import { TravelDatabase } from "@/lib/db/database";
import { createRepositories } from "@/lib/repositories";
import { createBackupService } from "./backupService";
import { KEEP_DAILY_DAYS, KEEP_LATEST } from "@/lib/cloud/policy";
import { createCloudBackupService } from "./cloudBackupService";
import { createTripService } from "./tripService";

/** An in-memory cloud shared by several "devices". */
function memoryCloud() {
  const files = new Map<string, string>();
  return {
    files,
    provider(options: { failUploads?: Error } = {}): CloudBackupProvider & { connected: boolean } {
      const provider = {
        id: "dropbox" as const,
        label: "Dropbox",
        configured: true,
        connected: false,
        authorizationUrl: ({ state, codeChallenge }: { state: string; codeChallenge: string }) =>
          `https://auth.example/?state=${state}&challenge=${codeChallenge}`,
        completeAuthorization: async (code: string) => {
          if (code !== "good-code") throw new CloudAuthError();
          provider.connected = true;
        },
        isConnected: async () => provider.connected,
        account: async () => ({ name: "Sascha", email: "s@example.com" }),
        disconnect: async () => {
          provider.connected = false;
        },
        uploadBackup: async (name: string, json: string): Promise<CloudBackupFile> => {
          if (options.failUploads) throw options.failUploads;
          files.set(name, json);
          return { path: `/backups/${name}`, name, size: json.length };
        },
        listBackups: async () => [...files].map(([name, json]) => ({ path: `/backups/${name}`, name, size: json.length })),
        downloadBackup: async (file: CloudBackupFile) => files.get(file.name) ?? "",
        deleteBackup: async (file: CloudBackupFile) => {
          files.delete(file.name);
        },
      };
      return provider;
    },
  };
}

let databases: TravelDatabase[] = [];
let clock = Date.parse("2026-10-05T10:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  clock = Date.parse("2026-10-05T10:00:00.000Z");
  vi.setSystemTime(clock);
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(databases.map((db) => db.delete()));
  databases = [];
});

/** Moves the clock forward (backups have second precision). */
function later(seconds = 60) {
  clock += seconds * 1000;
  vi.setSystemTime(clock);
}

function device(provider: CloudBackupProvider, label: string) {
  const db = new TravelDatabase(`cloud-test-${crypto.randomUUID()}`);
  databases.push(db);
  const repos = createRepositories(db);
  const backup = createBackupService(repos);
  const cloud = createCloudBackupService({ repos, backup, provider, deviceLabel: label });
  const trips = createTripService(repos);
  const addTrip = (name: string) =>
    trips.createTrip({ name, countries: [], startDate: "2027-06-12", endDate: "2027-06-13", status: "planned", baseCurrency: "CHF" });
  return { repos, cloud, addTrip };
}

/** Connects through the real PKCE state check. */
async function connect(target: ReturnType<typeof device>) {
  const url = new URL(await target.cloud.beginConnect());
  const result = await target.cloud.completeConnect(new URLSearchParams({ code: "good-code", state: url.searchParams.get("state") ?? "" }));
  expect(result).toEqual({ kind: "connected" });
}

describe("cloud backup", () => {
  it("connects with a matching sign-in and refuses a foreign one", async () => {
    const mac = device(memoryCloud().provider(), "mac");
    expect(await mac.cloud.completeConnect(new URLSearchParams())).toEqual({ kind: "none" });
    await mac.cloud.beginConnect();
    const foreign = await mac.cloud.completeConnect(new URLSearchParams({ code: "good-code", state: "someone-else" }));
    expect(foreign.kind).toBe("failed");
    expect(await mac.cloud.completeConnect(new URLSearchParams({ error: "access_denied", state: "x" }))).toEqual({
      kind: "failed",
      message: "Dropbox access wasn't allowed.",
    });

    await connect(mac);
    expect(await mac.cloud.status()).toMatchObject({ connected: true, enabled: true, account: { name: "Sascha" } });
  });

  it("backs up automatically only when enabled and data changed", async () => {
    const cloud = memoryCloud();
    const mac = device(cloud.provider(), "mac");
    expect(await mac.cloud.autoBackup()).toBe("off");
    await connect(mac);
    expect(await mac.cloud.autoBackup()).toBe("no-changes");

    await mac.addTrip("Silk Road");
    expect((await mac.cloud.status()).hasLocalChanges).toBe(true);
    expect(await mac.cloud.autoBackup()).toBe("uploaded");
    expect([...cloud.files.keys()]).toEqual([backupName("2026-10-05T10:00:00.000Z", "mac", (await mac.repos.appMeta.get("deviceId")) ?? "")]);
    expect(await mac.cloud.status()).toMatchObject({ hasLocalChanges: false, lastBackupAt: "2026-10-05T10:00:00.000Z" });
    expect(await mac.cloud.autoBackup()).toBe("no-changes");

    await mac.cloud.setEnabled(false);
    await mac.addTrip("Lisbon");
    expect(await mac.cloud.autoBackup()).toBe("off");
  });

  it("thins out old versions: the newest ones plus one per recent day", async () => {
    const cloud = memoryCloud();
    const mac = device(cloud.provider(), "mac");
    await connect(mac);
    // Three backups a day for 20 days.
    for (let day = 0; day < 20; day++) {
      for (let i = 0; i < 3; i++) {
        await mac.addTrip(`Trip ${day}-${i}`);
        await mac.cloud.backupNow();
        later(3600);
      }
      later(21 * 3600);
    }
    const versions = await mac.cloud.listVersions();
    expect(versions.length).toBeLessThanOrEqual(KEEP_LATEST + KEEP_DAILY_DAYS);
    const days = new Set(versions.map((version) => version.createdAt.slice(0, 10)));
    expect(days.size).toBe(KEEP_DAILY_DAYS);
  });

  it("waits silently as long as the provider asks after a rate limit", async () => {
    const cloud = memoryCloud();
    const provider = cloud.provider({ failUploads: new CloudRateLimitError(120) });
    const mac = device(provider, "mac");
    await connect(mac);
    await mac.addTrip("Trip");
    await expect(mac.cloud.autoBackup()).rejects.toBeInstanceOf(CloudRateLimitError);
    const status = await mac.cloud.status();
    expect(status.lastError).toBeUndefined();
    expect(status.backoffUntil).toBe("2026-10-05T10:02:00.000Z");
    expect(await mac.cloud.autoBackup()).toBe("waiting");
    later(121);
    await expect(mac.cloud.autoBackup()).rejects.toBeInstanceOf(CloudRateLimitError);
  });

  it("offers newer data from another device and never uploads over it automatically", async () => {
    const cloud = memoryCloud();
    const mac = device(cloud.provider(), "mac");
    const iphone = device(cloud.provider(), "iphone");
    await connect(mac);
    await connect(iphone);

    await mac.addTrip("Planned on the Mac");
    await mac.cloud.backupNow();
    later();

    // The iPhone has nothing yet: the Mac's backup is newer, without local changes.
    const check = await iphone.cloud.checkRemote();
    expect(check).toMatchObject({ kind: "newer", localChanges: false, version: { deviceLabel: "mac", own: false } });

    // Edited on the iPhone too: no silent upload; the user decides.
    await iphone.addTrip("Edited on the iPhone");
    expect(await iphone.cloud.autoBackup()).toBe("newer-remote");
    expect(await iphone.cloud.checkRemote()).toMatchObject({ kind: "newer", localChanges: true });

    // Loading it replaces the iPhone's data (safety backup first) and marks the iPhone in sync.
    if (check.kind !== "newer") throw new Error("expected newer");
    const validation = await iphone.cloud.prepareRestore(check.version);
    if (!validation.ok) throw new Error(validation.errors.join());
    await iphone.cloud.restore(check.version, validation.backup);
    expect((await iphone.repos.trips.list()).map((trip) => trip.name)).toEqual(["Planned on the Mac"]);
    expect((await iphone.repos.safetyBackups.list())[0].data.trips.map((trip) => trip.name)).toEqual(["Edited on the iPhone"]);
    expect(await iphone.cloud.checkRemote()).toEqual({ kind: "up-to-date" });
    expect(await iphone.cloud.autoBackup()).toBe("no-changes");

    // The Mac sees its own backup as current; after the iPhone uploads, the Mac is offered that.
    expect(await mac.cloud.checkRemote()).toEqual({ kind: "up-to-date" });
    await iphone.addTrip("On the road");
    expect(await iphone.cloud.autoBackup()).toBe("uploaded");
    expect(await mac.cloud.checkRemote()).toMatchObject({ kind: "newer", version: { deviceLabel: "iphone" } });
  });

  it("records failures and forgets a rejected sign-in", async () => {
    const cloud = memoryCloud();
    const failing = device(cloud.provider({ failUploads: new CloudAuthError() }), "mac");
    await connect(failing);
    await failing.addTrip("Trip");
    await failing.repos.appMeta.set("cloudAuth", { accessToken: "a", accessTokenExpiresAt: "2026-10-05T11:00:00.000Z", refreshToken: "r" });
    await expect(failing.cloud.backupNow()).rejects.toBeInstanceOf(CloudAuthError);
    expect((await failing.cloud.status()).lastError?.message).toBe("Dropbox needs to be connected again.");
    expect(await failing.repos.appMeta.get("cloudAuth")).toBeUndefined();
    // Local data is untouched.
    expect(await failing.repos.trips.count()).toBe(1);
  });

  it("updates a live status when travel data changes (drives the automatic backup)", async () => {
    vi.useRealTimers();
    const mac = device(memoryCloud().provider(), "mac");
    await connect(mac);
    const seen: boolean[] = [];
    const subscription = liveQuery(() => mac.cloud.status()).subscribe({ next: (status) => seen.push(status.hasLocalChanges) });
    await vi.waitFor(() => expect(seen).toEqual([false]));
    await mac.addTrip("New trip");
    await vi.waitFor(() => expect(seen.at(-1)).toBe(true));
    subscription.unsubscribe();
  });

  it("disconnects without touching local data or the cloud backups", async () => {
    const cloud = memoryCloud();
    const mac = device(cloud.provider(), "mac");
    await connect(mac);
    await mac.addTrip("Trip");
    await mac.cloud.backupNow();
    await mac.cloud.disconnect();
    expect(await mac.cloud.status()).toMatchObject({ connected: false, enabled: false });
    expect(await mac.repos.trips.count()).toBe(1);
    expect(cloud.files.size).toBe(1);
  });
});
