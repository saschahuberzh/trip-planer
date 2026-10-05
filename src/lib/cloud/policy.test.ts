import { describe, expect, it } from "vitest";
import {
  AUTO_BACKUP_MIN_INTERVAL_MS,
  AUTO_BACKUP_QUIET_MS,
  autoBackupDelay,
  KEEP_DAILY_DAYS,
  KEEP_LATEST,
  versionsToDelete,
} from "./policy";

const NOW = Date.parse("2026-10-20T12:00:00Z");

describe("automatic backup timing", () => {
  it("waits until edits pause", () => {
    expect(autoBackupDelay({ now: NOW, lastChangeAt: NOW })).toBe(AUTO_BACKUP_QUIET_MS);
    expect(autoBackupDelay({ now: NOW, lastChangeAt: NOW - AUTO_BACKUP_QUIET_MS })).toBe(0);
  });

  it("keeps a minimum interval between backups while editing", () => {
    const lastBackupAt = NOW - 60_000;
    expect(autoBackupDelay({ now: NOW, lastChangeAt: NOW - AUTO_BACKUP_QUIET_MS, lastBackupAt })).toBe(AUTO_BACKUP_MIN_INTERVAL_MS - 60_000);
  });

  it("backs up right away when the app is left, but always respects a rate limit", () => {
    expect(autoBackupDelay({ now: NOW, lastChangeAt: NOW, lastBackupAt: NOW - 1000, leaving: true })).toBe(0);
    expect(autoBackupDelay({ now: NOW, lastChangeAt: NOW, leaving: true, backoffUntil: NOW + 90_000 })).toBe(90_000);
    expect(autoBackupDelay({ now: NOW, lastChangeAt: NOW - 600_000, backoffUntil: NOW + 5000 })).toBe(5000);
  });

  it("needs only a handful of backups for an hour of planning", () => {
    // An hour of planning: 5 minutes of edits every 10 s, then a 1-minute pause, repeated.
    let backups = 0;
    let lastBackupAt: number | undefined;
    let lastChangeAt = NOW;
    let pending = false;
    for (let t = 0; t <= 3_600_000; t += 5_000) {
      const now = NOW + t;
      const editing = t % 360_000 < 300_000;
      if (editing && t % 10_000 === 0) {
        lastChangeAt = now;
        pending = true;
      }
      if (pending && autoBackupDelay({ now, lastChangeAt, lastBackupAt }) === 0) {
        backups++;
        lastBackupAt = now;
        pending = false;
      }
    }
    // One per pause (10 pauses); each backup is about 3 requests (list, upload, cleanup).
    expect(backups).toBe(10);
  });
});

describe("version retention", () => {
  const version = (iso: string) => ({ createdAt: iso });

  it(`keeps the ${KEEP_LATEST} newest and the last one of each recent day`, () => {
    const versions = [
      // Today: 7 backups.
      ...[11, 10, 9, 8, 7, 6, 5].map((hour) => version(`2026-10-20T${String(hour).padStart(2, "0")}:00:00Z`)),
      // Yesterday: 3 backups.
      version("2026-10-19T20:00:00Z"),
      version("2026-10-19T10:00:00Z"),
      version("2026-10-19T08:00:00Z"),
      // Older than the daily window.
      version("2026-09-30T10:00:00Z"),
    ];
    const deleted = versionsToDelete(versions, NOW).map((v) => v.createdAt);
    expect(deleted).toEqual([
      "2026-10-20T06:00:00Z",
      "2026-10-20T05:00:00Z",
      "2026-10-19T10:00:00Z",
      "2026-10-19T08:00:00Z",
      "2026-09-30T10:00:00Z",
    ]);
  });

  it(`keeps at most ${KEEP_LATEST + KEEP_DAILY_DAYS} versions`, () => {
    const many = Array.from({ length: 200 }, (_, i) => version(new Date(NOW - i * 3_600_000).toISOString()));
    const kept = many.length - versionsToDelete(many, NOW).length;
    expect(kept).toBeLessThanOrEqual(KEEP_LATEST + KEEP_DAILY_DAYS);
  });
});
