// Display helpers that depend on the current language: amounts from cents, millimetres as
// centimetres, materials, notices and price lines (stored as codes, written out here).
import { useCallback } from 'react';
import { MATERIALS, type MaterialId } from './domain/catalog';
import type { PriceLine } from './domain/pricing';
import type { Notice } from './domain/rules';
import { useI18n, type Key } from './i18n';

export function useFormat() {
  const i18n = useI18n();
  const { t, locale } = i18n;
  const money = useCallback((cents: number) => i18n.money(cents / 100, 2), [i18n]);
  const money0 = useCallback((cents: number) => i18n.money(cents / 100, 0), [i18n]);
  const num = useCallback((n: number, digits = 0) => n.toLocaleString(locale, { maximumFractionDigits: digits }), [locale]);
  const cm = useCallback((mm: number) => num(mm / 10, 1), [num]);
  const material = useCallback((id: MaterialId) => t(`material.${id}` as Key), [t]);
  const notice = useCallback((n: Notice) => t(`notice.${n.code}` as Key, Object.fromEntries(Object.entries(n.params ?? {}).map(([k, v]) => [k, num(v)]))), [t, num]);
  const line = useCallback((l: PriceLine, id: MaterialId) => t(`line.${l.code}` as Key, { material: material(id), t: MATERIALS[id].thickness }), [t, material]);
  const day = useCallback((stamp: string) => i18n.date(stamp, { day: 'numeric', month: 'long', year: 'numeric' }), [i18n]);
  return { ...i18n, money, money0, num, cm, material, notice, line, day };
}
