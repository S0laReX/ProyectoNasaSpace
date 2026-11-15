// Imágenes raw de Perseverance para un sol: vista "punto de vista" del lugar.
export const dynamic = 'force-dynamic';

const CAMARAS_UTILES = /NAVCAM|MCZ|HAZ|SHERLOC_WATSON|SUPERCAM_RMI/;
const QUIERO = 12;
const POR_PAGINA = 100;
const MAX_PAGINAS = 4; // algunos soles empiezan con cientos de fotos del cielo (SKYCAM)

export async function GET(request) {
  const sol = Number(new URL(request.url).searchParams.get('sol'));
  if (!Number.isInteger(sol) || sol < 0 || sol > 10000) return Response.json({ error: 'sol inválido' }, { status: 400 });
  const base = 'https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json'
    + `&num=${POR_PAGINA}&order=sol+desc&condition_2=${sol}:sol:gte&condition_3=${sol}:sol:lte`;
  try {
    // Se recorren páginas hasta juntar suficientes fotos del suelo, no solo la primera.
    const utiles = [];
    let total = 0;
    for (let pagina = 0; pagina < MAX_PAGINAS && utiles.length < QUIERO; pagina++) {
      const r = await fetch(`${base}&page=${pagina}`, { next: { revalidate: 86400 } });
      if (!r.ok) throw new Error(`NASA respondió ${r.status}`);
      const j = await r.json();
      total = j.total_results ?? 0;
      const lote = j.images ?? [];
      utiles.push(...lote.filter((i) => CAMARAS_UTILES.test(i.camera?.instrument ?? '') && (i.image_files?.medium || i.image_files?.small)));
      if ((pagina + 1) * POR_PAGINA >= total || lote.length === 0) break;
    }
    const imagenes = utiles.slice(0, QUIERO).map((i) => ({
      url: i.image_files.medium ?? i.image_files.small,
      grande: i.image_files.large ?? i.image_files.full_res ?? i.image_files.medium,
      camara: i.camera?.instrument,
      titulo: i.title,
      fecha: i.date_taken_utc,
    }));
    return Response.json({ sol, total, imagenes });
  } catch {
    return Response.json({ error: 'No se pudieron obtener imágenes' }, { status: 502 });
  }
}
