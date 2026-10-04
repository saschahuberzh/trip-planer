import { describe, expect, it } from "vitest";
import {
  activityToFormValues,
  emptyActivityFormValues,
  normalizeTimeInput,
  UNPLANNED_VALUE,
  validateActivityForm,
  validateDayDetailsForm,
} from "./itineraryForms";

const meta = { createdAt: "2026-10-03T19:00:00.000Z", updatedAt: "2026-10-03T19:00:00.000Z" };

describe("normalizeTimeInput", () => {
  it("accepts HH:mm, drops seconds and rejects invalid times", () => {
    expect(normalizeTimeInput("")).toBe("");
    expect(normalizeTimeInput("09:30")).toBe("09:30");
    expect(normalizeTimeInput("09:30:00")).toBe("09:30");
    expect(normalizeTimeInput("24:00")).toBeNull();
    expect(normalizeTimeInput("9:30")).toBeNull();
  });
});

describe("validateActivityForm", () => {
  it("creates an untimed activity in a day", () => {
    const result = validateActivityForm({ ...emptyActivityFormValues("day-1"), title: "  Old town  " });
    expect(result).toEqual({
      ok: true,
      input: { title: "Old town", startTime: undefined, endTime: undefined, notes: undefined },
      tripDayId: "day-1",
    });
  });

  it("maps the Unplanned choice to no day", () => {
    const result = validateActivityForm({ ...emptyActivityFormValues(undefined), title: "Idea" });
    expect(result.ok && result.tripDayId).toBeUndefined();
  });

  it("keeps times and notes", () => {
    const result = validateActivityForm({
      title: "Museum",
      startTime: "09:00",
      endTime: "11:30",
      notes: " Closed Mondays ",
      tripDayId: UNPLANNED_VALUE,
    });
    expect(result).toMatchObject({ ok: true, input: { startTime: "09:00", endTime: "11:30", notes: "Closed Mondays" } });
  });

  it("requires a title and a start time when an end time is set", () => {
    const result = validateActivityForm({ ...emptyActivityFormValues("d"), endTime: "10:00" });
    expect(result).toEqual({
      ok: false,
      errors: { title: "Give the activity a title.", endTime: "Add a start time as well." },
    });
  });

  it("rejects invalid times and overly long titles", () => {
    const result = validateActivityForm({ ...emptyActivityFormValues("d"), title: "x".repeat(121), startTime: "25:00" });
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(["startTime", "title"]);
  });

  it("round-trips an existing activity", () => {
    const values = activityToFormValues({
      id: "a",
      tripId: "t",
      title: "Dinner",
      startTime: "19:00",
      sortOrder: 0,
      ...meta,
    });
    expect(values).toEqual({ title: "Dinner", startTime: "19:00", endTime: "", notes: "", tripDayId: UNPLANNED_VALUE });
    expect(validateActivityForm(values)).toMatchObject({ ok: true, input: { title: "Dinner", startTime: "19:00" } });
  });
});

describe("validateDayDetailsForm", () => {
  it("clears empty values", () => {
    expect(validateDayDetailsForm({ title: "  ", notes: "" })).toEqual({
      ok: true,
      input: { title: undefined, notes: undefined },
    });
  });

  it("limits the title length", () => {
    expect(validateDayDetailsForm({ title: "x".repeat(121), notes: "" }).ok).toBe(false);
  });
});
