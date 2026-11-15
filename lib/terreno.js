// Terreno de Jezero en el navegador: carga la grilla generada por scripts/generar-terreno.mjs,
// la consulta en cualquier punto y la pinta como zonas para Leaflet.
import { EVA } from './marte';

export const UMBRAL_PRECAUCION = 8; // grados: por encima, caminar con cuidado
export const SIN_DATO = 255;

export const CLASES = {
  seguro: { nombre: 'Seguro', detalle: `menos de ${UMBRAL_PRECAUCION}°` },
  precaucion: { nombre: 'Precaución', detalle: `${UMBRAL_PRECAUCION}° a ${EVA.pendienteMaxGrados}°` },
  peligro: { nombre: 'No seguro', detalle: `más de ${EVA.pendienteMaxGrados}°` },
  sd: { nombre: 'Sin datos', detalle: 'fuera del modelo de terreno' },
};

export function clasePendiente(g) {
  if (g == null) return 'sd';
  if (g > EVA.pendienteMaxGrados) return 'peligro';
  if (g > UMBRAL_PRECAUCION) return 'precaucion';
  return 'seguro';
}

/** Descarga meta + binarios. Devuelve null si el terreno no fue generado todavía. */
export async function cargarTerreno(base = '/datos/terreno-jezero') {
  try {
    const meta = await fetch(`${base}.json`).then((r) => (r.ok ? r.json() : null));
    if (!meta) return null;
    const [p, e] = await Promise.all([
      fetch(`${base}.pend.bin`).then((r) => r.arrayBuffer()),
      fetch(`${base}.elev.bin`).then((r) => r.arrayBuffer()),
    ]);
    return { ...meta, pend: new Uint8Array(p), elev: new Int16Array(e) };
  } catch {
    return null;
  }
}

function celda(t, lat, lon) {
  const [[s, o], [n, e]] = t.limites;
  if (lat < s || lat > n || lon < o || lon > e) return -1;
  const c = Math.min(t.ancho - 1, Math.floor(((lon - o) / (e - o)) * t.ancho));
  const f = Math.min(t.alto - 1, Math.floor(((n - lat) / (n - s)) * t.alto));
  return f * t.ancho + c;
}

/** Pendiente (°) y elevación (m) en un punto, o nulls si no hay dato. */
export function muestrear(t, lat, lon) {
  if (!t) return { pendiente: null, elev: null };
  const i = celda(t, lat, lon);
  if (i < 0) return { pendiente: null, elev: null };
  const p = t.pend[i];
  const e = t.elev[i];
  return { pendiente: p === SIN_DATO ? null : p * t.pasoPendiente, elev: e === -32768 ? null : e };
}

/**
 * Dibuja las zonas en una tesela de pantalla (canvas de Leaflet): transparente lo seguro,
 * ámbar con trama diagonal la precaución y rojo con doble trama lo no seguro. La trama
 * va en píxeles de pantalla (gx0, gy0 = esquina global de la tesela), así se ve fina a
 * cualquier zoom y la diferencia no depende solo del color.
 */
export function dibujarTesela(ctx, ancho, alto, [latN, lonO], [latS, lonE], gx0, gy0, t, rgb) {
  const img = ctx.createImageData(ancho, alto);
  let algo = false;
  for (let py = 0; py < alto; py++) {
    const lat = latN + ((latS - latN) * (py + 0.5)) / alto;
    for (let px = 0; px < ancho; px++) {
      const lon = lonO + ((lonE - lonO) * (px + 0.5)) / ancho;
      const { pendiente } = muestrear(t, lat, lon);
      if (pendiente == null) continue;
      const k = clasePendiente(pendiente);
      if (k === 'seguro') continue;
      const gx = gx0 + px, gy = gy0 + py;
      const raya = ((gx + gy) & 7) < 2;
      const raya2 = ((gx - gy) & 7) < 2;
      const col = rgb[k];
      const alfa = k === 'peligro' ? (raya || raya2 ? 225 : 70) : (raya ? 190 : 22);
      img.data.set([col[0], col[1], col[2], alfa], (py * ancho + px) * 4);
      algo = true;
    }
  }
  if (algo) ctx.putImageData(img, 0, 0);
}

/** Convierte un color CSS (oklch incluido) a [r, g, b]. */
export function aRgb(css) {
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = css;
  c.fillRect(0, 0, 1, 1);
  return Array.from(c.getImageData(0, 0, 1, 1).data.slice(0, 3));
}

/** Celdas no seguras (>umbral) a menos de `radioM` metros de un punto: la más cercana. */
export function peligroCercano(t, lat, lon, radioM = 250, kmPorGrado) {
  if (!t) return null;
  const [[s, o], [n, e]] = t.limites;
  const i0 = celda(t, lat, lon);
  if (i0 < 0) return null;
  const f0 = Math.floor(i0 / t.ancho), c0 = i0 % t.ancho;
  const r = Math.ceil(radioM / t.celdaM);
  const mLat = (kmPorGrado * 1000 * (n - s)) / t.alto;
  const mLon = (kmPorGrado * 1000 * Math.cos((lat * Math.PI) / 180) * (e - o)) / t.ancho;
  let mejor = null;
  for (let df = -r; df <= r; df++) {
    for (let dc = -r; dc <= r; dc++) {
      const f = f0 + df, c = c0 + dc;
      if (f < 0 || c < 0 || f >= t.alto || c >= t.ancho) continue;
      const v = t.pend[f * t.ancho + c];
      if (v === SIN_DATO || v * t.pasoPendiente <= EVA.pendienteMaxGrados) continue;
      const d = Math.hypot(df * mLat, dc * mLon);
      if (d <= radioM && (!mejor || d < mejor.distM)) {
        mejor = { distM: d, pendiente: v * t.pasoPendiente, lat: n - ((f + 0.5) / t.alto) * (n - s), lon: o + ((c + 0.5) / t.ancho) * (e - o) };
      }
    }
  }
  return mejor;
}
