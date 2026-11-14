'use client';
import { useEffect, useRef, useState } from 'react';
import { CAPA_GLOBAL, CAPAS_BASE, EVA } from '../lib/marte';

const CENTRO = [18.445, 77.40];

// Mapa de Marte con Leaflet en proyección equirectangular (L.CRS.EPSG4326),
// que coincide con las teselas "EQ" de Mars Trek.
export default function MapaMarte({ rover, ruta, planificando, capaId, opacidad, verRover, onPunto, onWaypoint }) {
  const nodo = useRef(null);
  const ref = useRef({});
  const [listo, setListo] = useState(false);
  const [cursor, setCursor] = useState(null);

  // Crear el mapa una vez
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelado || ref.current.mapa) return;
      const mapa = L.map(nodo.current, {
        crs: L.CRS.EPSG4326, center: CENTRO, zoom: 13, minZoom: 3, maxZoom: 19,
        zoomControl: false, attributionControl: true, worldCopyJump: false,
      });
      L.control.zoom({ position: 'bottomright' }).addTo(mapa);
      mapa.attributionControl.setPrefix('NASA/JPL-Caltech · USGS · Univ. of Arizona · ASU');

      L.tileLayer(CAPA_GLOBAL.url, { maxNativeZoom: CAPA_GLOBAL.maxNativeZoom, maxZoom: 19, noWrap: true }).addTo(mapa);

      const capasRover = L.layerGroup().addTo(mapa);
      const capaRuta = L.layerGroup().addTo(mapa);
      mapa.on('mousemove', (e) => setCursor(e.latlng));
      mapa.on('mouseout', () => setCursor(null));

      ref.current = { L, mapa, capasRover, capaRuta, base: null };
      setListo(true);
    })();
    return () => {
      cancelado = true;
      ref.current.mapa?.remove();
      ref.current = {};
      setListo(false);
    };
  }, []);

  // Capa de datos seleccionada (óptica, topográfica o térmica)
  useEffect(() => {
    const { L, mapa } = ref.current;
    if (!L) return;
    const def = CAPAS_BASE.find((c) => c.id === capaId) ?? CAPAS_BASE[0];
    ref.current.base?.remove();
    ref.current.base = L.tileLayer(def.url, {
      maxNativeZoom: def.maxNativeZoom, maxZoom: 19, noWrap: true,
      bounds: def.bounds ? L.latLngBounds(def.bounds) : undefined,
      opacity: opacidad, attribution: def.fuente,
    }).addTo(mapa);
  }, [capaId, listo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { ref.current.base?.setOpacity(opacidad); }, [opacidad]);

  // Recorrido y waypoints de Perseverance
  useEffect(() => {
    const { L, capasRover } = ref.current;
    if (!L) return;
    capasRover.clearLayers();
    if (!rover || !verRover) return;

    L.polyline(rover.recorrido, { color: '#7fe3ff', weight: 2, opacity: 0.85 }).addTo(capasRover);

    for (const w of rover.waypoints) {
      const riesgo = w.tilt == null ? 'sd' : w.tilt > EVA.pendienteMaxGrados ? 'alto' : w.tilt > 8 ? 'medio' : 'bajo';
      L.circleMarker([w.lat, w.lon], {
        radius: 3.5, weight: 1, color: '#0b0d10',
        fillColor: { bajo: '#7fe3ff', medio: '#fab219', alto: '#ff5a4f', sd: '#8a8f98' }[riesgo],
        fillOpacity: 0.95, className: 'wp',
      })
        .bindTooltip(`Sol ${w.sol} · inclinación ${w.tilt ?? '—'}° · ${w.elev ?? '—'} m`, { direction: 'top', className: 'tip-mapa' })
        .on('click', (e) => { L.DomEvent.stopPropagation(e); onWaypoint?.(w); })
        .addTo(capasRover);
    }

    const primero = rover.waypoints[0];
    const ultimo = rover.waypoints.at(-1);
    if (primero) {
      L.marker([primero.lat, primero.lon], { icon: icono(L, 'aterrizaje', 'Aterrizaje Octavia E. Butler') }).addTo(capasRover);
    }
    if (ultimo) {
      L.marker([ultimo.lat, ultimo.lon], { icon: icono(L, 'rover', `Perseverance · sol ${ultimo.sol}`) })
        .on('click', () => onWaypoint?.(ultimo))
        .addTo(capasRover);
    }
  }, [rover, verRover, listo, onWaypoint]);

  // Ruta de la EVA trazada por el usuario
  useEffect(() => {
    const { L, capaRuta } = ref.current;
    if (!L) return;
    capaRuta.clearLayers();
    if (ruta.length > 1) {
      L.polyline(ruta, { color: '#ff7a3d', weight: 6, opacity: 0.25 }).addTo(capaRuta);
      L.polyline(ruta, { color: '#ff7a3d', weight: 2.5, dashArray: '8 6', className: 'ruta-animada' }).addTo(capaRuta);
    }
    ruta.forEach((p, i) => {
      const tipo = i === 0 ? 'habitat' : 'parada';
      const texto = i === 0 ? 'Hábitat / punto de salida' : `Parada ${i}`;
      L.marker(p, { icon: icono(L, tipo, texto, i === 0 ? '⌂' : String(i)) }).addTo(capaRuta);
    });
  }, [ruta, listo]);

  // Clic para añadir puntos a la ruta
  useEffect(() => {
    const { mapa } = ref.current;
    if (!mapa) return;
    const alClic = (e) => { if (planificando) onPunto([e.latlng.lat, e.latlng.lng]); };
    mapa.on('click', alClic);
    mapa.getContainer().classList.toggle('modo-planificar', planificando);
    return () => mapa.off('click', alClic);
  }, [planificando, onPunto, listo]);

  return (
    <div className="mapa-marco">
      <div ref={nodo} className="mapa" role="application" aria-label="Mapa del cráter Jezero" />
      <div className="hud-esquina hud-arriba" aria-hidden="true">
        <span>JEZERO CRATER</span>
        <span>{cursor ? `${cursor.lat.toFixed(5)}°N  ${cursor.lng.toFixed(5)}°E` : '18.44°N  77.40°E'}</span>
      </div>
      {planificando && <div className="hud-aviso">Modo ruta · haz clic en el mapa para añadir paradas</div>}
    </div>
  );
}

function icono(L, tipo, titulo, texto = '') {
  return L.divIcon({
    className: `marcador marcador-${tipo}`,
    html: `<span class="m-pulso"></span><span class="m-nucleo">${texto}</span><span class="m-etiqueta">${titulo}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}
