// Constantes y utilidades de Marte (sin React).

export const RADIO_MARTE_KM = 3389.5;

// Sitio de estudio: cráter Jezero (Perseverance)
export const JEZERO = { lat: 18.44, lon: 77.42 };

// Teselas WMTS de NASA Solar System Treks (proyección equirectangular, compatible con L.CRS.EPSG4326)
const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';
const tesela = (capa, ext) => `${TREK}/${capa}/1.0.0/default/default028mm/{z}/{y}/{x}.${ext}`;

// Extensión de los mosaicos locales de Jezero (de la búsqueda de Mars Trek)
const BBOX_HIRISE = [[18.3067994, 77.2229331], [18.669315, 77.583964]];
const BBOX_CTX = [[18.2110274, 77.1604655], [18.7211945, 77.6991776]];

// Nombre, tipo y fuente de cada capa están en los diccionarios (capas.<id>).
export const CAPAS_BASE = [
  {
    id: 'hirise',
    url: tesela('JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd', 'png'),
    maxNativeZoom: 17, bounds: BBOX_HIRISE,
  },
  {
    id: 'ctx',
    url: tesela('JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0', 'png'),
    maxNativeZoom: 13, bounds: BBOX_CTX,
  },
  {
    id: 'mola',
    url: tesela('Mars_MGS_MOLA_ClrShade_merge_global_463m', 'jpg'),
    maxNativeZoom: 7,
  },
  {
    id: 'themis-dia',
    url: tesela('THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018', 'png'),
    maxNativeZoom: 9,
  },
  {
    id: 'themis-noche',
    url: tesela('THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018', 'png'),
    maxNativeZoom: 9,
  },
];

// Fondo global siempre visible debajo de los mosaicos locales
export const CAPA_GLOBAL = {
  url: tesela('Mars_Viking_MDIM21_ClrMosaic_global_232m', 'jpg'),
  maxNativeZoom: 7,
};

export const TEXTURA_GLOBO = (x, y) =>
  `${TREK}/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/2/${y}/${x}.jpg`;

// Misma capa Viking a cualquier nivel: el globo y el mapa comparten píxeles en el fundido.
export const TESELA_VIKING = (z, x, y) =>
  `${TREK}/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/${z}/${y}/${x}.jpg`;

// Transición planeta → mapa. El fundido ocurre con el mapa en ZOOM_FUNDIDO, donde Viking es nativo.
export const ZOOM_FUNDIDO = 6;
export const ZONA_EVA = { centro: [18.445, 77.40], zoom: 14 };

// Etiquetas que aparecen por escala durante el descenso (planeta → región → cráter → zona de EVA).
// Su texto está en los diccionarios (etiquetas.<id>).
export const ETIQUETAS_ESCALA = [
  { id: 'region', lat: 12.9, lon: 87.0 },
  { id: 'crater', lat: 18.38, lon: 77.58 },
  { id: 'zona', lat: 18.452, lon: 77.392 },
];

// Supuestos del planificador de EVA (editables en la interfaz)
export const EVA = {
  velocidadKmH: 1.5,     // caminata con traje presurizado en terreno irregular (supuesto conservador)
  autonomiaH: 8,         // soporte vital portátil típico de una EVA larga
  reservaSeguridad: 0.3, // 30 % de consumibles intacto como margen, además de la ida y la vuelta
  dosisMSvDia: 0.67,     // dosis equivalente medida en superficie por Curiosity/RAD (Hassler et al., 2014)
  pendienteMaxGrados: 15 // pendiente a partir de la cual se marca precaución para caminar
};

export function distanciaKm([lat1, lon1], [lat2, lon2]) {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_MARTE_KM * Math.asin(Math.sqrt(a));
}

export function longitudRuta(puntos) {
  let total = 0;
  for (let i = 1; i < puntos.length; i++) total += distanciaKm(puntos[i - 1], puntos[i]);
  return total;
}

/** Waypoint del rover más cercano a un punto (para estimar elevación y pendiente). */
export function masCercano(waypoints, [lat, lon]) {
  let mejor = null;
  let dMin = Infinity;
  for (const w of waypoints) {
    const d = distanciaKm([lat, lon], [w.lat, w.lon]);
    if (d < dMin) { dMin = d; mejor = w; }
  }
  return { waypoint: mejor, distanciaKm: dMin };
}

