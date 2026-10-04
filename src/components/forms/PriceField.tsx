"use client";

import { CurrencySelect, Field, inputClass } from "@/components/trips/formFields";

type PriceFieldProps = {
  amount: string;
  currency: string;
  error?: string;
  onAmountChange: (amount: string) => void;
  onCurrencyChange: (currency: string) => void;
};

/** Informational price with currency (never counted in the budget). */
export function PriceField({ amount, currency, error, onAmountChange, onCurrencyChange }: PriceFieldProps) {
  return (
    <Field label="Price (optional)" error={error} hint="For your information only; not counted in the budget.">
      {(props) => (
        <div className="flex gap-2">
          <input
            {...props}
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            inputMode="decimal"
            placeholder="e.g. 25"
            autoComplete="off"
            className={`${inputClass} flex-1`}
          />
          <div className="w-28 shrink-0">
            <CurrencySelect
              id={`${props.id}-currency`}
              aria-invalid={false}
              value={currency}
              onChange={onCurrencyChange}
            />
          </div>
        </div>
      )}
    </Field>
  );
}
