import { formattingLocale, resolveLanguage } from '@/i18n';
import { dateFormatter } from '@/lib/dates';
import { formatMoney, type FormatMoneyOptions } from '@/lib/money';
import { useSettings } from '@/store/settings';

const HIDDEN = '••••';

const decimalSeparators = new Map<string, string>();
function decimalSeparator(locale: string): string {
  let sep = decimalSeparators.get(locale);
  if (!sep) {
    sep = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
    decimalSeparators.set(locale, sep);
  }
  return sep;
}

/** Formatting helpers bound to the user's language, region, main currency and privacy setting. */
export function useFormat() {
  const language = resolveLanguage(useSettings((s) => s.language));
  const region = useSettings((s) => s.region);
  const baseCurrency = useSettings((s) => s.baseCurrency);
  const hidden = useSettings((s) => s.hideAmounts);
  const locale = formattingLocale(language, region);

  const money = (minor: number, currency = baseCurrency, opts?: FormatMoneyOptions) =>
    hidden ? HIDDEN : formatMoney(minor, currency, locale, opts);

  /** Splits "₺18.450,75" into "₺18.450" and ",75" so the cents can be drawn smaller. */
  const moneyParts = (minor: number, currency = baseCurrency) => {
    if (hidden) return { main: HIDDEN, cents: '' };
    const full = formatMoney(minor, currency, locale);
    const sep = decimalSeparator(locale);
    const i = full.lastIndexOf(sep);
    if (i < 0) return { main: full, cents: '' };
    // Keep a trailing currency sign (e.g. "12,50 €") with the main part.
    const tail = full.slice(i);
    const digits = tail.match(/^.\d+/)?.[0] ?? tail;
    return { main: full.slice(0, i) + tail.slice(digits.length), cents: digits };
  };

  const date = (d: Date, options: Intl.DateTimeFormatOptions) => dateFormatter(locale, options).format(d);

  return { locale, language, baseCurrency, hidden, money, moneyParts, date };
}
