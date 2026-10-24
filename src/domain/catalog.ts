// Atelier Lisière (fictional joinery in Annecy): what can be ordered, what it costs, and the
// workshop's construction limits. Lengths in millimetres, money in euro cents.

export const COMPANY = {
  name: 'Atelier Lisière',
  legal: 'SAS au capital de 8 000 €',
  address: '9 rue des Tanneurs',
  zip: '74000',
  city: 'Annecy',
  phone: '04 65 71 30 12',
  email: 'contact@atelier-lisiere.example',
  siret: '912 345 678 00017',
  vat: 'FR00 912345678',
} as const;

/** Allowed outer dimensions (mm), in steps of 10 mm. */
export const LIMITS = {
  width: { min: 600, max: 3200 },
  height: { min: 600, max: 2600 },
  depth: { min: 250, max: 500 },
} as const;
export const STEP = 10;

/** Longest shelf a 18–19 mm board carries without visible sag under books (about 25 kg/m). */
export const MAX_SPAN = 800;
/** Narrowest compartment worth building. */
export const MIN_BAY = 250;
/** Lowest compartment: a paperback standing up. */
export const MIN_ROW = 180;
/** Compartment height the automatic layout aims for: most books, with room to take them out. */
export const TARGET_ROW = 330;
export const PLINTH = 80;
export const PLINTH_SETBACK = 40;
export const BACK_THICKNESS = 8;
export const DRAWER_BOX_THICKNESS = 15;
/** Doors need a row at least this tall; drawers need this much. */
export const MIN_DOOR_ROW = 250;
export const MIN_DRAWER_ROW = 120;
/** Single doors up to this bay width, pairs above. */
export const MAX_SINGLE_DOOR = 600;
/** Gap around doors and drawer fronts. */
export const REVEAL = 3;

/** Standard panel and saw: what the cutting plan packs pieces onto. */
export const SHEET = { length: 2800, width: 2070, trim: 10, kerf: 4 } as const;
export const USABLE_LENGTH = SHEET.length - 2 * SHEET.trim;

export const MATERIAL_IDS = ['chene', 'noyer', 'frene', 'bouleau', 'laque-blanc', 'laque-sauge', 'laque-nuit', 'laque-terre'] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];

export interface Material {
  kind: 'veneer' | 'plywood' | 'lacquer';
  thickness: number;
  /** Price of one finished sheet (veneer, varnish or lacquer included). */
  sheet: number;
  /** Price of a sheet of the matching 8 mm back panel. */
  backSheet: number;
  /** kg per m³, for the weight estimate. */
  density: number;
  /** Colour in the 3D view and the drawings. */
  color: string;
  /** Wood grain must run along the piece: no rotation on the cutting plan. */
  grain: boolean;
}

export const MATERIALS: Record<MaterialId, Material> = {
  chene: { kind: 'veneer', thickness: 19, sheet: 32_000, backSheet: 11_000, density: 680, color: '#c49a6c', grain: true },
  noyer: { kind: 'veneer', thickness: 19, sheet: 42_000, backSheet: 14_000, density: 680, color: '#7a5236', grain: true },
  frene: { kind: 'veneer', thickness: 19, sheet: 29_000, backSheet: 10_000, density: 680, color: '#dcc7a1', grain: true },
  bouleau: { kind: 'plywood', thickness: 18, sheet: 23_000, backSheet: 7_000, density: 650, color: '#e6d3b0', grain: true },
  'laque-blanc': { kind: 'lacquer', thickness: 19, sheet: 26_000, backSheet: 8_000, density: 750, color: '#f1eee7', grain: false },
  'laque-sauge': { kind: 'lacquer', thickness: 19, sheet: 26_000, backSheet: 8_000, density: 750, color: '#a3b18a', grain: false },
  'laque-nuit': { kind: 'lacquer', thickness: 19, sheet: 26_000, backSheet: 8_000, density: 750, color: '#2f3a4f', grain: false },
  'laque-terre': { kind: 'lacquer', thickness: 19, sheet: 26_000, backSheet: 8_000, density: 750, color: '#b8684a', grain: false },
};

/** Drawer boxes are always birch plywood, whatever the visible material. */
export const DRAWER_BOX_SHEET = 19_000;

export const LOWER_IDS = ['open', 'doors', 'drawers'] as const;
export type Lower = (typeof LOWER_IDS)[number];
export const HANDLE_IDS = ['push', 'bar', 'knob'] as const;
export type Handle = (typeof HANDLE_IDS)[number];

export const PRICES = {
  hinge: 600,
  handle: { push: 1_100, bar: 1_400, knob: 900 } satisfies Record<Handle, number>,
  slides: 3_800,
  /** Edge banding of visible front edges, per metre (veneer and lacquer only). */
  edging: 250,
  /** Cutting, drilling and edging, per piece. */
  perPiece: 600,
  assembly: 18_000,
  perBay: 2_500,
  ledPerMetre: 2_400,
  ledDriver: 3_500,
  delivery: 9_000,
  installation: 24_000,
  installationPerMetre: 6_000,
} as const;
export const VAT_RATE = 20;

/** Weeks from order to delivery. */
export const LEAD_TIME = { base: 4, lacquer: 1, drawers: 1 } as const;
