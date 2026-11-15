'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CAPAS_BASE, EVA, analizarRuta, formatoHoras } from '../lib/marte';
import { obtenerRover } from '../lib/rover';
import Perfil from './Perfil';
import VistaSuperficie from './VistaSuperficie';
import Clima from './Clima';

const MapaMarte = dynamic(() => import('./MapaMarte'), {
  ssr: false,
  loading: () => <div className="mapa-marco"><div className="mapa cargando"><span className="radar" />Conectando con Mars Trek…</div></div>,
});

export default function Planificador() {
  const [rover, setRover] = useState(null);
  const [errorRover, setErrorRover] = useState(null);
  const [capaId, setCapaId] = useState('hirise');
  const [opacidad, setOpacidad] = useState(1);
  const [verRover, setVerRover] = useState(true);
  const [planificando, setPlanificando] = useState(false);
  const [ruta, setRuta] = useState([]);
  const [velocidad, setVelocidad] = useState(EVA.velocidadKmH);
  const [waypoint, setWaypoint] = useState(null);

  useEffect(() => {
    obtenerRover()
      .then((j) => (j.error ? setErrorRover(j.error) : setRover(j)))
      .catch(() => setErrorRover('Sin conexión con la telemetría del rover'));
  }, []);

  const agregarPunto = useCallback((p) => setRuta((r) => [...r, p]), []);
  const elegirWaypoint = useCallback((w) => setWaypoint(w), []);

  const rutaSugerida = () => {
    if (!rover) return;
    // Seguir el tramo más reciente del rover: terreno ya verificado en superficie
    const wps = rover.waypoints;
    const tramo = wps.slice(Math.max(0, wps.length - 60));
    const paso = Math.max(1, Math.floor(tramo.length / 6));
    setRuta(tramo.filter((_, i) => i % paso === 0).map((w) => [w.lat, w.lon]));
    setPlanificando(false);
  };

  const analisis = useMemo(
    () => (rover && ruta.length > 1 ? analizarRuta(ruta, rover.waypoints, { ...EVA, velocidadKmH: velocidad }) : null),
    [ruta, rover, velocidad],
  );
  const capa = CAPAS_BASE.find((c) => c.id === capaId);

  return (
    <div className="planificador">
      <div className="plan-mapa">
        <MapaMarte rover={rover} ruta={ruta} planificando={planificando} capaId={capaId} opacidad={opacidad}
          verRover={verRover} onPunto={agregarPunto} onWaypoint={elegirWaypoint} />

        <div className="capas" role="radiogroup" aria-label="Capa de datos">
          {CAPAS_BASE.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={c.id === capaId}
              className={`chip ${c.id === capaId ? 'activo' : ''}`} onClick={() => setCapaId(c.id)}>
              <small>{c.tipo}</small>{c.nombre}
            </button>
          ))}
        </div>
      </div>

      <aside className="plan-panel">
        <section className="tarjeta">
          <header className="tarjeta-cab"><h3>Capa activa</h3><span className="etiqueta-dato">{capa?.tipo}</span></header>
          <p className="texto-2">{capa?.fuente}</p>
          <label className="deslizador">
            <span>Opacidad</span>
            <input type="range" min="0" max="1" step="0.05" value={opacidad} onChange={(e) => setOpacidad(Number(e.target.value))} />
            <output>{Math.round(opacidad * 100)}%</output>
          </label>
          <label className="interruptor">
            <input type="checkbox" checked={verRover} onChange={(e) => setVerRover(e.target.checked)} />
            <span>Recorrido de Perseverance {rover ? `(sol ${rover.solActual}, ${rover.distanciaTotalKm} km)` : ''}</span>
          </label>
          {verRover && (
            <ul className="leyenda" aria-label="Inclinación medida por el rover">
              <li><i style={{ background: '#7fe3ff' }} />&lt; 8°</li>
              <li><i style={{ background: '#fab219' }} />8–{EVA.pendienteMaxGrados}°</li>
              <li><i style={{ background: '#ff5a4f' }} />&gt; {EVA.pendienteMaxGrados}°</li>
            </ul>
          )}
          {errorRover && <p className="aviso">{errorRover}</p>}
        </section>

        <section className="tarjeta">
          <header className="tarjeta-cab"><h3>Planificar Marswalk</h3><span className="etiqueta-dato">{ruta.length} puntos</span></header>
          <div className="botones">
            <button type="button" className={`boton ${planificando ? 'primario' : ''}`} onClick={() => setPlanificando((p) => !p)}>
              {planificando ? '● Trazando…' : '+ Trazar ruta'}
            </button>
            <button type="button" className="boton" onClick={() => setRuta((r) => r.slice(0, -1))} disabled={!ruta.length}>Deshacer</button>
            <button type="button" className="boton" onClick={() => setRuta([])} disabled={!ruta.length}>Limpiar</button>
            <button type="button" className="boton" onClick={rutaSugerida} disabled={!rover}>Ruta sugerida</button>
          </div>
          <label className="deslizador">
            <span>Velocidad con traje</span>
            <input type="range" min="0.5" max="3" step="0.1" value={velocidad} onChange={(e) => setVelocidad(Number(e.target.value))} />
            <output>{velocidad.toFixed(1)} km/h</output>
          </label>

          {analisis ? (
            <>
              <div className="metricas">
                <Metrica etiqueta="Distancia" valor={analisis.km < 1 ? `${Math.round(analisis.km * 1000)} m` : `${analisis.km.toFixed(2)} km`} />
                <Metrica etiqueta="Caminata" valor={formatoHoras(analisis.horasCaminata)} />
                <Metrica etiqueta="Radiación" valor={`${analisis.dosis.toFixed(3)} mSv`} nota={`a ${EVA.dosisMSvDia} mSv/día (RAD)`} />
                <Metrica etiqueta="Pendiente máx." valor={analisis.pendienteMax != null ? `${analisis.pendienteMax.toFixed(0)}°` : '—'} nota={`${Math.round(analisis.cobertura * 100)}% verificado por el rover`} />
              </div>
              <Consumibles uso={analisis.usoConsumibles} reserva={EVA.reservaRetorno} />
              <ul className="alertas">
                {analisis.alertas.map((a) => (
                  <li key={a.texto} className={`alerta alerta-${a.nivel}`}>
                    <span aria-hidden="true">{{ ok: '✓', info: 'i', alerta: '!', critico: '▲' }[a.nivel]}</span>{a.texto}
                  </li>
                ))}
              </ul>
              <Perfil perfil={analisis.perfil} />
            </>
          ) : (
            <p className="texto-2">Activa <b>Trazar ruta</b> y marca la salida (hábitat) y las paradas científicas, o carga la ruta sugerida.</p>
          )}
        </section>

        <Clima />
      </aside>

      <VistaSuperficie waypoint={waypoint} onCerrar={() => setWaypoint(null)} />
    </div>
  );
}

function Metrica({ etiqueta, valor, nota }) {
  return (
    <div className="metrica">
      <span className="metrica-etq">{etiqueta}</span>
      <span className="metrica-val">{valor}</span>
      {nota && <span className="metrica-nota">{nota}</span>}
    </div>
  );
}

function Consumibles({ uso, reserva }) {
  const pct = Math.min(uso, 1.2);
  const nivel = uso > 1 - reserva ? 'critico' : uso > (1 - reserva) * 0.8 ? 'alerta' : 'ok';
  return (
    <div className="consumibles">
      <div className="consumibles-cab">
        <span>Soporte vital (ida)</span>
        <span>{Math.round(uso * 100)}% de {EVA.autonomiaH} h</span>
      </div>
      <div className="barra" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(uso * 100)} aria-label="Uso de soporte vital">
        <div className={`barra-relleno barra-${nivel}`} style={{ width: `${Math.min(pct, 1) * 100}%` }} />
        <div className="barra-reserva" style={{ left: `${(1 - reserva) * 100}%` }} title="Reserva para el retorno" />
      </div>
    </div>
  );
}
