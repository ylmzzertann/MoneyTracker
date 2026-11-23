const TR_MAP: Record<string, string> = { ç: 'c', ş: 's', ğ: 'g', ö: 'o', ü: 'u', ı: 'i', â: 'a', î: 'i', û: 'u' };

/** Splits accented letters ("é" → "e" + accent); a no-op where the engine lacks Unicode normalisation. */
const decompose = (s: string) => (typeof s.normalize === 'function' ? s.normalize('NFD') : s);

/** Lower-cases and strips accents/punctuation so "MİGROS  A.Ş." and "migros as" match. */
export function normalizeName(name: string): string {
  const lower = name
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr')
    .replace(/[çşğöüıâîû]/g, (c) => TR_MAP[c] ?? c);
  return decompose(lower)
    .replace(/[̀-ͯ]/g, '')
    // "A.Ş." -> "as", "Joe's" -> "joes"; other punctuation separates words.
    .replace(/[.'`´’]/g, '')
    .replace(/[\s,;:!?"“”()[\]{}/\\|&*+\-_#@%^~<>=]+/g, ' ')
    .trim();
}
