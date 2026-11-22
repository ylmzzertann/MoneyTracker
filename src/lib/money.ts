/**
 * Money helpers. Amounts are always stored as integers in the currency's
 * minor unit (cents, kuruş) to avoid floating point errors.
 */

export type CurrencyCode = string;

/** Currencies offered in pickers, most common first for our two launch regions. */
export const SUPPORTED_CURRENCIES: CurrencyCode[] = [
  'USD',
  'TRY',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'CHF',
  'JPY',
  'MXN',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
  'RON',
  'BGN',
  'CNY',
  'INR',
  'BRL',
  'ZAR',
  'KRW',
  'SGD',
  'HKD',
  'NZD',
  'ILS',
  'IDR',
  'MYR',
  'PHP',
  'THB',
  'ISK',
];

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'ISK', 'IDR', 'HUF']);

export function currencyDecimals(currency: CurrencyCode): number {
  return ZERO_DECIMAL.has(currency) ? 0 : 2;
}

export function toMinor(major: number, currency: CurrencyCode): number {
  return Math.round(major * 10 ** currencyDecimals(currency));
}

export function fromMinor(minor: number, currency: CurrencyCode): number {
  return minor / 10 ** currencyDecimals(currency);
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formatterCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, options);
    } catch {
      f = new Intl.NumberFormat('en-US', options);
    }
    formatterCache.set(key, f);
  }
  return f;
}

export type FormatMoneyOptions = {
  /** Drop the fraction part when it is zero (e.g. "$1,250" instead of "$1,250.00"). */
  trimZeroCents?: boolean;
  /** Short form for chart labels, e.g. "$1.2K". */
  compact?: boolean;
  /** Show "+" for positive values. */
  showPlus?: boolean;
};

export function formatMoney(
  minor: number,
  currency: CurrencyCode,
  locale: string,
  opts: FormatMoneyOptions = {},
): string {
  const decimals = currencyDecimals(currency);
  const major = fromMinor(minor, currency);
  const hideCents = opts.compact || (opts.trimZeroCents && Number.isInteger(major));
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: hideCents ? 0 : decimals,
    maximumFractionDigits: opts.compact ? 1 : decimals,
    signDisplay: opts.showPlus ? 'exceptZero' : 'auto',
  };
  if (opts.compact) {
    options.notation = 'compact';
  }
  return getFormatter(locale, options).format(major);
}

/** Plain number with grouping, no currency symbol (used by the amount wheels). */
export function formatNumber(value: number, locale: string, fractionDigits = 0): string {
  return getFormatter(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function currencySymbol(currency: CurrencyCode, locale: string): string {
  const parts = getFormatter(locale, { style: 'currency', currency }).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value ?? currency;
}

/** Splits a minor amount into its digits for the amount wheels. */
export function minorToDigits(minor: number, intDigits: number, decimals: number): number[] {
  const total = intDigits + decimals;
  const max = 10 ** total - 1;
  const clamped = Math.max(0, Math.min(Math.round(minor), max));
  const s = String(clamped).padStart(total, '0');
  return s.split('').map((c) => Number(c));
}

export function digitsToMinor(digits: number[]): number {
  return digits.reduce((acc, d) => acc * 10 + d, 0);
}

/**
 * ATM-style keypad entry: each key press shifts digits in from the right.
 * "1","2","5","0" -> 1250 minor units (= 12.50 for a 2-decimal currency).
 */
export function keypadPress(currentMinor: number, key: string, maxDigits = 10): number {
  if (key === 'back') {
    return Math.floor(currentMinor / 10);
  }
  if (key === 'clear') {
    return 0;
  }
  if (key === '00') {
    return keypadPress(keypadPress(currentMinor, '0', maxDigits), '0', maxDigits);
  }
  if (!/^\d$/.test(key)) {
    return currentMinor;
  }
  const next = currentMinor * 10 + Number(key);
  return String(next).length > maxDigits ? currentMinor : next;
}

/** Quick-pick amounts shown as chips when the user has no history yet. */
export function defaultQuickAmounts(currency: CurrencyCode): number[] {
  const majors: Record<string, number[]> = {
    TRY: [50, 100, 250, 500, 1000, 2500],
    JPY: [500, 1000, 3000, 5000, 10000],
    KRW: [5000, 10000, 30000, 50000],
    INR: [100, 250, 500, 1000, 2500],
  };
  const list = majors[currency] ?? [5, 10, 20, 50, 100, 250];
  return list.map((m) => toMinor(m, currency));
}
