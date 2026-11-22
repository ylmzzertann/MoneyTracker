import { normalizeName } from '@/lib/text';

/** Payment processors and card-network words banks put in front of the real merchant. */
const PREFIXES = [
  'pos', 'pos islem', 'pos harcama', 'harcama', 'alisveris', 'e ticaret', 'eticaret', 'internet', 'sanal pos', 'vpos',
  'iyz', 'iyzico', 'paytr', 'param', 'sq', 'tst', 'pp', 'paypal', 'apple pay', 'google pay', 'card purchase',
  'debit card purchase', 'purchase', 'purchase authorized on', 'recurring payment', 'pos purchase', 'pos debit',
  'ach debit', 'online payment', 'checkcard', 'point of sale',
];

/** Tokens that only say where or how the card was used. */
const TRAILING = new Set(['tr', 'tur', 'turkey', 'turkiye', 'us', 'usa', 'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'ist', 'ank']);

function titleCase(word: string, locale: 'tr' | 'en'): string {
  if (word.length <= 3 || /\d/.test(word)) return word;
  const lower = word.replace(/[İI]/g, 'i').toLowerCase();
  const first = lower[0] === 'i' ? (locale === 'tr' ? 'İ' : 'I') : lower[0].toLocaleUpperCase(locale);
  return first + lower.slice(1);
}

/**
 * Turns a bank description into a merchant name:
 * "POS IYZICO*MIGROS KADIKOY 4543****1234 ISTANBUL TR" → "Migros Kadikoy".
 */
export function cleanMerchant(raw: string, locale: 'tr' | 'en'): string {
  const s = raw
    .replace(/\b\d{4,6}[*xX•]{2,}\d{2,4}\b/g, ' ')
    .replace(/[*xX•]{3,}\d{2,4}/g, ' ')
    .replace(/\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\b[A-Z]*\d{5,}[A-Z\d]*\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let words = s.split(/[\s*/]+/).filter((w) => /[A-Za-z0-9À-ɏ]/.test(w));
  for (let changed = true; changed; ) {
    changed = false;
    for (let n = Math.min(4, words.length - 1); n >= 1; n--) {
      if (PREFIXES.includes(normalizeName(words.slice(0, n).join(' ')))) {
        words = words.slice(n);
        changed = true;
        break;
      }
    }
  }

  // Trailing places and store numbers ("STARBUCKS 0042 ISTANBUL TR").
  const isTail = (w: string) => TRAILING.has(normalizeName(w)) || /^#?\d+$/.test(w);
  while (words.length > 1 && isTail(words[words.length - 1])) words.pop();
  const kept = words.slice(0, 4).map((w) => w.replace(/^[*#\-/.]+|[*#\-/.,]+$/g, '')).filter(Boolean);
  const shouting = kept.join('') === kept.join('').toUpperCase();
  const name = (shouting ? kept.map((w) => titleCase(w, locale)) : kept).join(' ');
  return name.slice(0, 40).trim();
}

const CARD_PAYMENT = [
  'odeme tesekkur', 'odemeniz icin tesekkur', 'kart odemesi', 'karti odemesi', 'kart odemeniz', 'karti odemeniz', 'borc odeme', 'ekstre odemesi',
  'payment thank you', 'autopay payment', 'online payment thank', 'payment received', 'mobile payment thank',
];

/** "ÖDEME - TEŞEKKÜR EDERİZ" on a card statement is money moving between your own accounts. */
export function looksLikeCardPayment(description: string): boolean {
  const n = normalizeName(description);
  return CARD_PAYMENT.some((p) => n.includes(p));
}
