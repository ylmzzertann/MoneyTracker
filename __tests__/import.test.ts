import { strToU8, zipSync } from 'fflate';

import { keywordCategory, suggestCategory, type CategoryContext } from '@/features/import/categorize';
import { classify } from '@/features/import/dedupe';
import { draftFromText } from '@/features/import/draft';
import { detectDecimalMark, parseAmount } from '@/features/import/parse/amount';
import { detectDateOrder, parseDateText, parseShortDate } from '@/features/import/parse/date';
import { detectSeparator, parseDelimited, parseHtmlTable } from '@/features/import/parse/delimited';
import { decodeText } from '@/features/import/parse/encoding';
import { cleanMerchant, looksLikeCardPayment } from '@/features/import/parse/merchant';
import { parseMessages } from '@/features/import/parse/sms';
import { gridFromBytes } from '@/features/import/parse/source';
import { detectMapping, tableCandidates } from '@/features/import/parse/table';
import { readXlsx } from '@/features/import/parse/xlsx';

const TR = { decimal: ',' as const, dateOrder: 'dmy' as const };
const US = { decimal: '.' as const, dateOrder: 'mdy' as const };

describe('amounts', () => {
  it('reads both decimal styles and the usual minus signs', () => {
    expect(parseAmount('1.234,56', ',')).toBe(1234.56);
    expect(parseAmount('1,234.56', '.')).toBe(1234.56);
    expect(parseAmount('-45,00', ',')).toBe(-45);
    expect(parseAmount('45,00-', ',')).toBe(-45);
    expect(parseAmount('(12.50)', '.')).toBe(-12.5);
    expect(parseAmount('₺1.250', ',')).toBe(1250);
    expect(parseAmount('-$9.99', '.')).toBe(-9.99);
    expect(parseAmount('abc', '.')).toBeNull();
  });

  it('detects the decimal mark from a column', () => {
    expect(detectDecimalMark(['1.234,56', '-45,00', '12,5'], '.')).toBe(',');
    expect(detectDecimalMark(['1,234.56', '-45.00'], ',')).toBe('.');
    expect(detectDecimalMark(['1.250'], ',')).toBe(',');
  });
});

describe('dates', () => {
  it('reads numeric, ISO and month-name dates', () => {
    expect(parseDateText('12.11.2026', 'dmy')).toMatchObject({ y: 2026, m: 11, d: 12, hh: 12 });
    expect(parseDateText('11/12/2026', 'mdy')).toMatchObject({ y: 2026, m: 11, d: 12 });
    expect(parseDateText('2026-11-12 14:35', 'dmy')).toMatchObject({ y: 2026, m: 11, d: 12, hh: 14, mm: 35 });
    expect(parseDateText('12 Kasım 2026', 'dmy')).toMatchObject({ m: 11, d: 12 });
    expect(parseDateText('Nov 12, 2026', 'mdy')).toMatchObject({ m: 11, d: 12 });
    expect(parseDateText('31.02.2026', 'dmy')).toBeNull();
  });

  it('puts a short date in the most recent year', () => {
    const now = new Date(2026, 0, 5);
    expect(parseShortDate('28.12 14:35', 'dmy', now)).toMatchObject({ y: 2025, m: 12, d: 28, hh: 14 });
    expect(parseShortDate('03.01', 'dmy', now)).toMatchObject({ y: 2026, m: 1, d: 3 });
  });

  it('detects day-first columns', () => {
    expect(detectDateOrder(['01/02/2026', '25/02/2026'], 'mdy')).toBe('dmy');
    expect(detectDateOrder(['01/02/2026', '02/25/2026'], 'dmy')).toBe('mdy');
  });
});

describe('text files', () => {
  it('parses Turkish CSV with quotes', () => {
    const text = '﻿Tarih;Açıklama;Tutar\r\n12.11.2026;"MIGROS; KADIKOY";-250,00\r\n';
    expect(detectSeparator(text)).toBe(';');
    expect(parseDelimited(text)).toEqual([
      ['Tarih', 'Açıklama', 'Tutar'],
      ['12.11.2026', 'MIGROS; KADIKOY', '-250,00'],
    ]);
  });

  it('reads HTML disguised as .xls', () => {
    const html = '<table><tr><th>Tarih</th><th>Tutar</th></tr><tr><td>12.11.2026</td><td>1.250,00&nbsp;TL</td></tr></table>';
    expect(parseHtmlTable(html)).toEqual([
      ['Tarih', 'Tutar'],
      ['12.11.2026', '1.250,00 TL'],
    ]);
  });

  it('decodes Windows-1254 files', () => {
    expect(decodeText(new Uint8Array([0x41, 0xe7, 0xfd, 0x6b, 0x6c, 0x61, 0x6d, 0x61, 0x20, 0xde]))).toBe('Açıklama Ş');
  });

  it('reads an xlsx sheet with shared strings and date cells', () => {
    const files = {
      'xl/sharedStrings.xml': strToU8('<sst><si><t>Tarih</t></si><si><t>Açıklama</t></si><si><t>Tutar</t></si><si><r><t>MIGROS </t></r><r><t>KADIKOY</t></r></si></sst>'),
      'xl/styles.xml': strToU8('<styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>'),
      'xl/worksheets/sheet1.xml': strToU8(
        '<worksheet><sheetData>' +
          '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
          '<row r="2"><c r="A2" s="1"><v>46338</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>-250.5</v></c></row>' +
          '</sheetData></worksheet>',
      ),
    };
    expect(readXlsx(zipSync(files))).toEqual([
      ['Tarih', 'Açıklama', 'Tutar'],
      ['2026-11-12', 'MIGROS KADIKOY', '-250.5'],
    ]);
  });
});

