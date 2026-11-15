'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CAPAS_BASE, EVA, analizarRuta, formatoHoras } from '../lib/marte';
import { cargarTerreno, muestrear, clasePendiente, peligroCercano, CLASES } from '../lib/terreno';
import Perfil from './Perfil';
import VistaSuperficie from './VistaSuperficie';
import Clima from './Clima';

const MapaMarte = dynamic(() => import('./MapaMarte'), {
  ssr: false,
  loading: () => <div className="mapa cargando">Conectando con Mars Trek…</div>,
});

const UTILS_TERRENO = { muestrear, clasePendiente, peligroCercano };
const VEREDICTO = {
  ok: { texto: 'Dentro de márgenes', clase: 'seguro' },
  info: { texto: 'Revisar antes de salir', clase: 'sd' },
  alerta: { texto: 'Con precaución', clase: 'precaucion' },
  critico: { texto: 'No segura', clase: 'peligro' },
};
const ORDEN = ['ok', 'info', 'alerta', 'critico'];
const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`);

export default function Planificador({ activo = true, onMapa, onVistaOrbital }) {
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
    fetch('/api/rover')
      .then((r) => r.json())
      .then((j) => (j.error ? setErrorRover(j.error) : setRover(j)))
      .catch(() => setErrorRover('Sin conexión con la telemetría del rover'));
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
  const peor = analisis ? analisis.alertas.reduce((a, b) => (ORDEN.indexOf(b.nivel) > ORDEN.indexOf(a) ? b.nivel : a), 'ok') : null;

  return (
    <div className={`mesa ${capasAbiertas ? '' : 'mesa-sin-capas'} ${activo ? 'mesa-activa' : ''}`} ref={mesa}>
      <div className="mesa-barra" role="toolbar" aria-label="Herramientas de ruta" data-entrada style={{ '--i': 0 }}>
        <button type="button" className="boton boton-texto" aria-expanded={capasAbiertas} aria-controls="panel-capas" onClick={() => setCapasAbiertas((v) => !v)}>
          {capasAbiertas ? 'Ocultar capas' : 'Capas'}
        </button>
        <span className="mesa-titulo">Cráter Jezero</span>
        {onVistaOrbital && (
          <button type="button" className="boton boton-texto" onClick={onVistaOrbital}>Vista orbital</button>
        )}
        <div className="mesa-herramientas">
          <button type="button" className={`boton ${planificando ? 'primario' : 'secundario'}`} aria-pressed={planificando} onClick={() => setPlanificando((p) => !p)}>
            {planificando ? 'Terminar trazado' : 'Trazar ruta'}
          </button>
          <button type="button" className="boton secundario" onClick={() => setRuta((r) => r.slice(0, -1))} disabled={!ruta.length}>Deshacer</button>
          <button type="button" className="boton secundario" onClick={() => setRuta([])} disabled={!ruta.length}>Limpiar</button>
          <button type="button" className="boton secundario" onClick={rutaSugerida} disabled={!rover}>Ruta sugerida</button>
        </div>
        <button type="button" className="boton boton-texto" onClick={pantallaCompleta}>
          {completa ? 'Salir de pantalla completa' : 'Pantalla completa'}
        </button>
      </div>

      <aside id="panel-capas" className="mesa-capas" hidden={!capasAbiertas} aria-label="Capas del mapa" data-entrada style={{ '--i': 1 }}>
        <section>
          <h3>Mapa base</h3>
          <div className="lista-capas" role="radiogroup" aria-label="Capa de datos">
            {CAPAS_BASE.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={c.id === capaId}
                className={`capa ${c.id === capaId ? 'activo' : ''}`} onClick={() => setCapaId(c.id)}>
                <span className="capa-nombre">{c.nombre}</span>
                <span className="capa-tipo">{c.tipo}</span>
              </button>
            ))}
          </div>
          <p className="nota">{capa?.fuente}</p>
          <label className="deslizador">
            <span>Opacidad</span>
            <input type="range" min="0" max="1" step="0.05" value={opacidad} onChange={(e) => setOpacidad(Number(e.target.value))} />
            <output>{Math.round(opacidad * 100)} %</output>
          </label>
        </section>

        <section>
          <h3>Sobre el mapa</h3>
          <label className="interruptor">
            <input type="checkbox" checked={verZonas} disabled={!terreno} onChange={(e) => setVerZonas(e.target.checked)} />
            <span>Zonas por pendiente <small>DTM CTX de USGS, 40 m</small></span>
          </label>
          {terreno === null && (
            <p className="nota">Todavía no hay modelo de terreno. Genéralo una vez con <code>node scripts/generar-terreno.mjs</code>.</p>
          )}
          <label className="interruptor">
            <input type="checkbox" checked={verRover} onChange={(e) => setVerRover(e.target.checked)} />
            <span>Recorrido de Perseverance <small>{rover ? `sol ${rover.solActual}, ${rover.distanciaTotalKm} km` : 'cargando'}</small></span>
          </label>
          <label className="interruptor">
            <input type="checkbox" checked={verNotas} onChange={(e) => setVerNotas(e.target.checked)} />
            <span>Hitos de la misión <small>notas del equipo de Mars 2020</small></span>
          </label>
          {errorRover && <p className="aviso">{errorRover}</p>}
        </section>

      </aside>

      <div className="mesa-mapa">
        <MapaMarte rover={rover} ruta={ruta} planificando={planificando} capaId={capaId} opacidad={opacidad}
          verRover={verRover} onPunto={agregarPunto} onWaypoint={elegirWaypoint} onMapa={onMapa}
          terreno={terreno || null} verZonas={verZonas} verNotas={verNotas}
          tramosPeligro={analisis?.tramosPeligro ?? []} cerca={analisis?.cerca ?? []} enfoque={enfoque} onCursor={alCursor} />
        {verZonas && terreno && (
          <div className="mapa-leyenda" data-entrada style={{ '--i': 3 }}>
            <p className="mapa-leyenda-titulo">Pendiente del terreno</p>
            <ul className="leyenda">
              {['peligro', 'precaucion', 'seguro'].map((k) => (
                <li key={k}><i className={`muestra muestra-${k}`} aria-hidden="true" /><span>{CLASES[k].nombre} <small>{CLASES[k].detalle}</small></span></li>
              ))}
            </ul>
          </div>
        )}
        {planificando && <p className="mapa-aviso" role="status">Haz clic en el mapa: el primer punto es el hábitat, los siguientes son paradas.</p>}
      </div>

      <aside className="mesa-ruta" aria-label="Análisis de la ruta" data-entrada style={{ '--i': 2 }}>
        <header className="ruta-cab">
          <h3>Ruta de la EVA</h3>
          <span className="nota">{ruta.length ? `${ruta.length} ${ruta.length === 1 ? 'punto' : 'puntos'}` : 'sin trazar'}</span>
        </header>

        {analisis ? (
          <>
            <p className={`veredicto veredicto-${VEREDICTO[peor].clase}`}>
              <i className={`muestra muestra-${VEREDICTO[peor].clase}`} aria-hidden="true" />{VEREDICTO[peor].texto}
            </p>

            <dl className="filas">
              <div><dt>Distancia</dt><dd>{fmtKm(analisis.km)}</dd></div>
              <div><dt>Caminata</dt><dd>{formatoHoras(analisis.horasCaminata)}</dd></div>
              {analisis.conTerreno && <div><dt>Desnivel</dt><dd>+{Math.round(analisis.sube)} m, −{Math.round(analisis.baja)} m</dd></div>}
              <div><dt>Radiación</dt><dd>{analisis.dosis.toFixed(3)} mSv <small>a {EVA.dosisMSvDia} mSv por día (RAD)</small></dd></div>
              <div><dt>Pendiente máxima</dt><dd>{analisis.pendienteMax != null ? `${analisis.pendienteMax.toFixed(0)}°` : 'sin dato'} <small>{analisis.conTerreno ? 'modelo de terreno' : `${Math.round(analisis.cobertura * 100)} % verificado por el rover`}</small></dd></div>
            </dl>

            {analisis.conTerreno && <Reparto reparto={analisis.reparto} km={analisis.km} />}

            <label className="deslizador">
              <span>Velocidad con traje</span>
              <input type="range" min="0.5" max="3" step="0.1" value={velocidad} onChange={(e) => setVelocidad(Number(e.target.value))} />
              <output>{velocidad.toFixed(1)} km/h</output>
            </label>
            <Consumibles uso={analisis.usoConsumibles} reserva={EVA.reservaRetorno} />

            <ul className="alertas">
              {analisis.alertas.map((a) => (
                <li key={a.texto} className={`alerta alerta-${a.nivel}`}>
                  <span className="alerta-signo" aria-hidden="true">{{ ok: '✓', info: 'i', alerta: '!', critico: '×' }[a.nivel]}</span>{a.texto}
                </li>
              ))}
            </ul>

            <Cercanias analisis={analisis} onEnfocar={setEnfoque} onWaypoint={elegirWaypoint} />
            <Perfil perfil={analisis.perfil} conTerreno={analisis.conTerreno} />
          </>
        ) : (
          <div className="ruta-vacia">
            <p>Marca el hábitat y las paradas con <b>Trazar ruta</b>. El panel calcula la distancia, el tiempo con traje, el soporte vital, la radiación y qué terreno cruzas.</p>
            <button type="button" className="boton secundario" onClick={rutaSugerida} disabled={!rover}>Cargar la ruta sugerida</button>
          </div>
        )}
        <Clima />
      </aside>

      <div className="mesa-estado" aria-live="off" data-entrada style={{ '--i': 3 }}>
        <span>{cursor?.lat != null ? `${cursor.lat.toFixed(5)}° N, ${cursor.lon.toFixed(5)}° E` : '18.44500° N, 77.40000° E'}</span>
        <span>Elevación {cursor?.elev != null ? `${cursor.elev} m` : 'sin dato'}</span>
        <span className="estado-pend">
          {cursor?.clase && <i className={`muestra muestra-${cursor.clase}`} aria-hidden="true" />}
          Pendiente {cursor?.pendiente != null ? `${cursor.pendiente.toFixed(1)}°` : 'sin dato'}
        </span>
        <Escala kmPx={cursor?.kmPx} />
      </div>

      <VistaSuperficie waypoint={waypoint} onCerrar={() => setWaypoint(null)} />
    </div>
  );
}

function Reparto({ reparto, km }) {
  const orden = ['seguro', 'precaucion', 'peligro', 'sd'].filter((k) => reparto[k] > 0);
  return (
    <figure className="reparto">
      <figcaption>Terreno que cruza la ruta</figcaption>
      <div className="reparto-barra" role="img" aria-label={orden.map((k) => `${CLASES[k].nombre}: ${fmtKm(reparto[k])}`).join('; ')}>
        {orden.map((k) => <i key={k} className={`muestra-${k}`} style={{ flexGrow: reparto[k] / km }} />)}
      </div>
      <ul>
        {orden.map((k) => <li key={k}><i className={`muestra muestra-${k}`} aria-hidden="true" />{CLASES[k].nombre} <b>{fmtKm(reparto[k])}</b></li>)}
      </ul>
    </figure>
  );
}

function Cercanias({ analisis, onEnfocar, onWaypoint }) {
  const items = [
    ...analisis.tramosPeligro.map((t) => ({
      clave: `t${t.desdeKm}`, clase: 'peligro', km: t.desdeKm,
      texto: `Cruza pendiente de ${t.maxPend.toFixed(0)}°`, detalle: `km ${t.desdeKm.toFixed(2)} a ${t.hastaKm.toFixed(2)}`,
      accion: () => onEnfocar({ lat: t.lat, lon: t.lon, t: Date.now() }),
    })),
    ...analisis.cerca.map((c) => ({
      clave: `c${c.lat}`, clase: 'precaucion', km: c.km,
      texto: `Pendiente de ${c.pendiente.toFixed(0)}° a ${Math.round(c.distM)} m`, detalle: `junto al km ${c.km.toFixed(2)}`,
      accion: () => onEnfocar({ lat: c.lat, lon: c.lon, t: Date.now() }),
    })),
    ...analisis.puntosInteres.map((w) => ({
      clave: `w${w.sol}${w.lat}`, clase: 'nota', km: w.km,
      texto: w.nota, detalle: `sol ${w.sol}, a ${Math.round(w.distM)} m del km ${w.km.toFixed(2)}`,
      accion: () => { onEnfocar({ lat: w.lat, lon: w.lon, t: Date.now() }); onWaypoint(w); },
    })),
  ].sort((a, b) => a.km - b.km);

  return (
    <section className="cercanias">
      <h4>Dentro o cerca de la ruta</h4>
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
        <p className="nota">{analisis.conTerreno ? 'Nada a menos de 250 m: ni pendientes de más de 15° ni hitos de la misión.' : 'Genera el modelo de terreno para ver pendientes cercanas.'}</p>
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
  const pct = Math.min(uso, 1);
  const nivel = uso > 1 - reserva ? 'peligro' : uso > (1 - reserva) * 0.8 ? 'precaucion' : 'seguro';
  return (
    <div className="consumibles">
      <div className="consumibles-cab">
        <span>Soporte vital, ida</span>
        <span>{Math.round(uso * 100)} % de {EVA.autonomiaH} h</span>
      </div>
      <div className="barra" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(uso * 100)} aria-label="Uso de soporte vital">
        <div className={`barra-relleno muestra-${nivel}`} style={{ transform: `scaleX(${pct})` }} />
        <div className="barra-reserva" style={{ left: `${(1 - reserva) * 100}%` }} title="Reserva para el retorno" />
      </div>
    </div>
  );
}
