// Workshop rules: a requested configuration becomes a buildable one, with the reason for every
// adjustment, and then a layout of parts placed in space. Pure functions, millimetres throughout.
// Axes: x from the left, y from the floor, z from the wall (the front is at z = depth).
import {
  BACK_THICKNESS, DRAWER_BOX_THICKNESS, MATERIALS, MAX_SINGLE_DOOR, MAX_SPAN, MIN_BAY, MIN_DOOR_ROW, MIN_ROW,
  PLINTH, PLINTH_SETBACK, REVEAL, STEP, TARGET_ROW, USABLE_LENGTH, LIMITS,
} from './catalog';
import type { Config } from './schema';

export type NoticeCode = 'bays.adjusted' | 'rows.adjusted' | 'doors.tooLow' | 'split' | 'wall' | 'tipping' | 'heavy' | 'led.noBack';
export interface Notice { code: NoticeCode; level: 'info' | 'warn'; params?: Record<string, number> }

export type Role =
  | 'side' | 'divider' | 'top' | 'bottom' | 'shelf' | 'plinth' | 'back'
  | 'door' | 'front' | 'drawer-side' | 'drawer-back' | 'drawer-bottom' | 'handle' | 'led';
/** The sheet stock a part is cut from; null for hardware. */
export type Group = 'carcass' | 'back' | 'drawer';

export interface Part {
  role: Role;
  group: Group | null;
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  bay: number;
  row: number;
  /** Doors: the side their hinges are on. */
  hinge?: 'left' | 'right';
}

