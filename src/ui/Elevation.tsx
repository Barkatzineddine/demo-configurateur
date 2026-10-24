// Front view drawn from the layout, in SVG: shown before the 3D view loads, instead of it where WebGL
// is missing, and as the thumbnail of saved designs. Millimetres are the drawing units.
import { MATERIALS } from '../domain/catalog';
import type { Layout, Part } from '../domain/rules';
import type { Config } from '../domain/schema';
import { useFormat } from '../format';
import { shade } from './colors';

const FRONT_ROLES: Part['role'][] = ['plinth', 'side', 'top', 'bottom', 'divider', 'shelf', 'door', 'front', 'handle', 'led'];

export function Elevation({ config, layout, dims = true, label, className = '' }: { config: Config; layout: Layout; dims?: boolean; label?: string; className?: string }) {
  const { cm } = useFormat();
  const m = MATERIALS[config.material];
  const W = config.width;
  const H = config.height;
  const pad = dims ? Math.max(W, H) * 0.09 : Math.max(W, H) * 0.02;
  const font = Math.max(W, H) * 0.034;
  const y = (p: Pick<Part, 'y' | 'h'>) => H - p.y - p.h;
  const wood = m.color;
  const inside = config.back ? shade(wood, -0.28) : '#e4dfd6';
  // the visible faces only: front parts, back panels drawn as the inside of each compartment
  const parts = layout.parts.filter((p) => FRONT_ROLES.includes(p.role) && !(p.role === 'plinth' && p.z < 1 && p.d < p.w));
  const fill = (p: Part) => {
    if (p.role === 'handle') return '#b8913a';
    if (p.role === 'led') return '#ffe9a8';
    if (p.role === 'plinth') return shade(wood, -0.18);
    if (p.role === 'door' || p.role === 'front') return shade(wood, 0.04);
    return wood;
  };
  return (
    // without a label it is a thumbnail next to its own description: decorative
    <svg className={`elevation ${className}`} viewBox={`${-pad} ${-pad * 0.6} ${W + 2 * pad} ${H + pad * 1.9}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      <rect x={layout.t} y={0} width={W - 2 * layout.t} height={H - layout.plinth} fill={inside} />
      {parts.map((p, i) => (
        <rect key={i} x={p.x} y={y(p)} width={p.w} height={p.h} fill={fill(p)}
          stroke={p.role === 'door' || p.role === 'front' ? shade(wood, -0.35) : 'none'} strokeWidth={W / 900} rx={p.role === 'handle' ? Math.min(p.w, p.h) / 2 : 0} />
      ))}
      {dims ? (
        <g className="elevation-dims" fontSize={font}>
          <line x1={0} x2={W} y1={H + pad * 0.55} y2={H + pad * 0.55} />
          <line x1={0} x2={0} y1={H + pad * 0.35} y2={H + pad * 0.75} />
          <line x1={W} x2={W} y1={H + pad * 0.35} y2={H + pad * 0.75} />
          <text x={W / 2} y={H + pad * 0.55 + font * 1.25} textAnchor="middle">{cm(W)} cm</text>
          <line x1={W + pad * 0.45} x2={W + pad * 0.45} y1={0} y2={H} />
          <line x1={W + pad * 0.25} x2={W + pad * 0.65} y1={0} y2={0} />
          <line x1={W + pad * 0.25} x2={W + pad * 0.65} y1={H} y2={H} />
          <text x={W + pad * 0.45 + font * 0.45} y={H / 2} textAnchor="middle" transform={`rotate(-90 ${W + pad * 0.45 + font * 0.45} ${H / 2})`}>{cm(H)} cm</text>
        </g>
      ) : null}
    </svg>
  );
}
