// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MATERIALS, MAX_SPAN, MIN_BAY, PRICES, SHEET, USABLE_LENGTH } from '../../src/domain/catalog';
import { cuttingList, cuttingPlan } from '../../src/domain/cutting';
import { pack, type Placement } from '../../src/domain/packing';
import { estimate } from '../../src/domain/pricing';
import { bayRange, bayWidth, layout, normalize, resolve, type Part } from '../../src/domain/rules';
import { DEFAULT_CONFIG, type Config } from '../../src/domain/schema';
import { decodeConfig, encodeConfig } from '../../src/domain/share';

const cfg = (over: Partial<Config> = {}): Config => ({ ...DEFAULT_CONFIG, ...over });
const count = (parts: Part[], role: Part['role']) => parts.filter((p) => p.role === role).length;
const overlap = (a: Placement, b: Placement) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('workshop rules', () => {
  it('chooses the fewest columns that keep every shelf under the sag limit', () => {
    const { min, max } = bayRange(1800, 19);
    expect(min).toBe(3);
    expect(bayWidth(1800, min, 19)).toBeLessThanOrEqual(MAX_SPAN);
    expect(bayWidth(1800, min - 1, 19)).toBeGreaterThan(MAX_SPAN);
    expect(bayWidth(1800, max, 19)).toBeGreaterThanOrEqual(MIN_BAY);
    expect(bayWidth(1800, max + 1, 19)).toBeLessThan(MIN_BAY);
    expect(layout(cfg()).bays).toBe(3);
  });

  it('adjusts what cannot be built, and says why', () => {
    const { config, notices } = normalize(cfg({ width: 1234, bays: 1, rows: 14, height: 900 }));
    expect(config.width).toBe(1230);
    expect(config.bays).toBe(2);
    expect(notices.map((n) => n.code)).toEqual(expect.arrayContaining(['bays.adjusted', 'rows.adjusted']));
    const low = normalize(cfg({ height: 700, rows: 3, lower: 'doors' })); // three rows of 18 cm
    expect(low.config.lower).toBe('open');
    expect(low.notices.map((n) => n.code)).toContain('doors.tooLow');
  });

  it('places every part inside the outer dimensions, shelves inside their column', () => {
    for (const c of [cfg(), cfg({ width: 600, height: 600, depth: 250, plinth: false, back: false, lower: 'open' }), cfg({ width: 3200, height: 2600, depth: 500, lower: 'drawers', handle: 'bar', led: true })]) {
      const l = layout(normalize(c).config);
      for (const p of l.parts.filter((x) => x.role !== 'handle')) {
        expect(p.x).toBeGreaterThanOrEqual(-1e-6);
        expect(p.y).toBeGreaterThanOrEqual(-1e-6);
        expect(p.z).toBeGreaterThanOrEqual(-1e-6);
        expect(p.x + p.w).toBeLessThanOrEqual(c.width + 1e-6);
        expect(p.y + p.h).toBeLessThanOrEqual(c.height + 1e-6);
        expect(p.z + p.d).toBeLessThanOrEqual(c.depth + 1e-6);
      }
      expect(count(l.parts, 'side')).toBe(2);
      expect(count(l.parts, 'divider')).toBe(l.bays - 1);
      expect(count(l.parts, 'shelf')).toBe(l.bays * (l.rows - 1));
      for (const s of l.parts.filter((p) => p.role === 'shelf')) {
        const left = l.bayX[s.bay] ?? -1;
        expect(s.x).toBeCloseTo(left);
        expect(s.w).toBeCloseTo(l.bayW);
      }
    }
  });

  it('pairs doors on wide columns, stacks two drawers in tall rows', () => {
    const wide = layout(normalize(cfg({ width: 1500, bays: 2 })).config);
    expect(wide.bayW).toBeGreaterThan(600);
    expect(count(wide.parts, 'door')).toBe(4);
    const drawers = layout(normalize(cfg({ rows: 4, lower: 'drawers' })).config);
    expect(drawers.rowH).toBeGreaterThan(360);
    expect(count(drawers.parts, 'front')).toBe(2 * drawers.bays);
  });

  it('makes a top longer than a sheet in two pieces joined over a divider', () => {
    const l = layout(normalize(cfg({ width: 3200 })).config);
    expect(l.split).not.toBeNull();
    const tops = l.parts.filter((p) => p.role === 'top');
    expect(tops).toHaveLength(2);
    for (const t of tops) expect(t.w).toBeLessThanOrEqual(USABLE_LENGTH);
    const dividerCentres = l.parts.filter((p) => p.role === 'divider').map((d) => d.x + d.w / 2);
    expect(dividerCentres.some((x) => Math.abs(x - (l.split ?? 0)) < 1e-6)).toBe(true);
    expect(resolve(cfg({ width: 3200 })).notices.map((n) => n.code)).toContain('split');
  });

  it('warns about tall and shallow units and heavy ones', () => {
    expect(resolve(cfg({ height: 2600, depth: 250 })).notices.find((n) => n.code === 'tipping')?.level).toBe('warn');
    expect(resolve(cfg({ height: 1500, depth: 400 })).notices.map((n) => n.code)).toContain('wall');
    expect(resolve(cfg({ width: 3200, height: 2600, depth: 500 })).notices.map((n) => n.code)).toContain('heavy');
  });
});

