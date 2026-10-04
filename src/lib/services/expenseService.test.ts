import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TravelDatabase } from "@/lib/db/database";
import { createRepositories, type Repositories } from "@/lib/repositories";
import { createExpenseService, type ExpenseInput, type ExpenseService } from "./expenseService";
import { createTripService } from "./tripService";

let db: TravelDatabase;
let repos: Repositories;
let expenses: ExpenseService;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T19:00:00.000Z"));
  db = new TravelDatabase(`expense-service-test-${crypto.randomUUID()}`);
  repos = createRepositories(db);
  expenses = createExpenseService(repos);
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

const setup = () =>
  createTripService(repos).createTrip({
    name: "Trip",
    countries: [],
    startDate: "2026-06-12",
    endDate: "2026-06-14",
    status: "planned",
    baseCurrency: "CHF",
    budgetAmount: 3000,
  });

const plov: ExpenseInput = {
  title: "Plov",
  category: "food",
  status: "paid",
  originalAmount: 800000,
  originalCurrency: "UZS",
  exchangeRateToBase: 0.000065,
};

describe("expenses", () => {
  it("calculates and stores the rounded base amount", async () => {
    const trip = await setup();
    const created = await expenses.createExpense(trip.id, { ...plov, originalAmount: 812345 });
    expect(created).toMatchObject({ exchangeRateToBase: 0.000065, amountInBaseCurrency: 52.8 });
  });

  it("always converts the base currency at rate 1", async () => {
    const trip = await setup();
    const created = await expenses.createExpense(trip.id, { ...plov, originalAmount: 45.5, originalCurrency: "CHF", exchangeRateToBase: undefined });
    expect(created).toMatchObject({ exchangeRateToBase: 1, amountInBaseCurrency: 45.5 });
  });

  it("stores unconverted expenses", async () => {
    const trip = await setup();
    const created = await expenses.createExpense(trip.id, { ...plov, exchangeRateToBase: undefined });
    expect(created).not.toHaveProperty("amountInBaseCurrency");
    expect(created).not.toHaveProperty("exchangeRateToBase");
  });

  it("keeps the stored base amount when only other fields change", async () => {
    const trip = await setup();
    const created = await expenses.createExpense(trip.id, plov);
    // Simulate a value stored by an earlier version or rounding rule.
    await repos.expenses.update(created.id, { amountInBaseCurrency: 51.99 });
    const edited = await expenses.updateExpense(created.id, { ...plov, title: "Plov at Besh Qozon", status: "planned" });
    expect(edited).toMatchObject({ title: "Plov at Besh Qozon", amountInBaseCurrency: 51.99 });
  });

  it("recalculates when amount, currency or rate change", async () => {
    const trip = await setup();
    const created = await expenses.createExpense(trip.id, plov);
    expect((await expenses.updateExpense(created.id, { ...plov, exchangeRateToBase: 0.00007 })).amountInBaseCurrency).toBe(56);
    expect((await expenses.updateExpense(created.id, { ...plov, originalAmount: 100000, exchangeRateToBase: 0.00007 })).amountInBaseCurrency).toBe(7);
    const cleared = await expenses.updateExpense(created.id, { ...plov, exchangeRateToBase: undefined });
    expect(cleared).not.toHaveProperty("amountInBaseCurrency");
  });

  it("links to a booking and is unlinked when the booking is deleted", async () => {
    const trip = await setup();
    const booking = await repos.bookings.create({ tripId: trip.id, type: "other", title: "Museum pass" });
    const created = await expenses.createExpense(trip.id, { ...plov, linkedEntity: { type: "booking", id: booking.id } });
    await repos.bookings.delete(booking.id);
    expect(await repos.expenses.get(created.id)).not.toHaveProperty("linkedEntity");
  });

  it("lists newest first with undated last and deletes", async () => {
    const trip = await setup();
    await expenses.createExpense(trip.id, { ...plov, title: "undated" });
    await expenses.createExpense(trip.id, { ...plov, title: "first", date: "2026-06-12" });
    const last = await expenses.createExpense(trip.id, { ...plov, title: "second", date: "2026-06-13" });
    expect((await expenses.listExpenses(trip.id)).map((e) => e.title)).toEqual(["second", "first", "undated"]);
    await expenses.deleteExpense(last.id);
    expect(await expenses.listExpenses(trip.id)).toHaveLength(2);
  });
});
