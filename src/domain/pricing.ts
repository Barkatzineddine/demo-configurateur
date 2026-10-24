// The estimate, from what the workshop really buys and does: whole sheets from the cutting plan,
// edge banding, hardware, labour per piece and per column, options. Integer cents throughout.
import { DRAWER_BOX_SHEET, LEAD_TIME, MATERIALS, PRICES, VAT_RATE } from './catalog';
import { cuttingList, cuttingPlan, type GroupPlan, type Piece } from './cutting';
import { resolve, weight, type Layout, type Notice } from './rules';
import type { Config } from './schema';

export type LineCode =
  | 'sheets.carcass' | 'sheets.back' | 'sheets.drawer' | 'edging' | 'labour.pieces' | 'labour.assembly' | 'labour.bays'
  | 'hinges' | 'handles.push' | 'handles.bar' | 'handles.knob' | 'slides' | 'led' | 'led.driver' | 'delivery' | 'install';

export interface PriceLine { code: LineCode; qty: number; unit: number; total: number }
export interface Price { lines: PriceLine[]; ht: number; vat: number; ttc: number }

export function price(c: Config, l: Layout, pieces: Piece[], plans: GroupPlan[]): Price {
  const m = MATERIALS[c.material];
  const lines: PriceLine[] = [];
  const add = (code: LineCode, qty: number, unit: number) => { if (qty > 0) lines.push({ code, qty, unit, total: Math.round(qty * unit) }); };
  const sheets = (g: GroupPlan['group']) => plans.find((p) => p.group === g)?.sheets.length ?? 0;

  add('sheets.carcass', sheets('carcass'), m.sheet);
  add('sheets.back', sheets('back'), m.backSheet);
  add('sheets.drawer', sheets('drawer'), DRAWER_BOX_SHEET);
  const edgeMetres = Math.round(pieces.reduce((s, p) => s + p.edging * p.qty, 0) / 100) / 10;
  add('edging', edgeMetres, PRICES.edging);
  add('labour.pieces', pieces.reduce((s, p) => s + p.qty, 0), PRICES.perPiece);
  add('labour.assembly', 1, PRICES.assembly);
  add('labour.bays', l.bays, PRICES.perBay);

  const doors = l.parts.filter((p) => p.role === 'door');
  const fronts = l.parts.filter((p) => p.role === 'front');
  add('hinges', doors.reduce((s, d) => s + (d.h > 900 ? 3 : 2), 0), PRICES.hinge);
  add(`handles.${c.handle}`, doors.length + fronts.length, PRICES.handle[c.handle]);
  add('slides', fronts.length, PRICES.slides);

  const ledMetres = Math.round(l.parts.filter((p) => p.role === 'led').reduce((s, p) => s + p.w, 0) / 100) / 10;
  add('led', ledMetres, PRICES.ledPerMetre);
  add('led.driver', ledMetres > 0 ? Math.ceil(ledMetres / 5) : 0, PRICES.ledDriver);
  add('delivery', 1, PRICES.delivery);
  if (c.install) add('install', 1, PRICES.installation + Math.round((c.width / 1000) * PRICES.installationPerMetre));

  const ht = lines.reduce((s, x) => s + x.total, 0);
  const vat = Math.round((ht * VAT_RATE) / 100);
  return { lines, ht, vat, ttc: ht + vat };
}

export const leadWeeks = (c: Config) => LEAD_TIME.base + (MATERIALS[c.material].kind === 'lacquer' ? LEAD_TIME.lacquer : 0) + (c.lower === 'drawers' ? LEAD_TIME.drawers : 0);

export interface Estimate {
  config: Config;
  layout: Layout;
  notices: Notice[];
  pieces: Piece[];
  plans: GroupPlan[];
  price: Price;
  weeks: number;
  kg: number;
}

/** From a requested configuration to everything shown, priced and sent. */
export function estimate(input: Config): Estimate {
  const { config, layout, notices } = resolve(input);
  const pieces = cuttingList(layout, config.material);
  const plans = cuttingPlan(pieces, config.material);
  return {
    config, layout, notices, pieces, plans,
    price: price(config, layout, pieces, plans),
    weeks: leadWeeks(config),
    kg: weight(layout, MATERIALS[config.material].density),
  };
}
