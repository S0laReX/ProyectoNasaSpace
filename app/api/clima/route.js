// Clima en Jezero medido por MEDA (Perseverance). Devuelve el sol más reciente con datos.
export const revalidate = 3600;

export async function GET() {
  try {
    const j = await fetch('https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json', { next: { revalidate } })
      .then((r) => r.json());
    const sols = (j.sols ?? []).filter((s) => typeof s.min_temp === 'number' && typeof s.max_temp === 'number');
    const ultimo = sols.at(-1) ?? null;
    return Response.json({
      fuente: 'NASA/JPL-Caltech/CAB · MEDA',
      ultimo,
      serie: sols.slice(-14).map((s) => ({ sol: Number(s.sol), min: s.min_temp, max: s.max_temp, presion: s.pressure })),
    });
  } catch (e) {
    return Response.json({ error: 'No se pudo obtener el clima de MEDA' }, { status: 502 });
  }
}
