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
| Pendiente y elevación cada 40 m: zonas seguras, de precaución y no seguras | DTM CTX de USGS (Mars 2020 TRN, 20 m) |
| Últimas condiciones medidas: temperatura, presión, horas de luz | MEDA (Mars 2020); el feed público no se actualiza desde abril de 2024 y la app lo indica |
| Dosis de radiación por EVA | Curiosity RAD: 0,67 mSv/día en superficie (Hassler et al., 2014) |
| Vista desde el suelo de cada punto | Imágenes raw de Perseverance por sol |

**Planificador de EVA:** traza la ruta en el mapa y la app calcula distancia, tiempo de caminata con
traje, uso del soporte vital (ida y vuelta, con reserva de seguridad), dosis de radiación, pendiente máxima y desnivel según
el modelo de terreno, tramos no seguros que cruza o bordea y perfil de elevación. Además lanza alertas automáticas.

## Tecnologías

- **Next.js 15 + React 19.** Interfaz y rutas API que hacen de proxy y caché de los datos de NASA.
- **Leaflet** en proyección equirectangular (`L.CRS.EPSG4326`), compatible con las teselas *EQ* de Mars Trek.
- **Three.js.** Globo 3D del hero con la textura real de Viking, armada en el navegador a partir de teselas, más atmósfera y estrellas.
- **Motion** (`motion/react`, con `LazyMotion`) para las animaciones de interfaz: entrada de la portada, contenido al hacer scroll, cambios del análisis y diálogos. Respeta `prefers-reduced-motion`.
- **Pacha**, el rover guía: mascota de línea que aparece solo en estados vacíos y de carga.
- Fuentes Archivo y Atkinson Hyperlegible Next, servidas con `next/font`. Cielo nocturno azul marino con estrellas reales, azul NASA para la acción y óxido marciano como identidad (ver `.impeccable.md`).

## Ejecutar

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint    # ESLint con las reglas de Next
```

No necesita claves: todos los datos son abiertos. La app requiere conexión a internet.

El modelo de terreno ya viene generado en `public/datos/`. Para regenerarlo desde el DTM de USGS:

```bash
npm install --no-save geotiff
node scripts/generar-terreno.mjs
```

## Estructura

```
middleware.js             "/" → /es o /en (cookie de preferencia o idioma del navegador)
app/
  [lang]/layout.js        una versión estática por idioma (/es, /en), metadatos y hreflang
  [lang]/page.js          página completa (components/Inicio.js)
  api/rover/route.js      recorrido y waypoints de Perseverance (caché 6 h)
  api/clima/route.js      clima MEDA
  api/imagenes/route.js   imágenes raw por sol
components/
  Globo.js                globo de Marte (Three.js)
  MapaMarte.js            mapa Leaflet + capas + ruta
  Planificador.js         panel de capas, ruta y métricas
  Escena.js               transición planeta → mapa
  Pacha.js                rover guía (estados vacíos y de carga)
  Perfil.js · Clima.js · VistaSuperficie.js · Telemetria.js · Revelar.js · Proveedores.js
lib/i18n/                 diccionarios es.js y en.js, t(clave, datos) y configuración de idiomas
lib/marte.js              capas, supuestos de EVA y cálculos (Marte R = 3389,5 km)
lib/terreno.js            lectura del modelo de terreno y zonas por pendiente
lib/tiempo-marte.js       hora y Sol en Marte (Mars24)
public/datos/             grilla de pendiente y elevación de Jezero (40 m)
scripts/generar-terreno.mjs  genera esa grilla desde el DTM de USGS
```

## Idiomas

La página está en español e inglés: `/es` y `/en`, ambas pre-renderizadas. El selector ES | EN de la
navegación cambia el idioma al instante, sin recargar (no se pierde la ruta trazada), actualiza la URL y
guarda la preferencia en una cookie. Para añadir o cambiar un texto:

1. Añade la clave en `lib/i18n/es.js` y en `lib/i18n/en.js` (los dos deben tener las mismas claves).
2. En un componente: `const { t } = useIdioma();` y `t('seccion.clave')`, o `t('seccion.clave', { datos })`
   si el valor es una función (plurales, cifras).

La lógica (`lib/marte.js`, `lib/terreno.js`) no produce textos: devuelve códigos que la interfaz traduce.

## Supuestos (editables en `lib/marte.js`)

- Velocidad con traje: 1,5 km/h (ajustable en la interfaz).
- Autonomía del soporte vital: 8 h. La ida y el regreso por el mismo camino deben caber en el 70 %; el 30 % restante es reserva de seguridad.
- Pendiente: segura hasta 8°, precaución de 8° a 15°, no segura por encima de 15°. Sale del DTM CTX (Horn, con corrección de latitud; máximo de cada bloque de 40 m). Fuera del modelo se usa la inclinación medida por el rover.

## Créditos

NASA/JPL-Caltech · NASA Solar System Treks · Univ. of Arizona (HiRISE) · ASU (THEMIS) · MSSS (CTX) ·
CAB (MEDA) · SwRI (RAD). Proyecto independiente, sin respaldo oficial de NASA.
