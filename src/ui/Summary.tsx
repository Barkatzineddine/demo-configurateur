// Price, lead time and the workshop's notices for the current configuration.
import type { Estimate } from '../domain/pricing';
import { useFormat } from '../format';

export function Summary({ e }: { e: Estimate }) {
  const { t, money, money0, num, line, notice } = useFormat();
  const sheets = e.plans.reduce((s, p) => s + p.sheets.length, 0);
  return (
    <section className="summary card" aria-labelledby="price-t">
      <h2 id="price-t" className="card-title">{t('price.title')}</h2>
      <p className="total"><output aria-live="polite" aria-atomic="true"><strong>{money0(e.price.ttc)}</strong> <span className="muted">{t('price.ttc')}</span></output></p>
      <ul className="facts">
        <li>{t('price.weeks', { n: e.weeks })}</li>
        <li>{t('price.weight', { kg: e.kg })}</li>
        <li>{t('price.sheets', { n: sheets })}</li>
      </ul>
      <details className="breakdown">
        <summary>{t('price.details')}</summary>
        <table className="lines">
          <tbody>
            {e.price.lines.map((l) => (
              <tr key={l.code}>
                <th scope="row">{line(l, e.config.material)}{l.qty !== 1 ? <span className="muted"> × {num(l.qty, 1)}</span> : null}</th>
                <td className="num">{money(l.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row">{t('price.ht')}</th><td className="num">{money(e.price.ht)}</td></tr>
            <tr><th scope="row">{t('price.vat')}</th><td className="num">{money(e.price.vat)}</td></tr>
            <tr className="grand"><th scope="row">{t('price.ttc')}</th><td className="num">{money(e.price.ttc)}</td></tr>
          </tfoot>
        </table>
        <p className="hint">{t('price.estimate')}</p>
      </details>
      <div className="notices">
        <h3 className="notices-title">{t('notice.title')}</h3>
        {e.notices.length ? (
          <ul>
            {e.notices.map((n) => <li key={n.code} className={`notice notice-${n.level}`}><span className="notice-ic" aria-hidden="true">{n.level === 'warn' ? '!' : 'i'}</span>{notice(n)}</li>)}
          </ul>
        ) : <p className="muted small">{t('notice.none')}</p>}
      </div>
    </section>
  );
}
