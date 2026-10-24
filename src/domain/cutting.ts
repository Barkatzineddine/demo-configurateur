// From the layout to the workshop: the cutting list (each piece once, with how many) and the plan
// that places every piece on standard sheets. Lengths are given along the wood grain.
import { MATERIALS, SHEET, type MaterialId } from './catalog';
import { pack, type SheetPlan } from './packing';
import type { Group, Layout, Part, Role } from './rules';

export interface Piece {
  role: Role;
  group: Group;
  /** Along the grain. */
  length: number;
  width: number;
  thickness: number;
  qty: number;
  /** Visible edges to band, in mm per piece. */
  edging: number;
}

/** Parts whose grain runs vertically: the height is their length. */
const VERTICAL: Role[] = ['side', 'divider', 'back', 'door'];

function dims(p: Part): { length: number; width: number; thickness: number } {
  const r = (n: number) => Math.round(n);
  if (VERTICAL.includes(p.role)) return { length: r(p.h), width: r(p.role === 'back' || p.role === 'door' ? p.w : p.d), thickness: r(p.role === 'back' || p.role === 'door' ? p.d : p.w) };
  if (p.role === 'drawer-side') return { length: r(p.d), width: r(p.h), thickness: r(p.w) };
  if (p.role === 'drawer-bottom') return { length: r(p.w), width: r(p.d), thickness: r(p.h) };
  if (p.role === 'plinth') return p.d > p.w ? { length: r(p.d), width: r(p.h), thickness: r(p.w) } : { length: r(p.w), width: r(p.h), thickness: r(p.d) };
  if (p.role === 'front' || p.role === 'drawer-back') return { length: r(p.w), width: r(p.h), thickness: r(p.d) };
  return { length: r(p.w), width: r(p.d), thickness: r(p.h) }; // top, bottom, shelf
}

function edging(role: Role, length: number, width: number): number {
  if (role === 'door' || role === 'front') return 2 * (length + width);
  if (role === 'side' || role === 'divider' || role === 'top' || role === 'bottom' || role === 'shelf') return length;
  return 0;
}

export function cuttingList(l: Layout, material: MaterialId): Piece[] {
  const banded = MATERIALS[material].kind !== 'plywood'; // plywood edges stay visible, by design
  const pieces = new Map<string, Piece>();
  for (const p of l.parts) {
    if (!p.group) continue;
    const d = dims(p);
    const key = `${p.group}|${p.role}|${d.length}|${d.width}|${d.thickness}`;
    const known = pieces.get(key);
    if (known) known.qty++;
    else pieces.set(key, { role: p.role, group: p.group, ...d, qty: 1, edging: p.group === 'carcass' && banded ? edging(p.role, d.length, d.width) : 0 });
  }
  const order: Group[] = ['carcass', 'back', 'drawer'];
  return [...pieces.values()].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || b.length - a.length || b.width - a.width);
}

export interface GroupPlan { group: Group; sheets: SheetPlan[]; area: number; waste: number }

/** Packs each sheet stock separately. Back panels and drawer boxes have no grain to respect. */
export function cuttingPlan(pieces: Piece[], material: MaterialId): GroupPlan[] {
  const groups: Group[] = ['carcass', 'back', 'drawer'];
  return groups.flatMap((group) => {
    const list = pieces.filter((p) => p.group === group).flatMap((p, i) => Array.from({ length: p.qty }, (_, k) => ({ id: `${i}.${k}`, length: p.length, width: p.width })));
    if (!list.length) return [];
    const { sheets } = pack(list, { grain: group === 'carcass' && MATERIALS[material].grain });
    const usable = (SHEET.length - 2 * SHEET.trim) * (SHEET.width - 2 * SHEET.trim);
    const area = list.reduce((s, p) => s + p.length * p.width, 0);
    return [{ group, sheets, area, waste: 1 - area / (usable * sheets.length) }];
  });
}