describe('statement tables', () => {
  it('finds the header below a preamble and reads a bank account export', () => {
    const grid = parseDelimited(
      [
        'Hesap Hareketleri;;;',
        'IBAN: TR00 0000;;;',
        'Tarih;Açıklama;Tutar;Bakiye',
        '12.11.2026;POS IYZICO*MIGROS KADIKOY ISTANBUL TR;-250,00;4.750,00',
        '13.11.2026;MAAS ODEMESI;25.000,00;29.750,00',
        '14.11.2026;NETFLIX.COM;-189,99;29.560,01',
        'Toplam;;;',
      ].join('\n'),
    );
    const m = detectMapping(grid, US)!;
    expect(m).toMatchObject({ headerRow: 2, date: 0, description: 1, amount: 2, decimal: ',', dateOrder: 'dmy', expenseSign: 'negative' });
    const rows = tableCandidates(grid, m, 'tr');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ kind: 'expense', amount: 250, merchantName: 'Migros Kadikoy', occurredAt: '2026-11-12T12:00:00' });
    expect(rows[1]).toMatchObject({ kind: 'income', amount: 25000 });
    expect(new Set(rows.map((r) => r.key)).size).toBe(3);
  });

  it('reads a US card export with debit and credit columns', () => {
    const grid = parseDelimited(
      [
        'Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit',
        '11/12/2026,11/13/2026,1234,STARBUCKS STORE 0042,Dining,5.75,',
        '11/14/2026,11/14/2026,1234,AUTOPAY PAYMENT - THANK YOU,Payment/Credit,,500.00',
      ].join('\n'),
    );
    const m = detectMapping(grid, TR)!;
    expect(m).toMatchObject({ date: 0, description: 3, amount: null, debit: 5, credit: 6, dateOrder: 'mdy' });
    const rows = tableCandidates(grid, m, 'en');
    expect(rows[0]).toMatchObject({ kind: 'expense', amount: 5.75, merchantName: 'Starbucks Store', occurredAt: '2026-11-12T12:00:00' });
    expect(rows[1]).toMatchObject({ kind: 'income', amount: 500, hint: 'cardPayment' });
  });

  it('treats positive amounts as spending on a card statement', () => {
    const grid = parseDelimited('Date,Description,Amount\n11/12/2026,AMAZON MKTPL,24.99\n11/13/2026,PAYMENT THANK YOU,-300.00\n11/15/2026,SHELL OIL,40.00');
    const m = detectMapping(grid, US)!;
    expect(m.expenseSign).toBe('positive');
    expect(tableCandidates(grid, m, 'en').map((r) => r.kind)).toEqual(['expense', 'income', 'expense']);
  });

  it('guesses columns when there is no header', () => {
    const grid = parseDelimited('12.11.2026\tMIGROS\t-250,00\n13.11.2026\tBIM\t-80,50\n14.11.2026\tA101\t-35,00');
    const m = detectMapping(grid, TR)!;
    expect(m).toMatchObject({ headerRow: -1, date: 0, description: 1, amount: 2 });
    expect(tableCandidates(grid, m, 'tr')).toHaveLength(3);
  });
});

describe('bank messages', () => {
  const opts = { ...TR, locale: 'tr' as const, now: new Date(2026, 10, 20, 9, 0) };

  it('reads Turkish card and account messages', () => {
    const text = [
      'Kartınızla 12.11.2026 14:35 tarihinde MIGROS KADIKOY işyerinde 250,00 TL harcama yapılmıştır. Kullanılabilir limitiniz 4.750,00 TL. ****1234',
      '',
      'Hesabınıza 18.11.2026 tarihinde 25.000,00 TL maaş yatırılmıştır.',
      '',
      '3D Secure doğrulama kodunuz 123456. 1.299,00 TL tutarlı işlem için kullanınız.',
      '',
      "TRENDYOL'dan 1.299,00TL alışverişiniz için teşekkürler",
    ].join('\n');
    const { candidates, unread } = parseMessages(text, opts);
    expect(unread).toBe(1);
    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({
      kind: 'expense',
      amount: 250,
      currency: 'TRY',
      merchantName: 'Migros Kadikoy',
      last4: '1234',
      occurredAt: '2026-11-12T14:35:00',
    });
    expect(candidates[1]).toMatchObject({ kind: 'income', amount: 25000 });
    expect(candidates[2]).toMatchObject({ kind: 'expense', amount: 1299, merchantName: 'Trendyol' });
  });

  it('reads US alerts and refunds, one per line', () => {
    const text = [
      'You spent $12.50 at STARBUCKS on 11/18 with card ending in 4321.',
      'A refund of $30.00 from AMAZON was credited to your account.',
    ].join('\n');
    const { candidates } = parseMessages(text, { ...US, locale: 'en', now: new Date(2026, 10, 20) });
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({ kind: 'expense', amount: 12.5, currency: 'USD', merchantName: 'Starbucks', last4: '4321', occurredAt: '2026-11-18T12:00:00' });
    expect(candidates[1]).toMatchObject({ kind: 'income', amount: 30 });
  });

  it('gives the same message the same key', () => {
    const a = parseMessages('BIM 80,50 TL harcama', opts).candidates[0];
    const b = parseMessages('BIM   80,50 TL harcama ', opts).candidates[0];
    expect(a.key).toBe(b.key);
  });
});

