'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Globo from './Globo';
import Planificador from './Planificador';
import Telemetria from './Telemetria';
import { CAPAS_BASE, ETIQUETAS_ESCALA, JEZERO, ZONA_EVA, ZOOM_FUNDIDO } from '../lib/marte';
import { estacion, horaTexto, tiempoMarte } from '../lib/tiempo-marte';

// La experiencia principal en una sola escena: el planeta termina de acercarse y se convierte
// en el mapa de trabajo. Fases:
//   orbita → descenso (globo) → fundido (600 ms, globo y mapa con el mismo encuadre)
//   → acercamiento (Leaflet vuela a la zona de EVA) → mapa (la interfaz entra escalonada)
// y de vuelta con Vista orbital: alejamiento → fundido → ascenso → orbita.
const PREFERENCIA = 'marswalk.sitio';
const FUNDIDO_MS = 600;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const volar = (mapa, centro, zoom, duracion) => new Promise((listo) => {
  if (duracion === 0) { mapa.setView(centro, zoom, { animate: false }); listo(); return; }
  mapa.once('moveend', () => listo());
  mapa.flyTo(centro, zoom, { duration: duracion, easeLinearity: 0.2 });
});
const leerPreferencia = () => { try { return localStorage.getItem(PREFERENCIA); } catch { return null; } };
const guardarPreferencia = (v) => { try { v ? localStorage.setItem(PREFERENCIA, v) : localStorage.removeItem(PREFERENCIA); } catch { /* sin almacenamiento */ } };

