// Recorrido y waypoints reales de Perseverance (servidor MMGIS de NASA/JPL),
// reducidos a lo que usa la app. La respuesta de esta ruta se cachea 6 h.
export const revalidate = 21600;
// La ruta es estática (se regenera cada 6 h). Sus descargas no pasan por la caché de datos de Next:
// el recorrido pesa más que su límite de 2 MB, y lo que se cachea es la respuesta reducida.
export const dynamic = 'force-static';
export const fetchCache = 'force-no-store';

const BASE = 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json';

// MMGIS pone una nota a TODOS los waypoints; casi todas son etiquetas automáticas de localización.
// Solo cuentan como hitos las notas escritas a mano.
const NOTA_RUTINA = /^(end-of-drive localization|mid-drive localization|interpolated|site increment, no motion\.?)$/i;

async function leerJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  return r.json();
}

export async function GET() {
  try {
    const [wp, tr] = await Promise.all([leerJson(`${BASE}/M20_waypoints.json`), leerJson(`${BASE}/M20_traverse.json`)]);
    if (!Array.isArray(wp?.features) || !Array.isArray(tr?.features)) throw new Error('Formato de MMGIS inesperado');

    const waypoints = wp.features
      .filter((f) => f.geometry?.type === 'Point' || f.properties?.lat != null)
      .map((f) => {
        const p = f.properties ?? {};
        const nota = typeof p.Note === 'string' ? p.Note.trim() : '';
        return {
          sol: p.sol,
          lat: Number(p.lat),
          lon: Number(p.lon),
          elev: p.elev_geoid > -9000 ? Math.round(p.elev_geoid * 10) / 10 : null,
          tilt: p.tilt != null ? Math.round(p.tilt * 10) / 10 : null,
          distTotalKm: p.dist_km ?? null,
          nota: nota && !NOTA_RUTINA.test(nota) ? nota : null,
        };
      })
      .filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lon));

    // Línea del recorrido: una coordenada de cada 4 para aligerar
    const recorrido = tr.features.flatMap((f) => {
      const c = f.geometry?.coordinates ?? [];
      return c.filter((_, i) => i % 4 === 0 || i === c.length - 1).map(([lon, lat]) => [lat, lon]);
    });

    const ultimo = waypoints.at(-1);
    return Response.json({
      fuente: 'NASA/JPL-Caltech · Mars 2020 MMGIS',
      solActual: ultimo?.sol ?? null,
      distanciaTotalKm: ultimo?.distTotalKm ?? null,
      waypoints,
      recorrido,
    });
  } catch (e) {
    return Response.json({ error: 'No se pudo obtener la telemetría del rover', detalle: String(e) }, { status: 502 });
  }
}
