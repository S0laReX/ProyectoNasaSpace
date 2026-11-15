// Una sola petición a /api/rover compartida por todos los componentes de la página.
let pendiente = null;

export function obtenerRover() {
  if (!pendiente) {
    pendiente = fetch('/api/rover')
      .then((r) => r.json())
      .catch((e) => {
        pendiente = null; // permitir reintentar si falló la red
        throw e;
      });
  }
  return pendiente;
}
