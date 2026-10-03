import { describe, expect, it } from "vitest";
import {
  addDays,
  calendarDaysInclusive,
  compareCalendarDates,
  durationMinutes,
  eachDateInRange,
  formatCalendarDate,
  formatCalendarDateRange,
  formatLocalDateTime,
  isCalendarDate,
  isLocalDateTime,
  isLocalDateTimeString,
  isValidTimeZone,
  isWallClockTime,
  localDateTimeToEpochMs,
} from "./dateTime";

describe("calendar dates", () => {
  it("validates real YYYY-MM-DD dates", () => {
    expect(isCalendarDate("2026-06-12")).toBe(true);
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("2026-04-31")).toBe(false);
    expect(isCalendarDate("2026-6-12")).toBe(false);
    expect(isCalendarDate("2026-06-12T00:00")).toBe(false);
    expect(isCalendarDate(20260612)).toBe(false);
  });

  it("adds days across month, year and leap-day boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("is unaffected by DST transitions", () => {
    // Europe DST starts 2026-03-29; calendar arithmetic must not drift.
    expect(eachDateInRange("2026-03-28", "2026-03-30")).toEqual([
      "2026-03-28",
      "2026-03-29",
      "2026-03-30",
    ]);
  });

  it("lists inclusive ranges", () => {
    expect(eachDateInRange("2026-06-12", "2026-06-12")).toEqual(["2026-06-12"]);
    expect(eachDateInRange("2026-06-13", "2026-06-12")).toEqual([]);
  });

  it("compares dates", () => {
    expect(compareCalendarDates("2026-06-12", "2026-06-13")).toBeLessThan(0);
    expect(compareCalendarDates("2026-06-12", "2026-06-12")).toBe(0);
    expect(() => compareCalendarDates("2026-02-30", "2026-06-12")).toThrow(RangeError);
  });

  it("formats without shifting the date", () => {
    expect(formatCalendarDate("2026-06-12", "en-US", { dateStyle: "long" })).toBe("June 12, 2026");
    expect(formatCalendarDate("2026-01-01", "en-US", { dateStyle: "long" })).toBe("January 1, 2026");
  });

  it("counts days inclusively across month and DST boundaries", () => {
    expect(calendarDaysInclusive("2026-06-12", "2026-06-12")).toBe(1);
    expect(calendarDaysInclusive("2026-03-28", "2026-04-02")).toBe(6);
    expect(calendarDaysInclusive("2026-10-24", "2026-10-26")).toBe(3);
  });

  it("formats date ranges without shifting dates", () => {
    expect(formatCalendarDateRange("2026-06-12", "2026-06-14", "en-GB")).toBe("12–14 Jun 2026");
    // ICU may use thin spaces around the dash.
    expect(formatCalendarDateRange("2026-12-30", "2027-01-02", "en-GB").replace(/\s/g, " ")).toBe(
      "30 Dec 2026 – 2 Jan 2027",
    );
    expect(formatCalendarDateRange("2026-06-12", "2026-06-12", "en-GB")).toBe("12 Jun 2026");
  });
});

describe("wall-clock times", () => {
  it("accepts HH:mm in 24h format only", () => {
    expect(isWallClockTime("00:00")).toBe(true);
    expect(isWallClockTime("23:59")).toBe(true);
    expect(isWallClockTime("24:00")).toBe(false);
    expect(isWallClockTime("9:30")).toBe(false);
    expect(isWallClockTime("09:30:00")).toBe(false);
  });
});

describe("time zones", () => {
  it("accepts IANA names and rejects offsets or garbage", () => {
    expect(isValidTimeZone("Asia/Tashkent")).toBe(true);
    expect(isValidTimeZone("America/Argentina/Buenos_Aires")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("+05:00")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});

describe("LocalDateTime", () => {
  it("validates shape, date, time and zone", () => {
    expect(isLocalDateTimeString("2026-06-12T08:00")).toBe(true);
    expect(isLocalDateTimeString("2026-06-12T08:00Z")).toBe(false);
    expect(isLocalDateTimeString("2026-06-12T08:00+05:00")).toBe(false);
    expect(isLocalDateTimeString("2026-02-30T08:00")).toBe(false);
    expect(isLocalDateTime({ local: "2026-06-12T08:00", timeZone: "Asia/Tashkent" })).toBe(true);
    expect(isLocalDateTime({ local: "2026-06-12T08:00", timeZone: "Nowhere" })).toBe(false);
    expect(isLocalDateTime(null)).toBe(false);
  });

  it("resolves the instant in the given zone", () => {
    expect(
      new Date(localDateTimeToEpochMs({ local: "2026-06-12T08:00", timeZone: "Asia/Tashkent" })).toISOString(),
    ).toBe("2026-06-12T03:00:00.000Z");
    expect(
      new Date(localDateTimeToEpochMs({ local: "2026-01-15T08:00", timeZone: "America/New_York" })).toISOString(),
    ).toBe("2026-01-15T13:00:00.000Z");
  });

  it("resolves DST gaps forward and overlaps to the earlier instant", () => {
    // 02:30 does not exist in Zurich on 2026-03-29 → 03:30 CEST.
    expect(
      new Date(localDateTimeToEpochMs({ local: "2026-03-29T02:30", timeZone: "Europe/Zurich" })).toISOString(),
    ).toBe("2026-03-29T01:30:00.000Z");
    // 02:30 happens twice on 2026-10-25 → first occurrence (CEST).
    expect(
      new Date(localDateTimeToEpochMs({ local: "2026-10-25T02:30", timeZone: "Europe/Zurich" })).toISOString(),
    ).toBe("2026-10-25T00:30:00.000Z");
  });

  it("calculates durations across time zones", () => {
    // Tashkent (UTC+5) 08:00 → Zurich (UTC+2 in summer) 12:30 = 7h30.
    expect(
      durationMinutes(
        { local: "2026-06-12T08:00", timeZone: "Asia/Tashkent" },
        { local: "2026-06-12T12:30", timeZone: "Europe/Zurich" },
      ),
    ).toBe(450);
    // Tokyo → Tashkent: arrival shows an earlier clock time than departure.
    expect(
      durationMinutes(
        { local: "2026-06-12T23:30", timeZone: "Asia/Tokyo" },
        { local: "2026-06-12T23:15", timeZone: "Asia/Tashkent" },
      ),
    ).toBe(225);
  });

  it("calculates durations across DST changes", () => {
    expect(
      durationMinutes(
        { local: "2026-03-29T01:00", timeZone: "Europe/Zurich" },
        { local: "2026-03-29T04:00", timeZone: "Europe/Zurich" },
      ),
    ).toBe(120);
  });

  it("rejects invalid values", () => {
    expect(() => durationMinutes(
      { local: "2026-06-12T08:00", timeZone: "Nowhere" },
      { local: "2026-06-12T09:00", timeZone: "UTC" },
    )).toThrow(RangeError);
    expect(() => localDateTimeToEpochMs({ local: "2026-06-12 08:00", timeZone: "UTC" })).toThrow(RangeError);
  });

  it("formats the local time as entered", () => {
    expect(
      formatLocalDateTime({ local: "2026-06-12T08:00", timeZone: "Asia/Tashkent" }, "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    ).toBe("Jun 12, 2026, 8:00 AM");
  });
});
