import { daysInMonth } from '@/features/plan/schedule';
import { toLocalISO } from '@/lib/dates';
import { normalizeName } from '@/lib/text';

/** Order of day and month in numeric dates: 12.11.2026 (TR) or 11/12/2026 (US). */
export type DateOrder = 'dmy' | 'mdy';

export type DateParts = { y: number; m: number; d: number; hh: number; mm: number };

/** First three letters of Turkish and English month names, accents removed. */
const MONTH_PREFIX: Record<string, number> = {
  oca: 1, jan: 1, sub: 2, feb: 2, mar: 3, nis: 4, apr: 4, may: 5, haz: 6, jun: 6,
  tem: 7, jul: 7, agu: 8, aug: 8, eyl: 9, sep: 9, eki: 10, oct: 10, kas: 11, nov: 11, ara: 12, dec: 12,
};

export function monthFromName(word: string): number | null {
  return MONTH_PREFIX[normalizeName(word).slice(0, 3)] ?? null;
}

const TIME = String.raw`(?:[ ,T]+(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?)?`;
const ISO = new RegExp(String.raw`\b(\d{4})[-./](\d{1,2})[-./](\d{1,2})` + TIME);
const NUMERIC = new RegExp(String.raw`\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b` + TIME);
const NAMED_DMY = new RegExp(String.raw`\b(\d{1,2})[\s.-]+([A-Za-zÇĞİÖŞÜçğıöşü]{3,9})\.?[\s.-]+(\d{4})` + TIME);
const NAMED_MDY = new RegExp(String.raw`\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})` + TIME);
const SHORT = new RegExp(String.raw`\b(\d{1,2})[./](\d{1,2})\b(?![./]?\d)` + TIME, 'g');

function build(y: number, m: number, d: number, hh?: string, mm?: string): DateParts | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m - 1)) return null;
  const h = hh === undefined ? 12 : Number(hh);
  const min = mm === undefined ? 0 : Number(mm);
  if (h > 23 || min > 59) return null;
  return { y, m, d, hh: h, mm: min };
}

/** Finds a full date (with year) anywhere in `raw`. Dates without a time get 12:00. */
export function parseDateText(raw: string, order: DateOrder): DateParts | null {
  let m = ISO.exec(raw);
  if (m) return build(+m[1], +m[2], +m[3], m[4], m[5]);
  m = NUMERIC.exec(raw);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return order === 'mdy' ? build(y, a, b, m[4], m[5]) : build(y, b, a, m[4], m[5]);
  }
  m = NAMED_DMY.exec(raw);
  if (m) {
    const month = monthFromName(m[2]);
    if (month) return build(+m[3], month, +m[1], m[4], m[5]);
  }
  m = NAMED_MDY.exec(raw);
  if (m) {
    const month = monthFromName(m[1]);
    if (month) return build(+m[3], month, +m[2], m[4], m[5]);
  }
  return null;
}

/**
 * A day and month without a year ("12.11 14:35"), as bank SMS often write it.
 * The year is the one that puts the date closest before `now`.
 */
export function parseShortDate(raw: string, order: DateOrder, now: Date): DateParts | null {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  for (const m of raw.matchAll(SHORT)) {
    const a = +m[1];
    const b = +m[2];
    const [day, month] = order === 'mdy' ? [b, a] : [a, b];
    let y = now.getFullYear();
    if (new Date(y, month - 1, day) > tomorrow) y -= 1;
    const parts = build(y, month, day, m[3], m[4]);
    if (parts) return parts;
  }
  return null;
}

/** Picks the day/month order from samples: any first part above 12 means day first. */
export function detectDateOrder(samples: string[], fallback: DateOrder): DateOrder {
  let dmy = 0;
  let mdy = 0;
  for (const s of samples) {
    if (ISO.test(s)) continue;
    const m = NUMERIC.exec(s);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    if (+m[2] > 12) mdy++;
  }
  if (dmy === mdy) return fallback;
  return dmy > mdy ? 'dmy' : 'mdy';
}

export function partsToLocalISO(p: DateParts): string {
  return toLocalISO(new Date(p.y, p.m - 1, p.d, p.hh, p.mm));
}
