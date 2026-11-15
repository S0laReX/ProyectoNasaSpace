import { Archivo } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import './globals.css';

// Archivo con su eje de anchura: títulos y lecturas numéricas (estrecha en el mapa, normal en paneles).
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--f-archivo', display: 'swap' });

export const metadata = {
  title: 'Marswalk: guía de supervivencia en Jezero',
  description: 'Mapa por capas del cráter Jezero para planificar caminatas seguras y con valor científico en Marte. NASA Space Apps 2026.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={archivo.variable}>
      <head>
        {/* Atkinson Hyperlegible Next (Braille Institute): texto y controles, legible con guantes y a distancia. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,200..800;1,200..800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