describe('cutting list and plan', () => {
  it('lists each piece once with its quantity, length along the grain', () => {
    const c = normalize(cfg()).config;
    const l = layout(c);
    const pieces = cuttingList(l, c.material);
    const carcassParts = l.parts.filter((p) => p.group === 'carcass').length;
    expect(pieces.filter((p) => p.group === 'carcass').reduce((s, p) => s + p.qty, 0)).toBe(carcassParts);
    const side = pieces.find((p) => p.role === 'side');
    expect(side).toMatchObject({ length: c.height - 80, width: c.depth, thickness: 19, qty: 2 });
    expect(pieces.find((p) => p.role === 'shelf')?.length).toBe(Math.round(l.bayW));
  });

  it('does not band plywood edges', () => {
    const c = normalize(cfg({ material: 'bouleau' })).config;
    expect(cuttingList(layout(c), c.material).every((p) => p.edging === 0)).toBe(true);
  });

  it('packs pieces without overlap, inside the trimmed sheet, a kerf apart', () => {
    const pieces = Array.from({ length: 30 }, (_, i) => ({ id: String(i), length: 400 + (i * 37) % 900, width: 250 + (i * 53) % 300 }));
    const { sheets, unplaced } = pack(pieces, { grain: false });
    expect(unplaced).toEqual([]);
    const L = SHEET.length - 2 * SHEET.trim;
    const W = SHEET.width - 2 * SHEET.trim;
    for (const s of sheets) {
      for (const p of s.placements) {
        expect(p.x + p.w).toBeLessThanOrEqual(L);
        expect(p.y + p.h).toBeLessThanOrEqual(W);
      }
      for (const [i, a] of s.placements.entries()) {
        for (const b of s.placements.slice(i + 1)) {
          expect(overlap(a, b)).toBe(false);
          // pieces side by side are at least a kerf apart
          const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
          const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
          expect(Math.max(gapX, gapY)).toBeGreaterThanOrEqual(SHEET.kerf);
        }
      }
    }
    expect(sheets.flatMap((s) => s.placements)).toHaveLength(30);
  });

  it('keeps the grain: no rotation for veneer, rotation allowed for lacquer', () => {
    const mixed = [{ id: 'a', length: 600, width: 1900 }, { id: 'b', length: 1200, width: 300 }];
    expect(pack(mixed, { grain: true }).sheets.flatMap((s) => s.placements).every((p) => !p.rotated)).toBe(true);
    // 2.4 m across the grain is wider than a sheet: only a material without grain can turn it
    const across = [{ id: 'c', length: 400, width: 2400 }];
    expect(pack(across, { grain: true }).unplaced).toHaveLength(1);
    expect(pack(across, { grain: false }).sheets[0]?.placements[0]).toMatchObject({ rotated: true, w: 2400, h: 400 });
  });

  it('reports a piece larger than any sheet instead of placing it', () => {
    expect(pack([{ id: 'x', length: 3000, width: 500 }], { grain: true }).unplaced).toHaveLength(1);
  });

  it('uses a sensible number of sheets for a real unit', () => {
    const c = normalize(cfg()).config;
    const plans = cuttingPlan(cuttingList(layout(c), c.material), c.material);
    const carcass = plans.find((p) => p.group === 'carcass');
    // the default bookcase fits on two sheets (a single heuristic used to need a third for the plinth)
    expect(carcass?.sheets.length).toBe(2);
    expect(carcass?.waste).toBeGreaterThan(0);
    expect(carcass?.waste).toBeLessThan(0.6);
  });
});

