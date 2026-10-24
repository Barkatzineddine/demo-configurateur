import { useMemo } from 'react';
import { estimate } from '../domain/pricing';
import type { Design } from '../domain/schema';
import { useFormat } from '../format';
import { Link, navigate, usePage } from '../shared/router';
import { useFeedback } from '../shared/ui/Feedback';
import { deleteDesign, useData } from '../state/app';
import { load } from '../state/config';
import { Elevation } from '../ui/Elevation';

export default function Designs() {
  const { t, day, money0 } = useFormat();
  usePage(`${t('designs.title')} · Atelier Lisière`);
  const designs = useData((s) => s.designs);
  const requests = useData((s) => s.requests);
  return (
    <div className="designs">
      <header className="page-head">
        <h1 tabIndex={-1}>{t('designs.title')}</h1>
        <p className="lead">{t('designs.lead')}</p>
      </header>
      {designs.length ? (
        <ul className="design-grid">{designs.map((d) => <DesignCard key={d.id} design={d} />)}</ul>
      ) : <p className="card empty">{t('designs.empty')}</p>}

      <section className="card" aria-labelledby="req-t">
        <h2 id="req-t" className="card-title">{t('designs.requests')}</h2>
        {requests.length ? (
          <ul className="request-list">
            {requests.map((r) => (
              <li key={r.id}>
                <Link to={`/devis/${r.ref}`}>{r.ref}</Link>
                <span className="muted">{day(r.at)}</span>
                <strong className="num">{money0(r.total)}</strong>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">{t('designs.noRequest')}</p>}
      </section>
    </div>
  );
}

function DesignCard({ design }: { design: Design }) {
  const { t, day, money0, cm, material } = useFormat();
  const { confirm, toast } = useFeedback();
  const e = useMemo(() => estimate(design.config), [design.config]);
  const c = e.config;
  const remove = async () => {
    if (!(await confirm({ title: t('designs.deleteTitle', { name: design.name }), body: t('designs.deleteBody'), ok: t('common.delete'), cancel: t('common.cancel'), danger: true }))) return;
    deleteDesign(design.id);
    toast(t('designs.deleted'), 'ok');
  };
  return (
    <li className="card design">
      <Elevation config={c} layout={e.layout} dims={false} className="thumb" />
      <h2 className="design-name">{design.name}</h2>
      <p className="muted small">{cm(c.width)} × {cm(c.height)} × {cm(c.depth)} cm · {material(c.material)}</p>
      <p className="muted small">{t('designs.saved', { date: day(design.saved) })}</p>
      <p className="design-price">{money0(e.price.ttc)}</p>
      <div className="design-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => { load(design.config); navigate('/'); }}>{t('designs.open')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove()} aria-label={`${t('common.delete')} : ${design.name}`}>{t('common.delete')}</button>
      </div>
    </li>
  );
}