export default function Escena() {
  const [fase, setFase] = useState('orbita');
  const escena = useRef(null);
  const globo = useRef(null);
  const mapa = useRef(null);
  const ocupado = useRef(false);
  const reducido = useRef(false);

  // Centro que deja la zona de EVA en el medio del área visible, entre los paneles.
  const destino = useCallback(() => {
    const m = mapa.current;
    const nodo = escena.current;
    if (!m || !nodo) return ZONA_EVA.centro;
    const ancho = (sel) => nodo.querySelector(sel)?.getBoundingClientRect().width ?? 0;
    const corrimiento = (ancho('.mesa-ruta') - ancho('.mesa-capas')) / 2;
    if (window.innerWidth < 1024) return ZONA_EVA.centro;
    const p = m.project(ZONA_EVA.centro, ZONA_EVA.zoom).add([corrimiento, 0]);
    return m.unproject(p, ZONA_EVA.zoom);
  }, []);

  // Precarga las teselas de llegada durante el vuelo para que el mapa no aparezca vacío.
  const precargar = useCallback(() => {
    const m = mapa.current;
    if (!m) return;
    const base = CAPAS_BASE[0];
    const { x: w, y: h } = m.getSize();
    for (const z of [ZONA_EVA.zoom - 1, ZONA_EVA.zoom]) {
      const c = m.project(ZONA_EVA.centro, z);
      const [x0, x1] = [Math.floor((c.x - w / 2) / 256), Math.floor((c.x + w / 2) / 256)];
      const [y0, y1] = [Math.floor((c.y - h / 2) / 256), Math.floor((c.y + h / 2) / 256)];
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const img = new Image();
          img.src = base.url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
        }
      }
    }
  }, []);

  const iniciar = useCallback(async () => {
    if (ocupado.current || !mapa.current) return;
    ocupado.current = true;
    const lento = reducido.current;
    // El globo termina centrado en JEZERO: el mapa espera en el mismo punto y escala.
    mapa.current.setView([JEZERO.lat, JEZERO.lon], ZOOM_FUNDIDO, { animate: false });
    precargar();
    setFase('descenso');
    await globo.current?.descender({ zoom: ZOOM_FUNDIDO, duracion: lento ? 0 : 3200 });
    setFase('fundido');
    await esperar(lento ? 0 : FUNDIDO_MS);
    globo.current?.pausar();
    setFase('acercamiento');
    await volar(mapa.current, destino(), ZONA_EVA.zoom, lento ? 0 : 2.6);
    setFase('mapa');
    guardarPreferencia('jezero');
    ocupado.current = false;
  }, [destino, precargar]);

  const saltar = useCallback(() => {
    if (!mapa.current) return;
    globo.current?.pausar();
    mapa.current.setView(destino(), ZONA_EVA.zoom, { animate: false });
    setFase('mapa');
    guardarPreferencia('jezero');
  }, [destino]);

  const vistaOrbital = useCallback(async () => {
    if (ocupado.current || !mapa.current) return;
    ocupado.current = true;
    const lento = reducido.current;
    setFase('alejamiento');
    await volar(mapa.current, [JEZERO.lat, JEZERO.lon], ZOOM_FUNDIDO, lento ? 0 : 2.2);
    globo.current?.colocarAbajo({ zoom: ZOOM_FUNDIDO });
    globo.current?.reanudar();
    setFase('subida');
    await esperar(lento ? 0 : FUNDIDO_MS);
    setFase('ascenso');
    await globo.current?.ascender({ duracion: lento ? 0 : 2600 });
    setFase('orbita');
    guardarPreferencia(null);
    ocupado.current = false;
  }, []);

  // El mapa avisa cuando existe: si ya se eligió el sitio antes, o se pidió menos movimiento, ir directo.
  const alMapa = useCallback((m, L) => {
    mapa.current = m;
    const capa = L.layerGroup().addTo(m);
    for (const e of ETIQUETAS_ESCALA) {
      L.marker([e.lat, e.lon], {
        interactive: false, keyboard: false,
        icon: L.divIcon({ className: `etiqueta-escala etiqueta-mapa etq-${e.id}`, html: e.texto, iconSize: null }),
      }).addTo(capa);
    }
    // Etiquetas por escala: región, cráter, zona. Se cambia un atributo; el CSS decide qué se ve.
    const escala = () => {
      const z = m.getZoom();
      escena.current?.setAttribute('data-escala', z < 8 ? 'region' : z < 11.5 ? 'crater' : 'zona');
    };
    m.on('zoom', escala);
    escala();
    if (reducido.current || leerPreferencia() === 'jezero') saltar();
  }, [saltar]);

  useEffect(() => {
    reducido.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Los estados ocultos (paneles, fundidos) solo existen cuando el script corre.
    document.documentElement.classList.add('js');
  }, []);

  // Esc salta la intro mientras el planeta está en pantalla.
  useEffect(() => {
    if (fase !== 'orbita' && fase !== 'descenso') return;
    const alTecla = (e) => { if (e.key === 'Escape') saltar(); };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [fase, saltar]);

  const enMapa = fase === 'mapa';
  const hayGlobo = ['orbita', 'descenso', 'subida', 'ascenso'].includes(fase);

  return (
    <section id="inicio" ref={escena} className={`escena escena-${fase}`} data-escala="region" aria-label="Mapa de Jezero">
      <h2 className="visually-hidden">Elige una capa, traza la ruta y revisa los riesgos.</h2>
      <p className="visually-hidden">Las zonas ámbar y rojas marcan la pendiente medida desde órbita. Toca un punto del recorrido del rover para ver el terreno desde el suelo.</p>
      <div className="escena-capa-mapa" id="mapa" inert={!enMapa}>
        <Planificador activo={enMapa} onMapa={alMapa} onVistaOrbital={vistaOrbital} />
      </div>

      <div className={`escena-capa-globo ${hayGlobo ? '' : 'oculto'}`}>
        <Globo ref={globo} interactivo={fase === 'orbita'} onElegir={iniciar} />
      </div>

      <div className="escena-capa-orbita" inert={fase !== 'orbita'}>
        <div className="orbita-texto">
          <h1>Camina Marte con datos.</h1>
          <p className="lead">Un mapa por capas de Jezero para planificar caminatas seguras.</p>
          <div className="hero-cta">
            <button type="button" className="boton primario" onClick={iniciar}>Iniciar misión</button>
            <a href="#datos" className="boton secundario">Ver los datos</a>
          </div>
        </div>
        <Telemetria />
        <RelojMarte />
        <a href="#mision" className="desliza">Bajar a la misión</a>
      </div>

      {(fase === 'orbita' || fase === 'descenso') && (
        <button type="button" className="boton boton-texto saltar" onClick={saltar}>
          Saltar intro <kbd>Esc</kbd>
        </button>
      )}
      <p className="visually-hidden" role="status">
        {{ descenso: 'Descendiendo hacia Jezero.', acercamiento: 'Llegando a la zona de EVA.', mapa: 'Mapa listo.', ascenso: 'Volviendo a la órbita.' }[fase] ?? ''}
      </p>
    </section>
  );
}

// Instrumentos de la vista orbital: hora y estación en Jezero ahora mismo (Mars24) y cómo usar el globo.
function RelojMarte() {
  const [t, setT] = useState(null);
  useEffect(() => {
    const leer = () => setT(tiempoMarte(new Date(), JEZERO.lon));
    leer();
    const id = setInterval(leer, 10000); // un minuto marciano dura 61.6 s
    return () => clearInterval(id);
  }, []);
  return (
    <aside className="reloj-marte" aria-label="Hora en Marte">
      <dl>
        <div><dt>Hora en Jezero</dt><dd>{t ? `${horaTexto(t.lmst)} LMST` : 'calculando'}</dd></div>
        <div><dt>Estación en el norte</dt><dd>{t ? `${estacion(t.ls)}, Ls ${Math.round(t.ls)}°` : 'calculando'}</dd></div>
        <div><dt>Fecha solar de Marte</dt><dd>{t ? Math.floor(t.msd).toLocaleString('es') : 'calculando'}</dd></div>
      </dl>
      <p>Arrastra el planeta para girarlo. Toca Jezero para descender. El lado iluminado es el de este momento.</p>
    </aside>
  );
}
