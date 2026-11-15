'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import Pacha from './Pacha';
import { useIdioma } from './Idioma';

// Pacha como guía: el rover 3D y un globo de diálogo con consejos según el contexto.
//   · `clave` identifica el contexto: si cambia, vuelve al primer consejo y Pacha reacciona.
//   · Tocar a Pacha pasa al consejo siguiente (y salta).
//   · `minimizable`: se puede ocultar y queda un botón pequeño para traerlo; se recuerda por navegador.
// Pacha orienta y explica la interfaz; los veredictos de seguridad siguen en el panel de análisis.
const PREFERENCIA = 'marswalk.guia';
const leer = () => { try { return localStorage.getItem(PREFERENCIA) === 'oculta'; } catch { return false; } };
const guardar = (oculta) => { try { oculta ? localStorage.setItem(PREFERENCIA, 'oculta') : localStorage.removeItem(PREFERENCIA); } catch { /* sin almacenamiento */ } };

export default function GuiaPacha({
  mensajes, clave, estado = 'quieto', reaccion = 0, llegar = true, minimizable = false, tam = 132, className = '',
}) {
  const { t } = useIdioma();
  const [indice, setIndice] = useState(0);
  const [oculta, setOculta] = useState(false);
  const [claveVista, setClaveVista] = useState(clave);

  useEffect(() => { if (minimizable) setOculta(leer()); }, [minimizable]);

  // Contexto nuevo: primer consejo otra vez (se ajusta durante el render, sin efecto extra).
  if (clave !== claveVista) {
    setClaveVista(clave);
    setIndice(0);
  }
  const texto = mensajes[indice % mensajes.length];

  if (oculta) {
    return (
      <button type="button" className={`guia-mini ${className}`} onClick={() => { setOculta(false); guardar(false); }}>
        <span className="guia-mini-punto" aria-hidden="true" />{t('pacha.mostrar')}
      </button>
    );
  }

  return (
    <m.div className={`guia-pacha ${className}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
      <Pacha estado={estado} tam={tam} mirarCursor llegar={llegar} reaccion={`${clave}:${reaccion}`}
        etiqueta={t('pacha.etiqueta', { varios: mensajes.length > 1 })}
        onTocar={() => setIndice((i) => i + 1)} />
      <div className="guia-globo" role="status" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <m.p key={texto} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
            {texto}
          </m.p>
        </AnimatePresence>
        <div className="guia-pie">
          {mensajes.length > 1 && <span className="guia-cuenta">{t('pacha.cuenta', { i: (indice % mensajes.length) + 1, n: mensajes.length })}</span>}
          {minimizable && (
            <button type="button" className="guia-cerrar" onClick={() => { setOculta(true); guardar(true); }} aria-label={t('pacha.ocultarAria')}>
              {t('pacha.ocultar')}
            </button>
          )}
        </div>
      </div>
    </m.div>
  );
}
