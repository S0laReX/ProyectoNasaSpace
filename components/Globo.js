'use client';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { ETIQUETAS_ESCALA, JEZERO, TESELA_VIKING, TEXTURA_GLOBO } from '../lib/marte';
import { tiempoMarte } from '../lib/tiempo-marte';
import { useIdioma } from './Idioma';

// Globo de Marte en Three.js con la textura Viking de Mars Trek.
// No es un fondo decorativo: es el primer tramo del mapa. `descender()` lleva la cámara
// desde la órbita hasta Jezero y termina con la misma escala, centro y rumbo (norte arriba)
// que el mapa de Leaflet en ZOOM_FUNDIDO, para que el fundido no tenga salto.
const FOV = 35;
const ALTURA_ORBITA = 3.6; // en radios marcianos, medida desde la superficie
const LAT = (JEZERO.lat * Math.PI) / 180;
// El mapa es equirectangular: estira la longitud en 1/cos(lat) respecto del globo.
const ESTIRAMIENTO = 1 / Math.cos(LAT);

// Parche regional en alta resolución: 8 × 5 teselas Viking del nivel 6 (67.5° a 90° E, 11.25° a 25.3° N),
// las mismas que muestra Leaflet en ZOOM_FUNDIDO. Cubre la vista de llegada hasta 1920 × 1080.
const PARCHE = { z: 6, x0: 88, x1: 95, y0: 23, y1: 27 };

const suave = (t) => t * t * (3 - 2 * t);
const entre = (a, b, t) => Math.min(Math.max((t - a) / (b - a), 0), 1);
const cuarta = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

/** Altura de cámara (en radios) que da la misma escala que Leaflet EPSG:4326 en `zoom`. */
export function alturaParaZoom(zoom, altoPx) {
  const gradosPorPx = 360 / (512 * 2 ** zoom);
  return (gradosPorPx * (Math.PI / 180) * altoPx) / (2 * Math.tan((FOV * Math.PI) / 360));
}

