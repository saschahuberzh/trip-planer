import { describe, expect, it } from "vitest";
import { backupName, deviceLabelFrom, parseBackupName } from "./backupNaming";

describe("cloud backup names", () => {
  it("round-trips time and device", () => {
    const name = backupName("2026-10-05T14:32:07.123Z", "iphone", "k3j9x2");
    expect(name).toBe("travel-planner-20261005T143207Z-iphone-k3j9x2.json");
    expect(parseBackupName(name)).toEqual({ createdAt: "2026-10-05T14:32:07Z", deviceLabel: "iphone", deviceId: "k3j9x2" });
    expect(parseBackupName("notes.txt")).toBeNull();
    expect(parseBackupName("travel-planner-20261005T143207Z-iphone-k3j9x2 (1).json")).toBeNull();
  });

  it("names the device from the user agent", () => {
    expect(deviceLabelFrom("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("iphone");
    expect(deviceLabelFrom("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("mac");
    expect(deviceLabelFrom("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ipad");
    expect(deviceLabelFrom("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
  });
});