export const KM_POR_GRADO = (2 * Math.PI * RADIO_MARTE_KM) / 360;

// Si la última parada queda a menos de esto del hábitat, la ruta ya incluye el regreso.
const RADIO_CIERRE_KM = 0.05;

/**
 * Analiza una ruta trazada: distancia, tiempo, consumibles, radiación y riesgos.
 * Con `terreno` (DTM CTX real, ver lib/terreno.js) cada muestra toma la pendiente y la
 * elevación del modelo; sin él, se usa la telemetría de Perseverance como referencia.
 * `utils` recibe { muestrear, clasePendiente, peligroCercano } para no acoplar este módulo.
 */
export function analizarRuta(puntos, waypoints, supuestos = EVA, terreno = null, utils = null) {
  const km = longitudRuta(puntos);
  // La ruta va del hábitat a la última parada. Hay que volver: se asume el mismo camino de
  // regreso (terreno ya transitado), salvo que la ruta ya termine en el hábitat.
  const cerrada = puntos.length > 2 && distanciaKm(puntos[0], puntos.at(-1)) <= RADIO_CIERRE_KM;
  const kmRetorno = cerrada ? 0 : km;
  const horasCaminata = km / supuestos.velocidadKmH;
  const horasRetorno = kmRetorno / supuestos.velocidadKmH;
  const horasTotales = horasCaminata + horasRetorno;
  const horasDisponibles = supuestos.autonomiaH * (1 - supuestos.reservaSeguridad);
  const usoConsumibles = horasTotales / supuestos.autonomiaH;
  const dosis = (supuestos.dosisMSvDia * horasTotales) / 24;
  const conTerreno = Boolean(terreno && utils);

  // Muestrear la ruta cada ~25 m
  const perfil = [];
  let acumulado = 0;
  for (let i = 1; i < puntos.length; i++) {
    const tramo = distanciaKm(puntos[i - 1], puntos[i]);
    const pasos = Math.max(1, Math.ceil(tramo / 0.025));
    for (let p = 0; p <= pasos; p++) {
      if (i > 1 && p === 0) continue;
      const t = p / pasos;
      const lat = puntos[i - 1][0] + (puntos[i][0] - puntos[i - 1][0]) * t;
      const lon = puntos[i - 1][1] + (puntos[i][1] - puntos[i - 1][1]) * t;
      const { waypoint, distanciaKm: dRover } = masCercano(waypoints, [lat, lon]);
      const cobertura = dRover < 0.15;
      const dtm = conTerreno ? utils.muestrear(terreno, lat, lon) : { pendiente: null, elev: null };
      const pendiente = dtm.pendiente ?? (cobertura ? waypoint?.tilt ?? null : null);
      perfil.push({
        km: acumulado + tramo * t, lat, lon,
        elev: dtm.elev ?? waypoint?.elev ?? null,
        pendiente,
        fuentePendiente: dtm.pendiente != null ? 'dtm' : pendiente != null ? 'rover' : null,
        clase: conTerreno ? utils.clasePendiente(pendiente) : null,
        cobertura,
      });
    }
    acumulado += tramo;
  }
  const pendientes = perfil.map((p) => p.pendiente).filter((x) => x != null);
  const pendienteMax = pendientes.length ? Math.max(...pendientes) : null;
  const cobertura = perfil.length ? perfil.filter((p) => p.cobertura).length / perfil.length : 0;

  // Desnivel acumulado
  let sube = 0, baja = 0;
  for (let i = 1; i < perfil.length; i++) {
    const a = perfil[i - 1].elev, b = perfil[i].elev;
    if (a == null || b == null) continue;
    if (b > a) sube += b - a; else baja += a - b;
  }

  // Reparto por clase de terreno y tramos no seguros
  const reparto = { seguro: 0, precaucion: 0, peligro: 0, sd: 0 };
  const tramosPeligro = [];
  if (conTerreno) {
    let abierto = null;
    perfil.forEach((p, i) => {
      const paso = i ? p.km - perfil[i - 1].km : 0;
      reparto[p.clase] += paso;
      if (p.clase === 'peligro') {
        if (!abierto) abierto = { desdeKm: p.km, hastaKm: p.km, maxPend: p.pendiente, lat: p.lat, lon: p.lon };
        abierto.hastaKm = p.km;
        abierto.maxPend = Math.max(abierto.maxPend, p.pendiente);
      } else if (abierto) { tramosPeligro.push(abierto); abierto = null; }
    });
    if (abierto) tramosPeligro.push(abierto);
  }

  // Qué hay cerca de la ruta (a ≤ 250 m sin cruzarlo)
  const cerca = [];
  if (conTerreno) {
    // Lo que la ruta ya cruza se avisa como tramo no seguro: no repetirlo como "cerca".
    const cruzados = perfil.filter((p) => p.clase === 'peligro');
    const esCruzado = (c) => cruzados.some((q) => distanciaKm([q.lat, q.lon], [c.lat, c.lon]) < 0.25);
    let ultimoKm = -1;
    for (const p of perfil) {
      if (p.km - ultimoKm < 0.1 || p.clase === 'peligro') continue;
      ultimoKm = p.km;
      const c = utils.peligroCercano(terreno, p.lat, p.lon, 250, KM_POR_GRADO);
      if (!c || esCruzado(c)) continue;
      if (!cerca.some((x) => distanciaKm([x.lat, x.lon], [c.lat, c.lon]) < 0.12)) cerca.push({ ...c, km: p.km });
    }
    cerca.sort((a, b) => a.distM - b.distM);
  }
  const puntosInteres = [];
  for (const w of waypoints) {
    if (!w.nota) continue;
    let dMin = Infinity, kmEn = 0;
    for (const p of perfil) {
      const d = distanciaKm([p.lat, p.lon], [w.lat, w.lon]);
      if (d < dMin) { dMin = d; kmEn = p.km; }
    }
    if (dMin <= 0.3) puntosInteres.push({ ...w, distM: dMin * 1000, km: kmEn });
  }
  puntosInteres.sort((a, b) => a.km - b.km);

  // Los avisos van como código + datos: la interfaz los traduce (lib/i18n) y los usa de clave estable.
  const alertas = [];
  const umbral = supuestos.pendienteMaxGrados;
  if (horasTotales > horasDisponibles) alertas.push({ nivel: 'critico', codigo: 'autonomia', datos: { cerrada, horas: horasDisponibles.toFixed(1) } });
  else if (horasTotales > horasDisponibles * 0.8) alertas.push({ nivel: 'alerta', codigo: 'consumibles', datos: {} });
  if (tramosPeligro.length) {
    const t0 = tramosPeligro[0];
    alertas.push({ nivel: 'critico', codigo: 'cruza', datos: { n: tramosPeligro.length, umbral, km: t0.desdeKm.toFixed(2), max: t0.maxPend.toFixed(0) } });
  } else if (pendienteMax != null && pendienteMax > umbral) {
    alertas.push({ nivel: 'alerta', codigo: 'pendienteRover', datos: { max: pendienteMax.toFixed(0) } });
  }
  if (cerca.length) alertas.push({ nivel: 'alerta', codigo: 'cerca', datos: { umbral, m: Math.round(cerca[0].distM), km: cerca[0].km.toFixed(2) } });
  if (conTerreno && km > 0 && reparto.sd / km > 0.5) alertas.push({ nivel: 'info', codigo: 'fueraModelo', datos: {} });
  else if (!conTerreno && cobertura < 0.5 && puntos.length > 1) alertas.push({ nivel: 'info', codigo: 'lejosRover', datos: {} });
  if (!alertas.length && puntos.length > 1) alertas.push({ nivel: 'ok', codigo: 'ok', datos: {} });

  return {
    km, kmRetorno, cerrada, horasCaminata, horasRetorno, horasTotales, horasDisponibles, usoConsumibles, dosis, perfil, pendienteMax, cobertura,
    conTerreno, sube, baja, reparto, tramosPeligro, cerca: cerca.slice(0, 4), puntosInteres, alertas,
  };
}

export const formatoHoras = (h) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh} h ${String(mm).padStart(2, '0')} min`;
};
