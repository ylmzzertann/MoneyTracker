import type { TxKind } from '@/db/types';
import { toLocalISO } from '@/lib/dates';
import { normalizeName } from '@/lib/text';

import type { ImportCandidate } from '../types';
import { parseAmount, type DecimalMark } from './amount';
import { currencyCode } from './currency';
import { parseDateText, parseShortDate, partsToLocalISO, type DateOrder } from './date';
import { fingerprint } from './fingerprint';
import { cleanMerchant, looksLikeCardPayment } from './merchant';

const NUM = String.raw`(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
const CUR = String.raw`(TL|TRY|YTL|USD|US\$|EUR|GBP|₺|\$|€|£)`;
const LETTER = 'A-Za-zÀ-ɏ';
const AMOUNT_AFTER = new RegExp(String.raw`(^|[^\d.,])${NUM}\s?${CUR}(?![${LETTER}])`, 'g');
const AMOUNT_BEFORE = new RegExp(String.raw`(^|[^${LETTER}])${CUR}\s?${NUM}(?![\d])`, 'g');

/** Amounts right after these words are limits, balances or points, not the transaction. */
const NOT_THE_AMOUNT = [
  'limit', 'limitiniz', 'bakiye', 'bakiyeniz', 'balance', 'available', 'kullanilabilir', 'borcunuz', 'borc', 'asgari',
  'minimum', 'kalan', 'puan', 'bonus', 'maxipuan', 'worldpuan', 'chip para', 'cashback', 'kazandiniz',
];

/** Word starts that mark one-time codes and 3-D Secure prompts, which are not transactions yet. */
const ONE_TIME_CODE = ['sifre', 'dogrulama', 'kodunuz', 'password', 'verification', 'otp ', 'passcode', 'one time'];
const REFUND = ['iade', 'iadesi', 'refund', 'refunded', 'reversal'];
const INCOME = ['yatirildi', 'yatirilmistir', 'yatan', 'gelen', 'geldi', 'gelmistir', 'hesabiniza', 'alacak', 'credited', 'deposit', 'deposited', 'received', 'maas', 'salary', 'payroll'];
const EXPENSE = ['harcama', 'harcamaniz', 'odeme', 'odemesi', 'cekildi', 'cekilmistir', 'cekim', 'alisveris', 'purchase', 'spent', 'charged', 'debited', 'withdrawal', 'withdrawn', 'paid', 'tahsil', 'gonderildi'];

/** Bank and card words that are never the merchant. */
const STOPWORDS = new Set([
  'tl', 'try', 'usd', 'eur', 'gbp', 'kart', 'karti', 'kartiniz', 'kartinizdan', 'kartinizla', 'kredi', 'banka', 'bankasi',
  'bank', 'pos', 'atm', 'visa', 'mastercard', 'troy', 'amex', 'garanti', 'bbva', 'akbank', 'yapi', 'isbank',
  'is', 'ziraat', 'vakifbank', 'halkbank', 'qnb', 'enpara', 'denizbank', 'teb', 'ing', 'hsbc', 'chase', 'citi',
  'wells', 'fargo', 'capital', 'one', 'discover', 'boa', 'sayin', 'musterimiz', 'bilgi', 'info',
]);

type AmountHit = { index: number; length: number; amount: number; currency: string };

function decimalFor(num: string, currency: string, fallback: DecimalMark): DecimalMark {
  const lastComma = num.lastIndexOf(',');
  const lastDot = num.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) return lastComma > lastDot ? ',' : '.';
  const mark = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : null;
  if (!mark) return fallback;
  const tail = num.length - num.lastIndexOf(mark) - 1;
  if (tail !== 3) return mark;
  // "1.250 TL" — three digits after a single mark are thousands.
  return mark === ',' ? '.' : ',';
}

function findAmounts(text: string, fallback: DecimalMark): AmountHit[] {
  const hits: AmountHit[] = [];
  for (const [re, numAt, curAt] of [
    [AMOUNT_AFTER, 2, 3],
    [AMOUNT_BEFORE, 3, 2],
  ] as const) {
    for (const m of text.matchAll(re)) {
      const currency = currencyCode(m[curAt]);
      const value = currency ? parseAmount(m[numAt], decimalFor(m[numAt], currency, fallback)) : null;
      if (!currency || !value) continue;
      const index = (m.index ?? 0) + m[1].length;
      hits.push({ index, length: m[0].length - m[1].length, amount: value, currency });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/** The first amount that is not a limit, a balance or reward points. */
function transactionAmount(text: string, fallback: DecimalMark): AmountHit | null {
  for (const hit of findAmounts(text, fallback)) {
    const before = ` ${normalizeName(text.slice(Math.max(0, hit.index - 28), hit.index))} `;
    if (!NOT_THE_AMOUNT.some((w) => before.includes(` ${w} `))) return hit;
  }
  return null;
}

const hasWord = (tokens: string[], words: string[]) => tokens.some((t) => words.some((w) => t === w || (w.length >= 5 && t.startsWith(w))));

function kindOf(text: string): TxKind {
  const tokens = normalizeName(text).split(' ');
  if (hasWord(tokens, REFUND)) return 'income';
  return hasWord(tokens, INCOME) && !hasWord(tokens, EXPENSE) ? 'income' : 'expense';
}

const UPPER_RUN = /((?:[A-ZÇĞİÖŞÜ0-9][A-ZÇĞİÖŞÜ0-9&.'*-]*\s?){1,5})$/;

function withoutStopwords(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(normalizeName(w)))
    .join(' ');
}

/** Merchant name from the usual Turkish and US phrasings. */
function merchantOf(text: string): string {
  const at = /(?:\bat|@)\s+([A-Z0-9][A-Za-z0-9&'.* -]{1,40}?)(?=\s+(?:on|for|with|using|was|is|in)\b|[.,;!]|$)/i.exec(text);
  if (at) return withoutStopwords(at[1]);
  const shop = /\s(?:isimli\s+|adl[ıi]\s+)?(?:[üu]ye\s+)?i[şs]yer(?:in(?:de|den)|i)\b/i.exec(text);
  if (shop) {
    const run = UPPER_RUN.exec(text.slice(0, shop.index).trimEnd());
    if (run) return withoutStopwords(run[1]);
  }
  const suffix =
    /([A-ZÇĞİÖŞÜ0-9][A-ZÇĞİÖŞÜ0-9&.*\- ]{1,40}?|[A-ZÇĞİÖŞÜ][a-zçğıöşü0-9&]{1,30})['’](?:dan|den|tan|ten|da|de|ta|te|DAN|DEN|TAN|TEN|DA|DE|TA|TE)\b/.exec(text);
  if (suffix) return withoutStopwords(suffix[1]);
  const to = /\bto\s+([A-Z][A-Za-z0-9&'.* -]{1,40}?)(?=\s+(?:on|for)\b|[.,;!]|$)/.exec(text);
  if (to) return withoutStopwords(to[1]);
  return '';
}

const LAST4 = [/(?:\*{2,}|[xX]{2,}|•{2,}|ending in|ending with|ends with|son 4 hanesi|sonu)\s*(\d{4})\b/i, /\b(\d{4})\s*(?:ile biten|ile sonlanan|sonlu|no['’]?lu)/i];

export function findLast4(text: string): string | null {
  for (const re of LAST4) {
    const m = re.exec(text);
    if (m) return m[1];
  }
  return null;
}

/** Splits pasted text into messages: blank lines separate them, or one per line when most lines hold an amount. */
export function splitMessages(text: string, fallback: DecimalMark): string[] {
  const out: string[] = [];
  for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;
    const withAmount = lines.filter((l) => transactionAmount(l, fallback)).length;
    if (lines.length > 1 && withAmount >= 2 && withAmount >= lines.length * 0.6) out.push(...lines);
    else out.push(lines.join(' '));
  }
  return out;
}

export type MessageOptions = { decimal: DecimalMark; dateOrder: DateOrder; locale: 'tr' | 'en'; now: Date };

/** One bank message to a candidate, or null for codes, notices and anything without an amount. */
export function parseMessage(message: string, opts: MessageOptions): ImportCandidate | null {
  const text = message.replace(/\s+/g, ' ').trim();
  const spaced = ` ${normalizeName(text)} `;
  if (ONE_TIME_CODE.some((w) => spaced.includes(` ${w}`))) return null;
  const hit = transactionAmount(text, opts.decimal);
  if (!hit) return null;

  // Amounts such as "12.05 TL" would otherwise read as dates.
  let dateText = text;
  for (const a of findAmounts(text, opts.decimal).reverse()) {
    dateText = dateText.slice(0, a.index) + ' ' + dateText.slice(a.index + a.length);
  }
  const parts = parseDateText(dateText, opts.dateOrder) ?? parseShortDate(dateText, opts.dateOrder, opts.now);
  const merchant = merchantOf(text);
  return {
    key: `sms:${fingerprint(normalizeName(text))}`,
    kind: kindOf(text),
    amount: Math.abs(hit.amount),
    currency: hit.currency,
    occurredAt: parts ? partsToLocalISO(parts) : toLocalISO(opts.now),
    description: text,
    merchantName: merchant ? cleanMerchant(merchant, opts.locale) : '',
    last4: findLast4(text),
    hint: looksLikeCardPayment(text) ? 'cardPayment' : null,
  };
}

/** Parses everything pasted at once. `unread` counts messages that held no transaction. */
export function parseMessages(text: string, opts: MessageOptions): { candidates: ImportCandidate[]; unread: number } {
  const candidates: ImportCandidate[] = [];
  let unread = 0;
  const keys = new Set<string>();
  for (const message of splitMessages(text, opts.decimal)) {
    const c = parseMessage(message, opts);
    if (!c) unread++;
    else if (!keys.has(c.key)) {
      keys.add(c.key);
      candidates.push(c);
    }
  }
  return { candidates, unread };
}
