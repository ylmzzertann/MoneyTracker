import { buildCsv, csvNumber, csvOptionsForLocale } from '@/lib/csv';
import { normalizeName } from '@/lib/text';

describe('csv', () => {
  it('uses ";" and decimal commas for Turkish, "," for US English', () => {
    expect(csvOptionsForLocale('tr-TR').separator).toBe(';');
    expect(csvOptionsForLocale('en-US').separator).toBe(',');
    expect(csvNumber(12.5, 2, { separator: ';' })).toBe('12,50');
    expect(csvNumber(12.5, 2, { separator: ',' })).toBe('12.50');
  });

  it('quotes cells that contain separators, quotes or new lines and adds a BOM', () => {
    const out = buildCsv(['a', 'b'], [['x,y', 'say "hi"'], ['line\nbreak', null]], { separator: ',' });
    expect(out.startsWith('﻿')).toBe(true);
    expect(out).toContain('"x,y","say ""hi"""');
    expect(out).toContain('"line\nbreak",');
  });
});

describe('normalizeName', () => {
  it('matches Turkish merchant spellings regardless of case and punctuation', () => {
    expect(normalizeName('MİGROS  A.Ş.')).toBe(normalizeName('migros as'));
    expect(normalizeName('Şok Market')).toBe('sok market');
    expect(normalizeName('IKEA')).toBe('ikea');
    expect(normalizeName("Trader Joe's")).toBe('trader joes');
    expect(normalizeName('7-Eleven / Store #12')).toBe('7 eleven store 12');
  });
});
