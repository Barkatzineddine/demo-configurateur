import { lazy, Suspense, useEffect } from 'react';
import { useFormat } from './format';
// not lazy: the configurator is the pre-rendered first screen, which the first render replaces with itself
import Configurator from './pages/Configurator';
import { app, useData } from './state/app';
import { Link, match, useLocation, useScrollOnNavigate } from './shared/router';
import { usePrerenderHandoff } from './shared/prerender';
import { onInstallPrompt } from './shared/sw';
import { FeedbackProvider, useFeedback } from './shared/ui/Feedback';

const Workshop = lazy(() => import('./pages/Workshop'));
const Designs = lazy(() => import('./pages/Designs'));
const RequestPage = lazy(() => import('./pages/Request').then((m) => ({ default: m.RequestPage })));
const ConfirmationPage = lazy(() => import('./pages/Request').then((m) => ({ default: m.ConfirmationPage })));

export function App() {
  const { t } = useFormat();
  usePrerenderHandoff();
  return (
    <FeedbackProvider closeLabel={t('common.close')}>
      <Shell />
    </FeedbackProvider>
  );
}

function Shell() {
  const location = useLocation();
  useScrollOnNavigate(location);
  const { t } = useFormat();
  const { path } = location;
  const done = match('/devis/:ref', path);
  return (
    <>
      <a className="skip" href="#contenu">{t('nav.skip')}</a>
      <DemoBar />
      <Header />
      <main id="contenu" tabIndex={-1} className="wrap">
        <Suspense fallback={<div className="route-loading" aria-hidden="true" />}>
          {path === '/atelier' ? <Workshop /> : path === '/projets' ? <Designs /> : path === '/devis' ? <RequestPage />
            : done?.ref ? <ConfirmationPage refCode={done.ref} /> : <Configurator />}
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

function DemoBar() {
  const { t, lang, setLang } = useFormat();
  const { confirm, toast } = useFeedback();
  // offered in a toast: a button appearing in the bar would push the page down (layout shift)
  useEffect(() => onInstallPrompt((show) => { if (show) toast(t('demo.installable'), 'info', { label: t('demo.install'), run: () => void show() }); }), [t, toast]);
  const reset = async () => {
    if (!(await confirm({ title: t('demo.resetTitle'), body: t('demo.resetBody'), ok: t('demo.reset'), cancel: t('common.cancel'), danger: true }))) return;
    try {
      Object.keys(localStorage).filter((k) => (k.startsWith('lisiere:') && k !== 'lisiere:lang') || k.startsWith('antispam:')).forEach((k) => { localStorage.removeItem(k); });
      sessionStorage.clear();
    } catch { /* storage blocked */ }
    app.reset();
    window.location.hash = '';
    window.location.reload();
  };
  return (
    <div className="demo-bar">
      <p><strong>{t('demo.label')}</strong> · {t('demo.text')} <a href="https://barkatzineddine.github.io/#contact">{t('demo.cta')}</a></p>
      <div className="demo-actions">
        <button type="button" className="demo-btn" title={t('lang.label')} lang={lang === 'fr' ? 'en' : 'fr'} onClick={() => { setLang(lang === 'fr' ? 'en' : 'fr'); }}>{t('lang.switch')}</button>
        <button type="button" className="demo-btn" onClick={() => void reset()}>{t('demo.reset')}</button>
      </div>
    </div>
  );
}

function Header() {
  const { t } = useFormat();
  const { path } = useLocation();
  const saved = useData((s) => s.designs.length);
  const nav: [string, string][] = [['/', t('nav.configure')], ['/atelier', t('nav.workshop')], ['/projets', t('nav.designs')]];
  const current = (to: string) => (to === '/' ? path === '/' : path.startsWith(to));
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link to="/" className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 27V5h4v18h18v4z" fill="currentColor" /><path d="M13 19V9l6-4 6 4v10z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
          <span><span className="brand-name">Atelier Lisière</span><span className="brand-sub">{t('brand.sub')}</span></span>
        </Link>
        <nav className="nav" aria-label={t('nav.label')}>
          {nav.map(([to, label]) => (
            <Link key={to} to={to} aria-current={current(to) ? 'page' : undefined}>
              {label}{to === '/projets' && saved ? <span className="badge">{saved}</span> : null}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useFormat();
  const by = t('footer.by', { name: 'Zineddine Barkat' }).split('Zineddine Barkat');
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <p className="brand-name">Atelier Lisière</p>
          <p>{t('footer.address')}<br /><a href="tel:+33465713012">04 65 71 30 12</a> · <a href="mailto:contact@atelier-lisiere.example">contact@atelier-lisiere.example</a></p>
        </div>
        <div id="securite">
          <h2 className="footer-title">{t('footer.security')}</h2>
          <ul className="sec-list"><li>{t('footer.sec.1')}</li><li>{t('footer.sec.2')}</li><li>{t('footer.sec.3')}</li><li>{t('footer.sec.4')}</li></ul>
        </div>
        <div>
          <h2 className="footer-title">{t('footer.demo')}</h2>
          <p>{t('footer.fiction')}</p>
          <p>{t('footer.engineering')}</p>
          <p>{by[0]}<a href="https://barkatzineddine.github.io/#contact">Zineddine Barkat</a>{by[1]} <a href="https://github.com/Barkatzineddine/demo-configurateur">{t('footer.code')}</a></p>
        </div>
      </div>
    </footer>
  );
}
