import { strFromU8, unzipSync } from 'fflate';

import { decodeEntities, type Grid } from './delimited';

/** Built-in Excel number formats that show a date or time. */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

const attr = (tag: string, name: string) => new RegExp(String.raw`\b${name}="([^"]*)"`).exec(tag)?.[1];

/** Excel writes control characters as "_x000D_". */
const unescapeXlsx = (s: string) => s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

/** Joins the text runs of a shared or inline string, skipping phonetic hints. */
function textOf(xml: string): string {
  let out = '';
  for (const m of xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1];
  return unescapeXlsx(decodeEntities(out));
}

function sharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si\s*\/>/g)].map((m) => textOf(m[1] ?? ''));
}

function isDateFormat(code: string | undefined): boolean {
  if (!code) return false;
  const bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
  return /[dy]/i.test(bare) || /h/i.test(bare);
}

/** Indexes of cell styles (`s` attribute) that display a date. */
function dateStyles(xml: string | undefined): Set<number> {
  const result = new Set<number>();
  if (!xml) return result;
  const custom = new Map<number, string>();
  for (const m of xml.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = attr(m[0], 'numFmtId');
    if (id) custom.set(Number(id), decodeEntities(attr(m[0], 'formatCode') ?? ''));
  }
  const xfs = /<cellXfs\b[\s\S]*?<\/cellXfs>/.exec(xml)?.[0] ?? '';
  let index = 0;
  for (const m of xfs.matchAll(/<xf\b[^>]*>/g)) {
    const id = Number(attr(m[0], 'numFmtId') ?? 0);
    if (BUILTIN_DATE_FORMATS.has(id) || isDateFormat(custom.get(id))) result.add(index);
    index++;
  }
  return result;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Excel day serial (days since 1899-12-30) to "YYYY-MM-DD" or "YYYY-MM-DD HH:mm". */
export function serialToText(serial: number): string {
  if (!Number.isFinite(serial)) return '';
  const d = new Date(Math.round((serial - 25569) * 86400000));
  const date = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  return Math.abs(serial % 1) > 1e-9 ? `${date} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}` : date;
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b;

/** Reads the fullest worksheet of an .xlsx file as text cells. Dates become ISO text. */
export function readXlsx(bytes: Uint8Array): Grid {
  const files = unzipSync(bytes, { filter: (f) => f.name.startsWith('xl/') && f.name.endsWith('.xml') });
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : undefined);
  const sheets = Object.keys(files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .map((n) => text(n) ?? '');
  if (sheets.length === 0) throw new Error('No worksheet');
  const sheet = sheets.reduce((a, b) => ((b.match(/<row\b/g)?.length ?? 0) > (a.match(/<row\b/g)?.length ?? 0) ? b : a));
  const shared = sharedStrings(text('xl/sharedStrings.xml'));
  const dates = dateStyles(text('xl/styles.xml'));

  const grid: Grid = [];
  let nextRow = 0;
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = attr(rowMatch[1], 'r');
    const rowIndex = r ? Number(r) - 1 : nextRow;
    nextRow = rowIndex + 1;
    const body = rowMatch[2];
    if (!body) continue;
    const row: string[] = [];
    let col = 0;
    for (const c of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const inner = c[2] ?? '';
      const ref = attr(attrs, 'r');
      if (ref) col = columnIndex(ref);
      const type = attr(attrs, 't');
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(inner);
      else if (type === 'str' || type === 'e') value = v ? unescapeXlsx(decodeEntities(v)) : '';
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (type === 'd') value = v ?? '';
      else if (v !== undefined) value = dates.has(Number(attr(attrs, 's') ?? 0)) ? serialToText(Number(v)) : v;
      row[col] = value.trim();
      col++;
    }
    grid[rowIndex] = Array.from(row, (cell) => cell ?? '');
  }
  return grid.filter((row) => row && row.some((c) => c !== ''));
}
