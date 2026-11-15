'use client';
import { m } from 'motion/react';
import { CURVA } from './Proveedores';

// Aparece al entrar en pantalla, una sola vez. Con "reducir movimiento" solo se desvanece.
const ETIQUETAS = { div: m.div, li: m.li, section: m.section, tr: m.tr };

export default function Revelar({ children, como = 'div', retraso = 0, className = '', ...resto }) {
  const Etiqueta = ETIQUETAS[como] ?? m.div;
  return (
    <Etiqueta
      className={`revelar ${className}`}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.7, delay: retraso / 1000, ease: CURVA }}
      {...resto}
    >
      {children}
    </Etiqueta>
  );
}
