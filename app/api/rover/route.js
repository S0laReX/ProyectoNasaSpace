// Recorrido y waypoints reales de Perseverance (servidor MMGIS de NASA/JPL),
// reducidos a lo que usa la app. Se cachean 6 h.
export const revalidate = 21600;

const BASE = 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json';

export async function GET() {
  try {
    const [wp, tr] = await Promise.all([
      fetch(`${BASE}/M20_waypoints.json`, { next: { revalidate } }).then((r) => r.json()),
      fetch(`${BASE}/M20_traverse.json`, { next: { revalidate } }).then((r) => r.json()),
    ]);

    const waypoints = wp.features
      .filter((f) => f.geometry?.type === 'Point' || f.properties?.lat != null)
      .map((f) => {
        const p = f.properties;
        return {
          sol: p.sol,
          lat: Number(p.lat),
          lon: Number(p.lon),
          elev: p.elev_geoid > -9000 ? Math.round(p.elev_geoid * 10) / 10 : null,
          tilt: p.tilt != null ? Math.round(p.tilt * 10) / 10 : null,
          distTotalKm: p.dist_km ?? null,
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