export default function Globo({ ref, interactivo = false, onElegir }) {
  const { t } = useIdioma();
  const contenedor = useRef(null);
  const motor = useRef(null);
  const props = useRef({ interactivo, onElegir });
  props.current = { interactivo, onElegir };

  useImperativeHandle(ref, () => ({
    descender: (o) => motor.current?.descender(o) ?? Promise.resolve(),
    ascender: (o) => motor.current?.ascender(o) ?? Promise.resolve(),
    colocarAbajo: (o) => motor.current?.colocarAbajo(o),
    pausar: () => motor.current?.pausar(),
    reanudar: () => motor.current?.reanudar(),
  }), []);

  useEffect(() => {
    let cancelado = false;
    let limpiar = () => {};

    (async () => {
      const THREE = await import('three');
      if (cancelado) return;
      const el = contenedor.current;
      const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Equipos lentos: menos píxeles, menos geometría, sin antialias.
      const lento = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

      const renderer = new THREE.WebGLRenderer({ antialias: !lento, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, lento ? 1 : 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      el.prepend(renderer.domElement);

      const escena = new THREE.Scene();
      const camara = new THREE.PerspectiveCamera(FOV, 1, 0.005, 200);

      const ambiente = new THREE.AmbientLight(0xffffff, 0.22);
      const sol = new THREE.DirectionalLight(0xfff1e0, 2.4);
      escena.add(ambiente, sol);
      // El Sol está donde está ahora: punto subsolar del algoritmo Mars24, en el marco fijo del planeta.
      const dirSol = new THREE.Vector3();
      const actualizarSol = () => {
        const { subsolar } = tiempoMarte(new Date());
        dirSol.copy(latLonAVector(THREE, subsolar.lat, subsolar.lon, 1));
      };
      actualizarSol();
      const relojSol = setInterval(actualizarSol, 60000);

      const grupo = new THREE.Group();
      escena.add(grupo);
      const seg = lento ? [64, 48] : [128, 96];
      const material = new THREE.MeshStandardMaterial({ color: 0x8a4a30, roughness: 1, metalness: 0 });
      grupo.add(new THREE.Mesh(new THREE.SphereGeometry(1, ...seg), material));

      // Parche: misma convención de UV que SphereGeometry, así la textura cubre justo su recuadro.
      const lon0 = PARCHE.x0 * (360 / 2 ** (PARCHE.z + 1)) - 180;
      const lon1 = (PARCHE.x1 + 1) * (360 / 2 ** (PARCHE.z + 1)) - 180;
      const lat0 = 90 - PARCHE.y0 * (180 / 2 ** PARCHE.z);
      const lat1 = 90 - (PARCHE.y1 + 1) * (180 / 2 ** PARCHE.z);
      const rad = THREE.MathUtils.degToRad;
      const materialParche = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -1 });
      const parche = new THREE.Mesh(
        new THREE.SphereGeometry(1.0004, 64, 48, rad(lon0 + 180), rad(lon1 - lon0), rad(90 - lat0), rad(lat0 - lat1)),
        materialParche,
      );
      parche.visible = false;
      grupo.add(parche);

      const atmosfera = new THREE.Mesh(
        new THREE.SphereGeometry(1.06, 64, 48),
        new THREE.ShaderMaterial({
          transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
          uniforms: { fuerza: { value: 1 } },
          vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: 'uniform float fuerza; varying vec3 vN; void main(){ float i = pow(0.6 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(0.85, 0.52, 0.36, 1.0) * i * fuerza; }',
        }),
      );
      escena.add(atmosfera);

      // Jezero: un punto y un anillo quietos en el color de acento.
      const acento = colorToken('--color-accent');
      const posJezero = latLonAVector(THREE, JEZERO.lat, JEZERO.lon, 1.001);
      const anillo = new THREE.Mesh(
        new THREE.RingGeometry(0.018, 0.022, 48),
        new THREE.MeshBasicMaterial({ color: acento, transparent: true, side: THREE.DoubleSide }),
      );
      anillo.position.copy(posJezero);
      anillo.lookAt(posJezero.clone().multiplyScalar(2));
      grupo.add(anillo);

      // Retícula de carta: meridianos y paralelos cada 30°, en el marco del planeta.
      const ret = [];
      const paso = 2;
      for (let lon = -180; lon < 180; lon += 30) {
        for (let lat = -90; lat < 90; lat += paso) ret.push(latLonAVector(THREE, lat, lon, 1.0015), latLonAVector(THREE, lat + paso, lon, 1.0015));
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        for (let lon = -180; lon < 180; lon += paso) ret.push(latLonAVector(THREE, lat, lon, 1.0015), latLonAVector(THREE, lat, lon + paso, 1.0015));
      }
      const materialRet = new THREE.LineBasicMaterial({ color: colorToken('--color-ink'), transparent: true, opacity: 0.14, depthWrite: false });
      grupo.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ret), materialRet));

      // Órbitas de las naves que tomaron los datos del mapa. Altura e inclinación reales; la fase es ilustrativa.
      const NAVES = [
        { id: 'mro', alturaKm: 300, incl: 92.6, nodo: 40, periodoMin: 112 },
        { id: 'odyssey', alturaKm: 400, incl: 93.2, nodo: 140, periodoMin: 120 },
      ];
      const colorOrbita = colorToken('--color-muted');
      const orbitas = NAVES.map((nave) => {
        const r = 1 + nave.alturaKm / 3389.5;
        const plano = new THREE.Group();
        plano.rotation.set(rad(nave.incl), rad(nave.nodo), 0, 'YXZ');
        const pts = [];
        for (let i = 0; i <= 256; i++) { const t = (i / 256) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r)); }
        const linea = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: colorOrbita, transparent: true, opacity: 0.45, dashSize: 0.02, gapSize: 0.015, depthWrite: false }));
        linea.computeLineDistances();
        const nave3d = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 12), new THREE.MeshBasicMaterial({ color: colorToken('--color-ink'), transparent: true }));
        plano.add(linea, nave3d);
        escena.add(plano);
        return { ...nave, r, plano, linea, nave3d, fase: Math.random() * Math.PI * 2, nodoEtq: el.querySelector(`[data-nave="${nave.id}"]`) };
      });

      // Cielo: estrellas redondas con el color de su temperatura (de blanco azulado a anaranjado),
      // tres magnitudes y la franja tenue de la Vía Láctea. Sin parpadeo: solo la deriva lenta del bucle.
      const estrellas = crearCielo(THREE, lento);
      escena.add(estrellas);

      // Rotación que deja Jezero en el centro con el norte arriba (Euler XYZ: primero Y, luego X).
      const objetivoY = Math.atan2(-posJezero.x, posJezero.z);
      const objetivoX = LAT;

      // Etiquetas HTML que siguen a su punto del globo.
      const etiquetas = ETIQUETAS_ESCALA.filter((e) => e.id !== 'zona').map((e) => ({
        ...e, nodo: el.querySelector(`[data-etq="${e.id}"]`), pos: latLonAVector(THREE, e.lat, e.lon, 1),
      }));

      // En órbita se empieza mirando el lado de día, con el terminador a la vista para dar relieve.
      function giroDeDia() {
        const { subsolar } = tiempoMarte(new Date());
        const p = latLonAVector(THREE, 0, subsolar.lon - 35, 1);
        return Math.atan2(-p.x, p.z);
      }
      const estado = {
        altura: ALTURA_ORBITA, giro: giroDeDia(), rotX: 0.12, desvio: 0, luz: 0, estirar: 0,
        realce: 0, realceObjetivo: 0, // el planeta se eleva un poco bajo el puntero: "se puede tocar"
        entrada: 0, tiempo: 0,        // entrada atmosférica del descenso: resplandor y vibración
        anim: null, activo: true, ancho: 1, alto: 1,
      };
      // Opacidad de cada capa de estrellas, para apagarlas al entrar en la atmósfera.
      for (const capa of estrellas.children) capa.userData.opacidad = capa.material.opacity;
      const pista = el.querySelector('.globo-pista');

      const redimensionar = () => {
        const { clientWidth: w, clientHeight: h } = el;
        if (!w || !h) return;
        estado.ancho = w;
        estado.alto = h;
        renderer.setSize(w, h, false);
        camara.aspect = w / h;
        camara.updateProjectionMatrix();
        if (!estado.activo) dibujar();
      };
      const ro = new ResizeObserver(redimensionar);
      ro.observe(el);
      redimensionar();

      // En órbita, el planeta se corre a la derecha en pantallas anchas para dejar sitio al texto.
      const desvioOrbita = () => (estado.ancho > 900 ? 0.2 : 0);
      estado.desvio = desvioOrbita();

      const v = new THREE.Vector3();
      const normal = new THREE.Vector3();
      const dibujar = () => {
        const { ancho: w, alto: h } = estado;
        grupo.rotation.set(estado.rotX, estado.giro, 0);
        const escala = 1 + 0.035 * estado.realce;
        grupo.scale.setScalar(escala);
        atmosfera.scale.setScalar(escala);
        camara.position.set(0, 0, 1 + estado.altura);
        // Vibración leve durante la entrada atmosférica (en píxeles de pantalla).
        const tt = estado.tiempo;
        const sx = (Math.sin(tt * 83) + Math.sin(tt * 51)) * 2.2 * estado.entrada;
        const sy = (Math.sin(tt * 71) + Math.sin(tt * 43)) * 2.2 * estado.entrada;
        camara.setViewOffset(w, h, -estado.desvio * w + sx, sy, w, h);
        // Hacia la llegada: luz plana como las teselas del mapa, sin halo y con el estiramiento equirectangular.
        ambiente.intensity = 0.35 + 0.65 * estado.luz;
        sol.intensity = 2.2 * (1 - estado.luz);
        atmosfera.material.uniforms.fuerza.value = (1 + 0.7 * estado.realce + 1.6 * estado.entrada) * (1 - estado.luz);
        for (const capa of estrellas.children) capa.material.opacity = capa.userData.opacidad * (1 - 0.8 * estado.entrada) * (1 - estado.luz);
        el.style.setProperty('--entrada', estado.entrada.toFixed(3));
        anillo.material.opacity = 1 - estado.luz;
        renderer.domElement.style.transform = `scaleX(${1 + (ESTIRAMIENTO - 1) * estado.estirar})`;
        sol.position.copy(dirSol).applyEuler(grupo.rotation).multiplyScalar(5);
        materialRet.opacity = 0.14 * (1 - estado.luz) * Math.min(1, estado.altura / 0.8);
        const verOrbitas = Math.min(1, Math.max(0, (estado.altura - 0.7) / 0.8));
        const minutos = performance.now() / 60000;
        for (const o of orbitas) {
          const t = o.fase + (minutos / o.periodoMin) * Math.PI * 2;
          o.nave3d.position.set(Math.cos(t) * o.r, 0, Math.sin(t) * o.r);
          o.linea.material.opacity = 0.45 * verOrbitas;
          o.nave3d.material.opacity = verOrbitas;
          if (o.nodoEtq) {
            v.copy(o.nave3d.position).applyMatrix4(o.plano.matrixWorld);
            const tapada = v.z < 0 && Math.hypot(v.x, v.y) < 1; // detrás del planeta
            v.project(camara);
            o.nodoEtq.style.transform = `translate3d(${(((v.x + 1) / 2) * w).toFixed(1)}px, ${(((1 - v.y) / 2) * h).toFixed(1)}px, 0)`;
            o.nodoEtq.style.opacity = !tapada && verOrbitas > 0.5 ? '0.85' : '0';
          }
        }
        renderer.render(escena, camara);

        escena.updateMatrixWorld();
        for (const e of etiquetas) {
          if (!e.nodo) continue;
          v.copy(e.pos).applyMatrix4(grupo.matrixWorld);
          normal.copy(v).normalize();
          const deFrente = normal.dot(v.clone().sub(camara.position).negate().normalize()) > 0.15;
          const visible = deFrente && (e.id === 'region' ? estado.altura < 1.6 && estado.altura > 0.35 : true);
          v.project(camara);
          const x = ((v.x + 1) / 2) * w;
          const y = ((1 - v.y) / 2) * h;
          e.nodo.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          e.nodo.style.opacity = visible ? '1' : '0';
        }
      };

      // Arrastrar para girar (ratón, lápiz o un dedo), con inercia. Flechas del teclado como alternativa.
      const limitarX = (x) => Math.min(Math.max(x, -1.25), 1.25);
      const arrastre = { activo: false, x: 0, y: 0, recorrido: 0 };
      const vel = { x: 0, y: 0 };
      let ultimoToque = -Infinity;
      const K = 0.0055;
      // ¿El puntero está sobre el planeta? Un rayo desde la cámara contra la esfera (radio 1, escalada).
      const rayo = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const esfera = new THREE.Sphere(new THREE.Vector3(), 1);
      const sobrePlaneta = (e) => {
        const caja = el.getBoundingClientRect();
        ndc.set(((e.clientX - caja.left) / caja.width) * 2 - 1, -((e.clientY - caja.top) / caja.height) * 2 + 1);
        rayo.setFromCamera(ndc, camara);
        esfera.radius = grupo.scale.x;
        return rayo.ray.intersectsSphere(esfera);
      };
      const marcarSobre = (e, sobre) => {
        estado.realceObjetivo = sobre ? 1 : 0;
        el.classList.toggle('sobre-planeta', sobre);
        if (pista) {
          const caja = el.getBoundingClientRect();
          pista.style.transform = `translate3d(${(e.clientX - caja.left).toFixed(0)}px, ${(e.clientY - caja.top).toFixed(0)}px, 0)`;
        }
      };
      const alBajar = (e) => {
        if (!props.current.interactivo || estado.anim) return;
        el.setPointerCapture(e.pointerId);
        Object.assign(arrastre, { activo: true, x: e.clientX, y: e.clientY, recorrido: 0 });
        vel.x = vel.y = 0;
        el.classList.add('arrastrando');
      };
      const alSalir = () => { estado.realceObjetivo = 0; el.classList.remove('sobre-planeta'); };
      const alMover = (e) => {
        if (!props.current.interactivo || estado.anim) return;
        if (!arrastre.activo) { marcarSobre(e, e.pointerType !== 'touch' && sobrePlaneta(e)); return; }
        if (arrastre.recorrido > 6) alSalir(); // arrastrando: no es un toque, se quita la pista
        const dx = e.clientX - arrastre.x;
        const dy = e.clientY - arrastre.y;
        arrastre.x = e.clientX;
        arrastre.y = e.clientY;
        arrastre.recorrido += Math.abs(dx) + Math.abs(dy);
        estado.giro += dx * K;
        estado.rotX = limitarX(estado.rotX + dy * K);
        vel.x = dx * K;
        vel.y = dy * K;
        ultimoToque = performance.now();
      };
      const alSoltar = (e) => {
        if (!arrastre.activo) return;
        arrastre.activo = false;
        el.classList.remove('arrastrando');
        ultimoToque = performance.now();
        // Un toque (sin arrastrar) en cualquier parte del planeta empieza el descenso a Jezero.
        if (arrastre.recorrido < 6 && sobrePlaneta(e)) { vel.x = vel.y = 0; alSalir(); props.current.onElegir?.(); }
      };
      const alTecla = (e) => {
        if (!props.current.interactivo) return;
        const pasos = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] };
        if (pasos[e.key]) {
          e.preventDefault();
          estado.giro += pasos[e.key][0];
          estado.rotX = limitarX(estado.rotX + pasos[e.key][1]);
          ultimoToque = performance.now();
        } else if (e.key === 'Enter') {
          props.current.onElegir?.();
        }
      };
      el.addEventListener('pointerdown', alBajar);
      el.addEventListener('pointermove', alMover);
      el.addEventListener('pointerup', alSoltar);
      el.addEventListener('pointercancel', alSoltar);
      el.addEventListener('pointerleave', alSalir);
      el.addEventListener('keydown', alTecla);

      let frame = 0;
      const reloj = new THREE.Clock();
      const bucle = () => {
        const dt = Math.min(reloj.getDelta(), 0.05);
        const ahora = performance.now();
        estado.tiempo += dt;
        // El realce sigue al puntero con un muelle corto (sin saltos al entrar o salir del planeta).
        estado.realce += (estado.realceObjetivo - estado.realce) * (reducido ? 1 : 1 - Math.exp(-10 * dt));
        if (estado.anim) estado.anim(ahora);
        else if (!arrastre.activo) {
          if (!reducido && Math.abs(vel.x) + Math.abs(vel.y) > 1e-5) {
            // Inercia suave al soltar
            estado.giro += vel.x;
            estado.rotX = limitarX(estado.rotX + vel.y);
            vel.x *= 0.93;
            vel.y *= 0.93;
          } else if (!reducido && ahora - ultimoToque > 4000) {
            estado.giro += dt * 0.05; // vuelve a girar solo tras 4 s sin tocarlo
          }
        }
        estrellas.rotation.y += dt * 0.003;
        dibujar();
        frame = estado.activo ? requestAnimationFrame(bucle) : 0;
      };
      frame = requestAnimationFrame(bucle);

      const animar = (duracion, paso) => new Promise((listo) => {
        if (reducido || duracion === 0) { paso(1); estado.anim = null; dibujar(); listo(); return; }
        const inicio = performance.now();
        estado.anim = (ahora) => {
          const t = Math.min((ahora - inicio) / duracion, 1);
          paso(t);
          if (t === 1) { estado.anim = null; listo(); }
        };
      });

      const llegada = (zoom) => ({
        altura: alturaParaZoom(zoom, estado.alto),
        giro: objetivoY + Math.round((estado.giro - objetivoY) / (Math.PI * 2)) * Math.PI * 2,
      });

      motor.current = {
        // Descenso en cuatro tiempos:
        //   impulso (la cámara toma distancia un instante) → giro hacia Jezero y caída exponencial →
        //   entrada atmosférica (halo encendido, estrellas que se apagan, vibración leve) →
        //   luz plana y estiramiento equirectangular para fundirse sin salto con el mapa.
        descender({ zoom, duracion = 3400 }) {
          const desde = { ...estado };
          const hasta = llegada(zoom);
          const [la, lb] = [Math.log(desde.altura), Math.log(hasta.altura)];
          estado.realceObjetivo = 0;
          el.classList.remove('sobre-planeta');
          return animar(duracion, (t) => {
            const r = suave(entre(0, 0.6, t));
            estado.giro = desde.giro + (hasta.giro - desde.giro) * r;
            estado.rotX = desde.rotX + (objetivoX - desde.rotX) * r;
            estado.desvio = desde.desvio * (1 - suave(entre(0, 0.5, t)));
            const impulso = 1 + 0.07 * Math.sin(Math.PI * entre(0, 0.14, t));
            // Escala exponencial: la altura se interpola en espacio logarítmico.
            estado.altura = Math.exp(la + (lb - la) * cuarta(entre(0.1, 1, t))) * impulso;
            estado.entrada = Math.sin(Math.PI * entre(0.38, 0.86, t)) ** 1.5;
            estado.luz = suave(entre(0.6, 1, t));
            estado.estirar = suave(entre(0.7, 1, t));
          }).then(() => { estado.entrada = 0; dibujar(); });
        },
        ascender({ duracion = 2600 } = {}) {
          const desde = { ...estado };
          const [la, lb] = [Math.log(desde.altura), Math.log(ALTURA_ORBITA)];
          const desvio = desvioOrbita();
          return animar(duracion, (t) => {
            estado.altura = Math.exp(la + (lb - la) * cuarta(entre(0, 0.92, t)));
            estado.rotX = desde.rotX + (0.12 - desde.rotX) * suave(entre(0.3, 1, t));
            estado.desvio = desvio * suave(entre(0.5, 1, t));
            estado.luz = desde.luz * (1 - suave(entre(0, 0.35, t)));
            estado.estirar = desde.estirar * (1 - suave(entre(0, 0.25, t)));
          });
        },
        colocarAbajo({ zoom }) {
          const hasta = llegada(zoom);
          Object.assign(estado, { ...hasta, rotX: objetivoX, desvio: 0, luz: 1, estirar: 1, entrada: 0, realce: 0, realceObjetivo: 0, anim: null });
          dibujar();
        },
        pausar() {
          estado.activo = false;
          cancelAnimationFrame(frame);
          frame = 0;
        },
        reanudar() {
          if (estado.activo) return;
          estado.activo = true;
          reloj.getDelta();
          frame = requestAnimationFrame(bucle);
        },
      };

      // Texturas: primero el globo entero (32 teselas), después el parche regional (40 teselas).
      unirTeselas(THREE, 8, 4, (x, y) => TEXTURA_GLOBO(x, y)).then((tex) => {
        if (cancelado || !tex) return;
        material.map = tex;
        material.color.set(0xffffff);
        material.needsUpdate = true;
        return unirTeselas(THREE, PARCHE.x1 - PARCHE.x0 + 1, PARCHE.y1 - PARCHE.y0 + 1, (x, y) => TESELA_VIKING(PARCHE.z, PARCHE.x0 + x, PARCHE.y0 + y));
      }).then((tex) => {
        if (cancelado || !tex) return;
        materialParche.map = tex;
        materialParche.opacity = 1;
        materialParche.transparent = false;
        materialParche.needsUpdate = true;
        parche.visible = true;
      });

      limpiar = () => {
        cancelAnimationFrame(frame);
        clearInterval(relojSol);
        ro.disconnect();
        el.removeEventListener('pointerdown', alBajar);
        el.removeEventListener('pointermove', alMover);
        el.removeEventListener('pointerup', alSoltar);
        el.removeEventListener('pointercancel', alSoltar);
        el.removeEventListener('pointerleave', alSalir);
        el.removeEventListener('keydown', alTecla);
        escena.traverse((o) => {
          o.geometry?.dispose();
          o.material?.map?.dispose();
          o.material?.dispose();
        });
        renderer.dispose();
        renderer.domElement.remove();
        motor.current = null;
      };
    })();

    return () => { cancelado = true; limpiar(); };
  }, []);

  return (
    <div
      ref={contenedor}
      className={`globo ${interactivo ? 'globo-interactivo' : ''}`}
      role={interactivo ? 'application' : undefined}
      aria-hidden={interactivo ? undefined : 'true'}
      aria-label={interactivo ? t('globo.aria') : undefined}
      tabIndex={interactivo ? 0 : -1}
    >
      {/* Resplandor de entrada atmosférica: su opacidad la marca --entrada desde el bucle del globo */}
      <span className="globo-entrada" aria-hidden="true" />
      <span className="globo-pista" aria-hidden="true">{t('globo.pista')}</span>
      {ETIQUETAS_ESCALA.filter((e) => e.id !== 'zona').map((e) => (
        <span key={e.id} className="etiqueta-escala" data-etq={e.id}>{t(`etiquetas.${e.id}`)}</span>
      ))}
      <span className="etiqueta-nave" data-nave="mro">MRO</span>
      <span className="etiqueta-nave" data-nave="odyssey">Mars Odyssey</span>
    </div>
  );
}

