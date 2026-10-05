/**
 * A short fingerprint of all local travel data, to tell whether something changed since the
 * last cloud backup. Images count by ID and timestamp (their bytes never change in place).
 */
import type { DomainSnapshot } from "@/lib/repositories";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object" && !(value instanceof Blob)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/** FNV-1a (32 bit) over the text, as 8 hex characters. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function dataSignature(snapshot: DomainSnapshot): string {
  const key = (item: object) => ("id" in item ? String(item.id) : "countryCode" in item ? String(item.countryCode) : "");
  const sorted = Object.fromEntries(
    Object.entries(snapshot).map(([table, items]: [string, object[]]) => [
      table,
      [...items]
        .sort((a, b) => key(a).localeCompare(key(b)))
        .map((item) => (table === "images" && "id" in item && "updatedAt" in item ? { id: item.id, updatedAt: item.updatedAt } : item)),
    ]),
  );
  const text = JSON.stringify(stable(sorted));
  // Two halves of different seeds lower the chance of a collision.
  return `${fnv1a(text)}${fnv1a(`${text.length}:${text}`)}`;
}
