/**
 * Cloud backup file names carry when and on which device a backup was made, so the app can
 * tell "newer data from another device" without downloading anything:
 * travel-planner-20261005T143200Z-iphone-k3j9x2.json
 */

const PREFIX = "travel-planner-";
const NAME_PATTERN = /^travel-planner-(\d{8}T\d{6})Z-([a-z]+)-([a-z0-9]{4,16})\.json$/;

export interface BackupNameInfo {
  /** ISO 8601 UTC instant (second precision). */
  createdAt: string;
  deviceLabel: string;
  deviceId: string;
}

export function backupName(createdAt: string, deviceLabel: string, deviceId: string): string {
  const compact = createdAt.replace(/\.\d{3}Z$/, "Z").replace(/[-:]/g, "").replace(/Z$/, "");
  return `${PREFIX}${compact}Z-${deviceLabel}-${deviceId}.json`;
}

/** null for files that weren't written by this app. */
export function parseBackupName(name: string): BackupNameInfo | null {
  const match = NAME_PATTERN.exec(name);
  if (!match) return null;
  const [, stamp, deviceLabel, deviceId] = match;
  const createdAt = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}Z`;
  return { createdAt, deviceLabel, deviceId };
}

/** A short device word for file names and messages, from the user agent. */
export function deviceLabelFrom(userAgent: string, maxTouchPoints = 0): string {
  if (/iPhone/.test(userAgent)) return "iphone";
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return "ipad";
  if (/Macintosh|Mac OS X/.test(userAgent)) return "mac";
  if (/Android/.test(userAgent)) return "android";
  if (/Windows/.test(userAgent)) return "windows";
  if (/Linux/.test(userAgent)) return "linux";
  return "device";
}

const DEVICE_NAMES: Record<string, string> = {
  iphone: "iPhone",
  ipad: "iPad",
  mac: "Mac",
  android: "Android",
  windows: "Windows PC",
  linux: "Linux PC",
};

export function deviceDisplayName(label: string): string {
  return DEVICE_NAMES[label] ?? "another device";
}