// Convierte un token CSS (oklch, etc.) a un color que Three.js entiende.
function colorToken(nombre) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = valor || 'white';
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  return (r << 16) | (g << 8) | b;
}

// Colores de estrellas por temperatura (O/B azuladas … K/M anaranjadas) y su frecuencia aproximada a simple vista.
const TONOS_ESTELARES = [
  [[0.76, 0.84, 1.0], 0.1], [[0.88, 0.92, 1.0], 0.24], [[1.0, 1.0, 1.0], 0.36], [[1.0, 0.95, 0.86], 0.2], [[1.0, 0.84, 0.68], 0.1],
];
const tonoEstelar = () => {
  let r = Math.random();
  for (const [c, p] of TONOS_ESTELARES) { r -= p; if (r <= 0) return c; }
  return TONOS_ESTELARES[2][0];
};

function crearCielo(THREE, lento) {
  // Disco suave: núcleo nítido y halo corto, para que la estrella sea un punto y no un cuadrado.
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 32;
  const ctx = lienzo.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const disco = new THREE.CanvasTexture(lienzo);
  disco.colorSpace = THREE.SRGBColorSpace;

  // Polo de la galaxia, inclinado respecto del ecuador marciano: la franja cruza el cielo en diagonal.
  const polo = new THREE.Vector3(0.42, 0.82, 0.39).normalize();
  const capa = (cantidad, tam, opacidad, enBanda) => {
    const pos = new Float32Array(cantidad * 3);
    const col = new Float32Array(cantidad * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < cantidad; i++) {
      v.randomDirection();
      if (enBanda) {
        // Aplana hacia el plano galáctico; el resto aleatorio deja un borde difuso.
        const h = v.dot(polo);
        v.addScaledVector(polo, -h * (0.82 + Math.random() * 0.16)).normalize();
      }
      v.multiplyScalar(60 + Math.random() * 40);
      pos.set([v.x, v.y, v.z], i * 3);
      const [r, gg, b] = tonoEstelar();
      const brillo = 0.5 + Math.random() * 0.5;
      col.set([r * brillo, gg * brillo, b * brillo], i * 3);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return new THREE.Points(geom, new THREE.PointsMaterial({
      size: tam, map: disco, vertexColors: true, transparent: true, opacity: opacidad, depthWrite: false, sizeAttenuation: true,
    }));
  };
  const n = (x) => Math.round(lento ? x / 2 : x);
  const cielo = new THREE.Group();
  cielo.add(
    capa(n(2400), 0.13, 0.42, true), // Vía Láctea: muchas, diminutas y tenues
    capa(n(1400), 0.17, 0.7, false), // fondo de estrellas débiles
    capa(n(240), 0.3, 0.9, false),   // medianas
    capa(n(40), 0.52, 1, false),     // las pocas brillantes
  );
  return cielo;
}

function latLonAVector(THREE, lat, lon, r) {
  // Misma convención que SphereGeometry: u = (lon + 180) / 360, v = (90 - lat) / 180
  const phi = THREE.MathUtils.degToRad(lon + 180);
  const theta = THREE.MathUtils.degToRad(90 - lat);
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r);
}

// Une columnas × filas teselas de 256 px en una sola textura.
async function unirTeselas(THREE, columnas, filas, url) {
  const lienzo = document.createElement('canvas');
  lienzo.width = columnas * 256;
  lienzo.height = filas * 256;
  const ctx = lienzo.getContext('2d');
  const promesas = [];
  for (let y = 0; y < filas; y++) {
    for (let x = 0; x < columnas; x++) {
      promesas.push(new Promise((ok) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { ctx.drawImage(img, x * 256, y * 256); ok(true); };
        img.onerror = () => ok(false);
        img.src = url(x, y);
      }));
    }
  }
  const resultados = await Promise.all(promesas);
  if (!resultados.some(Boolean)) return null;
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
