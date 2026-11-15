// Configuración de idiomas sin diccionarios: la usa el middleware, que debe ser liviano.
export const IDIOMAS = ['es', 'en'];
export const POR_DEFECTO = 'es';
export const COOKIE = 'marswalk.idioma';

/** Idioma preferido según la cabecera Accept-Language ("en-US,en;q=0.9,es;q=0.8"). */
export function idiomaDeCabecera(cabecera = '') {
  const pedidos = cabecera.split(',')
    .map((parte) => {
      const [etiqueta, ...params] = parte.trim().split(';');
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? 1);
      return { idioma: etiqueta.toLowerCase().slice(0, 2), q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);
  return pedidos.find((p) => IDIOMAS.includes(p.idioma))?.idioma ?? POR_DEFECTO;
}
