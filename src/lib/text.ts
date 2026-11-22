const TR_MAP: Record<string, string> = { ç: 'c', ş: 's', ğ: 'g', ö: 'o', ü: 'u', ı: 'i', â: 'a', î: 'i', û: 'u' };

/** Lower-cases and strips accents/punctuation so "MİGROS  A.Ş." and "migros as" match. */
export function normalizeName(name: string): string {
  return name
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr')
    .replace(/[çşğöüıâîû]/g, (c) => TR_MAP[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // "A.Ş." -> "as", "Joe's" -> "joes"; other punctuation separates words.
    .replace(/[.'`´’]/g, '')
    .replace(/[\s,;:!?"“”()[\]{}/\\|&*+\-_#@%^~<>=]+/g, ' ')
    .trim();
}
