import { describe, expect, it } from "vitest";
import type { Accommodation, Transport } from "@/lib/domain/types";
import { applyLink, emptyBookingFormValues, validateBookingForm } from "./bookingForm";

const meta = { createdAt: "2026-10-03T19:00:00.000Z", updatedAt: "2026-10-03T19:00:00.000Z" };
const base = () => emptyBookingFormValues("Asia/Tashkent", "CHF");

const train: Transport = {
  id: "tr",
  tripId: "t",
  type: "train",
  sortOrder: 0,
  departure: { local: "2026-06-13T09:30", timeZone: "Asia/Tashkent" },
  price: 25,
  currency: "USD",
  bookingReference: "AFR123",
  ...meta,
};

const hotel: Accommodation = {
  id: "h",
  tripId: "t",
  name: "Hotel Uzbekistan",
  checkInDate: "2026-06-12",
  checkInTime: "14:00",
  checkOutDate: "2026-06-14",
  bookingUrl: "https://booking.com/x",
  ...meta,
};

describe("validateBookingForm", () => {
  it("requires a title and accepts no date", () => {
    expect(validateBookingForm(base())).toEqual({ ok: false, errors: { title: "Give the booking a title." } });
    expect(validateBookingForm({ ...base(), title: "Museum pass" })).toMatchObject({ ok: true, input: { title: "Museum pass", dateTime: undefined } });
  });

  it("builds the local date/time and validates URL and price", () => {
    const result = validateBookingForm({
      ...base(),
      title: "Opera",
      dateTime: { date: "2026-06-13", time: "19:00", timeZone: "Asia/Tashkent" },
      url: "tickets.example/123",
      price: "30",
      currency: "USD",
    });
    expect(result).toMatchObject({
      ok: true,
      input: { dateTime: { local: "2026-06-13T19:00", timeZone: "Asia/Tashkent" }, url: "https://tickets.example/123", price: 30 },
    });
    expect(validateBookingForm({ ...base(), title: "X", dateTime: { date: "2026-06-13", time: "", timeZone: "Asia/Tashkent" } }).ok).toBe(false);
  });
});

describe("applyLink", () => {
  it("fills empty fields from a linked transport", () => {
    const values = applyLink(base(), { type: "transport", item: train, title: "Train · Tashkent → Samarkand" }, false);
    expect(values).toMatchObject({
      type: "train",
      title: "Train · Tashkent → Samarkand",
      dateTime: { date: "2026-06-13", time: "09:30", timeZone: "Asia/Tashkent" },
      price: "25",
      currency: "USD",
      bookingReference: "AFR123",
      link: { type: "transport", id: "tr" },
    });
  });

  it("keeps what the user entered", () => {
    const values = applyLink({ ...base(), type: "other", title: "My ticket", price: "20" }, { type: "transport", item: train, title: "Train" }, true);
    expect(values).toMatchObject({ type: "other", title: "My ticket", price: "20", currency: "CHF", bookingReference: "AFR123" });
  });

  it("fills from an accommodation and can remove the link", () => {
    const linked = applyLink(base(), { type: "accommodation", item: hotel }, false);
    expect(linked).toMatchObject({ type: "accommodation", title: "Hotel Uzbekistan", dateTime: { date: "2026-06-12", time: "14:00" }, url: "https://booking.com/x" });
    expect(applyLink(linked, undefined, false).link).toBeUndefined();
  });
});
