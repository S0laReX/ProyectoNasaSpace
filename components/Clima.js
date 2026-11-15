'use client';
import { useEffect, useState } from 'react';
import { useIdioma } from './Idioma';

// Condiciones medidas por MEDA (Perseverance) en Jezero. El feed público dejó de actualizarse:
// se muestra la fecha del dato y, si es viejo, un aviso claro de que no es el clima de hoy.
const DIAS_VIEJO = 30;
const fechaLarga = (iso, idioma) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(idioma, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function Clima() {
  const { t, idioma } = useIdioma();
  const [c, setC] = useState(null);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    fetch('/api/clima')
      .then((r) => r.json())
      .then(setC)
      .catch(() => setC({ error: true }));
  }, []);

  if (!c) return <section className="clima"><h4>{t('clima.titulo')}</h4><p className="nota">{t('clima.cargando')}</p></section>;
  if (c.error || !c.ultimo) return <section className="clima"><h4>{t('clima.titulo')}</h4><p className="aviso">{t('clima.error')}</p></section>;

  const u = c.ultimo;
  const serie = c.serie;
  const tMin = Math.min(...serie.map((s) => s.min));
  const tMax = Math.max(...serie.map((s) => s.max));
  const escala = (t) => ((t - tMin) / Math.max(tMax - tMin, 1)) * 100;
  const dias = u.fecha ? Math.floor((Date.now() - Date.parse(`${u.fecha}T00:00:00Z`)) / 86400000) : null;
  const viejo = dias != null && dias > DIAS_VIEJO;

  return (
    <section className="clima">
      <header className="ruta-cab">
        <h4>{viejo ? t('clima.tituloViejo') : t('clima.titulo')}</h4>
        <span className="nota">{t('clima.fuente', { sol: u.sol })}</span>
      </header>
      {viejo && (
        <p className="aviso">{t('clima.historico', { fecha: fechaLarga(u.fecha, idioma) })}</p>
      )}
      <dl className="filas">
        <div><dt>{t('clima.minMax')}</dt><dd>{t('clima.minMaxValor', { min: u.min, max: u.max })}</dd></div>
        <div><dt>{t('clima.presion')}</dt><dd>{u.presion != null ? `${u.presion} Pa` : t('clima.sinDato')}</dd></div>
        <div><dt>{t('clima.luz')}</dt><dd>{t('clima.luzValor', { a: u.amanecer?.slice(0, 5) ?? '?', b: u.atardecer?.slice(0, 5) ?? '?' })} <small>{t('clima.horaLocal')}</small></dd></div>
        <div><dt>{t('clima.estacion')}</dt><dd>{u.temporada ? t('clima.temporada', { raw: u.temporada }) : t('clima.sinDato')} <small>Ls {Number.isFinite(u.ls) ? u.ls.toFixed(0) : '?'}°{u.fecha ? `, ${fechaLarga(u.fecha, idioma)}` : ''}</small></dd></div>
      </dl>
      <div className="rango-temp" onMouseLeave={() => setHover(null)} role="img" aria-label={t('clima.rangoAria')}>
        {serie.map((s) => (
          <div key={s.sol} className="rango-col" onMouseEnter={() => setHover(s)}>
            <div className="rango-barra" style={{ bottom: `${escala(s.min)}%`, height: `${Math.max(escala(s.max) - escala(s.min), 2)}%` }} />
          </div>
        ))}
        {hover && <div className="tooltip tooltip-fijo">{t('clima.rangoTip', hover)}</div>}
      </div>
      <p className="nota">{t('clima.rangoNota', { n: serie.length })}</p>
    </section>
  );
}
