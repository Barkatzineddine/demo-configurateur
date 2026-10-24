// A configuration in a short, readable link ("#/?w=1800&h=2200&m=chene…"), and back. What comes
// from a link is untrusted: it goes through the same schema as stored data, and anything missing or
// invalid falls back to the defaults.
import { HANDLE_IDS, LOWER_IDS, MATERIAL_IDS } from './catalog';
import { configSchema, DEFAULT_CONFIG, type Config } from './schema';

const LOWER_CODES: Record<Config['lower'], string> = { open: 'o', doors: 'p', drawers: 't' };

export function encodeConfig(c: Config): string {
  const q = new URLSearchParams({
    w: String(c.width), h: String(c.height), d: String(c.depth), c: String(c.bays), r: String(c.rows),
    s: c.plinth ? '1' : '0', f: c.back ? '1' : '0', b: LOWER_CODES[c.lower], p: c.handle, m: c.material,
    l: c.led ? '1' : '0', i: c.install ? '1' : '0',
  });
  return q.toString();
}

export function decodeConfig(query: URLSearchParams): { config: Config; valid: boolean } {
  if (![...query.keys()].length) return { config: DEFAULT_CONFIG, valid: true };
  const int = (key: string) => {
    const v = query.get(key);
    return v !== null && /^\d{1,5}$/.test(v) ? Number(v) : undefined;
  };
  const bool = (key: string) => (query.get(key) === '1' ? true : query.get(key) === '0' ? false : undefined);
  const pick = <T extends string>(key: string, allowed: readonly T[]): T | undefined => allowed.find((a) => a === query.get(key));
  const lowerCode = query.get('b');
  const candidate = {
    width: int('w'), height: int('h'), depth: int('d'), bays: int('c'), rows: int('r'),
    plinth: bool('s'), back: bool('f'),
    lower: LOWER_IDS.find((k) => LOWER_CODES[k] === lowerCode),
    handle: pick('p', HANDLE_IDS), material: pick('m', MATERIAL_IDS),
    led: bool('l'), install: bool('i'),
  };
  const merged = { ...DEFAULT_CONFIG, ...Object.fromEntries(Object.entries(candidate).filter(([, v]) => v !== undefined)) };
  const parsed = configSchema.safeParse(merged);
  const complete = Object.values(candidate).every((v) => v !== undefined);
  return parsed.success ? { config: parsed.data, valid: complete } : { config: DEFAULT_CONFIG, valid: false };
}
