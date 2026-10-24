// The settings panel. It shows the buildable configuration (after the workshop rules) and sends
// every change as a patch of the requested one: the rules run again and explain any adjustment.
import { useId, type ReactNode } from 'react';
import { HANDLE_IDS, LIMITS, LOWER_IDS, MATERIAL_IDS, MATERIALS } from '../domain/catalog';
import type { Estimate } from '../domain/pricing';
import { bayRange, rowRange } from '../domain/rules';
import type { Config } from '../domain/schema';
import { useFormat } from '../format';
import type { Key } from '../i18n';
import { update } from '../state/config';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="group"><legend>{title}</legend>{children}</fieldset>;
}

function Dimension({ label, value, limits, onChange }: { label: string; value: number; limits: { min: number; max: number }; onChange: (mm: number) => void }) {
  const { t, cm } = useFormat();
  const id = useId();
  const min = limits.min / 10;
  const max = limits.max / 10;
  return (
    <div className="dim">
      <label htmlFor={`${id}-n`}>{label}</label>
      <div className="dim-row">
        <input type="range" min={min} max={max} step={1} value={value / 10} aria-labelledby={`${id}-l`} aria-valuetext={`${cm(value)} cm`}
          onChange={(e) => { onChange(Number(e.target.value) * 10); }} />
        <span className="num-input">
          <input id={`${id}-n`} type="number" inputMode="numeric" min={min} max={max} step={1} value={value / 10} aria-describedby={`${id}-r`}
            onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= min && v <= max) onChange(Math.round(v) * 10); }} />
          <span aria-hidden="true">{t('unit.cm')}</span>
        </span>
      </div>
      <span id={`${id}-l`} className="sr">{label}</span>
      <span id={`${id}-r`} className="sr">{t('dims.range', { min, max })}</span>
    </div>
  );
}

function Stepper({ label, value, auto, range, onChange }: { label: string; value: number; auto: boolean; range: { min: number; max: number }; onChange: (n: number) => void }) {
  const { t } = useFormat();
  const id = useId();
  return (
    <div className="stepper">
      <span id={id} className="stepper-label">{label}</span>
      <div className="stepper-row" role="group" aria-labelledby={id}>
        <button type="button" className="step" aria-label={`${label} : ${t('layout.less')}`} disabled={value <= range.min} onClick={() => { onChange(value - 1); }}>−</button>
        <output className="step-value" aria-live="polite">{value}</output>
        <button type="button" className="step" aria-label={`${label} : ${t('layout.more')}`} disabled={value >= range.max} onClick={() => { onChange(value + 1); }}>+</button>
        <label className="auto"><input type="checkbox" checked={auto} onChange={(e) => { onChange(e.target.checked ? 0 : value); }} /> {t('layout.auto')}</label>
      </div>
    </div>
  );
}

function Choice<T extends string>({ name, legend, options, value, label, onChange, disabled = false }: {
  name: string; legend: string; options: readonly T[]; value: T; label: (v: T) => string; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <fieldset className="choice" disabled={disabled}>
      <legend>{legend}</legend>
      <div className="seg">
        {options.map((o) => (
          <label key={o} className="seg-item">
            <input type="radio" name={name} value={o} checked={value === o} onChange={() => { onChange(o); }} />
            <span>{label(o)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Controls({ e, requested }: { e: Estimate; requested: Config }) {
  const { t, cm, material } = useFormat();
  const c = e.config;
  const l = e.layout;
  const inner = c.height - l.plinth - 2 * l.t;
  const set = (patch: Partial<Config>) => { update(patch); };
  return (
    <form className="controls" aria-label={t('config.panel')} onSubmit={(ev) => { ev.preventDefault(); }}>
      <Group title={t('dims.title')}>
        <Dimension label={t('dims.width')} value={c.width} limits={LIMITS.width} onChange={(width) => { set({ width }); }} />
        <Dimension label={t('dims.height')} value={c.height} limits={LIMITS.height} onChange={(height) => { set({ height }); }} />
        <Dimension label={t('dims.depth')} value={c.depth} limits={LIMITS.depth} onChange={(depth) => { set({ depth }); }} />
      </Group>

      <Group title={t('layout.title')}>
        <div className="steppers">
          <Stepper label={t('layout.bays')} value={l.bays} auto={requested.bays === 0} range={bayRange(c.width, l.t)} onChange={(bays) => { set({ bays }); }} />
          <Stepper label={t('layout.rows')} value={l.rows} auto={requested.rows === 0} range={rowRange(inner, l.t)} onChange={(rows) => { set({ rows }); }} />
        </div>
        <p className="hint">{t('layout.info', { w: cm(l.bayW), h: cm(l.rowH) })}</p>
      </Group>

      <Group title={t('finish.title')}>
        <div className="swatches">
          {MATERIAL_IDS.map((id) => (
            <label key={id} className="swatch">
              <input type="radio" name="material" value={id} checked={c.material === id} onChange={() => { set({ material: id }); }} />
              <span className="swatch-chip" data-material={id} aria-hidden="true" />
              <span className="swatch-name">{material(id)}</span>
            </label>
          ))}
        </div>
        <p className="hint">{t(`kind.${MATERIALS[c.material].kind}` as Key)}</p>
      </Group>

      <Choice name="lower" legend={t('lower.title')} options={LOWER_IDS} value={c.lower} label={(v) => t(`lower.${v}` as Key)} onChange={(lower) => { set({ lower }); }} />
      <Choice name="handle" legend={t('handle.title')} options={HANDLE_IDS} value={c.handle} label={(v) => t(`handle.${v}` as Key)} onChange={(handle) => { set({ handle }); }} disabled={c.lower === 'open'} />

      <Group title={t('options.title')}>
        {([['plinth', 'opt.plinth'], ['back', 'opt.back'], ['led', 'opt.led'], ['install', 'opt.install']] as const).map(([key, label]) => (
          <label key={key} className="toggle">
            <input type="checkbox" checked={c[key]} onChange={(ev) => { set({ [key]: ev.target.checked }); }} />
            <span>{t(label)}</span>
          </label>
        ))}
      </Group>
    </form>
  );
}
