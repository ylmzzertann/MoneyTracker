import {
  addMonths,
  daysLeftInRange,
  dayKey,
  eachDay,
  lastMonths,
  monthKey,
  parseLocalISO,
  periodRange,
  shiftAnchor,
  toLocalISO,
} from '@/lib/dates';

describe('local ISO strings', () => {
  it('round-trips a local date', () => {
    const d = new Date(2026, 10, 21, 9, 5, 7);
    const s = toLocalISO(d);
    expect(s).toBe('2026-11-21T09:05:07');
    expect(parseLocalISO(s).getTime()).toBe(d.getTime());
    expect(dayKey(s)).toBe('2026-11-21');
    expect(monthKey(s)).toBe('2026-11');
  });
});

describe('periodRange', () => {
  it('returns a whole month with an exclusive end', () => {
    const r = periodRange('month', new Date(2026, 1, 14));
    expect(toLocalISO(r.start)).toBe('2026-02-01T00:00:00');
    expect(toLocalISO(r.end)).toBe('2026-03-01T00:00:00');
    expect(eachDay(r)).toHaveLength(28);
  });

  it('starts weeks on Monday for Turkey and Sunday for the US', () => {
    const saturday = new Date(2026, 10, 21);
    expect(dayKey(periodRange('week', saturday, 1).start)).toBe('2026-11-16');
    expect(dayKey(periodRange('week', saturday, 0).start)).toBe('2026-11-15');
  });

  it('returns the calendar year', () => {
    const r = periodRange('year', new Date(2026, 5, 1));
    expect(dayKey(r.start)).toBe('2026-01-01');
    expect(dayKey(r.end)).toBe('2027-01-01');
  });
});

describe('shifting', () => {
  it('moves months, weeks and years', () => {
    expect(monthKey(shiftAnchor('month', new Date(2026, 0, 31), -1))).toBe('2025-12');
    expect(dayKey(shiftAnchor('week', new Date(2026, 10, 21), 1))).toBe('2026-11-28');
    expect(shiftAnchor('year', new Date(2026, 3, 1), 2).getFullYear()).toBe(2028);
  });

  it('clamps addMonths to the last day of short months', () => {
    expect(dayKey(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
  });

  it('lists the last N months oldest first', () => {
    expect(lastMonths(new Date(2026, 1, 10), 3).map(monthKey)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('daysLeftInRange', () => {
  it('counts today as a remaining day', () => {
    const r = periodRange('month', new Date(2026, 10, 1));
    expect(daysLeftInRange(r, new Date(2026, 10, 21, 15))).toBe(10);
    expect(daysLeftInRange(r, new Date(2026, 11, 2))).toBe(0);
  });
});
