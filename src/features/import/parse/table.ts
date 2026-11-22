import { normalizeName } from '@/lib/text';

import type { ImportCandidate } from '../types';
import { detectDecimalMark, parseAmount, type DecimalMark } from './amount';
import { currencyCode } from './currency';
import { detectDateOrder, parseDateText, partsToLocalISO, type DateOrder } from './date';
import type { Grid } from './delimited';
import { fingerprint } from './fingerprint';
import { cleanMerchant, looksLikeCardPayment } from './merchant';

/** Which column holds what. A statement has one signed amount column or separate out/in columns. */
export type TableMapping = {
  /** -1 when the file has no header row. */
  headerRow: number;
  date: number;
  /** -1 when no column describes the transaction. */
  description: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  currency: number | null;
  decimal: DecimalMark;
  dateOrder: DateOrder;
  /** For a single amount column: whether money going out is written negative (bank) or positive (card). */
  expenseSign: 'negative' | 'positive';
};

type Role = 'date' | 'description' | 'amount' | 'debit' | 'credit' | 'currency' | 'balance' | 'ignore';

const HEADER_WORDS: [Role, string[]][] = [
  ['date', ['tarih', 'islem tarihi', 'date', 'transaction date', 'trans date', 'posting date', 'posted date', 'post date']],
  ['ignore', ['valor', 'valor tarihi', 'value date', 'saat', 'time', 'fis no', 'dekont no', 'reference', 'referans', 'kategori', 'category', 'type', 'islem turu', 'kanal', 'channel', 'status', 'durum', 'kart no', 'card no', 'check or slip']],
  ['description', ['aciklama', 'islem aciklamasi', 'islem detayi', 'description', 'details', 'merchant', 'merchant name', 'payee', 'name', 'memo', 'islem', 'isyeri', 'isyeri adi', 'detay', 'narrative', 'karsi taraf']],
  ['amount', ['tutar', 'islem tutari', 'tutar tl', 'tl tutar', 'tutari', 'amount', 'miktar', 'transaction amount', 'tutar try']],
  ['debit', ['borc', 'debit', 'debits', 'withdrawal', 'withdrawals', 'cikan', 'giden', 'money out', 'paid out']],
  ['credit', ['alacak', 'credit', 'credits', 'deposit', 'deposits', 'giren', 'gelen', 'money in', 'paid in']],
  ['currency', ['para birimi', 'doviz', 'doviz cinsi', 'currency', 'ccy']],
  ['balance', ['bakiye', 'balance', 'running balance', 'kalan bakiye', 'ledger balance']],
];

/** Best role for a header cell: exact words win over words found inside a longer header. */
export function headerRole(cell: string): Role | null {
  const n = normalizeName(cell);
  if (!n) return null;
  let best: Role | null = null;
  let bestScore = 0;
  for (const [role, words] of HEADER_WORDS) {
    for (const w of words) {
      const score = n === w ? 100 + w.length : ` ${n} `.includes(` ${w} `) ? w.length : 0;
      if (score > bestScore) {
        bestScore = score;
        best = role;
      }
    }
  }
  return best;
}

function findHeader(grid: Grid): { row: number; roles: (Role | null)[] } | null {
  for (let r = 0; r < Math.min(40, grid.length); r++) {
    const roles = grid[r].map(headerRole);
    if (roles.includes('date') && roles.some((x) => x === 'amount' || x === 'debit' || x === 'credit')) return { row: r, roles };
  }
  return null;
}

const share = (values: string[], ok: (v: string) => boolean) => (values.length ? values.filter(ok).length / values.length : 0);

