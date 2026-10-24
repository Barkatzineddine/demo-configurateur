// The workshop sheet: the cutting list and, for each sheet stock, where every piece is cut.
import { MATERIALS, SHEET } from '../domain/catalog';
import type { GroupPlan, Piece } from '../domain/cutting';
import { useFormat } from '../format';
import type { Key } from '../i18n';
import { Link, usePage } from '../shared/router';
import { csv, download } from '../shared/security';
import { useEstimate } from '../ui/useEstimate';

const L = SHEET.length - 2 * SHEET.trim;
const W = SHEET.width - 2 * SHEET.trim;

export default function Workshop() {
  const { t, material, num } = useFormat();
  usePage(`${t('ws.title')} · Atelier Lisière`);
  const { e } = useEstimate();
  const c = e.config;
  const m = MATERIALS[c.material];
  const group = (g: Piece['group']) => t(`ws.group.${g}` as Key, { material: material(c.material), t: m.thickness });
  const role = (p: Pick<Piece, 'role'>) => t(`role.${p.role}` as Key);
  const sheets = e.plans.reduce((s, p) => s + p.sheets.length, 0);

  const exportCsv = () => {
    const rows = [[t('ws.col.piece'), t('ws.col.qty'), `${t('ws.col.length')} (mm)`, `${t('ws.col.width')} (mm)`, `${t('ws.col.thickness')} (mm)`, `${t('ws.col.edging')} (mm)`, '']];
    for (const p of e.pieces) rows.push([role(p), String(p.qty), String(p.length), String(p.width), String(p.thickness), String(p.edging), group(p.group)]);
    download(`fiche-de-debit-${c.width / 10}x${c.height / 10}.csv`, csv(rows), 'text/csv;charset=utf-8');
  };

  return (
    <div className="workshop">
      <header className="page-head">
        <p><Link to="/">← {t('ws.back')}</Link></p>
        <h1 tabIndex={-1}>{t('ws.title')}</h1>
        <p className="lead">{t('ws.lead')} {t('ws.summary', { pieces: e.pieces.reduce((s, p) => s + p.qty, 0), sheets, kg: e.kg })}</p>
      </header>

      <section className="card" aria-labelledby="list-t">
        <div className="card-head">
          <h2 id="list-t" className="card-title">{t('ws.list')}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}>{t('ws.csv')}</button>
        </div>
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="list-t">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('ws.col.piece')}</th><th scope="col" className="num">{t('ws.col.qty')}</th>
                <th scope="col" className="num">{t('ws.col.length')}</th><th scope="col" className="num">{t('ws.col.width')}</th>
                <th scope="col" className="num">{t('ws.col.thickness')}</th><th scope="col" className="num">{t('ws.col.edging')}</th>
              </tr>
            </thead>
            {(['carcass', 'back', 'drawer'] as const).filter((g) => e.pieces.some((p) => p.group === g)).map((g) => (
              <tbody key={g}>
                <tr className="group-row"><th scope="colgroup" colSpan={6}>{group(g)}</th></tr>
                {e.pieces.filter((p) => p.group === g).map((p, i) => (
                  <tr key={i}>
                    <td>{role(p)}</td><td className="num">{p.qty}</td><td className="num">{p.length}</td><td className="num">{p.width}</td>
                    <td className="num">{p.thickness}</td><td className="num">{p.edging ? num(p.edging) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="plan-t">
        <h2 id="plan-t" className="card-title">{t('ws.plan')}</h2>
        <p className="hint">{t('ws.planLead', { l: SHEET.length, w: SHEET.width, trim: SHEET.trim, kerf: SHEET.kerf })}</p>
        {e.plans.map((plan) => <PlanGroup key={plan.group} plan={plan} pieces={e.pieces.filter((p) => p.group === plan.group)} title={group(plan.group)} grain={plan.group === 'carcass' && m.grain} />)}
      </section>
    </div>
  );
}

function PlanGroup({ plan, pieces, title, grain }: { plan: GroupPlan; pieces: Piece[]; title: string; grain: boolean }) {
  const { t, num } = useFormat();
  // placements are numbered "<piece index in this group>.<copy>"
  const pieceOf = (id: string) => pieces[Number(id.split('.')[0])];
  return (
    <div className="plan-group">
      <h3>{title}</h3>
      <p className="hint">{grain ? t('ws.grain') : t('ws.noGrain')}</p>
      <div className="sheets">
        {plan.sheets.map((sheet, i) => {
          const used = sheet.placements.reduce((s, p) => s + p.w * p.h, 0);
          const caption = `${t('ws.sheet', { n: i + 1, total: plan.sheets.length })} · ${t('ws.waste', { pct: num(100 - (used / (L * W)) * 100) })}`;
          return (
            <figure key={i} className="sheet">
              <svg viewBox={`-20 -20 ${L + 40} ${W + 40}`} role="img" aria-label={caption}>
                <rect x={-20} y={-20} width={L + 40} height={W + 40} className="sheet-board" />
                {grain ? <g className="sheet-grain">{Array.from({ length: 14 }, (_, k) => <line key={k} x1={0} x2={L} y1={(k + 0.5) * (W / 14)} y2={(k + 0.5) * (W / 14)} />)}</g> : null}
                {sheet.placements.map((p) => {
                  const piece = pieceOf(p.id);
                  const big = p.w > 260 && p.h > 140;
                  const size = Math.min(70, p.h / 3.2, p.w / 7);
                  return (
                    <g key={p.id}>
                      <rect x={p.x} y={p.y} width={p.w} height={p.h} className="sheet-piece" />
                      {piece && big ? (
                        <text x={p.x + p.w / 2} y={p.y + p.h / 2} fontSize={size} textAnchor="middle" dominantBaseline="middle">
                          {t(`role.${piece.role}` as Key)} {piece.length}×{piece.width}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </svg>
              <figcaption>{caption}</figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
