// The configuration being edited, with undo and redo. It is not stored: it lives in the address
// ("#/?w=1800&h=2200…"), so a link or a reload reopens it, and saved designs keep their own copy.
import { create } from 'zustand';
import { DEFAULT_CONFIG, type Config } from '../domain/schema';
import { decodeConfig, encodeConfig } from '../domain/share';

interface ConfigState { config: Config; past: Config[]; future: Config[] }

const fromAddress = (): { config: Config; valid: boolean } => {
  const hash = typeof location === 'undefined' ? '' : location.hash;
  return decodeConfig(new URLSearchParams(hash.split('?')[1] ?? ''));
};

const first = fromAddress();
/** False when the page was opened from an incomplete or altered link. */
export const openedFromValidLink = first.valid;

export const useConfig = create<ConfigState>(() => ({ config: first.config, past: [], future: [] }));

// a dragged slider sends many changes of the same setting per second: they make one step of history
const COALESCE_MS = 600;
let lastChange = 0;
let lastKeys = '';

export function update(patch: Partial<Config>, now = Date.now()): void {
  const { config, past } = useConfig.getState();
  const next = { ...config, ...patch };
  if (encodeConfig(next) === encodeConfig(config)) return;
  const keys = Object.keys(patch).sort().join();
  const coalesce = now - lastChange < COALESCE_MS && keys === lastKeys && past.length > 0;
  lastChange = now;
  lastKeys = keys;
  useConfig.setState({ config: next, past: coalesce ? past : [...past.slice(-49), config], future: [] });
}

/** Loads a whole configuration (a saved design, a link, the starting model) as one undoable step. */
export function load(config: Config): void {
  lastChange = 0;
  update(config, 0);
}

export function undo(): void {
  const { config, past, future } = useConfig.getState();
  const previous = past.at(-1);
  if (!previous) return;
  lastChange = 0;
  useConfig.setState({ config: previous, past: past.slice(0, -1), future: [config, ...future] });
}

export function redo(): void {
  const { config, past, future } = useConfig.getState();
  const [next, ...rest] = future;
  if (!next) return;
  lastChange = 0;
  useConfig.setState({ config: next, past: [...past, config], future: rest });
}

export const reset = () => { load(DEFAULT_CONFIG); };
