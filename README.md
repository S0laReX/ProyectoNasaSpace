# MARSWALK · Guía de supervivencia en Jezero

**NASA Space Apps Challenge 2026 · Interplanetary Survival Guide: Martian Map** (nivel intermedio)

Un mapa por capas del cráter Jezero para que una tripulación planifique una caminata (*Marswalk*)
segura y con valor científico. Combina datos de cinco misiones de NASA en una sola vista.

## El desafío

Crear un mapa, herramienta o interfaz que un astronauta en Marte pueda usar durante una exploración
de superficie. Debe integrar datos de varias misiones científicas de NASA (se sugieren al menos tres
tipos: óptico, térmico, espectral, topográfico, atmosférico, radiación…), priorizar la seguridad de la
tripulación y, si es posible, incluir una ruta que evite obstáculos.
→ https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/

## Qué hace

| Función | Datos de NASA |
|---|---|
| Mapa base óptico a 25 cm y 6 m por píxel | MRO HiRISE y CTX (mosaicos controlados de Jezero, Mars Trek) |
| Relieve regional | MGS MOLA (elevación coloreada con sombreado) |
| Térmico día/noche: roca firme vs. polvo suelto | Mars Odyssey THEMIS IR |
| Recorrido real, elevación e inclinación del terreno | Waypoints de Perseverance (MMGIS, Mars 2020) |
| Condiciones actuales: temperatura, presión, horas de luz | MEDA (Mars 2020) |
| Dosis de radiación por EVA | Curiosity RAD: 0,67 mSv/día en superficie (Hassler et al., 2014) |
| Vista desde el suelo de cada punto | Imágenes raw de Perseverance por sol |

**Planificador de EVA:** traza la ruta en el mapa y la app calcula distancia, tiempo de caminata con
traje, uso del soporte vital (con reserva para el retorno), dosis de radiación, pendiente máxima según
el rover y perfil de elevación. Además lanza alertas automáticas.

## Tecnologías

- **Next.js 15 + React 19.** Interfaz y rutas API que hacen de proxy y caché de los datos de NASA.
- **Leaflet** en proyección equirectangular (`L.CRS.EPSG4326`), compatible con las teselas *EQ* de Mars Trek.
- **Three.js.** Globo 3D del hero con la textura real de Viking, armada en el navegador a partir de teselas, más atmósfera y estrellas.
- **CSS puro** para las animaciones: aparición al hacer scroll, ruta animada, marcadores con pulso, contadores. Respeta `prefers-reduced-motion`.
- Fuentes Space Grotesk y JetBrains Mono, con estética HUD inspirada en *Explore with Perseverance*, *Where is Perseverance* y Mars Trek.

## Ejecutar

```bash
npm install
npm run dev     # http://localhost:3000
```

No necesita claves: todos los datos son abiertos. La app requiere conexión a internet.

## Estructura

```
app/
  page.js                 landing: hero 3D, misión, mapa, datos
  api/rover/route.js      recorrido y waypoints de Perseverance (caché 6 h)
  api/clima/route.js      clima MEDA
  api/imagenes/route.js   imágenes raw por sol
components/
  Globo.js                globo de Marte (Three.js)
  MapaMarte.js            mapa Leaflet + capas + ruta
  Planificador.js         panel de capas, ruta y métricas
  Perfil.js · Clima.js · VistaSuperficie.js · Telemetria.js · Revelar.js
lib/marte.js              capas, supuestos de EVA y cálculos (Marte R = 3389,5 km)
```

## Supuestos (editables en `lib/marte.js`)

- Velocidad con traje: 1,5 km/h (ajustable en la interfaz).
- Autonomía del soporte vital: 8 h, con un 30 % reservado para el retorno.
- Pendiente de precaución: más de 15° (tomada de la inclinación medida por el rover).

## Créditos

NASA/JPL-Caltech · NASA Solar System Treks · Univ. of Arizona (HiRISE) · ASU (THEMIS) · MSSS (CTX) ·
CAB (MEDA) · SwRI (RAD). Proyecto independiente, sin respaldo oficial de NASA.
