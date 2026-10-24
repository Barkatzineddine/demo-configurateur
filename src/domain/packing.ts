// Guillotine bin packing: every cut runs edge to edge, as on a panel saw. Pieces go, one sort order at
// a time, onto the first sheet with room, in the free rectangle they fit most snugly (best short side
// fit); the rest of that rectangle is split in two by one cut. A saw kerf is left between pieces and
// the factory edges of each sheet are trimmed off. With grain, a piece keeps its length along the
// length of the sheet. No single heuristic wins on every cutting list, so several sort orders and
// cutting directions are tried and the plan with the fewest sheets (then the largest offcut) is kept.
import { SHEET } from './catalog';

export interface PackPiece { id: string; length: number; width: number }
export interface Placement { id: string; x: number; y: number; w: number; h: number; rotated: boolean }
export interface SheetPlan { placements: Placement[] }
export interface PackOptions { grain: boolean; length?: number; width?: number; trim?: number; kerf?: number }

interface Rect { x: number; y: number; w: number; h: number }
interface Orientation { w: number; h: number; rotated: boolean }
interface Choice extends Orientation { sheet: number; free: number; score: number }
/** shorter: cut along the shorter leftover; strips: rip across first (long strips); columns: crosscut first. */
type Split = 'shorter' | 'strips' | 'columns';
type Result = { sheets: SheetPlan[]; unplaced: PackPiece[] };

const ORDERS: ((a: PackPiece, b: PackPiece) => number)[] = [
  (a, b) => b.length * b.width - a.length * a.width || b.length - a.length,
  (a, b) => b.length - a.length || b.width - a.width,
  (a, b) => b.width - a.width || b.length - a.length,
];
const SPLITS: Split[] = ['shorter', 'strips', 'columns'];

export function pack(pieces: PackPiece[], options: PackOptions): Result {
  const L = (options.length ?? SHEET.length) - 2 * (options.trim ?? SHEET.trim);
  const W = (options.width ?? SHEET.width) - 2 * (options.trim ?? SHEET.trim);
  const kerf = options.kerf ?? SHEET.kerf;
  const lastUse = (r: Result) => r.sheets.at(-1)?.placements.reduce((s, p) => s + p.w * p.h, 0) ?? 0;
  let best: Result | null = null;
  for (const order of ORDERS) {
    for (const split of SPLITS) {
      const r = run([...pieces].sort(order), split, { L, W, kerf, grain: options.grain });
      if (!best || r.sheets.length < best.sheets.length || (r.sheets.length === best.sheets.length && lastUse(r) < lastUse(best))) best = r;
    }
  }
  return best ?? { sheets: [], unplaced: [] };
}

function run(sorted: PackPiece[], split: Split, { L, W, kerf, grain }: { L: number; W: number; kerf: number; grain: boolean }): Result {
  const sheets: { plan: SheetPlan; free: Rect[] }[] = [];
  const unplaced: PackPiece[] = [];
  const orientations = (p: PackPiece): Orientation[] => {
    const list = [{ w: p.length, h: p.width, rotated: false }];
    if (!grain && p.length !== p.width) list.push({ w: p.width, h: p.length, rotated: true });
    return list;
  };

  for (const piece of sorted) {
    const shapes = orientations(piece);
    if (!shapes.some((o) => o.w <= L && o.h <= W)) { unplaced.push(piece); continue; }

    let best: Choice | null = null;
    for (const [s, sheet] of sheets.entries()) {
      for (const [i, f] of sheet.free.entries()) {
        for (const o of shapes) {
          if (o.w > f.w || o.h > f.h) continue;
          const score = Math.min(f.w - o.w, f.h - o.h);
          if (!best || score < best.score) best = { ...o, sheet: s, free: i, score };
        }
      }
      if (best) break;
    }
    if (!best) {
      sheets.push({ plan: { placements: [] }, free: [{ x: 0, y: 0, w: L, h: W }] });
      const o = shapes.find((x) => x.w <= L && x.h <= W) as Orientation;
      best = { ...o, sheet: sheets.length - 1, free: 0, score: 0 };
    }

    const target = sheets[best.sheet];
    const f = target?.free[best.free];
    if (!target || !f) continue;
    const { w, h, rotated } = best;
    target.plan.placements.push({ id: piece.id, x: f.x, y: f.y, w, h, rotated });
    target.free.splice(best.free, 1);
    // one cut across (the strip above keeps the full width) or along (the column beside keeps the full height)
    const across = split === 'strips' || (split === 'shorter' && f.w - w < f.h - h);
    const right: Rect = { x: f.x + w + kerf, y: f.y, w: f.w - w - kerf, h: across ? h : f.h };
    const top: Rect = { x: f.x, y: f.y + h + kerf, w: across ? f.w : w, h: f.h - h - kerf };
    for (const r of [right, top]) if (r.w > 0 && r.h > 0) target.free.push(r);
  }
  return { sheets: sheets.map((s) => s.plan), unplaced };
}
