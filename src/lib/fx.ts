import { fromMinor, toMinor, type CurrencyCode } from './money';

/**
 * Exchange rates expressed as "units of currency per 1 EUR" (the ECB reference
 * rates published by the Frankfurter API). EUR itself is always 1.
 */
export type RateTable = Record<CurrencyCode, number>;

export const FX_API_URL = 'https://api.frankfurter.dev/v1/latest';

/** Converts an amount; returns null when a rate is missing so callers can flag it. */
export function convertMinor(
  minor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: RateTable,
): number | null {
  if (from === to) return minor;
  const fromRate = from === 'EUR' ? 1 : rates[from];
  const toRate = to === 'EUR' ? 1 : rates[to];
  if (!fromRate || !toRate) return null;
  const inEur = fromMinor(minor, from) / fromRate;
  return toMinor(inEur * toRate, to);
}

export type FxApiResponse = { base: string; date: string; rates: Record<string, number> };

/** Normalises an API response to EUR-based rates, whatever base it was requested in. */
export function toEurTable(resp: FxApiResponse): RateTable {
  if (resp.base === 'EUR') return { ...resp.rates, EUR: 1 };
  const eurPerBase = resp.rates.EUR;
  if (!eurPerBase) return { EUR: 1 };
  // API rates are "units per 1 base"; rescale them to "units per 1 EUR".
  const basePerEur = 1 / eurPerBase;
  const table: RateTable = { EUR: 1, [resp.base]: basePerEur };
  for (const [code, rate] of Object.entries(resp.rates)) {
    if (code !== 'EUR') table[code] = rate * basePerEur;
  }
  return table;
}

export async function fetchLatestRates(signal?: AbortSignal): Promise<{ date: string; rates: RateTable }> {
  const res = await fetch(FX_API_URL, { signal });
  if (!res.ok) throw new Error(`FX request failed: ${res.status}`);
  const json = (await res.json()) as FxApiResponse;
  return { date: json.date, rates: toEurTable(json) };
}
