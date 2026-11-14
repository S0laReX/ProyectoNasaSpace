// Imágenes raw de Perseverance para un sol: vista "punto de vista" del lugar.
export const dynamic = 'force-dynamic';

const CAMARAS_UTILES = /NAVCAM|MCZ|HAZ|SHERLOC_WATSON|SUPERCAM_RMI/;

export async function GET(request) {
  const sol = Number(new URL(request.url).searchParams.get('sol'));
  if (!Number.isInteger(sol) || sol < 0 || sol > 10000) return Response.json({ error: 'sol inválido' }, { status: 400 });
  const url = 'https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json'
    + `&num=50&page=0&order=sol+desc&condition_2=${sol}:sol:gte&condition_3=${sol}:sol:lte`;
  try {
    const j = await fetch(url, { next: { revalidate: 86400 } }).then((r) => r.json());
    const imagenes = (j.images ?? [])
      .filter((i) => CAMARAS_UTILES.test(i.camera?.instrument ?? ''))
      .slice(0, 12)
      .map((i) => ({
        url: i.image_files?.medium ?? i.image_files?.small,
        grande: i.image_files?.large ?? i.image_files?.full_res,
        camara: i.camera?.instrument,
        titulo: i.title,
        fecha: i.date_taken_utc,
      }));
    return Response.json({ sol, total: j.total_results ?? 0, imagenes });
  } catch {
    return Response.json({ error: 'No se pudieron obtener imágenes' }, { status: 502 });
  }
}
