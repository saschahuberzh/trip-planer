import { describe, expect, it } from "vitest";
import { roundToCurrency } from "@/lib/domain/currency";
import { applyExpenseLink, emptyExpenseFormValues, expenseToFormValues, formatRate, previewConversion, suggestedRate, validateExpenseForm } from "./expenseForm";

const base = () => ({ ...emptyExpenseFormValues("UZS", "2026-06-13"), title: "Plov", amount: "800000" });

describe("validateExpenseForm", () => {
  it("accepts an unconverted expense in a foreign currency", () => {
    expect(validateExpenseForm(base(), "CHF")).toMatchObject({
      ok: true,
      input: { originalAmount: 800000, originalCurrency: "UZS", exchangeRateToBase: undefined, date: "2026-06-13", status: "paid" },
    });
  });

  it("uses rate 1 for the base currency", () => {
    expect(validateExpenseForm({ ...base(), currency: "CHF", amount: "45.50" }, "CHF")).toMatchObject({
      ok: true,
      input: { originalAmount: 45.5, exchangeRateToBase: 1 },
    });
  });

  it("takes a rate or derives it from the converted amount", () => {
    expect(validateExpenseForm({ ...base(), rate: "0.000065" }, "CHF")).toMatchObject({ ok: true, input: { exchangeRateToBase: 0.000065 } });
    const fromAmount = validateExpenseForm({ ...base(), conversion: "amount", baseAmount: "52" }, "CHF");
    expect(fromAmount).toMatchObject({ ok: true, input: { exchangeRateToBase: 52 / 800000 } });
    expect(previewConversion({ ...base(), conversion: "amount", baseAmount: "52" }, "CHF")).toBe(52);
  });

  it("rejects missing or invalid amounts, rates and titles", () => {
    expect(validateExpenseForm({ ...base(), title: "", amount: "0", rate: "-1" }, "CHF")).toEqual({
      ok: false,
      errors: { title: "Give the expense a title.", amount: "Enter an amount greater than 0.", rate: "Enter a rate greater than 0, e.g. 0.000065." },
    });
  });

  it("round-trips a stored expense", () => {
    const values = expenseToFormValues({
      id: "e",
      tripId: "t",
      title: "Train",
      category: "transport",
      status: "planned",
      originalAmount: 35000,
      originalCurrency: "KZT",
      exchangeRateToBase: 0.0018,
      amountInBaseCurrency: 63,
      createdAt: "2026-10-03T19:00:00.000Z",
      updatedAt: "2026-10-03T19:00:00.000Z",
    });
    expect(values).toMatchObject({ rate: "0.0018", date: "" });
    expect(validateExpenseForm(values, "CHF")).toMatchObject({ ok: true, input: { exchangeRateToBase: 0.0018, date: undefined } });
  });
});

describe("helpers", () => {
  it("formats rates without exponents", () => {
    expect(formatRate(0.000065)).toBe("0.000065");
    expect(formatRate(2e-7)).toBe("0.0000002");
    expect(formatRate(1.08)).toBe("1.08");
  });

  it("suggests the last rate used for a currency", () => {
    const stored = (rate: number, updatedAt: string) => ({
      id: updatedAt,
      tripId: "t",
      title: "x",
      category: "food" as const,
      status: "paid" as const,
      originalAmount: 1,
      originalCurrency: "UZS",
      exchangeRateToBase: rate,
      amountInBaseCurrency: rate,
      createdAt: updatedAt,
      updatedAt,
    });
    expect(suggestedRate([stored(0.00006, "2026-06-12T10:00:00.000Z"), stored(0.000065, "2026-06-13T10:00:00.000Z")], "UZS")).toBe(0.000065);
    expect(suggestedRate([], "UZS")).toBeUndefined();
  });

  it("fills empty fields from a linked entry", () => {
    const linked = applyExpenseLink({ ...base(), title: "", amount: "", date: "" }, { type: "transport", id: "t1" }, {
      title: "Train · Tashkent → Samarkand",
      category: "transport",
      date: "2026-06-13",
      price: { amount: 27, currency: "USD" },
    });
    expect(linked).toMatchObject({ title: "Train · Tashkent → Samarkand", category: "transport", amount: "27", currency: "USD", date: "2026-06-13" });
    expect(applyExpenseLink(linked, undefined, undefined).link).toBeUndefined();
  });

  it("rounds to the currency's minor unit", () => {
    expect(roundToCurrency(52.005, "CHF")).toBe(52.01);
    expect(roundToCurrency(1.005, "EUR")).toBe(1.01);
    expect(roundToCurrency(1234.5, "JPY")).toBe(1235);
    expect(roundToCurrency(0.0005, "KWD")).toBe(0.001);
  });
});
