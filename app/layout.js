import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import './globals.css';

const titulos = Space_Grotesk({ subsets: ['latin'], variable: '--f-titulo', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--f-mono', display: 'swap' });

export const metadata = {
  title: 'Marswalk · Guía de supervivencia en Jezero',
  description: 'Mapa por capas del cráter Jezero para planificar caminatas seguras y con valor científico en Marte. NASA Space Apps 2026.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${titulos.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
