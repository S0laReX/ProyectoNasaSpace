'use client';
import { useEffect, useRef } from 'react';

// Aparece con animación al entrar en pantalla (respeta prefers-reduced-motion vía CSS).
export default function Revelar({ children, como: Etiqueta = 'div', retraso = 0, className = '', ...resto }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('visible'); io.disconnect(); }
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Etiqueta ref={ref} className={`revelar ${className}`} style={{ '--retraso': `${retraso}ms` }} {...resto}>
      {children}
    </Etiqueta>
  );
}