describe('estimate', () => {
  it('prices whole sheets, hardware and labour, with VAT', () => {
    const e = estimate(cfg());
    const sum = e.price.lines.reduce((s, l) => s + l.total, 0);
    expect(e.price.ht).toBe(sum);
    expect(e.price.vat).toBe(Math.round(sum * 0.2));
    expect(e.price.ttc).toBe(e.price.ht + e.price.vat);
    const sheets = e.price.lines.find((l) => l.code === 'sheets.carcass');
    expect(sheets?.unit).toBe(MATERIALS.chene.sheet);
    expect(sheets?.qty).toBe(e.plans.find((p) => p.group === 'carcass')?.sheets.length);
    expect(e.price.lines.find((l) => l.code === 'hinges')?.qty).toBe(2 * e.layout.parts.filter((p) => p.role === 'door').length);
  });

  it('costs more for walnut, drawers, light and installation', () => {
    const base = estimate(cfg()).price.ttc;
    expect(estimate(cfg({ material: 'noyer' })).price.ttc).toBeGreaterThan(base);
    expect(estimate(cfg({ lower: 'drawers' })).price.ttc).toBeGreaterThan(base);
    expect(estimate(cfg({ led: true })).price.ttc).toBeGreaterThan(base);
    const installed = estimate(cfg({ install: true }));
    expect(installed.price.lines.find((l) => l.code === 'install')?.total).toBe(PRICES.installation + Math.round(1.8 * PRICES.installationPerMetre));
  });

  it('adds a week for lacquer and a week for drawers', () => {
    expect(estimate(cfg()).weeks).toBe(4);
    expect(estimate(cfg({ material: 'laque-sauge', lower: 'drawers' })).weeks).toBe(6);
  });
});

describe('share link', () => {
  it('round-trips a configuration', () => {
    const c = cfg({ width: 2400, height: 1200, depth: 400, bays: 4, rows: 3, plinth: false, back: false, lower: 'drawers', handle: 'knob', material: 'laque-nuit', led: true, install: true });
    expect(decodeConfig(new URLSearchParams(encodeConfig(c)))).toEqual({ config: c, valid: true });
  });

  it('falls back to defaults on a tampered or partial link', () => {
    expect(decodeConfig(new URLSearchParams('w=99999&m=chene'))).toEqual({ config: DEFAULT_CONFIG, valid: false });
    expect(decodeConfig(new URLSearchParams('m=<script>&w=1500')).config).toEqual({ ...DEFAULT_CONFIG, width: 1500 });
    expect(decodeConfig(new URLSearchParams('m=<script>&w=1500')).valid).toBe(false);
    expect(decodeConfig(new URLSearchParams(''))).toEqual({ config: DEFAULT_CONFIG, valid: true });
  });
});
