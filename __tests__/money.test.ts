import {
  currencyDecimals,
  defaultQuickAmounts,
  digitsToMinor,
  formatMoney,
  fromMinor,
  keypadPress,
  minorToDigits,
  toMinor,
} from '@/lib/money';

describe('minor units', () => {
  it('round-trips two-decimal currencies without float drift', () => {
    expect(toMinor(19.99, 'USD')).toBe(1999);
    expect(toMinor(0.1 + 0.2, 'TRY')).toBe(30);
    expect(fromMinor(1999, 'USD')).toBe(19.99);
  });

  it('handles zero-decimal currencies', () => {
    expect(currencyDecimals('JPY')).toBe(0);
    expect(toMinor(1500, 'JPY')).toBe(1500);
    expect(fromMinor(1500, 'JPY')).toBe(1500);
  });
});

describe('formatMoney', () => {
  it('formats US dollars for en-US', () => {
    expect(formatMoney(123456, 'USD', 'en-US')).toBe('$1,234.56');
  });

  it('formats Turkish lira for tr-TR with Turkish separators', () => {
    const s = formatMoney(123456, 'TRY', 'tr-TR');
    expect(s).toContain('1.234,56');
    expect(s).toContain('₺');
  });

  it('can trim zero cents and show a plus sign', () => {
    expect(formatMoney(125000, 'USD', 'en-US', { trimZeroCents: true })).toBe('$1,250');
    expect(formatMoney(500, 'USD', 'en-US', { showPlus: true })).toBe('+$5.00');
  });
});

describe('amount wheels', () => {
  it('splits and joins digits', () => {
    expect(minorToDigits(125000, 6, 2)).toEqual([0, 0, 1, 2, 5, 0, 0, 0]);
    expect(digitsToMinor([0, 0, 1, 2, 5, 0, 0, 0])).toBe(125000);
  });

  it('clamps to the largest value the wheels can show', () => {
    expect(minorToDigits(10 ** 12, 3, 2)).toEqual([9, 9, 9, 9, 9]);
    expect(minorToDigits(-5, 2, 2)).toEqual([0, 0, 0, 0]);
  });
});

describe('keypadPress', () => {
  it('shifts digits in from the right like a card terminal', () => {
    let v = 0;
    for (const k of ['1', '2', '5', '0']) v = keypadPress(v, k);
    expect(v).toBe(1250);
    expect(keypadPress(v, 'back')).toBe(125);
    expect(keypadPress(v, '00')).toBe(125000);
    expect(keypadPress(v, 'clear')).toBe(0);
  });

  it('ignores input past the digit limit', () => {
    expect(keypadPress(123456789, '1', 9)).toBe(123456789);
  });
});

describe('defaultQuickAmounts', () => {
  it('suggests larger round numbers for TRY than USD', () => {
    expect(defaultQuickAmounts('TRY')[0]).toBeGreaterThan(defaultQuickAmounts('USD')[0]);
  });
});
