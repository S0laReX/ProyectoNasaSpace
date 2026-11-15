'use client';
import { useEffect, useRef, useState } from 'react';

// Pacha ("tierra" en quechua), el rover guía de Marswalk, en 3D con Three.js.
// Personaje modelado con geometría propia: chasis, seis ruedas con balancines, mástil con cabeza y visor,
// ojos luminosos, antena con resorte y brazo robótico.
//
// Comportamiento:
//   · llega rodando (prop `llegar`) y saluda con el brazo;
//   · en reposo se balancea, parpadea y mira alrededor, o sigue al cursor (`mirarCursor`);
//   · `estado`: 'quieto' | 'buscando' (barre con la cámara) | 'conduciendo' (ruedas en marcha);
//   · al tocarlo, o cuando cambia `reaccion`, da un salto con giro y pone ojos felices;
//   · se pausa fuera de pantalla y, con "reducir movimiento", queda como una imagen fija.
const COLOR = {
  casco: 0xebe6de, marte: 0xd8693f, oscuro: 0x151a29, panel: 0x22345f, metal: 0x9aa3b5, ojo: 0x9cc8ff,
};
const suavizar = (actual, objetivo, dt, rapidez) => actual + (objetivo - actual) * (1 - Math.exp(-rapidez * dt));
const limitar = (v, a, b) => Math.min(Math.max(v, a), b);

