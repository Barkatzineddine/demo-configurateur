import { useEffect, useRef, useState } from 'react';
import { encodeConfig, decodeConfig } from '../domain/share';
import { useFormat } from '../format';
import { Link, navigate, usePage, useLocation } from '../shared/router';
import { Field } from '../shared/ui/Field';
import { Dialog } from '../shared/ui/Dialog';
import { useFeedback } from '../shared/ui/Feedback';
import { saveDesign } from '../state/app';
import { load, openedFromValidLink, redo, reset, undo, useConfig } from '../state/config';
import { Controls } from '../ui/Controls';
import { Summary } from '../ui/Summary';
import { useEstimate } from '../ui/useEstimate';
import { Viewer } from '../ui/Viewer';

let warnedAboutLink = false;

export default function Configurator() {
  const { t, cm } = useFormat();
  usePage(`${t('config.title')} · Atelier Lisière`);
  const { toast } = useFeedback();
  const { requested, e } = useEstimate();
  const canUndo = useConfig((s) => s.past.length > 0);
  const canRedo = useConfig((s) => s.future.length > 0);
  const { path, query } = useLocation();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  // the address follows the configuration (a shareable link); a different address that this page did
  // not write (a pasted link, back and forward) loads instead
  const encoded = encodeConfig(requested);
  const inAddress = query.toString();
  const written = useRef(inAddress);
  useEffect(() => {
    if (path !== '/') return;
    if (inAddress !== written.current && inAddress !== encoded) {
      written.current = inAddress;
      const link = decodeConfig(new URLSearchParams(inAddress));
      if (link.valid) { load(link.config); return; }
    }
    if (inAddress !== encoded) {
      written.current = encoded;
      navigate(`/?${encoded}`, { replace: true });
    }
  }, [path, encoded, inAddress]);

  useEffect(() => {
    if (openedFromValidLink || warnedAboutLink) return;
    warnedAboutLink = true;
    toast(t('link.invalid'), 'info');
  }, [t, toast]);

  // Ctrl+Z / Ctrl+Shift+Z or Ctrl+Y, except while typing in a field
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!(ev.ctrlKey || ev.metaKey) || (ev.target as HTMLElement).closest('input[type=number], input[type=text], textarea')) return;
      const key = ev.key.toLowerCase();
      if (key === 'z' && !ev.shiftKey) { ev.preventDefault(); undo(); }
      if ((key === 'z' && ev.shiftKey) || key === 'y') { ev.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, []);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast(t('act.shared'), 'ok');
    } catch {
      toast(t('act.copyBlocked'), 'info');
    }
  };
  const openSave = () => { setName(t('act.defaultName', { w: cm(e.config.width), h: cm(e.config.height) })); setSaving(true); };
  const save = () => {
    if (saveDesign(name, requested)) { setSaving(false); toast(t('act.saved'), 'ok', { label: t('nav.designs'), run: () => { navigate('/projets'); } }); }
  };

  return (
    <div className="configurator">
      <header className="page-head">
        <h1 tabIndex={-1}>{t('config.title')}</h1>
        <p className="lead">{t('config.lead')}</p>
      </header>
      <div className="config-grid">
        <div className="config-main">
          <Viewer e={e} />
          <div className="actions">
            <div className="seg">
              <button type="button" className="btn btn-ghost" disabled={!canUndo} onClick={undo}>{t('act.undo')}</button>
              <button type="button" className="btn btn-ghost" disabled={!canRedo} onClick={redo}>{t('act.redo')}</button>
            </div>
            <button type="button" className="btn btn-ghost" onClick={reset}>{t('act.restart')}</button>
            <button type="button" className="btn btn-ghost" onClick={() => void share()}>{t('act.share')}</button>
            <button type="button" className="btn btn-ghost" onClick={openSave}>{t('act.save')}</button>
          </div>
          <Summary e={e} />
          <div className="actions actions-main">
            <Link to="/devis" className="btn btn-primary">{t('act.quote')}</Link>
            <Link to="/atelier" className="btn btn-ghost">{t('act.workshop')}</Link>
          </div>
        </div>
        <Controls e={e} requested={requested} />
      </div>
      <Dialog open={saving} onClose={() => { setSaving(false); }} title={t('act.saveTitle')}>
        <form className="form" onSubmit={(ev) => { ev.preventDefault(); save(); }}>
          <Field label={t('act.saveName')} value={name} maxLength={60} required data-autofocus onChange={(ev) => { setName(ev.target.value); }} />
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={() => { setSaving(false); }}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary">{t('common.save')}</button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
