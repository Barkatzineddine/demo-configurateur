// A configuration and the persisted state, described once with Zod: the types come from the schemas,
// and every load (storage, another tab, a shared link) is checked against them.
import * as z from 'zod/mini';
import { HANDLE_IDS, LIMITS, LOWER_IDS, MATERIAL_IDS } from './catalog';

// The strict CSP forbids eval: Zod must not try its compiled fast path.
z.config({ jitless: true });

const mm = (min: number, max: number) => z.int().check(z.gte(min), z.lte(max));
const text = (max: number) => z.string().check(z.maxLength(max));
const id = z.string().check(z.regex(/^[a-zA-Z0-9]{2,20}$/));
const stamp = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/));

export const configSchema = z.object({
  width: mm(LIMITS.width.min, LIMITS.width.max),
  height: mm(LIMITS.height.min, LIMITS.height.max),
  depth: mm(LIMITS.depth.min, LIMITS.depth.max),
  /** Columns; 0 lets the workshop rules decide. */
  bays: z.int().check(z.gte(0), z.lte(12)),
  /** Compartments per column; 0 lets the workshop rules decide. */
  rows: z.int().check(z.gte(0), z.lte(14)),
  plinth: z.boolean(),
  back: z.boolean(),
  lower: z.enum(LOWER_IDS),
  handle: z.enum(HANDLE_IDS),
  material: z.enum(MATERIAL_IDS),
  led: z.boolean(),
  install: z.boolean(),
});
export type Config = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG: Config = {
  width: 1800, height: 2200, depth: 350, bays: 0, rows: 0,
  plinth: true, back: true, lower: 'doors', handle: 'push', material: 'chene', led: false, install: false,
};

export const designSchema = z.object({
  id,
  name: z.string().check(z.minLength(1), z.maxLength(60)),
  config: configSchema,
  saved: stamp,
});

export const requestSchema = z.object({
  id,
  ref: z.string().check(z.regex(/^AL-\d{4}-\d{4}$/)),
  at: stamp,
  name: z.string().check(z.minLength(2), z.maxLength(80)),
  email: text(254),
  phone: text(20),
  zip: z.string().check(z.regex(/^\d{5}$/)),
  message: text(1000),
  config: configSchema,
  /** Estimate shown when the request was sent, all taxes included. */
  total: z.int().check(z.gte(0), z.lte(100_000_000)),
});

export const stateSchema = z.object({
  v: z.literal(1),
  designs: z.array(designSchema).check(z.maxLength(50)),
  requests: z.array(requestSchema).check(z.maxLength(200)),
  seq: z.record(z.string().check(z.regex(/^\d{4}$/)), z.int().check(z.gte(0), z.lte(9999))),
});

export type Design = z.infer<typeof designSchema>;
export type QuoteRequest = z.infer<typeof requestSchema>;
export type State = z.infer<typeof stateSchema>;
