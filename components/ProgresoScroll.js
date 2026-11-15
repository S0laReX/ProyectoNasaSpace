'use client';
import { m, useReducedMotion, useScroll, useSpring } from 'motion/react';

// Línea de progreso bajo la navegación: cuánto de la página llevas leído.
export default function ProgresoScroll() {
  const { scrollYProgress } = useScroll();
  const suave = useSpring(scrollYProgress, { stiffness: 220, damping: 40, restDelta: 0.001 });
  const reducido = useReducedMotion();
  return <m.div className="progreso" style={{ scaleX: reducido ? scrollYProgress : suave }} aria-hidden="true" />;
}
