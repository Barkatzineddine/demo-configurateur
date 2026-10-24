// The summary sent with a quote request, on A4: the configuration with its front view, the priced
// estimate, the workshop's notices, then the cutting list. Always in French, like the workshop's papers.
import { COMPANY, MATERIALS, SHEET } from '../domain/catalog';
import type { Estimate } from '../domain/pricing';
import type { Part } from '../domain/rules';
import type { QuoteRequest } from '../domain/schema';
import { fr } from '../i18n/fr';
import { interpolate } from '../shared/i18n';
import { shade } from '../ui/colors';
import { A4, PdfDoc, wrap } from './writer';

const INK = '#22201c';
const MUTED = '#6b6458';
const ACCENT = '#2f5d46';
const RULE = '#ddd5c8';
const M = 48;
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const money = (cents: number) => euro.format(cents / 100);
const n1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const cm = (mm: number) => `${n1.format(mm / 10)} cm`;
const tr = (key: keyof typeof fr, vars?: Record<string, string | number>) => interpolate(fr[key], vars);
const longDate = (stamp: string) => {
  const [y, m, d] = stamp.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1));
};

export const pdfFileName = (r: QuoteRequest) => `recapitulatif-${r.ref.toLowerCase()}.pdf`;

export function buildPdf(r: QuoteRequest, e: Estimate, now = new Date()): Uint8Array {
  const c = e.config;
  const mat = MATERIALS[c.material];
  const pdf = new PdfDoc({ title: `Récapitulatif ${r.ref} · ${COMPANY.name}`, author: COMPANY.name });

  // header
  pdf.text(COMPANY.name, M, 58, { size: 20, bold: true, color: ACCENT });
  pdf.text('Menuiserie sur mesure', M, 76, { size: 9.5, color: MUTED });
  pdf.text(`${COMPANY.address}, ${COMPANY.zip} ${COMPANY.city} · ${COMPANY.phone} · ${COMPANY.email}`, M, 90, { size: 8.5, color: MUTED });
  pdf.text('RÉCAPITULATIF', A4.w - M, 58, { size: 16, bold: true, color: INK, align: 'right' });
  pdf.text(`Demande ${r.ref}`, A4.w - M, 76, { size: 9.5, color: INK, align: 'right' });
  pdf.text(`Le ${longDate(r.at)}`, A4.w - M, 90, { size: 9.5, color: MUTED, align: 'right' });
  pdf.line(M, 104, A4.w - M, 104, { color: RULE });

  // client
  pdf.text('CLIENT', M, 126, { size: 8, bold: true, color: MUTED });
  pdf.text(r.name, M, 141, { size: 11, bold: true, color: INK });
  pdf.text(`${r.email} · ${r.phone} · pose au ${r.zip}`, M, 155, { size: 9, color: MUTED });

  // front view, scaled into a box
  const box = { x: M, y: 178, w: 210, h: 250 };
  const scale = Math.min(box.w / c.width, box.h / c.height);
  const ox = box.x + (box.w - c.width * scale) / 2;
  const oy = box.y + box.h - (box.h - c.height * scale) / 2;
  const fill = (p: Part) => (p.role === 'handle' ? '#b8913a' : p.role === 'led' ? '#f3d98b' : p.role === 'plinth' ? shade(mat.color, -0.18) : mat.color);
  pdf.rect(ox + e.layout.t * scale, oy - c.height * scale, (c.width - 2 * e.layout.t) * scale, (c.height - e.layout.plinth) * scale, { fill: c.back ? shade(mat.color, -0.28) : '#ece7de' });
  for (const p of e.layout.parts) {
    if (['back', 'drawer-side', 'drawer-back', 'drawer-bottom'].includes(p.role) || (p.role === 'plinth' && p.z < 1 && p.d < p.w)) continue;
    const closed = p.role === 'door' || p.role === 'front';
    pdf.rect(ox + p.x * scale, oy - (p.y + p.h) * scale, p.w * scale, p.h * scale, { fill: fill(p), stroke: closed ? shade(mat.color, -0.35) : null, width: 0.5 });
  }
  pdf.text(cm(c.width), ox + (c.width * scale) / 2, oy + 16, { size: 8.5, color: MUTED, align: 'center' });

  // specification
  let y = 190;
  const spec = (label: string, value: string) => {
    pdf.text(label, 290, y, { size: 8.5, color: MUTED });
    for (const [i, l] of wrap(value, 9.5, A4.w - M - 390).entries()) pdf.text(l, 390, y + i * 12, { size: 9.5, color: INK });
    y += Math.max(1, wrap(value, 9.5, A4.w - M - 390).length) * 12 + 6;
  };
  pdf.text('CONFIGURATION', 290, 178, { size: 8, bold: true, color: MUTED });
  spec('Dimensions', `${cm(c.width)} × ${cm(c.height)} × ${cm(c.depth)} (L × H × P)`);
  spec('Agencement', `${e.layout.bays} colonnes de ${cm(e.layout.bayW)}, ${e.layout.rows} cases de ${cm(e.layout.rowH)}`);
  spec('Matière', `${tr(`material.${c.material}` as keyof typeof fr)} · ${tr(`kind.${mat.kind}` as keyof typeof fr)} · ${mat.thickness} mm`);
  spec('Bas du meuble', `${tr(`lower.${c.lower}` as keyof typeof fr)}${c.lower !== 'open' ? `, poignées : ${tr(`handle.${c.handle}` as keyof typeof fr).toLowerCase()}` : ''}`);
  const options = [c.plinth && tr('opt.plinth'), c.back && tr('opt.back'), c.led && tr('opt.led'), c.install && tr('opt.install')].filter((x): x is string => !!x);
  spec('Options', options.join(', ') || 'aucune');
  spec('Fabrication', `${e.weeks} semaines · environ ${e.kg} kg`);
  if (r.message) spec('Précisions', r.message);

  // price
  y = Math.max(y, box.y + box.h) + 24;
  pdf.text('ESTIMATION', M, y, { size: 8, bold: true, color: MUTED });
  y += 14;
  for (const l of e.price.lines) {
    const label = tr(`line.${l.code}` as keyof typeof fr, { material: tr(`material.${c.material}` as keyof typeof fr), t: mat.thickness });
    pdf.text(l.qty !== 1 ? `${label} × ${n1.format(l.qty)}` : label, M, y, { size: 9, color: INK });
    pdf.text(money(l.total), A4.w - M, y, { size: 9, color: INK, align: 'right' });
    y += 13;
  }
  pdf.line(M, y - 4, A4.w - M, y - 4, { color: RULE });
  for (const [label, value, strong] of [['Total HT', e.price.ht, false], ['TVA 20 %', e.price.vat, false], ['Total TTC', e.price.ttc, true]] as const) {
    y += 13;
    pdf.text(label, A4.w - M - 160, y, { size: strong ? 11 : 9, bold: strong, color: strong ? ACCENT : MUTED });
    pdf.text(money(value), A4.w - M, y, { size: strong ? 11 : 9, bold: true, color: INK, align: 'right' });
  }
  y += 24;
  for (const n of e.notices) {
    const text = tr(`notice.${n.code}` as keyof typeof fr, Object.fromEntries(Object.entries(n.params ?? {}).map(([k, v]) => [k, n1.format(v)])));
    for (const l of wrap(`• ${text}`, 8.5, A4.w - 2 * M)) { pdf.text(l, M, y, { size: 8.5, color: n.level === 'warn' ? '#9a3412' : MUTED }); y += 11; }
  }

  footer(pdf);

  // page 2: the cutting list, as the workshop will use it
  pdf.addPage();
  pdf.text('Fiche de débit', M, 58, { size: 16, bold: true, color: INK });
  pdf.text(`${r.ref} · panneaux de ${SHEET.length} × ${SHEET.width} mm · ${mat.grain ? 'fil du bois dans la longueur' : 'sans fil à respecter'}`, M, 76, { size: 9, color: MUTED });
  y = 104;
  const cols = [M, M + 190, M + 240, M + 320, M + 390, M + 440];
  ['Pièce', 'Qté', 'Longueur', 'Largeur', 'Ép.', 'Panneau'].forEach((h, i) => { pdf.text(h, cols[i] ?? M, y, { size: 8, bold: true, color: MUTED }); });
  y += 8;
  pdf.line(M, y, A4.w - M, y, { color: RULE });
  y += 14;
  for (const p of e.pieces) {
    const stock = p.group === 'carcass' ? `${tr(`material.${c.material}` as keyof typeof fr)} ${p.thickness}` : p.group === 'back' ? 'Fond 8' : 'Bouleau 15';
    [tr(`role.${p.role}` as keyof typeof fr), String(p.qty), `${p.length} mm`, `${p.width} mm`, `${p.thickness}`, stock].forEach((v, i) => { pdf.text(v, cols[i] ?? M, y, { size: 9, color: INK }); });
    y += 14;
  }
  y += 10;
  for (const plan of e.plans) {
    pdf.text(`${plan.group === 'carcass' ? 'Caisson, portes et façades' : plan.group === 'back' ? 'Fonds' : 'Caissons de tiroir'} : ${plan.sheets.length} panneau${plan.sheets.length > 1 ? 'x' : ''}, chute ${Math.round(plan.waste * 100)} %`, M, y, { size: 9, color: MUTED });
    y += 13;
  }
  footer(pdf);
  return pdf.output(now);
}

function footer(pdf: PdfDoc) {
  pdf.line(M, A4.h - 62, A4.w - M, A4.h - 62, { color: RULE });
  pdf.text(`${COMPANY.name} · ${COMPANY.legal} · SIRET ${COMPANY.siret} · TVA ${COMPANY.vat}`, M, A4.h - 48, { size: 7.5, color: MUTED });
  pdf.text('Estimation non contractuelle : le devis définitif suit une prise de mesures. Démonstration : entreprise, prix et coordonnées fictifs.', M, A4.h - 37, { size: 7.5, color: MUTED });
}
