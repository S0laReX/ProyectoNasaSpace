// Cálculo de pendiente y reducción de grilla a partir de un modelo de elevación (DTM).
// Puro: sin red ni archivos, para poder probarlo y reutilizarlo en el script de generación.

export const SIN_DATO_PEND = 255;   // Uint8: pendiente desconocida
export const SIN_DATO_ELEV = -32768; // Int16: elevación desconocida
export const PASO_PEND = 0.25;      // grados por unidad en el Uint8 (0–63,5°)

/**
 * Pendiente en grados con el operador de Horn (3×3), como gdaldem slope.
 * `z` en metros, fila 0 = norte. `celdaX`/`celdaY` en metros. Las celdas sin dato
 * (o con vecinos sin dato) devuelven NaN.
 */
export function pendienteHorn(z, ancho, alto, celdaX, celdaY, esSinDato) {
  const out = new Float32Array(ancho * alto).fill(NaN);
  for (let f = 1; f < alto - 1; f++) {
    for (let c = 1; c < ancho - 1; c++) {
      const v = (df, dc) => z[(f + df) * ancho + (c + dc)];
      const a = v(-1, -1), b = v(-1, 0), cc = v(-1, 1);
      const d = v(0, -1), fz = v(0, 1);
      const g = v(1, -1), h = v(1, 0), i = v(1, 1);
      if ([a, b, cc, d, fz, g, h, i, v(0, 0)].some(esSinDato)) continue;
      const dzdx = ((cc + 2 * fz + i) - (a + 2 * d + g)) / (8 * celdaX);
      const dzdy = ((g + 2 * h + i) - (a + 2 * b + cc)) / (8 * celdaY);
      out[f * ancho + c] = Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI;
    }
  }
  return out;
}

/**
 * Reduce la grilla por bloques de `k`×`k`: la pendiente toma el MÁXIMO del bloque
 * (criterio conservador para seguridad) y la elevación el promedio.
 */
export function reducir(pend, elev, ancho, alto, k, esSinDato) {
  const an = Math.floor(ancho / k), al = Math.floor(alto / k);
  const p8 = new Uint8Array(an * al).fill(SIN_DATO_PEND);
  const e16 = new Int16Array(an * al).fill(SIN_DATO_ELEV);
  for (let f = 0; f < al; f++) {
    for (let c = 0; c < an; c++) {
      let pMax = -1, eSum = 0, eN = 0;
      for (let df = 0; df < k; df++) {
        for (let dc = 0; dc < k; dc++) {
          const idx = (f * k + df) * ancho + (c * k + dc);
          const p = pend[idx];
          if (!Number.isNaN(p) && p > pMax) pMax = p;
          const e = elev[idx];
          if (!esSinDato(e)) { eSum += e; eN++; }
        }
      }
      if (pMax >= 0) p8[f * an + c] = Math.min(254, Math.round(pMax / PASO_PEND));
      if (eN) e16[f * an + c] = Math.max(-32767, Math.min(32767, Math.round(eSum / eN)));
    }
  }
  return { pend: p8, elev: e16, ancho: an, alto: al };
}

/** Metros de una proyección equirectangular (latTs=0, lon0=0) a grados. */
export const mAGrados = (m, radio) => (m / radio) * 180 / Math.PI;
