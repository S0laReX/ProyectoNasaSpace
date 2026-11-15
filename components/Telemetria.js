'use client';
import { useEffect, useState } from 'react';
import { JEZERO } from '../lib/marte';
import { obtenerRover } from '../lib/rover';

// Cifras vivas para el hero, con conteo animado.
export default function Telemetria() {
  const [d, setD] = useState(null);
  useEffect(() => { obtenerRover().then((j) => !j.error && setD(j)).catch(() => {}); }, []);
  const items = [
    { etq: 'Sitio', val: 'Cráter Jezero', fijo: true },
    { etq: 'Coordenadas', val: `${JEZERO.lat.toFixed(2)}°N ${JEZERO.lon.toFixed(2)}°E`, fijo: true },
    { etq: 'Sol actual del rover', val: d?.solActual },
    { etq: 'Km recorridos por Perseverance', val: d?.distanciaTotalKm, dec: 2 },
  ];
  return (
    <dl className="telemetria">
      {items.map((it) => (
        <div key={it.etq}>
          <dt>{it.etq}</dt>
          <dd>{it.fijo ? it.val : it.val == null ? '···' : <Contador valor={Number(it.val)} dec={it.dec ?? 0} />}</dd>
        </div>
      ))}
    </dl>
  );
}

function Contador({ valor, dec }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(valor); return; }
    let f;
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min((t - t0) / 1600, 1);
      setV(valor * (1 - (1 - p) ** 3));
      if (p < 1) f = requestAnimationFrame(paso);
    };
    f = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(f);
  }, [valor]);
  return <span className="num">{v.toFixed(dec)}</span>;
}
