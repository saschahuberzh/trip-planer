import { describe, expect, it } from "vitest";
import type { Transport } from "@/lib/domain/types";
import { UNPLANNED_VALUE } from "./itineraryForms";
import {
  defaultTimeZone,
  emptyTransportFormValues,
  parseDurationInput,
  transportDurationMinutes,
  transportToFormValues,
  validateTransportForm,
  type TransportFormValues,
} from "./transportForm";

const meta = { createdAt: "2026-10-03T19:00:00.000Z", updatedAt: "2026-10-03T19:00:00.000Z" };
const base = (): TransportFormValues => emptyTransportFormValues("day-2", "Asia/Tashkent");

describe("validateTransportForm", () => {
  it("accepts a transport without times or places", () => {
    expect(validateTransportForm(base())).toMatchObject({ ok: true, tripDayId: "day-2", input: { type: "train" } });
  });

  it("builds local date/times and keeps place or text per end", () => {
    const result = validateTransportForm({
      ...base(),
      type: "flight",
      origin: { placeId: "tashkent", text: "ignored" },
      destination: { placeId: undefined, text: " Istanbul Airport " },
      departure: { date: "2026-06-13", time: "23:40", timeZone: "Asia/Tashkent" },
      arrival: { date: "2026-06-14", time: "03:10", timeZone: "Europe/Istanbul" },
    });
    expect(result).toMatchObject({
      ok: true,
      input: {
        originPlaceId: "tashkent",
        originText: undefined,
        destinationPlaceId: undefined,
        destinationText: "Istanbul Airport",
        departure: { local: "2026-06-13T23:40", timeZone: "Asia/Tashkent" },
        arrival: { local: "2026-06-14T03:10", timeZone: "Europe/Istanbul" },
      },
    });
  });

  it("requires complete date/times and arrival after departure", () => {
    const missingTime = validateTransportForm({ ...base(), departure: { date: "2026-06-13", time: "", timeZone: "Asia/Tashkent" } });
    expect(missingTime).toMatchObject({ ok: false, errors: { departure: "Add the departure time (local time)." } });
    const reversed = validateTransportForm({
      ...base(),
      departure: { date: "2026-06-13", time: "10:00", timeZone: "Asia/Tashkent" },
      arrival: { date: "2026-06-13", time: "09:00", timeZone: "Asia/Tashkent" },
    });
    expect(reversed.ok).toBe(false);
    // 09:00 in Istanbul is after 10:00 in Tashkent (11:00 Tashkent time).
    const acrossZones = validateTransportForm({
      ...base(),
      departure: { date: "2026-06-13", time: "10:00", timeZone: "Asia/Tashkent" },
      arrival: { date: "2026-06-13", time: "09:00", timeZone: "Europe/Istanbul" },
    });
    expect(acrossZones.ok).toBe(true);
  });

  it("parses an explicit duration and a price with currency", () => {
    expect(validateTransportForm({ ...base(), duration: "2h 10", price: "45.50", currency: "USD" })).toMatchObject({
      ok: true,
      input: { durationMinutes: 130, price: 45.5, currency: "USD" },
    });
    expect(validateTransportForm({ ...base(), price: "45", currency: "" })).toMatchObject({
      ok: false,
      errors: { price: "Choose a currency." },
    });
    expect(validateTransportForm({ ...base(), duration: "soon" }).ok).toBe(false);
  });

  it("maps Unplanned to no day", () => {
    expect(validateTransportForm({ ...base(), tripDayId: UNPLANNED_VALUE })).toMatchObject({ ok: true, tripDayId: undefined });
  });
});

describe("parseDurationInput", () => {
  it("understands common formats", () => {
    expect(parseDurationInput("2:10")).toBe(130);
    expect(parseDurationInput("2h")).toBe(120);
    expect(parseDurationInput("2 h 10 min")).toBe(130);
    expect(parseDurationInput("45m")).toBe(45);
    expect(parseDurationInput("130")).toBe(130);
    expect(parseDurationInput("0")).toBeNull();
    expect(parseDurationInput("2:75")).toBeNull();
  });
});

describe("durations and defaults", () => {
  const flight: Transport = {
    id: "f",
    tripId: "t",
    type: "flight",
    sortOrder: 0,
    departure: { local: "2026-06-13T23:40", timeZone: "Asia/Tashkent" },
    arrival: { local: "2026-06-14T03:10", timeZone: "Europe/Istanbul" },
    ...meta,
  };

  it("calculates the duration across time zones unless explicitly set", () => {
    expect(transportDurationMinutes(flight)).toBe(330);
    expect(transportDurationMinutes({ ...flight, durationMinutes: 300 })).toBe(300);
    expect(transportDurationMinutes({ durationMinutes: undefined, departure: flight.departure, arrival: undefined })).toBeUndefined();
  });

  it("round-trips a stored transport through the form", () => {
    const values = transportToFormValues({ ...flight, originText: "TAS", durationMinutes: 330 }, "Europe/Zurich");
    expect(values).toMatchObject({
      origin: { placeId: undefined, text: "TAS" },
      departure: { date: "2026-06-13", time: "23:40", timeZone: "Asia/Tashkent" },
      arrival: { date: "2026-06-14", time: "03:10", timeZone: "Europe/Istanbul" },
      duration: "5:30",
    });
    expect(validateTransportForm(values)).toMatchObject({ ok: true, input: { durationMinutes: 330, originText: "TAS" } });
  });

  it("suggests the most recently used time zone of the trip, else the device's", () => {
    expect(defaultTimeZone([], "Europe/Zurich")).toBe("Europe/Zurich");
    expect(
      defaultTimeZone([flight, { ...flight, id: "g", arrival: { local: "2026-06-20T10:00", timeZone: "Asia/Almaty" }, updatedAt: "2026-10-04T10:00:00.000Z" }], "Europe/Zurich"),
    ).toBe("Asia/Almaty");
  });
});
