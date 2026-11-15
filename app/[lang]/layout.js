import { Archivo, Atkinson_Hyperlegible_Next as Atkinson } from 'next/font/google';
import { notFound } from 'next/navigation';
import 'leaflet/dist/leaflet.css';
import '../globals.css';
import Proveedores from '../../components/Proveedores';
import { DICCIONARIOS, IDIOMAS } from '../../lib/i18n';

// Archivo con su eje de anchura: títulos y lecturas numéricas (estrecha en el mapa, normal en paneles).
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--f-archivo', display: 'swap' });
// Atkinson Hyperlegible Next (Braille Institute): texto y controles, legible con guantes y a distancia.
// next/font la sirve desde el propio sitio: sin pedidos a Google en cada visita y sin salto de fuente.
// Next no trae métricas de respaldo para esta fuente: se desactiva el ajuste y se cae a Archivo.
const atkinson = Atkinson({
  subsets: ['latin'], style: ['normal', 'italic'], variable: '--f-atkinson', display: 'swap',
  adjustFontFallback: false, fallback: ['Archivo', 'ui-sans-serif', 'sans-serif'],
});

// Una versión estática por idioma: /es y /en. Cualquier otro prefijo da 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return IDIOMAS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const d = DICCIONARIOS[lang] ?? DICCIONARIOS.es;
  return {
    title: d.meta.titulo,
    description: d.meta.descripcion,
    alternates: { canonical: `/${lang}`, languages: { es: '/es', en: '/en', 'x-default': '/' } },
  };
}

export default async function RootLayout({ children, params }) {
  const { lang } = await params;
  if (!IDIOMAS.includes(lang)) notFound();
  return (
    <html lang={lang} className={`${archivo.variable} ${atkinson.variable}`}>
      <body><Proveedores idioma={lang}>{children}</Proveedores></body>
    </html>
  );
}