/** Works out the column layout from header words, falling back to what the cells contain. */
export function detectMapping(grid: Grid, defaults: { decimal: DecimalMark; dateOrder: DateOrder }): TableMapping | null {
  const header = findHeader(grid);
  const headerRow = header?.row ?? -1;
  const body = grid.slice(headerRow + 1, headerRow + 201);
  const width = Math.max(0, ...grid.map((r) => r.length));
  const column = (i: number) => body.map((r) => r[i] ?? '').filter((v) => v !== '');

  let date = -1;
  let description = -1;
  let amount: number | null = null;
  let debit: number | null = null;
  let credit: number | null = null;
  let currency: number | null = null;
  const taken = new Set<number>();

  if (header) {
    for (const [i, role] of header.roles.entries()) {
      if (role) taken.add(i);
      if (role === 'date' && date < 0) date = i;
      else if (role === 'description' && description < 0) description = i;
      else if (role === 'amount' && amount === null) amount = i;
      else if (role === 'debit' && debit === null) debit = i;
      else if (role === 'credit' && credit === null) credit = i;
      else if (role === 'currency' && currency === null) currency = i;
    }
    if (amount !== null || debit === null || credit === null) {
      amount ??= debit ?? credit;
      debit = null;
      credit = null;
    }
  } else {
    const isDate = (v: string) => parseDateText(v, defaults.dateOrder) !== null;
    const isMoney = (v: string) => /\d[.,]\d{2}\b/.test(v) && parseAmount(v, detectDecimalMark([v], defaults.decimal)) !== null;
    for (let i = 0; i < width && date < 0; i++) if (share(column(i), isDate) >= 0.6) date = i;
    for (let i = 0; i < width && amount === null; i++) if (i !== date && share(column(i), isMoney) >= 0.6) amount = i;
    taken.add(date);
    if (amount !== null) taken.add(amount);
  }

  if (description < 0) {
    let bestLength = 0;
    for (let i = 0; i < width; i++) {
      if (taken.has(i) || i === date || i === amount) continue;
      const values = column(i).filter((v) => /[A-Za-zÀ-ɏ]{3}/.test(v));
      const avg = values.reduce((s, v) => s + v.length, 0) / Math.max(1, column(i).length);
      if (avg > bestLength) {
        bestLength = avg;
        description = i;
      }
    }
  }

  if (date < 0 || (amount === null && (debit === null || credit === null))) return null;
  const moneyColumns = [amount, debit, credit].filter((c): c is number => c !== null);
  const decimal = detectDecimalMark(moneyColumns.flatMap(column), defaults.decimal);
  const dateOrder = detectDateOrder(column(date), defaults.dateOrder);
  let negatives = 0;
  let positives = 0;
  if (amount !== null) {
    for (const v of column(amount)) {
      const n = parseAmount(v, decimal);
      if (n !== null && n < 0) negatives++;
      else if (n !== null && n > 0) positives++;
    }
  }
  return {
    headerRow,
    date,
    description,
    amount,
    debit,
    credit,
    currency,
    decimal,
    dateOrder,
    expenseSign: negatives > positives ? 'negative' : 'positive',
  };
}

/** Header labels for the column chips ("Column 3" when the file has no header). */
export function columnLabels(grid: Grid, mapping: Pick<TableMapping, 'headerRow'>): string[] {
  const width = Math.max(0, ...grid.map((r) => r.length));
  const header = mapping.headerRow >= 0 ? grid[mapping.headerRow] : [];
  return Array.from({ length: width }, (_, i) => header[i]?.trim() || '');
}

/** Statement rows to candidates. Rows without a date or a non-zero amount (totals, notes) are skipped. */
export function tableCandidates(grid: Grid, m: TableMapping, locale: 'tr' | 'en'): ImportCandidate[] {
  const out: ImportCandidate[] = [];
  const seen = new Map<string, number>();
  for (let r = m.headerRow + 1; r < grid.length; r++) {
    const row = grid[r];
    const parts = parseDateText(row[m.date] ?? '', m.dateOrder);
    if (!parts) continue;
    let signed: number | null = null; // positive = money in
    if (m.amount !== null) {
      const v = parseAmount(row[m.amount] ?? '', m.decimal);
      if (v === null) continue;
      signed = m.expenseSign === 'negative' ? v : -v;
    } else {
      const moneyOut = parseAmount(row[m.debit ?? -1] ?? '', m.decimal);
      const moneyIn = parseAmount(row[m.credit ?? -1] ?? '', m.decimal);
      if (moneyOut) signed = -Math.abs(moneyOut);
      else if (moneyIn) signed = Math.abs(moneyIn);
    }
    if (!signed) continue;

    const description = (m.description >= 0 ? (row[m.description] ?? '') : '').replace(/\s+/g, ' ').trim();
    const occurredAt = partsToLocalISO(parts);
    const amount = Math.abs(signed);
    const kind = signed < 0 ? 'expense' : 'income';
    const base = [occurredAt.slice(0, 10), amount.toFixed(2), kind, normalizeName(description)].join('|');
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push({
      key: `imp:${fingerprint(`${base}|${n}`)}`,
      kind,
      amount,
      currency: m.currency !== null ? currencyCode(row[m.currency]) : null,
      occurredAt,
      description,
      merchantName: cleanMerchant(description, locale),
      last4: null,
      hint: looksLikeCardPayment(description) ? 'cardPayment' : null,
    });
  }
  return out;
}
