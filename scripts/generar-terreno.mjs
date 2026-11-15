// Genera la grilla de terreno de Jezero que usa el mapa (zonas seguras / precaución / no seguras
// y el perfil de elevación) a partir de un DTM REAL:
//
//   Mars 2020 Terrain Relative Navigation CTX DTM Mosaic (USGS Astrogeology, 20 m/píxel)
//   https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_ctx_dtm_mosaic
//
// Uso (una vez, con internet):   npm install --no-save geotiff
//                                node scripts/generar-terreno.mjs
// Escribe public/datos/terreno-jezero.json + .pend.bin + .elev.bin (≈1,5 MB en total).

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pendienteHorn, reducir, mAGrados, PASO_PEND } from '../lib/terreno-calc.mjs';

const URL_DTM = 'https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif';
const CACHE = path.resolve('.cache');
const ARCHIVO = path.join(CACHE, 'jezero_ctx_dtm_20m.tif');
const SALIDA = path.resolve('public/datos');
const REDUCCION = 2;            // 20 m -> 40 m por celda
const RADIO_POR_DEFECTO = 3396190; // esfera de Marte usada por USGS en productos Eqc

async function descargar() {
  if (existsSync(ARCHIVO) && (await stat(ARCHIVO)).size > 1e6) return;
  await mkdir(CACHE, { recursive: true });
  console.log('Descargando DTM de USGS (≈9 MB)…');
  const r = await fetch(URL_DTM);
  if (!r.ok) throw new Error(`USGS respondió ${r.status}`);
  await writeFile(ARCHIVO, Buffer.from(await r.arrayBuffer()));
}

async function main() {
  let geotiff;
  try { geotiff = await import('geotiff'); }
  catch { console.error('Falta la librería geotiff. Corre:  npm install --no-save geotiff'); process.exit(1); }

  await descargar();
  const buf = await readFile(ARCHIVO);
  const tiff = await geotiff.fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const img = await tiff.getImage();
  const ancho = img.getWidth(), alto = img.getHeight();
  const [x0, y0] = img.getOrigin();                 // esquina superior izquierda, en metros
  const [rx, ry] = img.getResolution();             // ry es negativo (filas hacia el sur)
  const geo = img.getGeoKeys() ?? {};
  const radio = geo.GeogSemiMajorAxisGeoKey || geo.ProjSemiMajorAxis || RADIO_POR_DEFECTO;
  const nd = img.getGDALNoData();
  const esSinDato = (v) => !Number.isFinite(v) || v < -1e5 || (nd != null && v === nd);
  console.log(`DTM ${ancho}×${alto} px, celda ${rx.toFixed(1)} m, radio ${radio} m, sin dato ${nd}`);

  const [z] = await img.readRasters({ interleave: false });
  const pend = pendienteHorn(z, ancho, alto, Math.abs(rx), Math.abs(ry), esSinDato);
  const red = reducir(pend, z, ancho, alto, REDUCCION, esSinDato);

  const oeste = mAGrados(x0, radio), norte = mAGrados(y0, radio);
  const este = mAGrados(x0 + rx * red.ancho * REDUCCION, radio);
  const sur = mAGrados(y0 + ry * red.alto * REDUCCION, radio);

  // Resumen para verificar a ojo
  let n = 0, s8 = 0, s15 = 0;
  for (const v of red.pend) { if (v === 255) continue; n++; const g = v * PASO_PEND; if (g > 15) s15++; else if (g > 8) s8++; }
  console.log(`Celdas con dato: ${n.toLocaleString()} · 8–15°: ${(100 * s8 / n).toFixed(1)} % · >15°: ${(100 * s15 / n).toFixed(1)} %`);

  await mkdir(SALIDA, { recursive: true });
  const meta = {
    fuente: 'USGS Astrogeology · Mars 2020 TRN CTX DTM Mosaic (20 m), pendiente Horn',
    url: URL_DTM,
    limites: [[sur, oeste], [norte, este]],
    ancho: red.ancho, alto: red.alto,
    celdaM: Math.abs(rx) * REDUCCION,
    pasoPendiente: PASO_PEND,
    criterio: 'pendiente máxima de cada bloque de 40 m (conservador); elevación promedio, referida al geoide',
    generado: new Date().toISOString(),
  };
  await writeFile(path.join(SALIDA, 'terreno-jezero.json'), JSON.stringify(meta, null, 2));
  await writeFile(path.join(SALIDA, 'terreno-jezero.pend.bin'), Buffer.from(red.pend.buffer));
  await writeFile(path.join(SALIDA, 'terreno-jezero.elev.bin'), Buffer.from(red.elev.buffer));
  console.log(`Listo: ${red.ancho}×${red.alto} celdas en public/datos/ (${sur.toFixed(3)}–${norte.toFixed(3)}°N, ${oeste.toFixed(3)}–${este.toFixed(3)}°E)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
