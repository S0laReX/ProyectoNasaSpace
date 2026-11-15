'use client';
import { domMax, LazyMotion, MotionConfig } from 'motion/react';
import { IdiomaProvider } from './Idioma';

// Movimiento de toda la app: respeta "reducir movimiento" del sistema (sin desplazamientos ni escalas,
// solo opacidad) y usa la misma curva que los tokens CSS (--ease-out) para que todo se sienta de una pieza.
// LazyMotion + componentes `m` cargan solo las funciones usadas (domMax incluye `layout` para los avisos);
// `strict` avisa si alguien importa `motion.*`, que traería la librería completa.
export const CURVA = [0.16, 1, 0.3, 1];

export default function Proveedores({ idioma, children }) {
  return (
    <IdiomaProvider inicial={idioma}>
      <LazyMotion features={domMax} strict>
        <MotionConfig reducedMotion="user" transition={{ duration: 0.42, ease: CURVA }}>
          {children}
        </MotionConfig>
      </LazyMotion>
    </IdiomaProvider>
  );
}
