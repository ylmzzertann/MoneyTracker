import { DEFAULT_CATEGORIES } from '@/db/defaults';
import { categoryTone, dark, light, tint } from '@/theme/tokens';

const luminance = (hex: string) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].reduce((sum, i) => sum + parseInt(h.slice(i, i + 2), 16), 0);
};

describe('categoryTone', () => {
  it('keeps the base colour and derives a lighter and a deeper tone', () => {
    const tone = categoryTone('#34d399');
    expect(tone.base).toBe('#34D399');
    expect(luminance(tone.light)).toBeGreaterThan(luminance(tone.base));
    expect(luminance(tone.deep)).toBeLessThan(luminance(tone.base));
    expect(tone.light).toMatch(/^#[0-9A-F]{6}$/);
    expect(tone.deep).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('tokens', () => {
  it('builds rgba strings', () => {
    expect(tint('#D4F65A', 0.5)).toBe('rgba(212,246,90,0.5)');
  });

  it('gives light and dark palettes the same keys', () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });

  it('gives sub-categories their parent category colour', () => {
    const byKey = new Map(DEFAULT_CATEGORIES.map((c) => [c.key, c]));
    for (const c of DEFAULT_CATEGORIES) {
      if (c.parent) expect(c.color).toBe(byKey.get(c.parent)?.color);
    }
  });
});
