import { describe, expect, it } from "vitest";
import type { Expense } from "@/lib/domain/types";
import { budgetOverview, totalsOf } from "./budget";

let counter = 0;
function expense(fields: Partial<Expense> & Pick<Expense, "originalAmount" | "originalCurrency">): Expense {
  counter++;
  return {
    id: `e${counter}`,
    tripId: "t",
    title: `Expense ${counter}`,
    category: "other",
    status: "paid",
    createdAt: "2026-10-03T19:00:00.000Z",
    updatedAt: "2026-10-03T19:00:00.000Z",
    ...fields,
  };
}

const converted = (originalAmount: number, originalCurrency: string, amountInBaseCurrency: number, extra: Partial<Expense> = {}) =>
  expense({ originalAmount, originalCurrency, exchangeRateToBase: amountInBaseCurrency / originalAmount, amountInBaseCurrency, ...extra });

describe("DATA_MODEL.md example (base CHF, budget 3000, all paid)", () => {
  const expenses = [
    converted(800000, "UZS", 52),
    converted(35000, "KZT", 63),
    expense({ originalAmount: 1200, originalCurrency: "KGS" }),
    converted(220, "CHF", 220),
  ];
  const overview = budgetOverview({ baseCurrency: "CHF", budgetAmount: 3000 }, expenses);

  it("sums converted spending and keeps unconverted amounts per currency", () => {
    expect(overview.totals.paid.converted).toBe(335);
    expect(overview.totals.paid.unconverted).toEqual([{ currency: "KGS", amount: 1200 }]);
    expect(overview.totals.paid.complete).toBe(false);
    expect(overview.totals.paid.unconvertedCount).toBe(1);
  });

  it("marks the remaining budget incomplete with a provisional value", () => {
    expect(overview.remaining).toEqual({ amount: 2665, complete: false });
  });
});

describe("totals", () => {
  it("separates spent, planned and projected", () => {
    const overview = budgetOverview({ baseCurrency: "CHF", budgetAmount: 1000 }, [
      converted(100, "CHF", 100),
      converted(50, "CHF", 50, { status: "planned" }),
      expense({ originalAmount: 30, originalCurrency: "EUR", status: "planned" }),
    ]);
    expect(overview.totals.paid).toMatchObject({ converted: 100, complete: true });
    expect(overview.totals.planned).toMatchObject({ converted: 50, complete: false, unconverted: [{ currency: "EUR", amount: 30 }] });
    expect(overview.totals.total).toMatchObject({ converted: 150, complete: false, count: 3 });
    // An unconverted *planned* expense does not make the remaining budget incomplete.
    expect(overview.remaining).toEqual({ amount: 900, complete: true });
  });

  it("has no remaining budget without a budget amount", () => {
    expect(budgetOverview({ baseCurrency: "CHF" }, [converted(10, "CHF", 10)]).remaining).toBeUndefined();
  });

  it("rounds sums to the currency's minor unit", () => {
    expect(totalsOf([converted(1, "USD", 0.1), converted(1, "USD", 0.2)], "CHF").converted).toBe(0.3);
    expect(totalsOf([expense({ originalAmount: 0.1, originalCurrency: "EUR" }), expense({ originalAmount: 0.2, originalCurrency: "EUR" })], "CHF").unconverted).toEqual([
      { currency: "EUR", amount: 0.3 },
    ]);
  });

  it("never recalculates stored converted amounts", () => {
    // Stored 52 although 800000 × 0.0000651 would be 52.08: the stored value counts.
    const stored = expense({ originalAmount: 800000, originalCurrency: "UZS", exchangeRateToBase: 0.0000651, amountInBaseCurrency: 52 });
    expect(totalsOf([stored], "CHF").converted).toBe(52);
  });
});

describe("categories and days", () => {
  const expenses = [
    converted(100, "CHF", 100, { category: "accommodation", date: "2026-06-12" }),
    converted(20, "CHF", 20, { category: "food", date: "2026-06-12" }),
    expense({ originalAmount: 50000, originalCurrency: "UZS", category: "food", date: "2026-06-13" }),
    converted(30, "CHF", 30, { category: "transport", status: "planned" }),
  ];
  const overview = budgetOverview({ baseCurrency: "CHF" }, expenses);

  it("groups by category in the fixed order", () => {
    expect(overview.byCategory.map((row) => [row.category, row.total.converted, row.total.complete])).toEqual([
      ["accommodation", 100, true],
      ["transport", 30, true],
      ["food", 20, false],
    ]);
    expect(overview.byCategory[2].total.unconverted).toEqual([{ currency: "UZS", amount: 50000 }]);
  });

  it("groups by day chronologically with undated expenses last", () => {
    expect(overview.byDay.map((row) => [row.date, row.total.converted, row.total.complete])).toEqual([
      ["2026-06-12", 120, true],
      ["2026-06-13", 0, false],
      [undefined, 30, true],
    ]);
    expect(overview.byDay[2].planned.converted).toBe(30);
  });
});
