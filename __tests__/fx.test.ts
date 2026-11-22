import { convertMinor, toEurTable } from '@/lib/fx';

const rates = { EUR: 1, USD: 1.1, TRY: 55.6, JPY: 160 };

describe('convertMinor', () => {
  it('returns the same amount for the same currency', () => {
    expect(convertMinor(1234, 'TRY', 'TRY', {})).toBe(1234);
  });

  it('converts through EUR', () => {
    // 11.00 USD = 10 EUR = 556.00 TRY
    expect(convertMinor(1100, 'USD', 'TRY', rates)).toBe(55600);
    expect(convertMinor(55600, 'TRY', 'USD', rates)).toBe(1100);
  });

  it('respects zero-decimal targets', () => {
    // 1.00 EUR = 160 JPY
    expect(convertMinor(100, 'EUR', 'JPY', rates)).toBe(160);
  });

  it('returns null when a rate is missing', () => {
    expect(convertMinor(100, 'GBP', 'USD', rates)).toBeNull();
  });
});

describe('toEurTable', () => {
  it('keeps EUR-based responses as they are', () => {
    expect(toEurTable({ base: 'EUR', date: '2026-11-20', rates: { USD: 1.1 } })).toEqual({ EUR: 1, USD: 1.1 });
  });

  it('rescales a USD-based response to EUR', () => {
    const t = toEurTable({ base: 'USD', date: '2026-11-20', rates: { EUR: 0.5, TRY: 50 } });
    expect(t.USD).toBeCloseTo(2);
    expect(t.TRY).toBeCloseTo(100);
    expect(t.EUR).toBe(1);
  });
});
