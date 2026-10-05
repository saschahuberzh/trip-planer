import { describe, expect, it } from "vitest";
import type { Accommodation } from "@/lib/domain/types";
import { nightCoverage, nightStaysOnDate, nightsOf, overlappingStays, sortAccommodations, staysOnDate } from "./accommodationSchedule";

const meta = { createdAt: "2026-10-03T19:00:00.000Z", updatedAt: "2026-10-03T19:00:00.000Z" };
const stay = (id: string, checkInDate: string, checkOutDate: string): Accommodation => ({
  id,
  tripId: "t",
  name: id,
  checkInDate,
  checkOutDate,
  ...meta,
});

const tashkent = stay("Hotel Tashkent", "2026-06-12", "2026-06-14");
const samarkand = stay("Guesthouse Samarkand", "2026-06-14", "2026-06-16");

describe("staysOnDate", () => {
  it("shows check-in, nights and check-out on every date of the stay", () => {
    expect(staysOnDate([tashkent], "2026-06-11")).toEqual([]);
    expect(staysOnDate([tashkent], "2026-06-12")).toEqual([{ accommodation: tashkent, role: "check-in", night: 1, nights: 2 }]);
    expect(staysOnDate([tashkent], "2026-06-13")).toEqual([{ accommodation: tashkent, role: "night", night: 2, nights: 2 }]);
    expect(staysOnDate([tashkent], "2026-06-14")).toEqual([{ accommodation: tashkent, role: "check-out", nights: 2 }]);
    expect(staysOnDate([tashkent], "2026-06-15")).toEqual([]);
  });

  it("orders a changeover day as check-out first, then check-in", () => {
    expect(staysOnDate([samarkand, tashkent], "2026-06-14").map((item) => [item.accommodation.id, item.role])).toEqual([
      ["Hotel Tashkent", "check-out"],
      ["Guesthouse Samarkand", "check-in"],
    ]);
  });

  it("handles a stay without a night", () => {
    const dayRoom = stay("Day room", "2026-06-15", "2026-06-15");
    expect(nightsOf(dayRoom)).toBe(0);
    expect(staysOnDate([dayRoom], "2026-06-15")).toEqual([{ accommodation: dayRoom, role: "check-in", night: undefined, nights: 0 }]);
  });
});

describe("nightStaysOnDate", () => {
  it("keeps where the traveller sleeps and leaves out check-outs", () => {
    expect(nightStaysOnDate([samarkand, tashkent], "2026-06-14").map((item) => [item.accommodation.id, item.role])).toEqual([
      ["Guesthouse Samarkand", "check-in"],
    ]);
    expect(nightStaysOnDate([tashkent], "2026-06-13").map((item) => item.role)).toEqual(["night"]);
    expect(nightStaysOnDate([tashkent], "2026-06-14")).toEqual([]);
  });
});

describe("overlappingStays", () => {
  it("finds shared nights, ignoring the stay itself and back-to-back stays", () => {
    // Tashkent 12–14, Samarkand 14–16: check-out and check-in on the same day is fine.
    expect(overlappingStays([tashkent, samarkand], { checkInDate: "2026-06-14", checkOutDate: "2026-06-16" })).toEqual([
      { accommodation: samarkand, nights: ["2026-06-14", "2026-06-15"] },
    ]);
    expect(overlappingStays([tashkent], { checkInDate: "2026-06-14", checkOutDate: "2026-06-16" })).toEqual([]);
    expect(overlappingStays([tashkent, samarkand], { id: "Guesthouse Samarkand", checkInDate: "2026-06-13", checkOutDate: "2026-06-16" })).toEqual([
      { accommodation: tashkent, nights: ["2026-06-13"] },
    ]);
  });

  it("never overlaps with a stay without a night", () => {
    const dayRoom = stay("Day room", "2026-06-13", "2026-06-13");
    expect(overlappingStays([dayRoom], { checkInDate: "2026-06-12", checkOutDate: "2026-06-14" })).toEqual([]);
    expect(overlappingStays([tashkent], { checkInDate: "2026-06-13", checkOutDate: "2026-06-13" })).toEqual([]);
  });
});

describe("sortAccommodations", () => {
  it("sorts chronologically", () => {
    expect(sortAccommodations([samarkand, tashkent]).map((a) => a.id)).toEqual(["Hotel Tashkent", "Guesthouse Samarkand"]);
  });
});

describe("nightCoverage", () => {
  it("lists the trip's nights without accommodation", () => {
    const trip = { startDate: "2026-06-12", endDate: "2026-06-17" };
    expect(nightCoverage(trip, [tashkent, samarkand])).toEqual({ nights: 5, uncovered: ["2026-06-16"] });
    expect(nightCoverage({ startDate: "2026-06-12", endDate: "2026-06-12" }, [])).toEqual({ nights: 0, uncovered: [] });
  });
});
