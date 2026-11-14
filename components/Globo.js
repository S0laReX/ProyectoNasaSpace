'use client';
import { useEffect, useRef } from 'react';
import { JEZERO, TEXTURA_GLOBO } from '../lib/marte';

// Globo de Marte en Three.js con la textura real de Viking (Mars Trek),
// atmósfera, campo de estrellas y un marcador en Jezero.
// Al hacer scroll, el globo gira hasta dejar Jezero de frente y se acerca.
export default function Globo() {
  const contenedor = useRef(null);

  useEffect(() => {
    let cancelado = false;
    let limpiar = () => {};

    (async () => {
      const THREE = await import('three');
      if (cancelado) return;
      const el = contenedor.current;
      const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      el.appendChild(renderer.domElement);

      const escena = new THREE.Scene();
      const camara = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
      camara.position.set(0, 0, 4.2);

      // Luz: sol rasante para resaltar el relieve
      escena.add(new THREE.AmbientLight(0xffffff, 0.35));
      const sol = new THREE.DirectionalLight(0xfff1e0, 2.2);
      sol.position.set(-4, 2, 3);
      escena.add(sol);

      // Planeta
      const grupo = new THREE.Group();
      escena.add(grupo);
      const material = new THREE.MeshStandardMaterial({ color: 0xb4532f, roughness: 1, metalness: 0 });
      const planeta = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), material);
      grupo.add(planeta);
      cargarTextura(THREE).then((tex) => {
        if (cancelado || !tex) return;
        material.map = tex;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      });

      // Atmósfera (resplandor de borde)
      const atmosfera = new THREE.Mesh(
        new THREE.SphereGeometry(1.09, 64, 48),
        new THREE.ShaderMaterial({
          transparent: true, side: THREE.BackSide, depthWrite: false,
          blending: THREE.AdditiveBlending,
          vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: `varying vec3 vN; void main(){ float i = pow(0.62 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(1.0, 0.48, 0.25, 1.0) * i * 1.6; }`,
        }),
      );
      escena.add(atmosfera);

      // Marcador de Jezero
      const pos = latLonAVector(THREE, JEZERO.lat, JEZERO.lon, 1.002);
      const punto = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), new THREE.MeshBasicMaterial({ color: 0x7fe3ff }));
      punto.position.copy(pos);
      const anillo = new THREE.Mesh(
        new THREE.RingGeometry(0.02, 0.026, 48),
        new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, side: THREE.DoubleSide }),
      );
      anillo.position.copy(pos);
      anillo.lookAt(pos.clone().multiplyScalar(2));
      grupo.add(punto, anillo);

      // Estrellas
      const n = 1800;
      const posiciones = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 40);
        posiciones.set([v.x, v.y, v.z], i * 3);
      }
      const geomEstrellas = new THREE.BufferGeometry();
      geomEstrellas.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
      const estrellas = new THREE.Points(geomEstrellas, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.8 }));
      escena.add(estrellas);

      // Ángulo que deja Jezero mirando a la cámara
      const objetivoY = Math.atan2(-pos.x, pos.z);
      const objetivoX = THREE.MathUtils.degToRad(JEZERO.lat) * 0.9;

      const redimensionar = () => {
        const { clientWidth: w, clientHeight: h } = el;
        renderer.setSize(w, h, false);
        camara.aspect = w / h;
        camara.updateProjectionMatrix();
      };
      redimensionar();
      const ro = new ResizeObserver(redimensionar);
      ro.observe(el);

      let raton = { x: 0, y: 0 };
      const alMover = (e) => { raton = { x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 }; };
      window.addEventListener('pointermove', alMover);

      let giroLibre = objetivoY - 2.4; // empieza mostrando otra cara
      let frame;
      const reloj = new THREE.Clock();
      const animar = () => {
        const dt = Math.min(reloj.getDelta(), 0.05);
        const t = reloj.elapsedTime;
        const progreso = Math.min(Math.max(window.scrollY / (window.innerHeight * 0.9), 0), 1);
        const suave = progreso * progreso * (3 - 2 * progreso);

        if (!reducido) giroLibre += dt * 0.06;
        // Giro libre → giro hacia Jezero según el scroll (por el camino más corto)
        const destino = objetivoY + Math.round((giroLibre - objetivoY) / (Math.PI * 2)) * Math.PI * 2;
        grupo.rotation.y = giroLibre + (destino - giroLibre) * suave;
        grupo.rotation.x = objetivoX * suave + raton.y * 0.08;
        grupo.rotation.z = raton.x * -0.04;
        camara.position.z = 4.2 - suave * 1.6;
        camara.position.x = 0.9 * (1 - suave) * (window.innerWidth > 900 ? 1 : 0);

        anillo.scale.setScalar(1 + ((t * 0.8) % 1) * 2.2);
        anillo.material.opacity = 1 - ((t * 0.8) % 1);
        estrellas.rotation.y = t * 0.004;

        renderer.render(escena, camara);
        frame = requestAnimationFrame(animar);
      };
      animar();

      limpiar = () => {
        cancelAnimationFrame(frame);
        ro.disconnect();
        window.removeEventListener('pointermove', alMover);
        renderer.dispose();
        el.removeChild(renderer.domElement);
      };
    })();

    return () => { cancelado = true; limpiar(); };
  }, []);

  return <div ref={contenedor} className="globo" aria-hidden="true" />;
}

function latLonAVector(THREE, lat, lon, r) {
  // Misma convención que SphereGeometry: u = (lon + 180) / 360, v = (90 - lat) / 180
  const phi = THREE.MathUtils.degToRad(lon + 180);
  const theta = THREE.MathUtils.degToRad(90 - lat);
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r);
}

// Une las 8 × 4 teselas del nivel 2 de Mars Trek en una textura equirectangular de 2048 × 1024.
async function cargarTextura(THREE) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 2048;
  lienzo.height = 1024;
  const ctx = lienzo.getContext('2d');
  const teselas = [];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 8; x++) {
      teselas.push(new Promise((ok) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { ctx.drawImage(img, x * 256, y * 256); ok(true); };
        img.onerror = () => ok(false);
        img.src = TEXTURA_GLOBO(x, y);
      }));
    }
  }
  const resultados = await Promise.all(teselas);
  if (!resultados.some(Boolean)) return null;
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
