'use client';
import { useState } from 'react';
import { useIdioma } from './Idioma';

// Perfil de elevación de la ruta. Con modelo de terreno usa la elevación del DTM CTX y
// colorea cada tramo según su pendiente; sin él, la elevación de los waypoints del rover.
const AN = 360;
const AL = 128;
const M = { i: 40, d: 8, s: 10, b: 22 };

export default function Perfil({ perfil, conTerreno = false }) {
  const { t } = useIdioma();
  const [hover, setHover] = useState(null);
  const pts = perfil.filter((p) => p.elev != null);
  if (pts.length < 2) return null;

  const kmMax = perfil.at(-1).km || 1;
  const eMin = Math.min(...pts.map((p) => p.elev));
  const eMax = Math.max(...pts.map((p) => p.elev));
  const rango = Math.max(eMax - eMin, 5);
  const x = (km) => M.i + (km / kmMax) * (AN - M.i - M.d);
  const y = (e) => AL - M.b - ((e - eMin) / rango) * (AL - M.s - M.b);
  const linea = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.km).toFixed(1)},${y(p.elev).toFixed(1)}`).join(' ');
  const area = `${linea} L${x(pts.at(-1).km)},${AL - M.b} L${x(pts[0].km)},${AL - M.b} Z`;

  // Tramos consecutivos de la misma clase, para colorear la línea
  const tramos = [];
  if (conTerreno) {
    for (let i = 1; i < pts.length; i++) {
      const k = pts[i].clase ?? 'sd';
      const ult = tramos.at(-1);
      if (ult && ult.k === k) ult.d += ` L${x(pts[i].km).toFixed(1)},${y(pts[i].elev).toFixed(1)}`;
      else tramos.push({ k, d: `M${x(pts[i - 1].km).toFixed(1)},${y(pts[i - 1].elev).toFixed(1)} L${x(pts[i].km).toFixed(1)},${y(pts[i].elev).toFixed(1)}` });
    }
  }

  return (
    <figure className="perfil">
      <figcaption>{t('perfil.titulo')} <span className="nota">{t('perfil.unidades', { modelo: conTerreno })}</span></figcaption>
      <div className="perfil-lienzo">
        <svg viewBox={`0 0 ${AN} ${AL}`} role="img" aria-label={t('perfil.aria', { min: eMin.toFixed(0), max: eMax.toFixed(0), km: kmMax.toFixed(2) })}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const km = ((((e.clientX - r.left) / r.width) * AN - M.i) / (AN - M.i - M.d)) * kmMax;
            setHover(pts.reduce((a, b) => (Math.abs(b.km - km) < Math.abs(a.km - km) ? b : a)));
          }}>
          {[eMin, eMin + rango / 2, eMin + rango].map((v) => (
            <g key={v}>
              <line x1={M.i} x2={AN - M.d} y1={y(v)} y2={y(v)} className="grid" />
              <text x={M.i - 6} y={y(v) + 3} textAnchor="end" className="eje">{Math.round(v)}</text>
            </g>
          ))}
          <text x={M.i} y={AL - 6} className="eje">0</text>
          <text x={AN - M.d} y={AL - 6} textAnchor="end" className="eje">{kmMax.toFixed(2)} km</text>
          <path d={area} className="perfil-area" />
          {conTerreno
            ? tramos.map((t, i) => <path key={i} d={t.d} className={`perfil-linea trazo-${t.k}`} />)
            : <path d={linea} className="perfil-linea" />}
          {hover && (
            <g>
              <line x1={x(hover.km)} x2={x(hover.km)} y1={M.s} y2={AL - M.b} className="cruz" />
              <circle cx={x(hover.km)} cy={y(hover.elev)} r="4" className="perfil-punto" />
            </g>
          )}
        </svg>
        {hover && (
          <div className="tooltip" style={{ left: `${(x(hover.km) / AN) * 100}%` }}>
            <b>{hover.km.toFixed(2)} km</b>, {hover.elev.toFixed(0)} m
            {hover.pendiente != null && <div>{t('perfil.pendiente')} {hover.pendiente.toFixed(1)}°</div>}
          </div>
        )}
      </div>
    </figure>
  );
}
