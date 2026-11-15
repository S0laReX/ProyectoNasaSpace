// Hora y posición del Sol en Marte (algoritmo Mars24 de NASA GISS: Allison y McEwen, 2000).
// Sin dependencias: sirve en el navegador y en Node.

const sen = (g) => Math.sin((g * Math.PI) / 180);
const mod = (a, n) => ((a % n) + n) % n;

// Perturbaciones planetarias (Allison y McEwen 2000, tabla 5)
const PBS = [
  [0.0071, 2.2353, 49.409], [0.0057, 2.7543, 168.173], [0.0039, 1.1177, 191.837],
  [0.0037, 15.7866, 21.736], [0.0021, 2.1354, 15.704], [0.0020, 2.4694, 95.528], [0.0018, 32.8493, 49.095],
];

/**
 * @param {Date} fecha
 * @param {number} lonEste longitud planetocéntrica este del sitio
 * @returns {{ msd, mtc, ls, lmst, ltst, subsolar: { lat, lon } }}
 *   msd: fecha solar de Marte · mtc y lmst/ltst en horas · ls en grados · subsolar en grados (lon este)
 */
export function tiempoMarte(fecha = new Date(), lonEste = 0) {
  const jdUT = fecha.getTime() / 86400000 + 2440587.5;
  const jdTT = jdUT + (37 + 32.184) / 86400; // TAI−UTC = 37 s desde 2017
  const dt = jdTT - 2451545.0;

  const M = 19.3871 + 0.52402073 * dt;
  const alfaFMS = 270.3871 + 0.524038496 * dt;
  const pbs = PBS.reduce((s, [A, tau, fi]) => s + A * Math.cos(((0.985626 * dt) / tau + fi) * (Math.PI / 180)), 0);
  const nuM = (10.691 + 3.0e-7 * dt) * sen(M) + 0.623 * sen(2 * M) + 0.05 * sen(3 * M) + 0.005 * sen(4 * M) + 0.0005 * sen(5 * M) + pbs;
  const ls = mod(alfaFMS + nuM, 360);
  const eot = 2.861 * sen(2 * ls) - 0.071 * sen(4 * ls) + 0.002 * sen(6 * ls) - nuM; // grados

  const msd = (dt - 4.5) / 1.0274912517 + 44796.0 - 0.0009626;
  const mtc = mod(24 * msd, 24);
  const lmst = mod(mtc + lonEste / 15, 24);
  const ltst = mod(lmst + eot / 15, 24);

  const latSS = (Math.asin(0.42565 * sen(ls)) * 180) / Math.PI + 0.25 * sen(ls);
  const lonSS = mod(180 - 15 * mtc - eot + 180, 360) - 180;
  return { msd, mtc, ls, lmst, ltst, subsolar: { lat: latSS, lon: lonSS } };
}

/** 10.7 → "10:42" */
export const horaTexto = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

/** Estación del hemisferio norte según la longitud solar (Jezero está en el norte). Devuelve una clave de diccionario. */
export function estacion(ls) {
  return ['primavera', 'verano', 'otono', 'invierno'][Math.floor(mod(ls, 360) / 90)];
}
