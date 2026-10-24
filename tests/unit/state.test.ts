import { beforeEach, describe, expect, it } from 'vitest';
import { estimate } from '../../src/domain/pricing';
import { DEFAULT_CONFIG } from '../../src/domain/schema';
import { buildPdf, pdfFileName } from '../../src/pdf/layout';
import { app, checkRequest, deleteDesign, saveDesign, sendRequest } from '../../src/state/app';
import { load, redo, undo, update, useConfig } from '../../src/state/config';

const config = () => useConfig.getState().config;
const person = { name: 'Camille Durand', email: 'camille@example.com', phone: '06 39 98 12 34', zip: '74000', message: 'Séjour', consent: true };

beforeEach(() => {
  useConfig.setState({ config: DEFAULT_CONFIG, past: [], future: [] });
  app.reset();
});

describe('editing history', () => {
  it('makes one step of a dragged slider, separate steps of different settings', () => {
    update({ width: 1810 }, 1000);
    update({ width: 1820 }, 1100);
    update({ width: 1830 }, 1200);
    update({ material: 'noyer' }, 1300);
    update({ lower: 'open' }, 1400);
    expect(useConfig.getState().past).toHaveLength(3);
    undo();
    expect(config().lower).toBe('doors');
    undo();
    expect(config().material).toBe('chene');
    undo();
    expect(config().width).toBe(1800);
    redo();
    redo();
    expect(config()).toMatchObject({ width: 1830, material: 'noyer', lower: 'doors' });
  });

  it('ignores changes that change nothing and clears redo after a new change', () => {
    update({ width: 1800 }, 1000);
    expect(useConfig.getState().past).toHaveLength(0);
    update({ height: 2000 }, 2000);
    undo();
    update({ depth: 400 }, 4000);
    expect(useConfig.getState().future).toHaveLength(0);
  });

  it('loads a whole configuration as one step', () => {
    load({ ...DEFAULT_CONFIG, width: 2400, material: 'frene' });
    expect(useConfig.getState().past).toHaveLength(1);
    undo();
    expect(config()).toEqual(DEFAULT_CONFIG);
  });
});

describe('designs and quote requests', () => {
  it('saves, cleans and deletes designs', () => {
    const d = saveDesign(`  Salon${String.fromCharCode(0x202e)}  `, DEFAULT_CONFIG);
    expect(d?.name).toBe('Salon');
    expect(app.get().designs).toHaveLength(1);
    deleteDesign(d?.id ?? '');
    expect(app.get().designs).toHaveLength(0);
  });

  it('checks every field like a server would', () => {
    expect(checkRequest(person)).toEqual({});
    expect(checkRequest({ ...person, name: 'x', email: 'nope', phone: '123', zip: '7400', consent: false })).toEqual({ name: true, email: true, phone: true, zip: true, consent: true });
    expect(sendRequest({ ...person, zip: 'abcde' }, DEFAULT_CONFIG, 100)).toBeNull();
  });

  it('numbers requests per year and normalises the phone', () => {
    const now = new Date(2026, 9, 24, 10, 0);
    const a = sendRequest(person, DEFAULT_CONFIG, 208_170, now);
    const b = sendRequest(person, DEFAULT_CONFIG, 208_170, now);
    expect([a?.ref, b?.ref]).toEqual(['AL-2026-0001', 'AL-2026-0002']);
    expect(a?.phone).toBe('06 39 98 12 34');
    expect(app.get().requests[0]?.ref).toBe('AL-2026-0002');
  });

  it('writes a two-page PDF summary', () => {
    const r = sendRequest(person, DEFAULT_CONFIG, 208_170, new Date(2026, 9, 24, 10, 0));
    if (!r) throw new Error('request refused');
    const bytes = buildPdf(r, estimate(r.config), new Date(2026, 9, 24, 10, 0));
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(pdfFileName(r)).toBe('recapitulatif-al-2026-0001.pdf');
  });
});
