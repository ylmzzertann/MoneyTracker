function fnv1a(s: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Short stable hash (16 hex characters) used to recognise rows that were imported before. */
export const fingerprint = (s: string) => fnv1a(s, 0x811c9dc5) + fnv1a(s, 0x050c5d1f);