export interface Layout {
  t: number;
  bays: number;
  rows: number;
  bayW: number;
  rowH: number;
  plinth: number;
  /** x of the joint when the top, bottom and plinth are longer than a sheet; null otherwise. */
  split: number | null;
  bayX: number[];
  rowY: number[];
  drawersPerBay: number;
  parts: Part[];
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const snap = (v: number, min: number, max: number) => clamp(Math.round(v / STEP) * STEP, min, max);

/** Width of each column for n columns between the two sides and n − 1 dividers. */
export const bayWidth = (width: number, n: number, t: number) => (width - (n + 1) * t) / n;
/** Height of each compartment for n rows between the bottom and the top. */
export const rowHeight = (inner: number, n: number, t: number) => (inner - (n - 1) * t) / n;

/** Columns allowed for a width: no shelf longer than MAX_SPAN, no column narrower than MIN_BAY. */
export function bayRange(width: number, t: number): { min: number; max: number } {
  let min = 1;
  while (bayWidth(width, min, t) > MAX_SPAN) min++;
  let max = min;
  while (bayWidth(width, max + 1, t) >= MIN_BAY) max++;
  return { min, max };
}

/** Rows allowed for an inner height: none lower than MIN_ROW. */
export function rowRange(inner: number, t: number): { min: number; max: number } {
  return { min: 1, max: Math.max(1, Math.floor((inner + t) / (MIN_ROW + t))) };
}
export const autoRows = (inner: number, t: number) => clamp(Math.round((inner + t) / (TARGET_ROW + t)), 1, rowRange(inner, t).max);

const innerHeight = (c: Config, t: number) => c.height - (c.plinth ? PLINTH : 0) - 2 * t;

/** Makes a requested configuration buildable; every change comes with a notice saying why. */
export function normalize(input: Config): { config: Config; notices: Notice[] } {
  const notices: Notice[] = [];
  const config: Config = {
    ...input,
    width: snap(input.width, LIMITS.width.min, LIMITS.width.max),
    height: snap(input.height, LIMITS.height.min, LIMITS.height.max),
    depth: snap(input.depth, LIMITS.depth.min, LIMITS.depth.max),
  };
  const t = MATERIALS[config.material].thickness;
  const bays = bayRange(config.width, t);
  if (config.bays !== 0 && (config.bays < bays.min || config.bays > bays.max)) {
    config.bays = clamp(config.bays, bays.min, bays.max);
    notices.push({ code: 'bays.adjusted', level: 'info', params: { n: config.bays, span: MAX_SPAN / 10, min: MIN_BAY / 10 } });
  }
  const inner = innerHeight(config, t);
  const rows = rowRange(inner, t);
  if (config.rows !== 0 && config.rows > rows.max) {
    config.rows = rows.max;
    notices.push({ code: 'rows.adjusted', level: 'info', params: { n: config.rows, min: MIN_ROW / 10 } });
  }
  const rowH = rowHeight(inner, config.rows || autoRows(inner, t), t);
  if (config.lower === 'doors' && rowH < MIN_DOOR_ROW) {
    config.lower = 'open';
    notices.push({ code: 'doors.tooLow', level: 'warn', params: { min: MIN_DOOR_ROW / 10 } });
  }
  return { config, notices };
}

/** Places every part of a normalized configuration. */
export function layout(c: Config): Layout {
  const t = MATERIALS[c.material].thickness;
  const plinth = c.plinth ? PLINTH : 0;
  const bays = c.bays || bayRange(c.width, t).min;
  const inner = innerHeight(c, t);
  const rows = c.rows || autoRows(inner, t);
  const bayW = bayWidth(c.width, bays, t);
  const rowH = rowHeight(inner, rows, t);
  const back = c.back ? BACK_THICKNESS : 0;
  const bayX = Array.from({ length: bays }, (_, i) => t + i * (bayW + t));
  const rowY = Array.from({ length: rows }, (_, j) => plinth + t + j * (rowH + t));
  const parts: Part[] = [];
  const add = (p: Omit<Part, 'bay' | 'row'> & Partial<Pick<Part, 'bay' | 'row'>>) => { parts.push({ bay: -1, row: -1, ...p }); };

  // a top, bottom or plinth longer than a sheet is made in two pieces joined over the middle divider
  const span = c.width - 2 * t;
  const split = span > USABLE_LENGTH && bays > 1 ? (bayX[Math.floor(bays / 2)] ?? 0) - t / 2 : null;
  const runs = (from: number, to: number): [number, number][] => (split === null ? [[from, to]] : [[from, split], [split, to]]);

  for (const x of [0, c.width - t]) add({ role: 'side', group: 'carcass', x, y: plinth, z: 0, w: t, h: c.height - plinth, d: c.depth });
  for (const [a, b] of runs(t, c.width - t)) {
    add({ role: 'bottom', group: 'carcass', x: a, y: plinth, z: 0, w: b - a, h: t, d: c.depth });
    add({ role: 'top', group: 'carcass', x: a, y: c.height - t, z: 0, w: b - a, h: t, d: c.depth });
  }
  for (let i = 1; i < bays; i++) add({ role: 'divider', group: 'carcass', x: (bayX[i] ?? 0) - t, y: plinth + t, z: 0, w: t, h: inner, d: c.depth });

  for (let i = 0; i < bays; i++) {
    const x = bayX[i] ?? 0;
    for (let j = 1; j < rows; j++) add({ role: 'shelf', group: 'carcass', x, y: (rowY[j] ?? 0) - t, z: back, w: bayW, h: t, d: c.depth - back, bay: i, row: j });
    if (c.back) add({ role: 'back', group: 'back', x, y: plinth + t, z: 0, w: bayW, h: inner, d: BACK_THICKNESS, bay: i });
  }

  if (c.plinth) {
    const front = c.depth - PLINTH_SETBACK - t;
    for (const [a, b] of runs(0, c.width)) {
      add({ role: 'plinth', group: 'carcass', x: a, y: 0, z: front, w: b - a, h: PLINTH, d: t });
      add({ role: 'plinth', group: 'carcass', x: a, y: 0, z: 0, w: b - a, h: PLINTH, d: t });
    }
    for (const x of [0, c.width - t]) add({ role: 'plinth', group: 'carcass', x, y: 0, z: t, w: t, h: PLINTH, d: front - t });
  }

  // the bottom row closes with inset doors or drawer fronts, flush with the front
  const y0 = rowY[0] ?? 0;
  const drawersPerBay = c.lower === 'drawers' ? (rowH >= 360 ? 2 : 1) : 0;
  for (let i = 0; i < bays; i++) {
    const x = bayX[i] ?? 0;
    if (c.lower === 'doors') {
      const pair = bayW > MAX_SINGLE_DOOR;
      const w = pair ? (bayW - 3 * REVEAL) / 2 : bayW - 2 * REVEAL;
      const h = rowH - 2 * REVEAL;
      const doors: [number, 'left' | 'right'][] = pair ? [[x + REVEAL, 'left'], [x + 2 * REVEAL + w, 'right']] : [[x + REVEAL, i % 2 === 0 ? 'left' : 'right']];
      for (const [dx, hinge] of doors) {
        add({ role: 'door', group: 'carcass', x: dx, y: y0 + REVEAL, z: c.depth - t, w, h, d: t, bay: i, row: 0, hinge });
        if (c.handle !== 'push') {
          const hx = hinge === 'left' ? dx + w - 40 : dx + 28;
          add(c.handle === 'bar'
            ? { role: 'handle', group: null, x: hx, y: y0 + REVEAL + h - 200, z: c.depth, w: 12, h: 160, d: 22, bay: i, row: 0 }
            : { role: 'handle', group: null, x: hx, y: y0 + REVEAL + h - 70, z: c.depth, w: 24, h: 24, d: 22, bay: i, row: 0 });
        }
      }
    }
    if (drawersPerBay) {
      const fh = (rowH - (drawersPerBay + 1) * REVEAL) / drawersPerBay;
      const fw = bayW - 2 * REVEAL;
      const boxD = c.depth - t - back - 20;
      const boxH = Math.max(60, fh - 40);
      for (let k = 0; k < drawersPerBay; k++) {
        const fy = y0 + REVEAL + k * (fh + REVEAL);
        add({ role: 'front', group: 'carcass', x: x + REVEAL, y: fy, z: c.depth - t, w: fw, h: fh, d: t, bay: i, row: 0 });
        // box behind the front, between two 13 mm runners
        const bx = x + 13;
        const bw = bayW - 26;
        const by = fy + 15;
        const bz = c.depth - t - boxD;
        for (const sx of [bx, bx + bw - DRAWER_BOX_THICKNESS]) add({ role: 'drawer-side', group: 'drawer', x: sx, y: by, z: bz, w: DRAWER_BOX_THICKNESS, h: boxH, d: boxD, bay: i, row: 0 });
        add({ role: 'drawer-back', group: 'drawer', x: bx + DRAWER_BOX_THICKNESS, y: by, z: bz, w: bw - 2 * DRAWER_BOX_THICKNESS, h: boxH, d: DRAWER_BOX_THICKNESS, bay: i, row: 0 });
        add({ role: 'drawer-bottom', group: 'back', x: bx, y: by - BACK_THICKNESS, z: bz, w: bw, h: BACK_THICKNESS, d: boxD, bay: i, row: 0 });
        if (c.handle !== 'push') {
          add(c.handle === 'bar'
            ? { role: 'handle', group: null, x: x + REVEAL + fw / 2 - 80, y: fy + fh / 2 - 6, z: c.depth, w: 160, h: 12, d: 22, bay: i, row: 0 }
            : { role: 'handle', group: null, x: x + REVEAL + fw / 2 - 12, y: fy + fh / 2 - 12, z: c.depth, w: 24, h: 24, d: 22, bay: i, row: 0 });
        }
      }
    }
    if (c.led) {
      // a strip under the top of every open compartment, near the front
      for (let j = c.lower === 'open' ? 0 : 1; j < rows; j++) {
        add({ role: 'led', group: null, x: x + 20, y: (rowY[j] ?? 0) + rowH - 4, z: c.depth - 40, w: bayW - 40, h: 4, d: 12, bay: i, row: j });
      }
    }
  }
  return { t, bays, rows, bayW, rowH, plinth, split, bayX, rowY, drawersPerBay, parts };
}

/** Weight of the wooden parts, in kg. */
export function weight(l: Layout, density: number): number {
  const grams = l.parts.filter((p) => p.group).reduce((sum, p) => sum + (p.w * p.h * p.d) / 1e9 * (p.group === 'carcass' ? density : 650) * 1000, 0);
  return Math.round(grams / 1000);
}

/** Advice that does not change the configuration: safety, transport, installation. */
export function advice(c: Config, l: Layout): Notice[] {
  const notices: Notice[] = [];
  if (l.split !== null) notices.push({ code: 'split', level: 'info', params: { max: USABLE_LENGTH / 10 } });
  // taller than seven times its depth, a loaded bookcase tips over without a wall fixing
  if (c.height / c.depth >= 7) notices.push({ code: 'tipping', level: 'warn' });
  else if (c.height >= 1200) notices.push({ code: 'wall', level: 'info' });
  const kg = weight(l, MATERIALS[c.material].density);
  if (kg > 60) notices.push({ code: 'heavy', level: 'info', params: { kg } });
  if (c.led && !c.back) notices.push({ code: 'led.noBack', level: 'info' });
  return notices;
}

/** Everything the interface needs about a requested configuration. */
export function resolve(input: Config): { config: Config; layout: Layout; notices: Notice[] } {
  const { config, notices } = normalize(input);
  const l = layout(config);
  return { config, layout: l, notices: [...notices, ...advice(config, l)] };
}
