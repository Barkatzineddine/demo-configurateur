import { useMemo, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { estimate } from '../domain/pricing';
import { useFormat } from '../format';
import { buildPdf, pdfFileName } from '../pdf/layout';
import { useFormGuard } from '../shared/formGuard';
import { Link, navigate, usePage } from '../shared/router';
import { download } from '../shared/security';
import { Checkbox, Field, Honeypot, TextArea } from '../shared/ui/Field';
import { useFeedback } from '../shared/ui/Feedback';
import { checkRequest, sendRequest, useData, type RequestField, type RequestInput } from '../state/app';
import { Elevation } from '../ui/Elevation';
import { useEstimate } from '../ui/useEstimate';

const ERRORS: Record<RequestField, 'err.name' | 'err.email' | 'err.phone' | 'err.zip' | 'err.consent'> = {
  name: 'err.name', email: 'err.email', phone: 'err.phone', zip: 'err.zip', consent: 'err.consent',
};

export function RequestPage() {
  const { t, money0, cm, material } = useFormat();
  usePage(`${t('req.title')} · Atelier Lisière`);
  const { toast } = useFeedback();
  const { requested, e } = useEstimate();
  const c = e.config;
  const guard = useFormGuard({ key: 'request', max: 4, windowMs: 30 * 60_000, minMs: 1500, maxLinks: 0 });
  const [form, setForm] = useState<RequestInput>({ name: '', email: '', phone: '', zip: '', message: '', consent: false });
  const [errors, setErrors] = useState<Partial<Record<RequestField, true>>>({});
  const set = (patch: Partial<RequestInput>) => { setForm((f) => ({ ...f, ...patch })); };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const found = checkRequest(form);
    flushSync(() => { setErrors(found); }); // render the errors, then move focus to the first one
    if (Object.keys(found).length) { document.querySelector<HTMLElement>('.request-form [aria-invalid="true"]')?.focus(); return; }
    const verdict = guard.check(form.message);
    if (!verdict.ok) {
      if (!verdict.silent) toast(verdict.reason === 'too-fast' ? t('err.tooFast') : verdict.reason === 'too-many-links' ? t('err.links') : t('err.rate', { n: verdict.waitMinutes ?? 1 }), 'err');
      return;
    }
    const request = sendRequest(form, requested, e.price.ttc);
    if (!request) return;
    verdict.commit();
    navigate(`/devis/${request.ref}`);
  };

  return (
    <div className="request">
      <header className="page-head">
        <h1 tabIndex={-1}>{t('req.title')}</h1>
        <p className="lead">{t('req.lead')}</p>
      </header>
      <div className="request-grid">
        <section className="card request-summary" aria-labelledby="sum-t">
          <h2 id="sum-t" className="card-title">{t('req.summary')}</h2>
          <Elevation config={c} layout={e.layout} dims={false} className="thumb" />
          <p>{cm(c.width)} × {cm(c.height)} × {cm(c.depth)} cm · {material(c.material)}</p>
          <p className="design-price">{money0(e.price.ttc)} <span className="muted small">{t('price.ttc')}</span></p>
          <Link to="/">{t('req.edit')}</Link>
        </section>
        <form className="card form request-form" noValidate onSubmit={submit}>
          <Field label={t('req.name')} autoComplete="name" value={form.name} maxLength={80} error={errors.name ? t(ERRORS.name) : null} onChange={(ev) => { set({ name: ev.target.value }); }} />
          <Field label={t('req.email')} type="email" autoComplete="email" value={form.email} maxLength={254} error={errors.email ? t(ERRORS.email) : null} onChange={(ev) => { set({ email: ev.target.value }); }} />
          <Field label={t('req.phone')} type="tel" autoComplete="tel" value={form.phone} maxLength={20} error={errors.phone ? t(ERRORS.phone) : null} onChange={(ev) => { set({ phone: ev.target.value }); }} />
          <Field label={t('req.zip')} inputMode="numeric" autoComplete="postal-code" value={form.zip} maxLength={5} error={errors.zip ? t(ERRORS.zip) : null} onChange={(ev) => { set({ zip: ev.target.value }); }} />
          <TextArea label={t('req.message')} rows={4} maxLength={1000} value={form.message} onChange={(ev) => { set({ message: ev.target.value }); }} />
          <Checkbox label={t('req.consent')} checked={form.consent} error={errors.consent ? t(ERRORS.consent) : null} onChange={(ev) => { set({ consent: ev.target.checked }); }} />
          <Honeypot inputRef={guard.honeypotRef} label={t('honeypot')} />
          <button type="submit" className="btn btn-primary">{t('req.send')}</button>
          <p className="hint">{t('req.privacy')}</p>
        </form>
      </div>
    </div>
  );
}

export function ConfirmationPage({ refCode }: { refCode: string }) {
  const { t } = useFormat();
  const request = useData((s) => s.requests.find((r) => r.ref === refCode));
  usePage(`${t('done.title')} · Atelier Lisière`);
  const e = useMemo(() => (request ? estimate(request.config) : null), [request]);
  if (!request || !e) {
    return (
      <div className="page-head">
        <h1 tabIndex={-1}>{t('done.notFound')}</h1>
        <p><Link to="/">{t('done.back')}</Link></p>
      </div>
    );
  }
  return (
    <div className="confirmation card">
      <p className="done-mark" aria-hidden="true">✓</p>
      <h1 tabIndex={-1}>{t('done.title')}</h1>
      <p className="done-ref">{t('done.ref', { ref: request.ref })}</p>
      <p>{t('done.lead', { name: request.name.split(' ')[0] ?? request.name })}</p>
      <p className="actions">
        <button type="button" className="btn btn-primary" onClick={() => { download(pdfFileName(request), buildPdf(request, e), 'application/pdf'); }}>{t('done.pdf')}</button>
        <Link to="/" className="btn btn-ghost">{t('done.back')}</Link>
      </p>
    </div>
  );
}
