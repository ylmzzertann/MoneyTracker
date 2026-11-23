import { csvOptionsForLocale } from '@/lib/csv';
import { decimalSeparator, formatMoney, formatPercent } from '@/lib/money';
import { normalizeName } from '@/lib/text';

/**
 * Hermes (the engine in Expo Go and release builds) implements only part of
 * Intl, and iOS less than Android: no formatToParts, no PluralRules, and
 * NumberFormat ignores signDisplay / notation. Jest runs on Node, which has all
 * of it, so these tests keep such calls out of the source and check that the
 * formatting helpers work without them.
 */

// Jest runs on Node, but the app's tsconfig has no Node types: type just the calls used here.
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = require('fs') as {
  readdirSync: (path: string) => string[];
  readFileSync: (path: string, encoding: 'utf8') => string;
  statSync: (path: string) => { isDirectory: () => boolean };
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const SRC = join(__dirname, '..', 'src');
const UNSUPPORTED = [
  /formatToParts/,
  /Intl\.(PluralRules|RelativeTimeFormat|ListFormat|DisplayNames|Segmenter|Locale)\b/,
  /\bsignDisplay\b/,
  /\bnotation\s*[:=]/,
  /\bcompactDisplay\b/,
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('Hermes compatibility', () => {
  it('uses no Intl features missing on iOS', () => {
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (UNSUPPORTED.some((re) => re.test(line))) hits.push(`${file.slice(SRC.length + 1)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });

  describe('without formatToParts and normalize', () => {
    const proto = Intl.NumberFormat.prototype as { formatToParts?: unknown };
    const saved = { parts: proto.formatToParts, normalize: String.prototype.normalize };
    beforeAll(() => {
      delete proto.formatToParts;
      // @ts-expect-error simulating an engine without Unicode normalisation
      delete String.prototype.normalize;
    });
    afterAll(() => {
      proto.formatToParts = saved.parts;
      String.prototype.normalize = saved.normalize;
    });

    it('finds the decimal mark', () => {
      expect(decimalSeparator('tr-TR')).toBe(',');
      expect(decimalSeparator('en-US')).toBe('.');
      expect(csvOptionsForLocale('tr-TR').separator).toBe(';');
      expect(csvOptionsForLocale('en-US').separator).toBe(',');
    });

    it('formats signs and compact amounts by hand', () => {
      expect(formatMoney(500, 'USD', 'en-US', { showPlus: true })).toBe('+$5.00');
      expect(formatMoney(-500, 'USD', 'en-US', { showPlus: true })).toBe('-$5.00');
      expect(formatMoney(0, 'USD', 'en-US', { showPlus: true })).toBe('$0.00');
      expect(formatMoney(250000, 'USD', 'en-US', { compact: true })).toBe('$2.5K');
      expect(formatMoney(99900, 'USD', 'en-US', { compact: true })).toBe('$999');
      expect(formatMoney(123456789, 'TRY', 'tr-TR', { compact: true })).toBe('₺1,2 Mn');
      expect(formatMoney(4500000, 'TRY', 'tr-TR', { compact: true })).toBe('₺45 B');
    });

    it('writes percents the local way', () => {
      expect(formatPercent(0.7, 'en-US')).toBe('70%');
      expect(formatPercent(0.7, 'tr-TR')).toBe('%70');
    });

    it('still matches merchant names', () => {
      expect(normalizeName('MİGROS  A.Ş.')).toBe('migros as');
    });
  });
});
