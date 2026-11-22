import { strFromU8 } from 'fflate';

/** True when the bytes are well-formed UTF-8. */
export function isValidUtf8(bytes: Uint8Array): boolean {
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    const extra = b < 0x80 ? 0 : b >> 5 === 0b110 ? 1 : b >> 4 === 0b1110 ? 2 : b >> 3 === 0b11110 ? 3 : -1;
    if (extra < 0) return false;
    for (let k = 1; k <= extra; k++) {
      if (i + k >= bytes.length || bytes[i + k] >> 6 !== 0b10) return false;
    }
    i += extra + 1;
  }
  return true;
}

/** Windows-1254 (Turkish) bytes 0x80–0x9F; unused slots stay as the raw code. */
const CP1254_HIGH = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008D\u008E\u008F\u0090‘’“”•–—˜™š›œ\u009D\u009EŸ';
const CP1254_TURKISH: Record<number, string> = { 0xd0: 'Ğ', 0xdd: 'İ', 0xde: 'Ş', 0xf0: 'ğ', 0xfd: 'ı', 0xfe: 'ş' };

export function decodeCp1254(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    if (b < 0x80) out += String.fromCharCode(b);
    else if (b < 0xa0) out += CP1254_HIGH[b - 0x80];
    else out += CP1254_TURKISH[b] ?? String.fromCharCode(b);
  }
  return out;
}

function decodeUtf16le(bytes: Uint8Array): string {
  let out = '';
  for (let i = 2; i + 1 < bytes.length; i += 2) out += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
  return out;
}

/** Text files from banks come as UTF-8, UTF-16 ("Unicode text" from Excel) or Windows-1254. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return decodeUtf16le(bytes);
  const text = isValidUtf8(bytes) ? strFromU8(bytes) : decodeCp1254(bytes);
  return text.replace(/^﻿/, '');
}
