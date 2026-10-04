import { describe, expect, it } from "vitest";
import { localDateTimeToEpochMs, timeZoneOffsetLabel } from "./dateTime";
import { COMMON_TIME_ZONES, availableCommonTimeZones, timeZoneCities } from "./timeZones";

/** Offsets in January and July, i.e. the zone's standard offset and daylight-saving rule. */
function rule(timeZone: string): string {
  return ["2026-01-15T12:00", "2026-07-15T12:00"]
    .map((local) => timeZoneOffsetLabel(timeZone, { local, timeZone }))
    .join("/");
}

describe("COMMON_TIME_ZONES", () => {
  it("contains only valid, distinct zones with one entry per offset and daylight-saving rule", () => {
    expect(availableCommonTimeZones()).toHaveLength(COMMON_TIME_ZONES.length);
    const rules = COMMON_TIME_ZONES.map((entry) => rule(entry.timeZone));
    const duplicates = rules.filter((value, index) => rules.indexOf(value) !== index);
    // Zones may share both offsets only when their switch dates differ (e.g. Europe vs. Cairo, or hemispheres).
    const allowed = new Set(["GMT+2/GMT+3"]);
    expect(duplicates.filter((value) => !allowed.has(value))).toEqual([]);
    expect(new Set(COMMON_TIME_ZONES.map((entry) => entry.timeZone)).size).toBe(COMMON_TIME_ZONES.length);
  });

  it("lists cities that really share the zone's offsets", () => {
    const cities: [string, string][] = [
      ["Asia/Tashkent", "Asia/Samarkand"],
      ["Asia/Tashkent", "Asia/Almaty"],
      ["Asia/Tashkent", "Asia/Karachi"],
      ["Asia/Bishkek", "Asia/Dhaka"],
      ["Europe/Istanbul", "Europe/Moscow"],
      ["Europe/Istanbul", "Asia/Riyadh"],
      ["Asia/Dubai", "Asia/Baku"],
      ["Asia/Dubai", "Asia/Tbilisi"],
      ["Europe/Zurich", "Europe/Berlin"],
      ["Asia/Shanghai", "Asia/Singapore"],
      ["Asia/Shanghai", "Australia/Perth"],
      ["America/Sao_Paulo", "America/Argentina/Buenos_Aires"],
      ["America/Mexico_City", "America/Guatemala"],
    ];
    for (const [zone, city] of cities) {
      for (const local of ["2026-01-15T12:00", "2026-04-15T12:00", "2026-07-15T12:00", "2026-10-30T12:00"]) {
        expect(localDateTimeToEpochMs({ local, timeZone: city }), `${city} vs ${zone} at ${local}`).toBe(
          localDateTimeToEpochMs({ local, timeZone: zone }),
        );
      }
    }
  });

  it("names zones by their cities", () => {
    expect(timeZoneCities("Asia/Tashkent")).toBe("Tashkent, Samarkand, Almaty, Karachi");
    expect(timeZoneCities("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
  });
});
