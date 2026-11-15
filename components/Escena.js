'use client';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { m } from 'motion/react';
import Globo from './Globo';
import Planificador from './Planificador';
import Telemetria from './Telemetria';
import GuiaPacha from './GuiaPacha';
import { CAPAS_BASE, ETIQUETAS_ESCALA, JEZERO, ZONA_EVA, ZOOM_FUNDIDO } from '../lib/marte';
import { estacion, horaTexto, tiempoMarte } from '../lib/tiempo-marte';
import { useIdioma } from './Idioma';

// La experiencia principal en una sola escena: el planeta termina de acercarse y se convierte
// en el mapa de trabajo. Fases:
//   orbita → descenso (globo) → fundido (600 ms, globo y mapa con el mismo encuadre)
//   → acercamiento (Leaflet vuela a la zona de EVA) → mapa (la interfaz entra escalonada)
// y de vuelta con Vista orbital: alejamiento → fundido → ascenso → orbita.
const PREFERENCIA = 'marswalk.sitio';
const FUNDIDO_MS = 600;

// Entrada de la portada: el título (hero.titulo) sube palabra por palabra detrás de una máscara y el resto le sigue.
const ENTRADA = { visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } } };
const PALABRA = { oculto: { y: '110%' }, visible: { y: '0%', transition: { duration: 0.9, ease: [0.19, 1, 0.22, 1] } } };
const PIEZA = { oculto: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } } };

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const volar = (mapa, centro, zoom, duracion) => new Promise((listo) => {
  if (duracion === 0) { mapa.setView(centro, zoom, { animate: false }); listo(); return; }
  mapa.once('moveend', () => listo());
  mapa.flyTo(centro, zoom, { duration: duracion, easeLinearity: 0.2 });
});
const leerPreferencia = () => { try { return localStorage.getItem(PREFERENCIA); } catch { return null; } };
const guardarPreferencia = (v) => { try { v ? localStorage.setItem(PREFERENCIA, v) : localStorage.removeItem(PREFERENCIA); } catch { /* sin almacenamiento */ } };

