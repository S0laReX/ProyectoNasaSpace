// Telemetría del rover en el navegador: una sola petición compartida por todos los componentes
// (la portada y el planificador la pedían por separado). Si falla, se puede reintentar.
let pendiente = null;

export function obtenerRover() {
  if (!pendiente) {
    pendiente = fetch('/api/rover')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        return j;
      })
      .catch((e) => {
        pendiente = null; // la próxima llamada vuelve a intentar
        throw e;
      });
  }
  return pendiente;
}
