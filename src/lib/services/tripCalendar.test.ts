import { describe, expect, it } from "vitest";
import type { Accommodation, Place, Trip, TripDay } from "@/lib/domain/types";
import type { DayTimeline, Itinerary } from "./itineraryService";
import { CALENDAR_WEEKS, initialCalendarMonth, tripCalendar } from "./tripCalendar";

const meta = { createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z" };
const place = (id: string, name: string): Place => ({ id, tripId: "t", name, type: "city", favorite: false, visited: false, ...meta });
const places = new Map([place("tas", "Tashkent"), place("sam", "Samarkand"), place("buk", "Bukhara")].map((p) => [p.id, p]));

function itinerary(start: string, end: string, dayPlaces: (string[] | undefined)[], accommodations: Accommodation[] = []): Itinerary {
  const trip: Trip = { id: "t", name: "Silk Road", countries: [], startDate: start, endDate: end, status: "planned", baseCurrency: "CHF", ...meta };
  const days: DayTimeline[] = dayPlaces.map((placeIds, index) => {
    const date = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, Number(start.slice(8)) + index)).toISOString().slice(0, 10);
    const day: TripDay = { id: `d${index + 1}`, tripId: "t", date, ...(placeIds ? { placeIds } : {}), ...meta };
    return { day, dayNumber: index + 1, outside: false, entries: [] };
  });
  return { trip, days, outsideDays: [], unplanned: [], places, accommodations };
}

describe("tripCalendar", () => {
  it("shows each month of the trip as Monday–Sunday weeks", () => {
    // Sat 12 – Tue 15 June 2027: one month; 1 June 2027 is a Tuesday, 30 June a Wednesday.
    const { months } = tripCalendar(itinerary("2027-06-12", "2027-06-15", [["tas"], ["tas", "sam"], ["sam"], ["sam"]]));
    expect(months.map((month) => month.month)).toEqual(["2027-06"]);
    const { weeks } = months[0];
    // Five weeks of June plus one empty week: every month has six rows.
    expect(weeks).toHaveLength(CALENDAR_WEEKS);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[5].every((cell) => cell === null)).toBe(true);
    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][1]?.date).toBe("2027-06-01");
    expect(weeks[4][2]?.date).toBe("2027-06-30");
    expect(weeks[4][3]).toBeNull();
    const cells = weeks.flat().filter((cell) => cell !== null);
    expect(cells.filter((cell) => cell.trip).map((cell) => cell.trip?.dayNumber)).toEqual([1, 2, 3, 4]);
    expect(cells.find((cell) => cell.date === "2027-06-13")?.places.map((p) => p.name)).toEqual(["Tashkent", "Samarkand"]);
    expect(cells.find((cell) => cell.date === "2027-06-11")).toEqual({ date: "2027-06-11", places: [] });
    expect(cells.find((cell) => cell.date === "2027-06-12")?.trip).toEqual({ tripDayId: "d1", dayNumber: 1, hasStay: false });
  });

  it("covers every month of a trip across a year boundary and starts at today's month", () => {
    const calendar = tripCalendar(itinerary("2027-12-30", "2028-02-01", Array.from({ length: 34 }, () => ["tas"])));
    expect(calendar.months.map((month) => month.month)).toEqual(["2027-12", "2028-01", "2028-02"]);
    // Every month has six rows, whether it needs 5 (Feb 2028) or 6 (Jan 2028 starts on a Saturday).
    expect(calendar.months.map((month) => month.weeks.length)).toEqual([6, 6, 6]);
    expect(calendar.months[2].weeks.flat().filter((cell) => cell?.trip).map((cell) => cell?.date)).toEqual(["2028-02-01"]);
    expect(initialCalendarMonth(calendar, "2028-01-15")).toBe("2028-01");
    expect(initialCalendarMonth(calendar, "2026-10-04")).toBe("2027-12");
  });

  it("merges consecutive days at a place into stays with nights", () => {
    const { stays } = tripCalendar(itinerary("2027-06-12", "2027-06-15", [["tas"], ["tas", "sam"], ["sam"], ["sam"]]));
    expect(stays).toEqual([
      { placeId: "tas", name: "Tashkent", colorIndex: 0, firstDayNumber: 1, lastDayNumber: 2, nights: 1 },
      { placeId: "sam", name: "Samarkand", colorIndex: 1, firstDayNumber: 2, lastDayNumber: 4, nights: 2 },
    ]);
  });

  it("keeps a place's colour when it comes back and leaves days without places empty", () => {
    const { stays, months } = tripCalendar(itinerary("2027-06-14", "2027-06-18", [["tas"], ["sam"], undefined, ["sam", "tas"], ["tas"]]));
    expect(stays.map((stay) => [stay.name, stay.colorIndex, stay.firstDayNumber, stay.lastDayNumber, stay.nights])).toEqual([
      ["Tashkent", 0, 1, 1, 1],
      ["Samarkand", 1, 2, 2, 1],
      ["Samarkand", 1, 4, 4, 0],
      ["Tashkent", 0, 4, 5, 1],
    ]);
    expect(months[0].weeks.flat().find((cell) => cell?.trip?.dayNumber === 3)?.places).toEqual([]);
  });

  it("marks the days whose night is covered by an accommodation", () => {
    const hotel: Accommodation = { id: "h", tripId: "t", name: "Hotel", checkInDate: "2027-06-12", checkOutDate: "2027-06-14", ...meta };
    const { months } = tripCalendar(itinerary("2027-06-12", "2027-06-15", [["tas"], ["tas"], ["sam"], ["sam"]], [hotel]));
    const stays = months[0].weeks.flat().flatMap((cell) => (cell?.trip ? [[cell.date, cell.trip.hasStay]] : []));
    // Nights of 12 and 13 June; 14 June is the check-out day, the last day has no night.
    expect(stays).toEqual([["2027-06-12", true], ["2027-06-13", true], ["2027-06-14", false], ["2027-06-15", false]]);
  });
});
