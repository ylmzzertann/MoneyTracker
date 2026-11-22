/** Which character separates the cents: "1.234,56" uses ',', "1,234.56" uses '.'. */
export type DecimalMark = ',' | '.';

/**
 * Guesses the decimal mark from a sample of amount strings. A single mark
 * followed by exactly three digits ("1.250") is ambiguous and not counted.
 */
export function detectDecimalMark(samples: string[], fallback: DecimalMark): DecimalMark {
  let comma = 0;
  let dot = 0;
  for (const raw of samples) {
    const s = raw.replace(/[^\d.,]/g, '');
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) comma++;
      else dot++;
      continue;
    }
    const mark = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : null;
    if (!mark) continue;
    const parts = s.split(mark);
    if (parts.length > 2) {
      // "1.234.567" — the repeated mark is grouping, so the other one is decimal.
      if (mark === '.') comma++;
      else dot++;
      continue;
    }
    if (parts[1].length !== 3) {
      if (mark === ',') comma++;
      else dot++;
    }
  }
  if (comma === dot) return fallback;
  return comma > dot ? ',' : '.';
}

/**
 * Parses a money string into a signed number in major units:
 * "1.234,56" → 1234.56, "(12.50)" → -12.5, "45,00-" → -45, "-₺1.234" → -1234.
 */
export function parseAmount(raw: string, mark: DecimalMark): number | null {
  const s = raw.trim();
  if (!/\d/.test(s)) return null;
  const negative = /^\(.*\)$/.test(s) || /^[^\d]*[-−–]/.test(s) || /\d\s*[-−–]$/.test(s);
  const digits = s.replace(/[^\d.,]/g, '');
  const grouping = mark === ',' ? '.' : ',';
  const plain = digits.split(grouping).join('').replace(mark, '.');
  if (plain.split('.').length > 2) return null;
  const n = Number(plain);
  if (!Number.isFinite(n)) return null;
  return negative && n !== 0 ? -n : n;
}
