'use client';
import { useEffect, useRef, useState } from 'react';
import { CAPA_GLOBAL, CAPAS_BASE, KM_POR_GRADO, JEZERO, ZOOM_FUNDIDO } from '../lib/marte';
import { dibujarTesela, aRgb, muestrear, clasePendiente } from '../lib/terreno';


// Lee un token de color del CSS (las capas de Leaflet no aceptan var()).
const token = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

// Mapa de Marte con Leaflet en proyección equirectangular (L.CRS.EPSG4326),
// que coincide con las teselas "EQ" de Mars Trek.
export default function MapaMarte({
  rover, ruta, planificando, capaId, opacidad, verRover, onPunto, onWaypoint,
  terreno = null, verZonas = true, verNotas = true, tramosPeligro = [], cerca = [], enfoque = null, onCursor, onMapa,
}) {
  const nodo = useRef(null);
  const ref = useRef({});
  const plan = useRef({ planificando, onPunto });
  plan.current = { planificando, onPunto };
  const [listo, setListo] = useState(false);

  // Crear el mapa una vez
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelado || ref.current.mapa) return;
      const mapa = L.map(nodo.current, {
        // Arranca donde termina el descenso del globo (ver Escena.js): Jezero en ZOOM_FUNDIDO.
        crs: L.CRS.EPSG4326, center: [JEZERO.lat, JEZERO.lon], zoom: ZOOM_FUNDIDO, minZoom: 3, maxZoom: 19,
        zoomControl: false, attributionControl: true, worldCopyJump: false,
      });
      L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(mapa);
      mapa.attributionControl.setPrefix('NASA/JPL-Caltech, USGS, Univ. of Arizona, ASU');

      L.tileLayer(CAPA_GLOBAL.url, { maxNativeZoom: CAPA_GLOBAL.maxNativeZoom, maxZoom: 19, noWrap: true }).addTo(mapa);

      mapa.createPane('zonas').style.zIndex = 350;
      const capaZonas = L.layerGroup().addTo(mapa);
      const capasRover = L.layerGroup().addTo(mapa);
      const capaNotas = L.layerGroup().addTo(mapa);
      const capaRuta = L.layerGroup().addTo(mapa);
      const capaAvisos = L.layerGroup().addTo(mapa);

      // Lejos (región o cráter entero) los puntos del rover se amontonan: solo se ve el recorrido.
      const lejos = () => mapa.getContainer().classList.toggle('zoom-lejos', mapa.getZoom() < 12);
      mapa.on('zoom', lejos);
      lejos();

      ref.current = { L, mapa, capaZonas, capasRover, capaNotas, capaRuta, capaAvisos, base: null };
      setListo(true);
      onMapa?.(mapa, L);
    })();
    return () => {
      cancelado = true;
      ref.current.mapa?.remove();
      ref.current = {};
      setListo(false);
    };
  }, []);

  // Cursor: coordenadas, elevación y pendiente del DTM bajo el puntero, y escala marciana
  useEffect(() => {
    const { mapa } = ref.current;
    if (!mapa || !onCursor) return;
    const escala = () => {
      const c = mapa.getCenter();
      const px = mapa.getSize().x;
      const grados = mapa.containerPointToLatLng([px, 0]).lng - mapa.containerPointToLatLng([0, 0]).lng;
      return (grados * KM_POR_GRADO * Math.cos((c.lat * Math.PI) / 180)) / px; // km por píxel
    };
    const mover = (e) => {
      const { lat, lng } = e.latlng;
      const m = muestrear(terreno, lat, lng);
      onCursor({ lat, lon: lng, ...m, clase: terreno ? clasePendiente(m.pendiente) : null, kmPx: escala() });
    };
    const zoom = () => onCursor((c) => (c ? { ...c, kmPx: escala() } : { kmPx: escala() }));
    mapa.on('mousemove', mover);
    mapa.on('zoomend', zoom);
    zoom();
    return () => { mapa.off('mousemove', mover); mapa.off('zoomend', zoom); };
  }, [listo, terreno, onCursor]);

  // Capa de datos seleccionada (óptica, topográfica o térmica)
  useEffect(() => {
    const { L, mapa } = ref.current;
    if (!L) return;
    const def = CAPAS_BASE.find((c) => c.id === capaId) ?? CAPAS_BASE[0];
    ref.current.base?.remove();
    ref.current.base = L.tileLayer(def.url, {
      maxNativeZoom: def.maxNativeZoom, maxZoom: 19, noWrap: true,
      // Los mosaicos locales de Jezero no tienen niveles regionales: no pedir teselas que no existen.
      minZoom: def.bounds ? 9 : 0,
      bounds: def.bounds ? L.latLngBounds(def.bounds) : undefined,
      opacity: opacidad, attribution: def.fuente,
    }).addTo(mapa);
  }, [capaId, listo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { ref.current.base?.setOpacity(opacidad); }, [opacidad]);

  // Zonas de pendiente calculadas del DTM CTX (USGS)
  useEffect(() => {
    const { L, capaZonas } = ref.current;
    if (!L) return;
    capaZonas.clearLayers();
    if (!terreno || !verZonas) return;
    const rgb = { precaucion: aRgb(token('--color-zona-precaucion')), peligro: aRgb(token('--color-zona-peligro')) };
    const Zonas = L.GridLayer.extend({
      createTile(coords) {
        const lienzo = document.createElement('canvas');
        const tam = this.getTileSize();
        lienzo.width = tam.x;
        lienzo.height = tam.y;
        const nw = this._map.unproject([coords.x * tam.x, coords.y * tam.y], coords.z);
        const se = this._map.unproject([(coords.x + 1) * tam.x, (coords.y + 1) * tam.y], coords.z);
        dibujarTesela(lienzo.getContext('2d'), tam.x, tam.y, [nw.lat, nw.lng], [se.lat, se.lng], coords.x * tam.x, coords.y * tam.y, terreno, rgb);
        return lienzo;
      },
    });
    new Zonas({ pane: 'zonas', bounds: L.latLngBounds(terreno.limites), maxZoom: 19, opacity: 0.9 }).addTo(capaZonas);
    L.rectangle(terreno.limites, { pane: 'zonas', color: token('--color-ink-2'), weight: 1, dashArray: '2 6', fill: false, interactive: false }).addTo(capaZonas);
  }, [terreno, verZonas, listo]);

  // Recorrido y waypoints de Perseverance
  useEffect(() => {
    const { L, capasRover } = ref.current;
    if (!L) return;
    capasRover.clearLayers();
    if (!rover || !verRover) return;

    L.polyline(rover.recorrido, { color: token('--color-rover'), weight: 2, opacity: 0.8 }).addTo(capasRover);

    const colores = { seguro: token('--color-zona-seguro'), precaucion: token('--color-zona-precaucion'), peligro: token('--color-zona-peligro'), sd: token('--color-zona-sd') };
    for (const w of rover.waypoints) {
      const riesgo = clasePendiente(w.tilt);
      L.circleMarker([w.lat, w.lon], {
        radius: 3.5, weight: 1, color: token('--color-paper'),
        fillColor: colores[riesgo], fillOpacity: 0.95, className: 'wp',
      })
          .bindTooltip(`Sol ${w.sol}: inclinación ${w.tilt != null ? `${Number(w.tilt).toFixed(1)}°` : 'sin dato'}, ${w.elev ?? 'sin dato'} m`, { direction: 'top', className: 'tip-mapa' })
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          // Al trazar, tocar un punto del rover lo suma como parada (terreno ya verificado)
          if (plan.current.planificando) plan.current.onPunto([w.lat, w.lon]);
          else onWaypoint?.(w);
        })
        .addTo(capasRover);
    }

    const primero = rover.waypoints[0];
    const ultimo = rover.waypoints.at(-1);
    if (primero) {
      L.marker([primero.lat, primero.lon], { icon: icono(L, 'aterrizaje', 'Aterrizaje Octavia E. Butler') }).addTo(capasRover);
    }
    if (ultimo) {
      L.marker([ultimo.lat, ultimo.lon], { icon: icono(L, 'rover', `Perseverance, sol ${ultimo.sol}`) })
        .on('click', () => onWaypoint?.(ultimo))
        .addTo(capasRover);
    }
  }, [rover, verRover, listo, onWaypoint]);

  // Notas de la misión en el recorrido (MMGIS): hitos con nombre
  useEffect(() => {
    const { L, capaNotas } = ref.current;
    if (!L) return;
    capaNotas.clearLayers();
    if (!rover || !verNotas) return;
    for (const w of rover.waypoints.filter((x) => x.nota)) {
      L.marker([w.lat, w.lon], { icon: icono(L, 'nota', `Sol ${w.sol}: ${w.nota}`), keyboard: false })
        .on('click', () => onWaypoint?.(w))
        .addTo(capaNotas);
    }
  }, [rover, verNotas, listo, onWaypoint]);

  // Ruta de la EVA trazada por el usuario
  useEffect(() => {
    const { L, capaRuta } = ref.current;
    if (!L) return;
    capaRuta.clearLayers();
    if (ruta.length > 1) {
      L.polyline(ruta, { color: token('--color-paper'), weight: 7, opacity: 0.7 }).addTo(capaRuta);
      L.polyline(ruta, { color: token('--color-ruta'), weight: 3, dashArray: '10 6' }).addTo(capaRuta);
    }
    ruta.forEach((p, i) => {
      const tipo = i === 0 ? 'habitat' : 'parada';
      const texto = i === 0 ? 'Hábitat, punto de salida' : `Parada ${i}`;
      L.marker(p, { icon: icono(L, tipo, texto, i === 0 ? 'H' : String(i)) }).addTo(capaRuta);
    });
  }, [ruta, listo]);

  // Tramos no seguros que cruza la ruta y peligros cercanos
  useEffect(() => {
    const { L, capaAvisos } = ref.current;
    if (!L) return;
    capaAvisos.clearLayers();
    for (const t of tramosPeligro) {
      L.circleMarker([t.lat, t.lon], { radius: 9, weight: 2, color: token('--color-zona-peligro'), fillOpacity: 0, interactive: false }).addTo(capaAvisos);
    }
    for (const c of cerca) {
      L.circleMarker([c.lat, c.lon], { radius: 6, weight: 2, dashArray: '3 3', color: token('--color-zona-peligro'), fillOpacity: 0 })
        .bindTooltip(`Pendiente de ${c.pendiente.toFixed(0)}° a ${Math.round(c.distM)} m de la ruta`, { className: 'tip-mapa' })
        .addTo(capaAvisos);
    }
  }, [tramosPeligro, cerca, listo]);

  // Centrar el mapa en un punto pedido desde el panel
  useEffect(() => {
    const { mapa } = ref.current;
    if (!mapa || !enfoque) return;
    mapa.flyTo([enfoque.lat, enfoque.lon], Math.max(mapa.getZoom(), 16), { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.6 });
  }, [enfoque, listo]);

  // Clic para añadir puntos a la ruta
  useEffect(() => {
    const { mapa } = ref.current;
    if (!mapa) return;
    const alClic = (e) => { if (planificando) onPunto([e.latlng.lat, e.latlng.lng]); };
    mapa.on('click', alClic);
    mapa.getContainer().classList.toggle('modo-planificar', planificando);
    return () => mapa.off('click', alClic);
  }, [planificando, onPunto, listo]);

  return <div ref={nodo} className="mapa" role="application" aria-label="Mapa del cráter Jezero" />;
}

// Los textos vienen de fuentes externas (notas de MMGIS): se escapan antes de ir al HTML.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function icono(L, tipo, titulo, texto = '') {
  return L.divIcon({
    className: `marcador marcador-${tipo}`,
    html: `<span class="m-nucleo">${esc(texto)}</span><span class="m-etiqueta">${esc(titulo)}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
