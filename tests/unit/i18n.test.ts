// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { fr } from '../../src/i18n/fr';

describe('translations', () => {
  it('has the same keys in French and English', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });
  it('keeps the same placeholders', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(fr) as (keyof typeof fr)[]) expect(vars(en[key]), key).toEqual(vars(fr[key]));
  });
});
