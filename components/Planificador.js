'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import GuiaPacha from './GuiaPacha';
import { CAPAS_BASE, EVA, analizarRuta, formatoHoras } from '../lib/marte';
import { cargarTerreno, muestrear, clasePendiente, peligroCercano, UMBRAL_PRECAUCION } from '../lib/terreno';
import Perfil from './Perfil';
import VistaSuperficie from './VistaSuperficie';
import Clima from './Clima';
import { obtenerRover } from '../lib/rover-cliente';
import { useIdioma } from './Idioma';

const MapaMarte = dynamic(() => import('./MapaMarte'), {
  ssr: false,
  loading: () => <CargandoMapa />,
});

const UTILS_TERRENO = { muestrear, clasePendiente, peligroCercano };
// Clase visual de cada nivel de veredicto; el texto está en ruta.veredicto.<nivel>.
const VEREDICTO = { ok: 'seguro', info: 'sd', alerta: 'precaucion', critico: 'peligro' };
// Datos de las clases de pendiente para los textos (umbral de precaución y de no seguro).
const UMBRALES = { a: UMBRAL_PRECAUCION, b: EVA.pendienteMaxGrados };
const ORDEN = ['ok', 'info', 'alerta', 'critico'];
const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`);

export default function Planificador({ activo = true, onMapa, onVistaOrbital }) {
  const { t } = useIdioma();
  const [rover, setRover] = useState(null);
  const [errorRover, setErrorRover] = useState(null);
  const [terreno, setTerreno] = useState(undefined); // undefined: cargando · null: no generado
  const [capaId, setCapaId] = useState('hirise');
  const [opacidad, setOpacidad] = useState(1);
  const [verRover, setVerRover] = useState(true);
  const [verZonas, setVerZonas] = useState(true);
  const [verNotas, setVerNotas] = useState(true);
  const [planificando, setPlanificando] = useState(false);
  const [ruta, setRuta] = useState([]);
  const [velocidad, setVelocidad] = useState(EVA.velocidadKmH);
  const [waypoint, setWaypoint] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [enfoque, setEnfoque] = useState(null);
  const [capasAbiertas, setCapasAbiertas] = useState(true);
  const [completa, setCompleta] = useState(false);
  const mesa = useRef(null);

  useEffect(() => {
    obtenerRover()
      .then(setRover)
      .catch((e) => setErrorRover(e.message?.startsWith('No se pudo') ? 'rover' : 'sinConexion'));
    cargarTerreno().then(setTerreno);
  }, []);

  useEffect(() => {
    const alCambiar = () => setCompleta(document.fullscreenElement === mesa.current);
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  const agregarPunto = useCallback((p) => setRuta((r) => [...r, p]), []);
  const elegirWaypoint = useCallback((w) => setWaypoint(w), []);
  const alCursor = useCallback((c) => setCursor(c), []);

  const rutaSugerida = () => {
    if (!rover) return;
    // Seguir el tramo más reciente del rover: terreno ya verificado en superficie
    const wps = rover.waypoints;
    const tramo = wps.slice(Math.max(0, wps.length - 60));
    const paso = Math.max(1, Math.floor(tramo.length / 6));
    setRuta(tramo.filter((_, i) => i % paso === 0).map((w) => [w.lat, w.lon]));
    setPlanificando(false);
  };

  const pantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else mesa.current?.requestFullscreen?.().catch(() => {});
  };

  const analisis = useMemo(
    () => (rover && ruta.length > 1
      ? analizarRuta(ruta, rover.waypoints, { ...EVA, velocidadKmH: velocidad }, terreno || null, terreno ? UTILS_TERRENO : null)
      : null),
    [ruta, rover, velocidad, terreno],
  );
  const capa = CAPAS_BASE.find((c) => c.id === capaId);
  // Lo que Pacha cuenta según lo que estás haciendo (orienta; los veredictos están en el panel).
  const contexto = planificando ? (ruta.length ? 'trazando' : 'habitat') : analisis ? 'analisis' : 'inicio';
  const guia = { clave: contexto, estado: planificando ? 'buscando' : 'quieto', mensajes: t(`pacha.mapa.${contexto}`) };

  const peor = analisis ? analisis.alertas.reduce((a, b) => (ORDEN.indexOf(b.nivel) > ORDEN.indexOf(a) ? b.nivel : a), 'ok') : null;

  return (
    <div className={`mesa ${capasAbiertas ? '' : 'mesa-sin-capas'} ${activo ? 'mesa-activa' : ''}`} ref={mesa}>
      <div className="mesa-barra" role="toolbar" aria-label={t('mesa.herramientas')} data-entrada style={{ '--i': 0 }}>
        <button type="button" className="boton boton-texto" aria-expanded={capasAbiertas} aria-controls="panel-capas" onClick={() => setCapasAbiertas((v) => !v)}>
          {capasAbiertas ? t('mesa.ocultarCapas') : t('mesa.capas')}
        </button>
        <span className="mesa-titulo">{t('mesa.titulo')}</span>
        {onVistaOrbital && (
          <button type="button" className="boton boton-texto" onClick={onVistaOrbital}>{t('mesa.orbital')}</button>
        )}
        <div className="mesa-herramientas">
          <button type="button" className={`boton ${planificando ? 'primario' : 'secundario'}`} aria-pressed={planificando} onClick={() => setPlanificando((p) => !p)}>
            {planificando ? t('mesa.terminar') : t('mesa.trazar')}
          </button>
          <button type="button" className="boton secundario" onClick={() => setRuta((r) => r.slice(0, -1))} disabled={!ruta.length}>{t('mesa.deshacer')}</button>
          <button type="button" className="boton secundario" onClick={() => setRuta([])} disabled={!ruta.length}>{t('mesa.limpiar')}</button>
          <button type="button" className="boton secundario" onClick={rutaSugerida} disabled={!rover}>{t('mesa.sugerida')}</button>
        </div>
        <button type="button" className="boton boton-texto" onClick={pantallaCompleta}>
          {completa ? t('mesa.salirCompleta') : t('mesa.completa')}
        </button>
      </div>

      <aside id="panel-capas" className="mesa-capas" hidden={!capasAbiertas} aria-label={t('capas.aria')} data-entrada style={{ '--i': 1 }}>
        <section>
          <h3>{t('capas.base')}</h3>
          <div className="lista-capas" role="radiogroup" aria-label={t('capas.grupo')}>
            {CAPAS_BASE.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={c.id === capaId}
                className={`capa ${c.id === capaId ? 'activo' : ''}`} onClick={() => setCapaId(c.id)}>
                <span className="capa-nombre">{t(`capas.${c.id}.nombre`)}</span>
                <span className="capa-tipo">{t(`capas.${c.id}.tipo`)}</span>
              </button>
            ))}
          </div>
          <p className="nota">{t(`capas.${capa?.id ?? 'hirise'}.fuente`)}</p>
          <label className="deslizador">
            <span>{t('capas.opacidad')}</span>
            <input type="range" min="0" max="1" step="0.05" value={opacidad} onChange={(e) => setOpacidad(Number(e.target.value))} />
            <output>{Math.round(opacidad * 100)} %</output>
          </label>
        </section>

        <section>
          <h3>{t('capas.sobre')}</h3>
          <label className="interruptor">
            <input type="checkbox" checked={verZonas} disabled={!terreno} onChange={(e) => setVerZonas(e.target.checked)} />
            <span>{t('capas.zonas')} <small>{t('capas.zonasFuente')}</small></span>
          </label>
          {terreno === null && (
            <p className="nota">{t('capas.sinTerreno')} <code>node scripts/generar-terreno.mjs</code>.</p>
          )}
          <label className="interruptor">
            <input type="checkbox" checked={verRover} onChange={(e) => setVerRover(e.target.checked)} />
            <span>{t('capas.recorrido')} <small>{rover ? t('capas.recorridoDato', { sol: rover.solActual, km: rover.distanciaTotalKm }) : t('capas.cargando')}</small></span>
          </label>
          <label className="interruptor">
            <input type="checkbox" checked={verNotas} onChange={(e) => setVerNotas(e.target.checked)} />
            <span>{t('capas.hitos')} <small>{t('capas.hitosFuente')}</small></span>
          </label>
          {errorRover && <p className="aviso">{t(`errores.${errorRover}`)}</p>}
        </section>

      </aside>

      <div className="mesa-mapa">
        <MapaMarte rover={rover} ruta={ruta} planificando={planificando} capaId={capaId} opacidad={opacidad}
          verRover={verRover} onPunto={agregarPunto} onWaypoint={elegirWaypoint} onMapa={onMapa}
          terreno={terreno || null} verZonas={verZonas} verNotas={verNotas}
          tramosPeligro={analisis?.tramosPeligro ?? []} cerca={analisis?.cerca ?? []} enfoque={enfoque} onCursor={alCursor} />
        {verZonas && terreno && (
          <div className="mapa-leyenda" data-entrada style={{ '--i': 3 }}>
            <p className="mapa-leyenda-titulo">{t('leyenda.titulo')}</p>
            <ul className="leyenda">
              {['peligro', 'precaucion', 'seguro'].map((k) => (
                <li key={k}><i className={`muestra muestra-${k}`} aria-hidden="true" /><span>{t(`clases.${k}.nombre`)} <small>{t(`clases.${k}.detalle`, UMBRALES)}</small></span></li>
              ))}
            </ul>
          </div>
        )}
        {/* Pacha entra rodando al llegar al mapa y acompaña el trazado con consejos */}
        {activo && (
          <GuiaPacha className="guia-mapa" minimizable clave={guia.clave} mensajes={guia.mensajes}
            estado={guia.estado} reaccion={ruta.length} />
        )}
      </div>

      <aside className="mesa-ruta" aria-label={t('ruta.aria')} data-entrada style={{ '--i': 2 }}>
        <header className="ruta-cab">
          <h3>{t('ruta.titulo')}</h3>
          <span className="nota">{t('ruta.puntos', { n: ruta.length })}</span>
        </header>

        <AnimatePresence mode="wait" initial={false}>
        {analisis ? (
          <m.div key="analisis" className="ruta-analisis"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {/* El veredicto cambia con un fundido corto: el cambio de estado se nota sin sobresalto */}
            <AnimatePresence mode="wait" initial={false}>
              <m.p key={peor} className={`veredicto veredicto-${VEREDICTO[peor]}`}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.22 }}>
                <i className={`muestra muestra-${VEREDICTO[peor]}`} aria-hidden="true" />{t(`ruta.veredicto.${peor}`)}
              </m.p>
            </AnimatePresence>

            <dl className="filas">
              <div><dt>{t('ruta.distancia')}</dt><dd>{fmtKm(analisis.km)}</dd></div>
              <div><dt>{t('ruta.caminata')}</dt><dd>{formatoHoras(analisis.horasTotales)} <small>{analisis.cerrada ? t('ruta.cerrada') : t('ruta.ida', { h: formatoHoras(analisis.horasCaminata) })}</small></dd></div>
              {analisis.conTerreno && <div><dt>{t('ruta.desnivel')}</dt><dd>+{Math.round(analisis.sube)} m, −{Math.round(analisis.baja)} m</dd></div>}
              <div><dt>{t('ruta.radiacion')}</dt><dd>{analisis.dosis.toFixed(3)} mSv <small>{t('ruta.radiacionRef', { d: EVA.dosisMSvDia })}</small></dd></div>
              <div><dt>{t('ruta.pendienteMax')}</dt><dd>{analisis.pendienteMax != null ? `${analisis.pendienteMax.toFixed(0)}°` : t('ruta.sinDato')} <small>{analisis.conTerreno ? t('ruta.modelo') : t('ruta.verificado', { p: Math.round(analisis.cobertura * 100) })}</small></dd></div>
            </dl>

            {analisis.conTerreno && <Reparto reparto={analisis.reparto} km={analisis.km} />}

            <label className="deslizador">
              <span>{t('ruta.velocidad')}</span>
              <input type="range" min="0.5" max="3" step="0.1" value={velocidad} onChange={(e) => setVelocidad(Number(e.target.value))} />
              <output>{velocidad.toFixed(1)} km/h</output>
            </label>
            <Consumibles uso={analisis.usoConsumibles} reserva={EVA.reservaSeguridad} />

            {/* Los avisos entran y salen al cambiar la ruta; los que quedan se reacomodan con `layout` */}
            <ul className="alertas">
              <AnimatePresence initial={false} mode="popLayout">
                {analisis.alertas.map((a) => (
                  <m.li key={`${a.codigo}:${JSON.stringify(a.datos)}`} layout className={`alerta alerta-${a.nivel}`}
                    initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                    <span className="alerta-signo" aria-hidden="true">{{ ok: '✓', info: 'i', alerta: '!', critico: '×' }[a.nivel]}</span>{t(`alertas.${a.codigo}`, a.datos)}
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>

            <Cercanias analisis={analisis} onEnfocar={setEnfoque} onWaypoint={elegirWaypoint} />
            <Perfil perfil={analisis.perfil} conTerreno={analisis.conTerreno} />
          </m.div>
        ) : (
          <m.div key="vacia" className="ruta-vacia"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <p>{t('ruta.vaciaAntes')} <b>{t('mesa.trazar')}</b>{t('ruta.vaciaDespues')}</p>
            <button type="button" className="boton secundario" onClick={rutaSugerida} disabled={!rover}>{t('ruta.cargarSugerida')}</button>
          </m.div>
        )}
        </AnimatePresence>
        <Clima />
      </aside>

      <div className="mesa-estado" aria-live="off" data-entrada style={{ '--i': 3 }}>
        <span>{cursor?.lat != null ? `${cursor.lat.toFixed(5)}° N, ${cursor.lon.toFixed(5)}° E` : '18.44500° N, 77.40000° E'}</span>
        <span>{t('ruta.estado.elevacion')} {cursor?.elev != null ? `${cursor.elev} m` : t('ruta.estado.sinDato')}</span>
        <span className="estado-pend">
          {cursor?.clase && <i className={`muestra muestra-${cursor.clase}`} aria-hidden="true" />}
          {t('ruta.estado.pendiente')} {cursor?.pendiente != null ? `${cursor.pendiente.toFixed(1)}°` : t('ruta.estado.sinDato')}
        </span>
        <Escala kmPx={cursor?.kmPx} />
      </div>

      <VistaSuperficie waypoint={waypoint} onCerrar={() => setWaypoint(null)} />
    </div>
  );
}

function CargandoMapa() {
  const { t } = useIdioma();
  return <div className="mapa cargando" role="status">{t('mesa.cargandoMapa')}</div>;
}

function Reparto({ reparto, km }) {
  const { t } = useIdioma();
  const orden = ['seguro', 'precaucion', 'peligro', 'sd'].filter((k) => reparto[k] > 0);
  return (
    <figure className="reparto">
      <figcaption>{t('ruta.reparto')}</figcaption>
      <div className="reparto-barra" role="img" aria-label={orden.map((k) => `${t(`clases.${k}.nombre`)}: ${fmtKm(reparto[k])}`).join('; ')}>
        {orden.map((k) => <i key={k} className={`muestra-${k}`} style={{ flexGrow: reparto[k] / km }} />)}
      </div>
      <ul>
        {orden.map((k) => <li key={k}><i className={`muestra muestra-${k}`} aria-hidden="true" />{t(`clases.${k}.nombre`)} <b>{fmtKm(reparto[k])}</b></li>)}
      </ul>
    </figure>
  );
}

function Cercanias({ analisis, onEnfocar, onWaypoint }) {
  const { t } = useIdioma();
  const items = [
    ...analisis.tramosPeligro.map((tr) => ({
      clave: `t${tr.desdeKm}`, clase: 'peligro', km: tr.desdeKm,
      texto: t('ruta.cercanias.cruza', { g: tr.maxPend.toFixed(0) }), detalle: t('ruta.cercanias.tramo', { a: tr.desdeKm.toFixed(2), b: tr.hastaKm.toFixed(2) }),
      accion: () => onEnfocar({ lat: tr.lat, lon: tr.lon, t: Date.now() }),
    })),
    ...analisis.cerca.map((c) => ({
      clave: `c${c.lat},${c.lon}`, clase: 'precaucion', km: c.km,
      texto: t('ruta.cercanias.cerca', { g: c.pendiente.toFixed(0), m: Math.round(c.distM) }), detalle: t('ruta.cercanias.junto', { km: c.km.toFixed(2) }),
      accion: () => onEnfocar({ lat: c.lat, lon: c.lon, t: Date.now() }),
    })),
    ...analisis.puntosInteres.map((w) => ({
      clave: `w${w.sol},${w.lat},${w.lon}`, clase: 'nota', km: w.km,
      texto: w.nota, detalle: t('ruta.cercanias.hito', { sol: w.sol, m: Math.round(w.distM), km: w.km.toFixed(2) }),
      accion: () => { onEnfocar({ lat: w.lat, lon: w.lon, t: Date.now() }); onWaypoint(w); },
    })),
  ].sort((a, b) => a.km - b.km);

  return (
    <section className="cercanias">
      <h4>{t('ruta.cercanias.titulo')}</h4>
      {items.length ? (
        <ul>
          {items.map((it) => (
            <li key={it.clave}>
              <button type="button" onClick={it.accion}>
                <i className={`muestra muestra-${it.clase}`} aria-hidden="true" />
                <span>{it.texto}<small>{it.detalle}</small></span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="nota">{analisis.conTerreno ? t('ruta.cercanias.nada') : t('ruta.cercanias.sinModelo')}</p>
      )}
    </section>
  );
}

function Escala({ kmPx }) {
  if (!kmPx) return <span className="escala" />;
  const objetivo = kmPx * 90;
  const pasos = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  const km = pasos.reduce((a, b) => (Math.abs(b - objetivo) < Math.abs(a - objetivo) ? b : a));
  return (
    <span className="escala">
      <i style={{ width: `${km / kmPx}px` }} aria-hidden="true" />
      {km < 1 ? `${km * 1000} m` : `${km} km`}
    </span>
  );
}

function Consumibles({ uso, reserva }) {
  const { t } = useIdioma();
  const pct = Math.min(uso, 1);
  const nivel = uso > 1 - reserva ? 'peligro' : uso > (1 - reserva) * 0.8 ? 'precaucion' : 'seguro';
  return (
    <div className="consumibles">
      <div className="consumibles-cab">
        <span>{t('ruta.soporte')}</span>
        <span>{t('ruta.soporteUso', { p: Math.round(uso * 100), h: EVA.autonomiaH })}</span>
      </div>
      <div className="barra" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(uso * 100)} aria-label={t('ruta.soporteAria')}>
        <div className={`barra-relleno muestra-${nivel}`} style={{ transform: `scaleX(${pct})` }} />
        <div className="barra-reserva" style={{ left: `${(1 - reserva) * 100}%` }} title={t('ruta.reserva')} />
      </div>
    </div>
  );
}
