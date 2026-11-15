// Clima en Jezero medido por MEDA (Perseverance). Devuelve el sol más reciente con datos.
// Ojo: el feed público dejó de actualizarse (último dato de abril de 2024); la interfaz lo dice.
export const revalidate = 3600;

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null); // el feed usa "--" sin dato

export async function GET() {
  try {
    const r = await fetch('https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json', { next: { revalidate } });
    if (!r.ok) throw new Error(`MEDA respondió ${r.status}`);
    const j = await r.json();
    const sols = (j.sols ?? []).filter((s) => numero(s.min_temp) != null && numero(s.max_temp) != null);
    const u = sols.at(-1);
    return Response.json({
      fuente: 'NASA/JPL-Caltech/CAB · MEDA',
      ultimo: u ? {
        sol: Number(u.sol),
        fecha: u.terrestrial_date ?? null,
        min: u.min_temp,
        max: u.max_temp,
        presion: numero(u.pressure),
        amanecer: u.sunrise ?? null,
        atardecer: u.sunset ?? null,
        ls: Number(u.ls),
        temporada: typeof u.season === 'string' ? u.season.toLowerCase() : null, // p. ej. "late autumn"; la interfaz la traduce
      } : null,
      serie: sols.slice(-14).map((s) => ({ sol: Number(s.sol), min: s.min_temp, max: s.max_temp })),
    });
  } catch {
    return Response.json({ error: 'No se pudo obtener el clima de MEDA' }, { status: 502 });
  }
}
