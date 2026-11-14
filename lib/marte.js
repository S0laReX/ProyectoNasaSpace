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

export const CAPAS_BASE = [
  {
    id: 'hirise', nombre: 'HiRISE 25 cm', tipo: 'Óptico',
    url: tesela('JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd', 'png'),
    maxNativeZoom: 17, bounds: BBOX_HIRISE,
    fuente: 'MRO HiRISE · mosaico controlado de Jezero',
  },
  {
    id: 'ctx', nombre: 'CTX 6 m', tipo: 'Óptico',
    url: tesela('JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0', 'png'),
    maxNativeZoom: 13, bounds: BBOX_CTX,
    fuente: 'MRO CTX · mosaico controlado de Jezero',
  },
  {
    id: 'mola', nombre: 'Relieve MOLA', tipo: 'Topográfico',
    url: tesela('Mars_MGS_MOLA_ClrShade_merge_global_463m', 'jpg'),
    maxNativeZoom: 7,
    fuente: 'MGS MOLA · elevación coloreada con sombreado',
  },
  {
    id: 'themis-dia', nombre: 'THEMIS IR día', tipo: 'Térmico',
    url: tesela('THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018', 'png'),
    maxNativeZoom: 9,
    fuente: 'Mars Odyssey THEMIS · infrarrojo diurno 100 m',
  },
  {
    id: 'themis-noche', nombre: 'THEMIS IR noche', tipo: 'Térmico',
    url: tesela('THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018', 'png'),
    maxNativeZoom: 9,
    fuente: 'Mars Odyssey THEMIS · infrarrojo nocturno (inercia térmica: roca vs. polvo)',
  },
];

// Fondo global siempre visible debajo de los mosaicos locales
export const CAPA_GLOBAL = {
  url: tesela('Mars_Viking_MDIM21_ClrMosaic_global_232m', 'jpg'),
  maxNativeZoom: 7,
};

export const TEXTURA_GLOBO = (x, y) =>
  `${TREK}/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/2/${y}/${x}.jpg`;

// Supuestos del planificador de EVA (editables en la interfaz)
export const EVA = {
  velocidadKmH: 1.5,     // caminata con traje presurizado en terreno irregular (supuesto conservador)
  autonomiaH: 8,         // soporte vital portátil típico de una EVA larga
  reservaRetorno: 0.3,   // 30 % de consumibles reservado para volver
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

/**
 * Analiza una ruta trazada: distancia, tiempo, consumibles, radiación y riesgos
 * usando la telemetría real de Perseverance como referencia del terreno.
 */
export function analizarRuta(puntos, waypoints, supuestos = EVA) {
  const km = longitudRuta(puntos);
  const horasCaminata = km / supuestos.velocidadKmH;
  const horasDisponibles = supuestos.autonomiaH * (1 - supuestos.reservaRetorno);
  const usoConsumibles = horasCaminata / supuestos.autonomiaH;
  const dosis = (supuestos.dosisMSvDia * horasCaminata) / 24;

  // Muestrear la ruta cada ~25 m y consultar la pendiente y elevación del rover cercanas
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
      perfil.push({
        km: acumulado + tramo * t,
        elev: waypoint?.elev ?? null,
        pendiente: dRover < 0.15 ? waypoint?.tilt ?? null : null, // solo si el rover pasó a <150 m
        cobertura: dRover < 0.15,
      });
    }
    acumulado += tramo;
  }
  const pendientes = perfil.map((p) => p.pendiente).filter((x) => x != null);
  const pendienteMax = pendientes.length ? Math.max(...pendientes) : null;
  const cobertura = perfil.length ? perfil.filter((p) => p.cobertura).length / perfil.length : 0;

  const alertas = [];
  if (horasCaminata > horasDisponibles) alertas.push({ nivel: 'critico', texto: `La ruta excede la autonomía útil (${horasDisponibles.toFixed(1)} h con reserva de retorno).` });
  else if (horasCaminata > horasDisponibles * 0.8) alertas.push({ nivel: 'alerta', texto: 'Ruta cerca del límite de consumibles: considera apoyo de rover.' });
  if (pendienteMax != null && pendienteMax > supuestos.pendienteMaxGrados) alertas.push({ nivel: 'alerta', texto: `Pendiente de hasta ${pendienteMax.toFixed(0)}° registrada por el rover en la ruta.` });
  if (cobertura < 0.5 && puntos.length > 1) alertas.push({ nivel: 'info', texto: 'Más de la mitad de la ruta está lejos del recorrido del rover: terreno sin verificar en superficie.' });
  if (!alertas.length && puntos.length > 1) alertas.push({ nivel: 'ok', texto: 'Ruta dentro de los márgenes de seguridad.' });

  return { km, horasCaminata, horasDisponibles, usoConsumibles, dosis, perfil, pendienteMax, cobertura, alertas };
}

export const formatoHoras = (h) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh} h ${String(mm).padStart(2, '0')} min`;
};
