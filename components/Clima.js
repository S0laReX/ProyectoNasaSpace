'use client';
import { useEffect, useState } from 'react';

// Condiciones medidas por MEDA (Perseverance) en Jezero.
export default function Clima() {
  const [c, setC] = useState(null);
  const [hover, setHover] = useState(null);
  useEffect(() => { fetch('/api/clima').then((r) => r.json()).then(setC).catch(() => setC({ error: true })); }, []);

  if (!c) return <section className="clima"><h4>Condiciones en Jezero</h4><p className="nota">Cargando MEDA…</p></section>;
  if (c.error || !c.ultimo) return <section className="clima"><h4>Condiciones en Jezero</h4><p className="aviso">MEDA no respondió. Vuelve a intentar en unos minutos.</p></section>;

  const u = c.ultimo;
  const serie = c.serie;
  const tMin = Math.min(...serie.map((s) => s.min));
  const tMax = Math.max(...serie.map((s) => s.max));
  const escala = (t) => ((t - tMin) / Math.max(tMax - tMin, 1)) * 100;

  return (
    <section className="clima">
      <header className="ruta-cab"><h4>Condiciones en Jezero</h4><span className="nota">MEDA, sol {u.sol}</span></header>
      <dl className="filas">
        <div><dt>Mínima y máxima</dt><dd>{u.min_temp}° y {u.max_temp} °C</dd></div>
        <div><dt>Presión</dt><dd>{u.pressure ?? 'sin dato'} Pa</dd></div>
        <div><dt>Luz solar</dt><dd>{u.sunrise?.slice(0, 5)} a {u.sunset?.slice(0, 5)} <small>hora solar local</small></dd></div>
        <div><dt>Estación</dt><dd>{u.season} <small>Ls {Number(u.ls).toFixed(0)}°, {u.terrestrial_date}</small></dd></div>
      </dl>
      <div className="rango-temp" onMouseLeave={() => setHover(null)} aria-label="Temperatura mínima y máxima de los últimos soles">
        {serie.map((s) => (
          <div key={s.sol} className="rango-col" onMouseEnter={() => setHover(s)}>
            <div className="rango-barra" style={{ bottom: `${escala(s.min)}%`, height: `${Math.max(escala(s.max) - escala(s.min), 2)}%` }} />
          </div>
        ))}
        {hover && <div className="tooltip tooltip-fijo">Sol {hover.sol}: {hover.min}° a {hover.max}°C</div>}
      </div>
      <p className="nota">Rango térmico diario de los últimos {serie.length} soles con datos.</p>
    </section>
  );
}