describe('merchant names', () => {
  it('strips processors, card numbers and places', () => {
    expect(cleanMerchant('POS IYZICO*MIGROS KADIKOY 4543****1234 ISTANBUL TR', 'tr')).toBe('Migros Kadikoy');
    expect(cleanMerchant('SQ *BLUE BOTTLE COFFEE', 'en')).toBe('Blue Bottle Coffee');
    expect(cleanMerchant('İSTANBULKART DOLUM', 'tr')).toBe('İstanbulkart Dolum');
    expect(looksLikeCardPayment('ÖDEME - TEŞEKKÜR EDERİZ')).toBe(true);
  });
});

describe('categories', () => {
  const ctx: CategoryContext = {
    learned: new Map([['kahveci ahmet', 'sys:dining']]),
    categories: new Map([
      ['sys:groceries', { kind: 'expense', parentId: null, hidden: false }],
      ['sys:dining', { kind: 'expense', parentId: null, hidden: false }],
      ['sys:transport', { kind: 'expense', parentId: null, hidden: false }],
      ['sys:transport.fuel', { kind: 'expense', parentId: 'sys:transport', hidden: true }],
      ['sys:other', { kind: 'expense', parentId: null, hidden: false }],
      ['sys:salary', { kind: 'income', parentId: null, hidden: false }],
      ['sys:other_income', { kind: 'income', parentId: null, hidden: false }],
    ]),
  };

  it('knows common merchants, longest phrase first', () => {
    expect(keywordCategory('UBER EATS')).toBe('dining');
    expect(keywordCategory('UBER TRIP')).toBe('transport.taxi');
    expect(keywordCategory('Migros Kadikoy')).toBe('groceries');
  });

  it('prefers what the user chose before and respects hidden categories', () => {
    const base = { kind: 'expense' as const, description: '' };
    expect(suggestCategory({ ...base, merchantName: 'Kahveci Ahmet' }, ctx)).toBe('sys:dining');
    expect(suggestCategory({ ...base, merchantName: 'Shell' }, ctx)).toBe('sys:transport');
    expect(suggestCategory({ ...base, merchantName: 'Bilinmeyen' }, ctx)).toBe('sys:other');
    expect(suggestCategory({ kind: 'income', merchantName: '', description: 'MAAS ODEMESI' }, ctx)).toBe('sys:salary');
  });
});

describe('sources', () => {
  const defaults = { ...TR, locale: 'tr' as const };

  it('refuses PDF and old Excel files with a reason', () => {
    expect(() => gridFromBytes(strToU8('%PDF-1.7'))).toThrow(expect.objectContaining({ problem: 'pdf' }));
    expect(() => gridFromBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0]))).toThrow(expect.objectContaining({ problem: 'oldExcel' }));
  });

  it('turns pasted spreadsheet rows into a statement and messages into SMS', () => {
    const rows = draftFromText('Tarih\tAçıklama\tTutar\n12.11.2026\tMIGROS\t-250,00\n13.11.2026\tBIM\t-80,50', defaults, new Date(2026, 10, 20));
    expect(rows).toMatchObject({ source: 'statement', candidates: [{ amount: 250 }, { amount: 80.5 }] });
    const sms = draftFromText('BIM 80,50 TL harcama', defaults, new Date(2026, 10, 20));
    expect(sms).toMatchObject({ source: 'sms', candidates: [{ amount: 80.5, merchantName: '' }] });
    expect(() => draftFromText('merhaba', defaults, new Date())).toThrow(expect.objectContaining({ problem: 'noMessages' }));
  });
});

describe('duplicates', () => {
  it('flags earlier imports and same-amount transactions within a day, once each', () => {
    const probe = (key: string, occurredAt: string) => ({ key, kind: 'expense' as const, amountMinor: 450, currency: 'TRY', occurredAt });
    const status = classify(
      [probe('a', '2026-11-12T08:00:00'), probe('b', '2026-11-12T09:00:00'), probe('c', '2026-11-13T09:00:00'), probe('d', '2026-11-20T09:00:00')],
      new Set(['d']),
      [{ kind: 'expense', amountMinor: 450, currency: 'TRY', occurredAt: '2026-11-11T20:00:00' }],
    );
    expect([...status.values()]).toEqual(['similar', 'new', 'new', 'imported']);
  });
});