export default function Pacha({
  estado = 'quieto', tam = 160, mirarCursor = false, llegar = false, reaccion = 0, onTocar, etiqueta = 'Pacha, el rover guía', className = '',
}) {
  const caja = useRef(null);
  const motor = useRef(null);
  const props = useRef({ estado, mirarCursor });
  props.current = { estado, mirarCursor };
  const [sinWebGL, setSinWebGL] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let limpiar = () => {};
    (async () => {
      const [THREE, { RoundedBoxGeometry }] = await Promise.all([
        import('three'),
        import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
      ]);
      if (cancelado || !caja.current) return;
      const nodo = caja.current;
      const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      } catch {
        setSinWebGL(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.setSize(nodo.clientWidth || tam, nodo.clientHeight || tam, false);
      renderer.domElement.className = 'pacha-lienzo';
      nodo.prepend(renderer.domElement);

      const escena = new THREE.Scene();
      const camara = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
      camara.position.set(2.2, 1.6, 4.15);
      camara.lookAt(0.12, 0.84, 0);

      // Luz de estudio: cielo frío, suelo marciano cálido, clave cálida y contraluz azul para separar del fondo.
      escena.add(new THREE.HemisphereLight(0xbfd4ff, 0x5c2c1a, 1.15));
      const clave = new THREE.DirectionalLight(0xfff0de, 2.3);
      clave.position.set(3, 5, 4);
      const contra = new THREE.DirectionalLight(0x7fa8ff, 1.6);
      contra.position.set(-4, 2.5, -3);
      escena.add(clave, contra);

      const m = construir(THREE, RoundedBoxGeometry);
      escena.add(m.raiz, m.sombra);

      // ---------- Estado de la animación ----------
      const a = {
        t: 0,
        x: llegar && !reducido ? -3.4 : 0, xObjetivo: 0, alLlegar: null,
        saludo: llegar || reducido ? -1 : 0, // al montarse sin llegada, saluda enseguida
        salto: -1, feliz: 0,
        parpadeo: -1, proximoParpadeo: 1.5,
        yaw: 0, pitch: 0, antena: 0, antenaV: 0,
        cursor: null,
      };
      if (llegar && !reducido) a.alLlegar = () => { a.saludo = 0; };

      const alPuntero = (e) => { a.cursor = { x: e.clientX, y: e.clientY }; };
      window.addEventListener('pointermove', alPuntero, { passive: true });

      const paso = (dt) => {
        a.t += dt;
        const { estado: est, mirarCursor: mira } = props.current;

        // Desplazamiento (llegar / irse): las ruedas giran lo que avanza el chasis.
        const antes = a.x;
        a.x = suavizar(a.x, a.xObjetivo, dt, 3.4);
        if (Math.abs(a.xObjetivo - a.x) < 0.01) a.x = a.xObjetivo;
        // Saluda mientras frena, no después: la llegada y el saludo se encadenan.
        if (a.alLlegar && Math.abs(a.xObjetivo - a.x) < 0.3) { const f = a.alLlegar; a.alLlegar = null; f(); }
        const avance = a.x - antes;
        const velocidad = avance / Math.max(dt, 1e-3);
        m.raiz.position.x = a.x;
        const giroRuedas = est === 'conduciendo' ? 3.2 * dt : 0;
        for (const r of m.ruedas) r.rotation.z -= avance / 0.17 + giroRuedas;

        // Vaivén del chasis; al acelerar se inclina hacia atrás, y en marcha vibra un poco.
        const vibra = est === 'conduciendo' ? Math.sin(a.t * 38) * 0.006 : 0;
        m.cuerpo.position.y = Math.sin(a.t * 2.2) * 0.012 + vibra;
        m.cuerpo.rotation.z = suavizar(m.cuerpo.rotation.z, limitar(-velocidad * 0.06, -0.12, 0.12), dt, 6);

        // Mirada: cursor, barrido de búsqueda o curiosidad tranquila.
        let yaw;
        let pitch;
        if (mira && a.cursor) {
          const c = nodo.getBoundingClientRect();
          const dx = a.cursor.x - (c.left + c.width / 2);
          const dy = a.cursor.y - (c.top + c.height * 0.35);
          yaw = limitar((dx / window.innerWidth) * 2.2, -0.9, 0.9);
          pitch = limitar((dy / window.innerHeight) * 1.4, -0.35, 0.45);
        } else if (est === 'buscando') {
          yaw = Math.sin(a.t * 1.3) * 0.8;
          pitch = 0.18 + Math.sin(a.t * 2.6) * 0.05;
        } else {
          yaw = Math.sin(a.t * 0.55) * 0.3 + Math.sin(a.t * 1.6) * 0.08;
          pitch = Math.sin(a.t * 0.8) * 0.07;
        }
        const yawAntes = a.yaw;
        a.yaw = suavizar(a.yaw, yaw, dt, 7);
        a.pitch = suavizar(a.pitch, pitch, dt, 7);
        m.cabeza.rotation.set(a.pitch, a.yaw, 0);

        // Antena con resorte: la empuja el giro de la cabeza y el vaivén.
        const empuje = (a.yaw - yawAntes) * 60 + vibra * 40;
        a.antenaV += (-60 * a.antena - 6 * a.antenaV + empuje) * dt;
        a.antena += a.antenaV * dt;
        m.antena.rotation.z = limitar(a.antena, -0.6, 0.6);

        // Parpadeo cada 2 a 5 s.
        if (a.parpadeo < 0 && a.t > a.proximoParpadeo) a.parpadeo = 0;
        let ojoY = 1;
        if (a.parpadeo >= 0) {
          a.parpadeo += dt / 0.16;
          ojoY = 1 - 0.92 * Math.sin(Math.PI * Math.min(a.parpadeo, 1));
          if (a.parpadeo >= 1) { a.parpadeo = -1; a.proximoParpadeo = a.t + 2 + Math.random() * 3; }
        }

        // Saludo con el brazo robótico.
        let hombro = -1.95;
        let codo = 1.15;
        if (a.saludo >= 0) {
          a.saludo += dt;
          const dur = 1.9;
          const env = Math.sin(Math.PI * Math.min(a.saludo / dur, 1));
          hombro = -1.95 + (1.95 - 0.35) * env;
          codo = 1.15 * (1 - env) + Math.sin(a.saludo * 13) * 0.55 * env;
          a.feliz = Math.max(a.feliz, 0.3);
          if (a.saludo >= dur) a.saludo = -1;
        }
        m.hombro.rotation.z = suavizar(m.hombro.rotation.z, hombro, dt, 14);
        m.codo.rotation.z = suavizar(m.codo.rotation.z, codo, dt, 14);

        // Salto con giro: anticipación (se agacha), vuelo y aterrizaje con compresión.
        let alto = 0;
        let sy = 1;
        if (a.salto >= 0) {
          a.salto += dt / 0.85;
          const p = Math.min(a.salto, 1);
          if (p < 0.15) sy = 1 - 0.16 * Math.sin((p / 0.15) * Math.PI);
          else if (p < 0.85) {
            const q = (p - 0.15) / 0.7;
            alto = 4 * 0.42 * q * (1 - q);
            sy = 1.05;
            m.raiz.rotation.y = q * Math.PI * 2;
          } else sy = 1 - 0.12 * Math.sin(((p - 0.85) / 0.15) * Math.PI);
          if (a.salto >= 1) { a.salto = -1; m.raiz.rotation.y = 0; }
        }
        m.raiz.position.y = alto;
        m.raiz.scale.set(1 + (1 - sy) * 0.5, sy, 1 + (1 - sy) * 0.5);
        m.sombra.position.x = a.x;
        m.sombra.scale.setScalar(1 - alto * 0.9);
        m.sombra.material.opacity = 0.5 * (1 - alto * 1.2);

        // Ojos: normales o felices (arcos), según el ánimo.
        a.feliz = Math.max(0, a.feliz - dt);
        const feliz = a.feliz > 0;
        for (const o of m.ojos) { o.visible = !feliz; o.scale.y = 1.25 * ojoY; }
        for (const o of m.ojosFelices) o.visible = feliz;
      };

      // ---------- Bucle: solo mientras se ve ----------
      let frame = 0;
      let visible = true;
      let ultimo = performance.now();
      const dibujar = () => renderer.render(escena, camara);
      const bucle = (ahora) => {
        const dt = Math.min((ahora - ultimo) / 1000, 0.05);
        ultimo = ahora;
        paso(dt);
        dibujar();
        frame = visible && !document.hidden ? requestAnimationFrame(bucle) : 0;
      };
      const arrancar = () => {
        if (reducido || frame || !visible || document.hidden) return;
        ultimo = performance.now();
        frame = requestAnimationFrame(bucle);
      };
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; arrancar(); });
      io.observe(nodo);
      const alVisibilidad = () => arrancar();
      document.addEventListener('visibilitychange', alVisibilidad);
      const ro = new ResizeObserver(() => {
        renderer.setSize(nodo.clientWidth, nodo.clientHeight, false);
        if (reducido) dibujar();
      });
      ro.observe(nodo);

      if (reducido) { paso(0); dibujar(); } else arrancar();

      motor.current = {
        saltar() {
          a.feliz = 1.3;
          if (reducido) { paso(0); dibujar(); setTimeout(() => { a.feliz = 0; paso(0); dibujar(); }, 1200); return; }
          if (a.salto < 0) a.salto = 0;
          arrancar();
        },
      };

      limpiar = () => {
        cancelAnimationFrame(frame);
        io.disconnect();
        ro.disconnect();
        window.removeEventListener('pointermove', alPuntero);
        document.removeEventListener('visibilitychange', alVisibilidad);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- se monta una vez; lo que cambia se lee de `props`

  // Reacción externa (p. ej. una parada nueva en la ruta): un saltito. Se ignora el valor inicial.
  const reaccionInicial = useRef(reaccion);
  useEffect(() => {
    if (reaccion !== reaccionInicial.current) motor.current?.saltar();
  }, [reaccion]);

  const contenido = sinWebGL ? <span className="pacha-sin-webgl" aria-hidden="true" /> : null;
  if (!onTocar) {
    return <div ref={caja} className={`pacha ${className}`} style={{ width: tam, height: tam }} aria-hidden="true">{contenido}</div>;
  }
  return (
    <button ref={caja} type="button" className={`pacha pacha-tocable ${className}`} style={{ width: tam, height: tam }}
      aria-label={etiqueta} onClick={() => { motor.current?.saltar(); onTocar(); }}>
      {contenido}
    </button>
  );
}

// ---------- Modelo ----------
function construir(THREE, RoundedBox) {
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, ...extra });
  const casco = mat(COLOR.casco, { roughness: 0.4 });
  const marte = mat(COLOR.marte, { roughness: 0.55 });
  const oscuro = mat(COLOR.oscuro, { roughness: 0.85 });
  const panel = mat(COLOR.panel, { roughness: 0.28, metalness: 0.55 });
  const metal = mat(COLOR.metal, { roughness: 0.32, metalness: 0.75 });
  const luz = new THREE.MeshBasicMaterial({ color: COLOR.ojo });
  const puntaAntena = new THREE.MeshBasicMaterial({ color: COLOR.marte });

  const malla = (geo, material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, material);
    o.position.set(x, y, z);
    return o;
  };
  // Barra entre dos puntos del plano XY (balancines de la suspensión), a profundidad z.
  const barra = ([x1, y1], [x2, y2], z, grosor = 0.045) => {
    const largo = Math.hypot(x2 - x1, y2 - y1);
    const o = malla(new THREE.BoxGeometry(largo, grosor, grosor), metal, (x1 + x2) / 2, (y1 + y2) / 2, z);
    o.rotation.z = Math.atan2(y2 - y1, x2 - x1);
    return o;
  };

  const raiz = new THREE.Group();
  const cuerpo = new THREE.Group();
  raiz.add(cuerpo);

  // Chasis, franja marciana, panel solar, generador trasero y plato de antena.
  cuerpo.add(malla(new RoundedBox(1.36, 0.42, 0.86, 4, 0.1), casco, 0, 0.62, 0));
  cuerpo.add(malla(new THREE.BoxGeometry(1.372, 0.07, 0.872), marte, 0, 0.5, 0));
  cuerpo.add(malla(new RoundedBox(1.18, 0.05, 0.72, 2, 0.02), panel, -0.02, 0.855, 0));
  const generador = malla(new THREE.CylinderGeometry(0.11, 0.12, 0.44, 18), metal, -0.8, 0.8, 0);
  generador.rotation.z = -0.95;
  cuerpo.add(generador);
  for (const d of [-0.12, 0, 0.12]) {
    const aleta = malla(new THREE.BoxGeometry(0.02, 0.2, 0.3), marte, -0.8 + d * 0.8, 0.8 - d * 0.6, 0);
    aleta.rotation.z = -0.95;
    cuerpo.add(aleta);
  }
  const plato = malla(new THREE.CylinderGeometry(0.17, 0.05, 0.05, 24), metal, -0.28, 0.93, -0.2);
  plato.rotation.x = -0.35;
  cuerpo.add(plato);

  // Ruedas (quedan en la raíz: no se balancean con el chasis) y balancines.
  const ruedas = [];
  const llanta = new THREE.CylinderGeometry(0.17, 0.17, 0.13, 28);
  llanta.rotateX(Math.PI / 2);
  const taza = new THREE.CylinderGeometry(0.075, 0.075, 0.14, 14);
  taza.rotateX(Math.PI / 2);
  const radio = new THREE.BoxGeometry(0.3, 0.035, 0.135);
  for (const x of [-0.5, 0, 0.5]) {
    for (const z of [-0.5, 0.5]) {
      const r = new THREE.Group();
      r.position.set(x, 0.17, z);
      r.add(new THREE.Mesh(llanta, oscuro), new THREE.Mesh(taza, marte), new THREE.Mesh(radio, metal));
      raiz.add(r);
      ruedas.push(r);
    }
  }
  for (const z of [-0.47, 0.47]) {
    raiz.add(barra([-0.5, 0.17], [-0.12, 0.44], z), barra([-0.12, 0.44], [0.5, 0.17], z), barra([0, 0.17], [0.25, 0.32], z));
  }

  // Mástil y cabeza (pivote en lo alto del mástil). La cabeza mira hacia +z: hacia quien la ve.
  cuerpo.add(malla(new THREE.CylinderGeometry(0.035, 0.045, 0.56, 12), metal, 0.42, 1.13, 0.2));
  const cabeza = new THREE.Group();
  cabeza.position.set(0.42, 1.41, 0.2);
  cuerpo.add(cabeza);
  cabeza.add(malla(new RoundedBox(0.58, 0.33, 0.36, 4, 0.09), casco, 0, 0.17, 0));
  cabeza.add(malla(new RoundedBox(0.47, 0.21, 0.04, 3, 0.05), oscuro, 0, 0.17, 0.17));
  cabeza.add(malla(new THREE.BoxGeometry(0.6, 0.04, 0.37), marte, 0, 0.04, 0));
  const ojos = [];
  const ojosFelices = [];
  for (const x of [-0.1, 0.1]) {
    const ojo = malla(new THREE.SphereGeometry(0.052, 18, 12), luz, x, 0.175, 0.19);
    ojo.scale.set(1, 1.25, 0.35);
    cabeza.add(ojo);
    ojos.push(ojo);
    const arco = malla(new THREE.TorusGeometry(0.045, 0.015, 8, 20, Math.PI), luz, x, 0.155, 0.195);
    arco.visible = false;
    cabeza.add(arco);
    ojosFelices.push(arco);
  }
  // Antena con punta luminosa (pivote en su base para que rebote).
  const antena = new THREE.Group();
  antena.position.set(-0.18, 0.33, 0);
  antena.add(malla(new THREE.CylinderGeometry(0.012, 0.014, 0.24, 8), metal, 0, 0.12, 0));
  antena.add(malla(new THREE.SphereGeometry(0.038, 14, 10), puntaAntena, 0, 0.26, 0));
  cabeza.add(antena);

  // Brazo robótico: hombro y codo con pivote, torreta de herramientas en la punta.
  const hombro = new THREE.Group();
  hombro.position.set(0.66, 0.6, 0.4);
  hombro.rotation.z = -1.95;
  cuerpo.add(hombro);
  hombro.add(malla(new THREE.SphereGeometry(0.06, 14, 10), marte));
  hombro.add(malla(new THREE.BoxGeometry(0.06, 0.34, 0.06), metal, 0, 0.17, 0));
  const codo = new THREE.Group();
  codo.position.set(0, 0.34, 0);
  codo.rotation.z = 1.15;
  hombro.add(codo);
  codo.add(malla(new THREE.SphereGeometry(0.05, 12, 10), marte));
  codo.add(malla(new THREE.BoxGeometry(0.05, 0.27, 0.05), metal, 0, 0.135, 0));
  codo.add(malla(new THREE.CylinderGeometry(0.075, 0.075, 0.09, 16), casco, 0, 0.3, 0));

  // Sombra de contacto: un disco difuso que se encoge al saltar.
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 64;
  const ctx = lienzo.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.9)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.4),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lienzo), transparent: true, depthWrite: false, opacity: 0.5 }),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.002;

  return { raiz, cuerpo, ruedas, cabeza, ojos, ojosFelices, antena, hombro, codo, sombra };
}
