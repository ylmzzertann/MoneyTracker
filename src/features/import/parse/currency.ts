import { SUPPORTED_CURRENCIES } from '@/lib/money';

const SYMBOLS: Record<string, string> = { TL: 'TRY', '₺': 'TRY', YTL: 'TRY', $: 'USD', US$: 'USD', '€': 'EUR', '£': 'GBP' };

/** "TL", "₺", "try", "$" → ISO code; null when the text is not a known currency. */
export function currencyCode(raw: string | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  const upper = s.toUpperCase();
  if (SYMBOLS[upper]) return SYMBOLS[upper];
  return SUPPORTED_CURRENCIES.includes(upper) ? upper : null;
}
