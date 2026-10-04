import { describe, expect, it } from "vitest";
import { accommodationToFormValues, emptyAccommodationFormValues, validateAccommodationForm } from "./accommodationForm";

const base = () => ({ ...emptyAccommodationFormValues("2026-06-12", "2026-06-14", "CHF"), name: "Hotel Uzbekistan" });

describe("validateAccommodationForm", () => {
  it("accepts a minimal accommodation", () => {
    expect(validateAccommodationForm(base())).toMatchObject({
      ok: true,
      input: { name: "Hotel Uzbekistan", checkInDate: "2026-06-12", checkOutDate: "2026-06-14", price: undefined, currency: undefined },
    });
  });

  it("requires a name and check-out not before check-in", () => {
    expect(validateAccommodationForm({ ...base(), name: " ", checkOutDate: "2026-06-11" })).toEqual({
      ok: false,
      errors: { name: "Give the accommodation a name.", checkOutDate: "Check-out can't be before check-in." },
    });
  });

  it("uses the linked place instead of own location fields", () => {
    const result = validateAccommodationForm({ ...base(), placeId: "p1", address: "Old address", latitude: "41", longitude: "69" });
    expect(result).toMatchObject({ ok: true, input: { placeId: "p1", address: undefined, latitude: undefined, longitude: undefined } });
  });

  it("keeps own address and coordinates without a place", () => {
    expect(validateAccommodationForm({ ...base(), address: "Amir Temur 1", latitude: "41.3", longitude: "69,2" })).toMatchObject({
      ok: true,
      input: { address: "Amir Temur 1", latitude: 41.3, longitude: 69.2 },
    });
    expect(validateAccommodationForm({ ...base(), latitude: "41.3" }).ok).toBe(false);
  });

  it("validates times, price and booking URL", () => {
    const result = validateAccommodationForm({
      ...base(),
      checkInTime: "14:00",
      checkOutTime: "11:00:00",
      price: "120",
      currency: "USD",
      bookingUrl: "booking.com/hotel/uz/abc",
    });
    expect(result).toMatchObject({
      ok: true,
      input: { checkInTime: "14:00", checkOutTime: "11:00", price: 120, currency: "USD", bookingUrl: "https://booking.com/hotel/uz/abc" },
    });
    expect(validateAccommodationForm({ ...base(), checkInTime: "25:00" }).ok).toBe(false);
  });

  it("round-trips a stored accommodation", () => {
    const values = accommodationToFormValues(
      {
        id: "a",
        tripId: "t",
        name: "Yurt camp",
        type: "Yurt",
        checkInDate: "2026-06-15",
        checkOutDate: "2026-06-16",
        address: "Aydarkul",
        latitude: 40.9,
        longitude: 66.5,
        createdAt: "2026-10-03T19:00:00.000Z",
        updatedAt: "2026-10-03T19:00:00.000Z",
      },
      "CHF",
    );
    expect(validateAccommodationForm(values)).toMatchObject({ ok: true, input: { type: "Yurt", latitude: 40.9 } });
  });
});
