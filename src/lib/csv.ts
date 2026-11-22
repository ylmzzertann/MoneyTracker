/**
 * CSV builder that opens cleanly in Excel and Google Sheets in both regions:
 * Turkish Excel expects ";" as the separator and "," as the decimal mark.
 */

export type CsvOptions = { separator: ',' | ';' };

export function csvOptionsForLocale(locale: string): CsvOptions {
  const decimal = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value;
  return { separator: decimal === ',' ? ';' : ',' };
}

function escapeCell(value: string, sep: string): string {
  const needsQuotes = value.includes(sep) || value.includes('"') || value.includes('\n') || value.includes('\r');
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function buildCsv(header: string[], rows: (string | number | null)[][], opts: CsvOptions): string {
  const lines = [header, ...rows].map((r) =>
    r.map((c) => escapeCell(c === null || c === undefined ? '' : String(c), opts.separator)).join(opts.separator),
  );
  // BOM so Excel detects UTF-8 (Turkish characters).
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Plain decimal number (no grouping) using the locale's decimal mark. */
export function csvNumber(major: number, decimals: number, opts: CsvOptions): string {
  const s = major.toFixed(decimals);
  return opts.separator === ';' ? s.replace('.', ',') : s;
}
