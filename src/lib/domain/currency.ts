/**
 * ISO 4217 currency codes. A fixed list (rather than `Intl.supportedValuesOf`) keeps
 * validation identical across browsers, which matters for backups moved between devices.
 */
const ACTIVE_CODES = `
AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BHD BIF BMD BND BOB BOV BRL BSD BTN BWP
BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB
EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD
JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP
MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR
RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND
TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XCD XCG XOF XPF
YER ZAR ZMW ZWG
`;

export const CURRENCY_CODES: readonly string[] = ACTIVE_CODES.trim().split(/\s+/);

const CODE_SET = new Set(CURRENCY_CODES);

// ISO 4217 minor units; every other listed currency uses 2.
const MINOR_UNITS: Record<string, number> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0, RWF: 0,
  UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  CLF: 4, UYW: 4,
};

export function isCurrencyCode(value: unknown): value is string {
  return typeof value === "string" && CODE_SET.has(value);
}

/** Number of decimal digits of the currency's minor unit (e.g. CHF 2, JPY 0). */
export function currencyMinorUnits(code: string): number {
  if (!isCurrencyCode(code)) throw new RangeError(`Unknown currency: ${code}`);
  return MINOR_UNITS[code] ?? 2;
}

/**
 * Rounds to the currency's minor unit (e.g. CHF 2 decimals, JPY 0). Half away from zero;
 * the epsilon nudge keeps values like 1.005 from rounding down due to binary floats.
 */
export function roundToCurrency(amount: number, code: string): number {
  const factor = 10 ** currencyMinorUnits(code);
  const rounded = Math.sign(amount) * Math.round(Math.abs(amount) * factor * (1 + Number.EPSILON)) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}
