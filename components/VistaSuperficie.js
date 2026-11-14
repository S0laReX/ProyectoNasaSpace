'use client';
import { useEffect, useState } from 'react';

// "Punto de vista": fotos raw de Perseverance tomadas el sol en que pasó por el waypoint elegido.
export default function VistaSuperficie({ waypoint, onCerrar }) {
  const [datos, setDatos] = useState(null);
  const [activa, setActiva] = useState(0);

  useEffect(() => {
    if (!waypoint) return;
    setDatos(null);
    setActiva(0);
    fetch(`/api/imagenes?sol=${waypoint.sol}`).then((r) => r.json()).then(setDatos).catch(() => setDatos({ imagenes: [] }));
  }, [waypoint]);

  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  if (!waypoint) return null;
  const img = datos?.imagenes?.[activa];

  return (
    <div className="vista" role="dialog" aria-modal="true" aria-label={`Vista de superficie, sol ${waypoint.sol}`}>
      <div className="vista-panel">
        <header className="vista-cab">
          <div>
            <span className="etiqueta-dato">PUNTO DE VISTA · SOL {waypoint.sol}</span>
            <h3>{waypoint.lat.toFixed(5)}°N {waypoint.lon.toFixed(5)}°E</h3>
            <p className="texto-2">Elevación {waypoint.elev ?? '—'} m · inclinación del rover {waypoint.tilt ?? '—'}°</p>
          </div>
          <button type="button" className="boton" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>
        {!datos && <div className="vista-img cargando"><span className="radar" />Buscando imágenes del sol {waypoint.sol}…</div>}
        {datos && !img && <div className="vista-img cargando">No hay imágenes públicas de ese sol.</div>}
        {img && (
          <>
            <a className="vista-img" href={img.grande} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={img.url} src={img.url} alt={img.titulo} />
              <span className="vista-pie">{img.camara} · {img.fecha?.slice(0, 16).replace('T', ' ')} UTC</span>
            </a>
            <div className="miniaturas">
              {datos.imagenes.map((m, i) => (
                <button key={m.url} type="button" className={i === activa ? 'activo' : ''} onClick={() => setActiva(i)} aria-label={m.titulo}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </>
        )}
        <p className="texto-2 pequeno">Imágenes raw: NASA/JPL-Caltech.</p>
      </div>
    </div>
  );
}
