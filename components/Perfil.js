'use client';
import { useState } from 'react';

// Perfil de elevación de la ruta, estimado con la elevación de los waypoints del rover más cercanos.
const AN = 360;
const AL = 120;
const M = { i: 38, d: 8, s: 10, b: 22 };

export default function Perfil({ perfil }) {
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

  return (
    <figure className="perfil">
      <figcaption>Perfil de elevación <span className="texto-2">(m, referencia del rover)</span></figcaption>
      <div className="perfil-lienzo">
        <svg viewBox={`0 0 ${AN} ${AL}`} role="img" aria-label={`Elevación entre ${eMin.toFixed(0)} y ${eMax.toFixed(0)} m`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const km = (((e.clientX - r.left) / r.width) * AN - M.i) / (AN - M.i - M.d) * kmMax;
            setHover(pts.reduce((a, b) => (Math.abs(b.km - km) < Math.abs(a.km - km) ? b : a)));
          }}>
          <defs>
            <linearGradient id="grad-perfil" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--marte)" stopOpacity="0.45" />
              <stop offset="1" stopColor="var(--marte)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[eMin, eMin + rango / 2, eMin + rango].map((v) => (
            <g key={v}>
              <line x1={M.i} x2={AN - M.d} y1={y(v)} y2={y(v)} className="grid" />
              <text x={M.i - 4} y={y(v) + 3} textAnchor="end" className="eje">{Math.round(v)}</text>
            </g>
          ))}
          <text x={M.i} y={AL - 6} className="eje">0</text>
          <text x={AN - M.d} y={AL - 6} textAnchor="end" className="eje">{kmMax.toFixed(2)} km</text>
          <path d={area} fill="url(#grad-perfil)" />
          <path d={linea} fill="none" stroke="var(--marte)" strokeWidth="2" />
          {hover && (
            <g>
              <line x1={x(hover.km)} x2={x(hover.km)} y1={M.s} y2={AL - M.b} className="cruz" />
              <circle cx={x(hover.km)} cy={y(hover.elev)} r="4" fill="var(--marte)" stroke="var(--fondo)" strokeWidth="2" />
            </g>
          )}
        </svg>
        {hover && (
          <div className="tooltip" style={{ left: `${(x(hover.km) / AN) * 100}%` }}>
            <b>{hover.km.toFixed(2)} km</b> · {hover.elev.toFixed(0)} m
            {hover.pendiente != null && <div>Inclinación {hover.pendiente.toFixed(1)}°</div>}
          </div>
        )}
      </div>
    </figure>
  );
}
