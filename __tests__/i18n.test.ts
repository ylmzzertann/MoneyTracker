import { DEFAULT_CATEGORIES } from '@/db/defaults';
import { categoryKey } from '@/i18n';
import en from '@/i18n/locales/en.json';
import tr from '@/i18n/locales/tr.json';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en', regionCode: 'US' }] }));

type Tree = { [k: string]: string | Tree };

function flatten(obj: Tree, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : flatten(v, `${prefix}${k}.`),
  );
}

function lookup(obj: Tree, path: string): string | undefined {
  const value = path.split('.').reduce<string | Tree | undefined>(
    (node, part) => (node && typeof node === 'object' ? node[part] : undefined),
    obj,
  );
  return typeof value === 'string' ? value : undefined;
}

describe('translations', () => {
  it('English and Turkish have exactly the same keys', () => {
    const enKeys = flatten(en as Tree).sort();
    const trKeys = flatten(tr as Tree).sort();
    expect(trKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !trKeys.includes(k))).toEqual([]);
  });

  it('every built-in category has a name in both languages', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(lookup(en as Tree, categoryKey(c.key))).toBeTruthy();
      expect(lookup(tr as Tree, categoryKey(c.key))).toBeTruthy();
    }
  });

  it('keeps the same interpolation variables in both languages', () => {
    const vars = (s: string) => (s.match(/{{\s*\w+\s*}}/g) ?? []).map((v) => v.replace(/\s/g, '')).sort();
    for (const key of flatten(en as Tree)) {
      expect([key, vars(lookup(tr as Tree, key) ?? '')]).toEqual([key, vars(lookup(en as Tree, key) ?? '')]);
    }
  });
});