export default function Escena() {
  const { t, idioma } = useIdioma();
  const tActual = useRef(t);
  tActual.current = t;
  const etiquetasMapa = useRef(null); // { L, marcadores: [{ id, marcador }] } para traducirlas al cambiar de idioma
  const [fase, setFase] = useState('orbita');
  const escena = useRef(null);
  const globo = useRef(null);
  const mapa = useRef(null);
  const ocupado = useRef(false);
  const reducido = useRef(false);
  // Cada transición toma un turno. Si otra la reemplaza (p. ej. Saltar intro a mitad del
  // descenso), la anterior ve que su turno caducó y no toca la fase al despertar.
  const turno = useRef(0);
  const [esperandoMapa, setEsperandoMapa] = useState(false);
  const esperando = useRef(false);
  esperando.current = esperandoMapa;
  const saltarPendiente = useRef(false);

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
    if (ocupado.current) return;
    // Leaflet todavía cargando: se recuerda el pedido y alMapa lo lanza en cuanto el mapa existe.
    if (!mapa.current) { setEsperandoMapa(true); return; }
    setEsperandoMapa(false);
    ocupado.current = true;
    const mio = ++turno.current;
    const vigente = () => turno.current === mio;
    const lento = reducido.current;
    // El globo termina centrado en JEZERO: el mapa espera en el mismo punto y escala.
    mapa.current.setView([JEZERO.lat, JEZERO.lon], ZOOM_FUNDIDO, { animate: false });
    precargar();
    setFase('descenso');
    await globo.current?.descender({ zoom: ZOOM_FUNDIDO, duracion: lento ? 0 : 3200 });
    if (!vigente()) return;
    setFase('fundido');
    await esperar(lento ? 0 : FUNDIDO_MS);
    if (!vigente()) return;
    globo.current?.pausar();
    setFase('acercamiento');
    await volar(mapa.current, destino(), ZONA_EVA.zoom, lento ? 0 : 2.6);
    if (!vigente()) return;
    setFase('mapa');
    guardarPreferencia('jezero');
    ocupado.current = false;
  }, [destino, precargar]);

  const saltar = useCallback(() => {
    // Mapa aún cargando: se recuerda el pedido y alMapa salta en cuanto existe.
    if (!mapa.current) { saltarPendiente.current = true; return; }
    saltarPendiente.current = false;
    // Invalida cualquier transición en curso: su promesa puede no resolverse nunca
    // (pausar() detiene la animación del globo) y no debe dejar `ocupado` trabado.
    turno.current++;
    ocupado.current = false;
    globo.current?.pausar();
    mapa.current.setView(destino(), ZONA_EVA.zoom, { animate: false });
    setFase('mapa');
    guardarPreferencia('jezero');
  }, [destino]);

  const vistaOrbital = useCallback(async () => {
    if (ocupado.current || !mapa.current) return;
    ocupado.current = true;
    const mio = ++turno.current;
    const vigente = () => turno.current === mio;
    const lento = reducido.current;
    setFase('alejamiento');
    await volar(mapa.current, [JEZERO.lat, JEZERO.lon], ZOOM_FUNDIDO, lento ? 0 : 2.2);
    if (!vigente()) return;
    globo.current?.colocarAbajo({ zoom: ZOOM_FUNDIDO });
    globo.current?.reanudar();
    setFase('subida');
    await esperar(lento ? 0 : FUNDIDO_MS);
    if (!vigente()) return;
    setFase('ascenso');
    await globo.current?.ascender({ duracion: lento ? 0 : 2600 });
    if (!vigente()) return;
    setFase('orbita');
    guardarPreferencia(null);
    ocupado.current = false;
  }, []);

  // El mapa avisa cuando existe: si ya se eligió el sitio antes, o se pidió menos movimiento, ir directo.
  const alMapa = useCallback((m, L) => {
    mapa.current = m;
    const capa = L.layerGroup().addTo(m);
    const marcadores = ETIQUETAS_ESCALA.map((e) => ({
      id: e.id,
      marcador: L.marker([e.lat, e.lon], { interactive: false, keyboard: false, icon: iconoEtiqueta(L, e.id, tActual.current) }).addTo(capa),
    }));
    etiquetasMapa.current = { L, marcadores };
    // Etiquetas por escala: región, cráter, zona. Se cambia un atributo; el CSS decide qué se ve.
    const escala = () => {
      const z = m.getZoom();
      escena.current?.setAttribute('data-escala', z < 8 ? 'region' : z < 11.5 ? 'crater' : 'zona');
    };
    m.on('zoom', escala);
    escala();
    if (reducido.current || saltarPendiente.current || leerPreferencia() === 'jezero') saltar();
    else if (esperando.current) iniciar();
  }, [saltar, iniciar]);

  // Las etiquetas de Leaflet se crean una vez: al cambiar de idioma se les cambia el icono.
  useEffect(() => {
    const e = etiquetasMapa.current;
    if (!e) return;
    for (const { id, marcador } of e.marcadores) marcador.setIcon(iconoEtiqueta(e.L, id, t));
  }, [t]);

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
    <section id="inicio" ref={escena} className={`escena escena-${fase}`} data-escala="region" aria-label={t('hero.escena')}>
      {/* El encabezado del mapa va dentro de su capa: en la órbita queda inerte y el primer
          encabezado accesible es el h1 de la portada; en el mapa, este h2 precede a los h3 de los paneles. */}
      <div className="escena-capa-mapa" id="mapa" inert={!enMapa}>
        <h2 className="visually-hidden">{t('hero.mapaTitulo')}</h2>
        <p className="visually-hidden">{t('hero.mapaAyuda')}</p>
        <Planificador activo={enMapa} onMapa={alMapa} onVistaOrbital={vistaOrbital} />
      </div>

      <div className={`escena-capa-globo ${hayGlobo ? '' : 'oculto'}`}>
        <Globo ref={globo} interactivo={fase === 'orbita'} onElegir={iniciar} />
      </div>

      <m.div className="escena-capa-orbita" inert={fase !== 'orbita'} initial="oculto" animate="visible" variants={ENTRADA}>
        <div className="orbita-texto">
          <m.h1 variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
            {t('hero.titulo').map(([texto, clase], i) => (
              <Fragment key={`${idioma}-${i}`}>
                <span className="palabra"><m.span className={clase} variants={PALABRA}>{texto}</m.span></span>{' '}
              </Fragment>
            ))}
          </m.h1>
          <m.p className="lead" variants={PIEZA}>{t('hero.lead')}</m.p>
          <m.div className="hero-cta" variants={PIEZA}>
            <button type="button" className="boton primario" onClick={iniciar} aria-busy={esperandoMapa || undefined}>
              {esperandoMapa ? t('hero.preparando') : t('hero.iniciar')}
            </button>
            <a href="#datos" className="boton secundario">{t('hero.verDatos')}</a>
          </m.div>
        </div>
        <m.div variants={PIEZA}><Telemetria /></m.div>
        <m.div variants={PIEZA}><RelojMarte /></m.div>
        <m.a href="#mision" className="desliza" variants={PIEZA}>{t('hero.bajar')}</m.a>
      </m.div>

      {/* Pacha llega rodando y saluda: invita a tocar el planeta. Solo existe en la órbita. */}
      {fase === 'orbita' && (
        <GuiaPacha className="guia-orbita" clave="orbita" tam={150} mensajes={t('pacha.orbita')} />
      )}

      {(fase === 'orbita' || fase === 'descenso') && (
        <button type="button" className="boton boton-texto saltar" onClick={saltar}>
          {t('hero.saltar')} <kbd>Esc</kbd>
        </button>
      )}
      <p className="visually-hidden" role="status">
        {['descenso', 'acercamiento', 'mapa', 'ascenso'].includes(fase) ? t(`hero.estado.${fase}`) : ''}
      </p>
    </section>
  );
}

// Instrumentos de la vista orbital: hora y estación en Jezero ahora mismo (Mars24) y cómo usar el globo.
function RelojMarte() {
  const { t: tr, idioma } = useIdioma();
  const [t, setT] = useState(null);
  useEffect(() => {
    const leer = () => setT(tiempoMarte(new Date(), JEZERO.lon));
    leer();
    const id = setInterval(leer, 10000); // un minuto marciano dura 61.6 s
    return () => clearInterval(id);
  }, []);
  return (
    <aside className="reloj-marte" aria-label={tr('reloj.aria')}>
      <dl>
        <div><dt>{tr('reloj.hora')}</dt><dd>{t ? `${horaTexto(t.lmst)} LMST` : tr('reloj.calculando')}</dd></div>
        <div><dt>{tr('reloj.estacion')}</dt><dd>{t ? `${tr(`estaciones.${estacion(t.ls)}`)}, Ls ${Math.round(t.ls)}°` : tr('reloj.calculando')}</dd></div>
        <div><dt>{tr('reloj.fecha')}</dt><dd>{t ? Math.floor(t.msd).toLocaleString(idioma) : tr('reloj.calculando')}</dd></div>
      </dl>
      <p>{tr('reloj.ayuda')}</p>
    </aside>
  );
}

function iconoEtiqueta(L, id, t) {
  const texto = String(t(`etiquetas.${id}`)).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  return L.divIcon({ className: `etiqueta-escala etiqueta-mapa etq-${id}`, html: texto, iconSize: null });
}
