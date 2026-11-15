'use client';
import { useEffect, useState } from 'react';

// Condiciones medidas por MEDA (Perseverance) en Jezero.
export default function Clima() {
  const [c, setC] = useState(null);
  const [hover, setHover] = useState(null);
  useEffect(() => { fetch('/api/clima').then((r) => r.json()).then(setC).catch(() => setC({ error: true })); }, []);

  if (!c) return <section className="tarjeta"><h3>Condiciones en Jezero</h3><p className="texto-2">Cargando MEDA…</p></section>;
  if (c.error || !c.ultimo) return <section className="tarjeta"><h3>Condiciones en Jezero</h3><p className="aviso">Sin datos de MEDA ahora.</p></section>;

  const u = c.ultimo;
  const serie = c.serie;
  const tMin = Math.min(...serie.map((s) => s.min));
  const tMax = Math.max(...serie.map((s) => s.max));
  const escala = (t) => ((t - tMin) / Math.max(tMax - tMin, 1)) * 100;
  // El feed público de MEDA dejó de actualizarse: avisar si el último dato tiene más de 30 días
  const diasAntiguedad = Math.floor((Date.now() - new Date(`${u.terrestrial_date}T00:00:00Z`).getTime()) / 86400000);
  const desactualizado = Number.isFinite(diasAntiguedad) && diasAntiguedad > 30;

  return (
    <section className="tarjeta">
      <header className="tarjeta-cab"><h3>Condiciones en Jezero</h3><span className="etiqueta-dato">MEDA · SOL {u.sol}</span></header>
      {desactualizado && (
        <p className="aviso">
          Último dato público de MEDA: {u.terrestrial_date} (hace {diasAntiguedad} días). Úsalo como referencia
          de la estación, no como el clima de hoy.
        </p>
      )}
      <div className="metricas">
        <div className="metrica"><span className="metrica-etq">Mín / máx</span><span className="metrica-val">{u.min_temp}° / {u.max_temp}°C</span></div>
        <div className="metrica"><span className="metrica-etq">Presión</span><span className="metrica-val">{u.pressure ?? '—'} Pa</span></div>
        <div className="metrica"><span className="metrica-etq">Sol (luz)</span><span className="metrica-val">{u.sunrise?.slice(0, 5)}–{u.sunset?.slice(0, 5)}</span><span className="metrica-nota">hora solar local</span></div>
        <div className="metrica"><span className="metrica-etq">Estación</span><span className="metrica-val">{u.season}</span><span className="metrica-nota">Ls {Number(u.ls).toFixed(0)}° · {u.terrestrial_date}</span></div>
      </div>
      <div className="rango-temp" onMouseLeave={() => setHover(null)} aria-label="Temperatura mínima y máxima de los últimos soles">
        {serie.map((s) => (
          <div key={s.sol} className="rango-col" onMouseEnter={() => setHover(s)}>
            <div className="rango-barra" style={{ bottom: `${escala(s.min)}%`, height: `${Math.max(escala(s.max) - escala(s.min), 2)}%` }} />
          </div>
        ))}
        {hover && <div className="tooltip tooltip-fijo">Sol {hover.sol}: {hover.min}° a {hover.max}°C</div>}
      </div>
      <p className="texto-2 pequeno">Rango térmico diario de los últimos {serie.length} soles con datos.</p>
    </section>
  );
}
