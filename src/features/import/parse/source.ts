import { looksLikeHtml, parseDelimited, parseHtmlTable, type Grid } from './delimited';
import { decodeText } from './encoding';
import { isZip, readXlsx } from './xlsx';

/** Why a file could not be read; each has its own message. */
export type ImportProblem = 'empty' | 'pdf' | 'oldExcel' | 'tooLarge' | 'unreadable' | 'noRows' | 'noColumns' | 'noMessages';

export class ImportError extends Error {
  readonly problem: ImportProblem;
  constructor(problem: ImportProblem) {
    super(problem);
    this.problem = problem;
  }
}

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);

/** CSV, TSV, HTML-as-xls and xlsx bytes to cells. PDF and old binary .xls need the AI path. */
export function gridFromBytes(bytes: Uint8Array): Grid {
  if (bytes.length === 0) throw new ImportError('empty');
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) throw new ImportError('pdf');
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) throw new ImportError('oldExcel');
  let grid: Grid;
  try {
    if (isZip(bytes)) grid = readXlsx(bytes);
    else {
      const text = decodeText(bytes);
      grid = looksLikeHtml(text) ? parseHtmlTable(text) : parseDelimited(text);
    }
  } catch {
    throw new ImportError('unreadable');
  }
  if (grid.length === 0) throw new ImportError('noRows');
  return grid;
}

/** Rows copied from Excel or a bank's web page arrive tab-separated. */
export function looksTabular(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return false;
  const tabbed = lines.filter((l) => (l.match(/\t/g)?.length ?? 0) >= 2).length;
  return tabbed >= lines.length * 0.6;
}
