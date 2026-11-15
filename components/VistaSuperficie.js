'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import Pacha from './Pacha';
import { useIdioma } from './Idioma';

// "Punto de vista": fotos raw de Perseverance tomadas el sol en que pasó por el waypoint elegido.
// AnimatePresence conserva el diálogo durante la salida, así se cierra con la misma suavidad con que se abre.
// Se monta en un portal: dentro de la escena (que aísla su apilamiento) la navegación quedaba por encima
// del fondo del diálogo. En pantalla completa va dentro del elemento a pantalla completa, o no se vería.
export default function VistaSuperficie({ waypoint, onCerrar }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;
  return createPortal(
    <AnimatePresence>
      {waypoint && <Dialogo key="vista" waypoint={waypoint} onCerrar={onCerrar} />}
    </AnimatePresence>,
    document.fullscreenElement ?? document.body,
  );
}

function Dialogo({ waypoint, onCerrar }) {
  const { t } = useIdioma();
  const [datos, setDatos] = useState(null);
  const [activa, setActiva] = useState(0);

  useEffect(() => {
    setDatos(null);
    setActiva(0);
    let vigente = true;
    fetch(`/api/imagenes?sol=${waypoint.sol}`)
      .then((r) => r.json())
      .then((j) => vigente && setDatos(j))
      .catch(() => vigente && setDatos({ imagenes: [] }));
    return () => { vigente = false; };
  }, [waypoint]);

  // Esc cierra solo mientras el diálogo existe
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  const img = datos?.imagenes?.[activa];

  return (
    <m.div className="vista" role="dialog" aria-modal="true" aria-label={t('vista.aria', { sol: waypoint.sol })}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <m.div className="vista-panel"
        initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}>
        <header className="vista-cab">
          <div>
            <p className="nota">{t('vista.punto', { sol: waypoint.sol, nota: waypoint.nota })}</p>
            <h3>{waypoint.lat.toFixed(5)}° N, {waypoint.lon.toFixed(5)}° E</h3>
            <p className="nota">{t('vista.datos', { elev: waypoint.elev ?? t('vista.sinDato'), tilt: waypoint.tilt != null ? `${Number(waypoint.tilt).toFixed(1)}°` : t('vista.sinDato') })}</p>
          </div>
          {/* Foco inicial en Cerrar: quien usa teclado o lector de pantalla entra al diálogo */}
          <button type="button" className="boton secundario" onClick={onCerrar} autoFocus>{t('vista.cerrar')}</button>
        </header>

        {!datos && (
          <div className="vista-img cargando" role="status">
            <Pacha estado="conduciendo" tam={104} />
            <span>{t('vista.buscando', { sol: waypoint.sol })}</span>
          </div>
        )}
        {datos && !img && (
          <div className="vista-img cargando">
            <Pacha estado="buscando" tam={104} />
            <span>{t('vista.sinImagenes')}</span>
          </div>
        )}
        {img && (
          <>
            <a className="vista-img" href={img.grande} target="_blank" rel="noreferrer">
              <AnimatePresence mode="wait" initial={false}>
                <m.img key={img.url} src={img.url} alt={img.titulo}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
              </AnimatePresence>
              <span className="vista-pie">{img.camara}, {img.fecha?.slice(0, 16).replace('T', ' ')} UTC</span>
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
        <p className="nota">{t('vista.creditos')}</p>
      </m.div>
    </m.div>
  );
}
