// The preview: the front view drawn in SVG at once (it is also what the pre-rendered page shows), then
// the 3D scene, fetched when the browser is idle, over it. Without WebGL the drawing stays.
import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Estimate } from '../domain/pricing';
import { useFormat } from '../format';
import type { Key } from '../i18n';
import { download } from '../shared/security';
import { useFeedback } from '../shared/ui/Feedback';
import { capture, setCamera, toggleDims, toggleOpen, useView, type Camera } from '../state/view';
import { Elevation } from './Elevation';

const Scene = lazy(() => import('../three/Scene'));

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** A failed WebGL start (lost context, blocked GPU) falls back to the drawing instead of breaking the page. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

type Phase = 'waiting' | 'loading' | 'ready' | 'flat';

/**
 * On a large screen with a mouse the 3D view loads by itself. On phones it waits for a tap: about
 * 250 kB of code and a GPU warm-up are worth asking for, and the front view is already there.
 */
const loadsByItself = () => typeof matchMedia === 'function' && matchMedia('(min-width: 900px) and (pointer: fine)').matches
  && !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

export function Viewer({ e }: { e: Estimate }) {
  const { t, material, cm } = useFormat();
  const { toast } = useFeedback();
  const view = useView();
  const [phase, setPhase] = useState<Phase>('waiting');
  const [byItself] = useState(loadsByItself);
  const c = e.config;
  const start = useCallback(() => { setPhase(webglAvailable() ? 'loading' : 'flat'); }, []);

  useEffect(() => {
    // three.js is the heaviest part of the app: it loads once the first screen is up (and never in the
    // build-time snapshot, which keeps the drawing: build/prerender.ts)
    if ((window as { __PRERENDER__?: boolean }).__PRERENDER__ || !byItself) return;
    const go = start;
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(go, { timeout: 1500 });
      return () => { cancelIdleCallback(id); };
    }
    const id = setTimeout(go, 200);
    return () => { clearTimeout(id); };
  }, [byItself, start]);

  const onReady = useCallback(() => { setPhase('ready'); }, []);
  const lower = c.lower === 'open' ? '' : t(`view.alt.${c.lower}` as Key);
  const label = t('view.alt', { material: material(c.material).toLowerCase(), w: cm(c.width), h: cm(c.height), d: cm(c.depth), bays: e.layout.bays, rows: e.layout.rows, lower });
  const flat = phase === 'flat';
  const drawing = <Elevation config={c} layout={e.layout} label={label} />;

  const saveImage = () => {
    const url = capture();
    if (!url) return;
    const bytes = Uint8Array.from(atob(url.split(',')[1] ?? ''), (ch) => ch.charCodeAt(0));
    download(`bibliotheque-${c.width / 10}x${c.height / 10}.png`, bytes, 'image/png');
    toast(t('view.imageDone'), 'ok');
  };

  const cameras: [Camera, Key][] = [['front', 'view.front'], ['angle', 'view.angle'], ['side', 'view.side']];
  return (
    <section className="viewer" aria-label={t('view.label')}>
      <div className={`stage stage-${phase}`}>
        <div className="stage-drawing" aria-hidden={phase === 'ready' ? true : undefined}>{drawing}</div>
        {phase === 'loading' || phase === 'ready' ? (
          <SceneBoundary fallback={null}>
            <Suspense fallback={null}><Scene config={c} layout={e.layout} label={label} onReady={onReady} /></Suspense>
          </SceneBoundary>
        ) : null}
        {phase === 'loading' ? <p className="stage-status" data-volatile>{t('view.loading')}</p> : null}
        {phase === 'waiting' && !byItself ? <button type="button" className="btn btn-primary stage-cta" data-volatile onClick={start}>{t('view.show3d')}</button> : null}
      </div>
      {flat ? <p className="hint">{t('view.no3d')}</p> : (
        <div className="toolbar" role="toolbar" aria-label={t('view.cameras')}>
          <div className="seg">
            {cameras.map(([id, key]) => (
              <button key={id} type="button" className="tool" aria-pressed={view.camera === id} disabled={phase !== 'ready'} onClick={() => { setCamera(id); }}>{t(key)}</button>
            ))}
          </div>
          <button type="button" className="tool" aria-pressed={view.dims} disabled={phase !== 'ready'} onClick={toggleDims}>{t('view.dims')}</button>
          <button type="button" className="tool" aria-pressed={view.open} disabled={phase !== 'ready' || c.lower === 'open'} onClick={toggleOpen}>{t('view.open')}</button>
          <button type="button" className="tool" disabled={phase !== 'ready'} onClick={saveImage}>{t('view.image')}</button>
          {/* depends on the device: left to the app in the pre-rendered page */}
          <p className="hint toolbar-hint" data-volatile>{phase === 'waiting' && !byItself ? t('view.onDemand') : t('view.hint')}</p>
        </div>
      )}
    </section>
  );
}
