/** A sheet as plain text cells: rows of columns. */
export type Grid = string[][];

const SEPARATORS = ['\t', ';', ',', '|'] as const;

/** The separator whose count is the same on the most lines (outside quotes). */
export function detectSeparator(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 30);
  let best: string = ',';
  let bestScore = 0;
  for (const sep of SEPARATORS) {
    const counts = lines.map((l) => l.replace(/"[^"]*"/g, '').split(sep).length - 1);
    const freq = new Map<number, number>();
    for (const c of counts) if (c > 0) freq.set(c, (freq.get(c) ?? 0) + 1);
    let score = 0;
    for (const [cols, n] of freq) score = Math.max(score, n * 100 + cols);
    if (score > bestScore) {
      bestScore = score;
      best = sep;
    }
  }
  return best;
}

/** Parses CSV/TSV text (quotes, doubled quotes, line breaks inside quotes). Empty rows are dropped. */
export function parseDelimited(input: string, separator?: string): Grid {
  const text = input.replace(/^﻿/, '');
  const sep = separator ?? detectSeparator(text);
  const rows: Grid = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (ch === sep) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  rows.push(row);
  return rows.filter((r) => r.some((c) => c !== ''));
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Many banks' ".xls" downloads are really HTML tables. Reads the largest table's rows. */
export function parseHtmlTable(html: string): Grid {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [html];
  let best: Grid = [];
  for (const table of tables) {
    const rows: Grid = [];
    for (const tr of table.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const cells = (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map((td) =>
        decodeEntities(td.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
          .replace(/\s+/g, ' ')
          .trim(),
      );
      if (cells.some((c) => c !== '')) rows.push(cells);
    }
    if (rows.length > best.length) best = rows;
  }
  return best;
}

export const looksLikeHtml = (text: string) => /<table[\s>]/i.test(text.slice(0, 20000));
