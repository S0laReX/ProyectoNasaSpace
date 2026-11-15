'use client';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { COOKIE, DICCIONARIOS, IDIOMAS, crearT } from '../lib/i18n';

// Idioma de la interfaz. La página llega del servidor ya en su idioma (/es o /en); cambiarlo aquí
// traduce al instante sin navegar: no se pierde la ruta trazada ni se reinicia el globo.
const Contexto = createContext(null);

export function IdiomaProvider({ inicial, children }) {
  const [idioma, setIdioma] = useState(inicial);
  const t = useMemo(() => crearT(idioma), [idioma]);

  const cambiar = useCallback((nuevo) => {
    if (!IDIOMAS.includes(nuevo)) return;
    setIdioma(nuevo);
    document.documentElement.lang = nuevo;
    document.title = DICCIONARIOS[nuevo].meta.titulo;
    // La cookie la lee el servidor al entrar por "/"; la URL queda compartible en el idioma elegido.
    document.cookie = `${COOKIE}=${nuevo}; path=/; max-age=31536000; samesite=lax`;
    window.history.replaceState(null, '', `/${nuevo}${window.location.search}${window.location.hash}`);
  }, []);

  const valor = useMemo(() => ({ idioma, t, cambiar }), [idioma, t, cambiar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useIdioma() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useIdioma necesita <IdiomaProvider>');
  return valor;
}

/** Selector ES | EN para la navegación. Cada opción está en su propio idioma y lo declara con `lang`. */
export function SelectorIdioma({ className = '' }) {
  const { idioma, cambiar, t } = useIdioma();
  return (
    <div className={`idiomas ${className}`} role="group" aria-label={t('idioma.grupo')}>
      {IDIOMAS.map((codigo) => (
        <button key={codigo} type="button" lang={codigo} className={codigo === idioma ? 'activo' : ''}
          aria-pressed={codigo === idioma} aria-label={DICCIONARIOS[codigo].idioma[codigo]}
          onClick={() => cambiar(codigo)}>
          {codigo.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
