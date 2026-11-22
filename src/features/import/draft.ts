import { create } from 'zustand';

import { normalizeName } from '@/lib/text';
import type { Region } from '@/store/settings';

import type { DecimalMark } from './parse/amount';
import type { DateOrder } from './parse/date';
import { parseDelimited, type Grid } from './parse/delimited';
import { fingerprint } from './parse/fingerprint';
import { parseMessages } from './parse/sms';
import { ImportError, looksTabular } from './parse/source';
import { detectMapping, tableCandidates, type TableMapping } from './parse/table';
import type { ImportCandidate, ImportSource } from './types';

/** What a review screen works on: the parsed rows plus what is needed to re-read them. */
export type ImportDraft = {
  source: ImportSource;
  /** File name, or null for pasted text. */
  fileName: string | null;
  /** Statement cells, kept so the column choice can change during review. */
  grid: Grid | null;
  mapping: TableMapping | null;
  /** Identifies the statement layout, so the account and sign chosen for it are remembered. */
  layout: string | null;
  candidates: ImportCandidate[];
  /** Pasted messages that held no transaction. */
  unread: number;
};

export const useImportDraft = create<{ draft: ImportDraft | null; setDraft: (draft: ImportDraft | null) => void }>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
}));

export type ParseDefaults = { decimal: DecimalMark; dateOrder: DateOrder; locale: 'tr' | 'en' };

/** Number and date conventions to assume when a file does not make them obvious. */
export function parseDefaults(region: Region, language: 'tr' | 'en'): ParseDefaults {
  if (region === 'US') return { decimal: '.', dateOrder: 'mdy', locale: language };
  if (region === 'TR') return { decimal: ',', dateOrder: 'dmy', locale: language };
  return { decimal: language === 'tr' ? ',' : '.', dateOrder: 'dmy', locale: language };
}

/** A statement grid to a draft. Throws when no date and amount columns can be found. */
export function draftFromGrid(grid: Grid, fileName: string | null, defaults: ParseDefaults): ImportDraft {
  const mapping = detectMapping(grid, defaults);
  if (!mapping) throw new ImportError('noColumns');
  const header = mapping.headerRow >= 0 ? grid[mapping.headerRow] : [];
  const layout = fingerprint(`${grid[0]?.length ?? 0}|${header.map(normalizeName).join('|')}`);
  const candidates = tableCandidates(grid, mapping, defaults.locale);
  if (candidates.length === 0) throw new ImportError('noRows');
  return { source: 'statement', fileName, grid, mapping, layout, candidates, unread: 0 };
}

/** Pasted text: rows copied from a spreadsheet, or one or more bank messages. */
export function draftFromText(text: string, defaults: ParseDefaults, now: Date): ImportDraft {
  if (!text.trim()) throw new ImportError('empty');
  if (looksTabular(text)) return draftFromGrid(parseDelimited(text, '\t'), null, defaults);
  const { candidates, unread } = parseMessages(text, { ...defaults, now });
  if (candidates.length === 0) throw new ImportError('noMessages');
  return { source: 'sms', fileName: null, grid: null, mapping: null, layout: null, candidates, unread };
}
