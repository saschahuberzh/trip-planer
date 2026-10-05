/**
 * How often the app talks to the cloud and which versions it keeps.
 *
 * Dropbox (free, Plus and Pro accounts) has no monthly API call limit; the "data transport
 * limit" only applies to Business teams. There is a per-user rate limit (not published),
 * answered with HTTP 429 and Retry-After. The app stays far below it: a backup only after
 * edits have paused, at most every few minutes, plus one when the app is left; and it waits
 * as long as Dropbox asks after a 429.
 */

/** Back up only after no change for this long (typing makes many changes). */
export const AUTO_BACKUP_QUIET_MS = 30_000;
/** At least this long between two automatic backups while editing. */
export const AUTO_BACKUP_MIN_INTERVAL_MS = 2 * 60_000;
/** Look for newer backups from other devices at most this often. */
export const REMOTE_CHECK_INTERVAL_MS = 5 * 60_000;

/** The newest versions kept, whatever their age. */
export const KEEP_LATEST = 5;
/** Plus the last version of each of the recent days. */
export const KEEP_DAILY_DAYS = 14;

const DAY_MS = 86_400_000;

/**
 * Milliseconds until the next automatic backup may run, given the last local change, the last
 * backup and a pending rate limit (all epoch ms). `leaving`: the app goes to the background,
 * so it backs up right away (unless the provider asked to wait).
 */
export function autoBackupDelay({
  now,
  lastChangeAt,
  lastBackupAt,
  backoffUntil,
  leaving = false,
}: {
  now: number;
  lastChangeAt: number;
  lastBackupAt?: number;
  backoffUntil?: number;
  leaving?: boolean;
}): number {
  const notBefore = Math.max(
    leaving ? now : lastChangeAt + AUTO_BACKUP_QUIET_MS,
    leaving || lastBackupAt === undefined ? now : lastBackupAt + AUTO_BACKUP_MIN_INTERVAL_MS,
    backoffUntil ?? now,
  );
  return Math.max(0, notBefore - now);
}

/**
 * Versions to delete: everything except the KEEP_LATEST newest and the newest version of each
 * of the last KEEP_DAILY_DAYS days (days in UTC). `versions` newest first.
 */
export function versionsToDelete<T extends { createdAt: string }>(versions: readonly T[], now: number): T[] {
  const keep = new Set<T>(versions.slice(0, KEEP_LATEST));
  const days = new Set<string>();
  for (const version of versions) {
    const day = version.createdAt.slice(0, 10);
    const recent = now - Date.parse(version.createdAt) < KEEP_DAILY_DAYS * DAY_MS;
    if (recent && !days.has(day)) {
      days.add(day);
      keep.add(version);
    }
  }
  return versions.filter((version) => !keep.has(version));
}
