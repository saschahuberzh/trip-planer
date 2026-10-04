/**
 * Informational price fields (transport, accommodation, booking): an amount as typed plus
 * a currency. Never counted in the budget (see DATA_MODEL.md "Budget Calculations").
 */
import { isCurrencyCode } from "@/lib/domain/currency";
import { parseAmount } from "./tripForm";

export type PriceInputResult = { ok: true; price?: number; currency?: string } | { ok: false; error: string };

/** Empty amount = no price (the currency is then ignored). */
export function parsePriceInput(amount: string, currency: string): PriceInputResult {
  if (amount.trim() === "") return { ok: true };
  const parsed = parseAmount(amount);
  if (parsed === null) return { ok: false, error: "Enter an amount like 25 or 25.50." };
  if (!isCurrencyCode(currency)) return { ok: false, error: "Choose a currency." };
  return { ok: true, price: parsed.value, currency };
}
