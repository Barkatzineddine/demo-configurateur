// Input hygiene, identifiers, hashing and CSV export. Pure functions, unit-tested.

// Control characters, zero-width characters and bidi overrides (used to spoof displayed text).
const INVISIBLE_RANGES: [number, number][] = [[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x2069], [0xfeff, 0xfeff]];
const INVISIBLE = new RegExp(`[${INVISIBLE_RANGES.map(([a, b]) => `${String.fromCodePoint(a)}-${String.fromCodePoint(b)}`).join('')}]`, 'gu');

/** Normalise user text: NFC, invisible characters removed, whitespace collapsed, length capped. */
export function clean(value: unknown, max = 120, multiline = false): string {
  let out = String(value ?? '').normalize('NFC').replace(INVISIBLE, '');
  out = multiline
    ? out.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : out.replace(/\s+/g, ' ');
  return out.trim().slice(0, max);
}

export const patterns = {
  name: /^[\p{L}][\p{L}\p{M}' .-]{1,59}$/u,
  email: /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i,
  phoneFR: /^(?:\+33|0033|0)[1-9]\d{8}$/,
};

export const isName = (v: string) => patterns.name.test(v);
export const isEmail = (v: string) => v.length <= 254 && patterns.email.test(v);
export const isPhoneFR = (v: string) => patterns.phoneFR.test(v.replace(/[\s.-]/g, ''));
export const normPhone = (v: string) =>
  v.replace(/[\s.-]/g, '').replace(/^(?:\+33|0033)/, '0').replace(/(\d{2})(?=\d)/g, '$1 ');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Random identifier from crypto.getRandomValues (no ambiguous characters). */
export function randomId(prefix = '', length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return prefix + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** CSV for spreadsheets: semicolon-separated, BOM for Excel, formula injection neutralised. */
export function csv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let t = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

/** Download text or bytes as a file through a blob URL (no network). */
export function download(filename: string, content: string | Uint8Array, type = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([content as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
