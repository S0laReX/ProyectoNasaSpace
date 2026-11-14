import Globo from '../components/Globo';
import Planificador from '../components/Planificador';
import Revelar from '../components/Revelar';
import Telemetria from '../components/Telemetria';

const OBJETIVOS = [
  {
    n: '01', titulo: 'Ciencia en un antiguo lago',
    texto: 'Jezero albergó un lago y un delta hace unos 3.500 millones de años. Los sedimentos del delta son el mejor lugar para buscar señales de vida microbiana antigua.',
  },
  {
    n: '02', titulo: 'La seguridad va primero',
    texto: 'Cada ruta se evalúa con pendientes medidas por el rover, la radiación registrada en superficie y la autonomía del traje, con reserva para volver al hábitat.',
  },
  {
    n: '03', titulo: 'Saber qué esperar',
    texto: 'Las fotos de Perseverance en cada punto del recorrido muestran el terreno desde el suelo, como lo verá la tripulación al llegar.',
  },
];

const DATOS = [
  { tipo: 'Óptico', nombre: 'HiRISE · CTX', mision: 'Mars Reconnaissance Orbiter', uso: 'Rocas, dunas y obstáculos a 25 cm por píxel.' },
  { tipo: 'Topográfico', nombre: 'MOLA', mision: 'Mars Global Surveyor', uso: 'Relieve regional: bordes del cráter y frente del delta.' },
  { tipo: 'Térmico', nombre: 'THEMIS día / noche', mision: 'Mars Odyssey', uso: 'Inercia térmica: roca firme (cálida de noche) frente a polvo suelto.' },
  { tipo: 'Telemetría', nombre: 'Waypoints de Perseverance', mision: 'Mars 2020', uso: 'Recorrido real, elevación e inclinación del terreno ya transitado.' },
  { tipo: 'Atmosférico', nombre: 'MEDA', mision: 'Mars 2020', uso: 'Temperatura, presión y horas de luz para programar la EVA.' },
  { tipo: 'Radiación', nombre: 'RAD', mision: 'Curiosity (MSL)', uso: 'Dosis de referencia en superficie para cada caminata.' },
];

const PASOS = [
  ['Capturar', 'Teselas WMTS de Mars Trek y JSON de la misión Mars 2020'],
  ['Unificar', 'Todo en proyección equirectangular sobre el mismo mapa'],
  ['Evaluar', 'Distancia, tiempo, consumibles, pendiente y dosis por ruta'],
  ['Decidir', 'Alertas claras y vista de superficie de cada parada'],
];

export default function Inicio() {
  return (
    <>
      <nav className="nav">
        <a href="#inicio" className="logo"><span className="logo-punto" />MARSWALK</a>
        <div className="nav-links">
          <a href="#mision">Misión</a>
          <a href="#mapa">Mapa</a>
          <a href="#datos">Datos</a>
        </div>
        <a href="#mapa" className="boton primario pequeno">Planificar EVA</a>
      </nav>

      <header id="inicio" className="hero">
        <Globo />
        <div className="hero-velo" />
        <div className="hero-contenido">
          <p className="eyebrow anim-entrada" style={{ '--d': '100ms' }}>NASA Space Apps 2026 · Interplanetary Survival Guide</p>
          <h1 className="anim-entrada" style={{ '--d': '250ms' }}>
            Camina Marte<br /><span className="degradado">con datos.</span>
          </h1>
          <p className="hero-sub anim-entrada" style={{ '--d': '400ms' }}>
            Un mapa por capas del cráter Jezero que une imágenes orbitales, temperatura, relieve, clima y la telemetría
            real de Perseverance para planificar caminatas seguras y llenas de ciencia.
          </p>
          <div className="hero-cta anim-entrada" style={{ '--d': '550ms' }}>
            <a href="#mapa" className="boton primario">Abrir el mapa</a>
            <a href="#datos" className="boton fantasma">Ver los datos</a>
          </div>
          <div className="anim-entrada" style={{ '--d': '700ms' }}><Telemetria /></div>
        </div>
        <a href="#mision" className="desliza" aria-label="Bajar"><span /></a>
        <div className="hud-marco" aria-hidden="true"><i /><i /><i /><i /></div>
      </header>

      <main>
        <section id="mision" className="seccion">
          <Revelar className="seccion-cab">
            <p className="eyebrow">La misión</p>
            <h2>Una caminata por Jezero, planificada como en el centro de control.</h2>
          </Revelar>
          <div className="grid-3">
            {OBJETIVOS.map((o, i) => (
              <Revelar key={o.n} className="tarjeta tarjeta-objetivo" retraso={i * 120}>
                <span className="num-grande">{o.n}</span>
                <h3>{o.titulo}</h3>
                <p className="texto-2">{o.texto}</p>
              </Revelar>
            ))}
          </div>
        </section>

        <section id="mapa" className="seccion seccion-ancha">
          <Revelar className="seccion-cab">
            <p className="eyebrow">Mapa operativo</p>
            <h2>Elige una capa, traza la ruta y revisa los riesgos.</h2>
            <p className="texto-2">Cambia entre imagen óptica, relieve y térmico. Haz clic en un punto del recorrido del rover para ver cómo luce el terreno desde el suelo.</p>
          </Revelar>
          <Revelar><Planificador /></Revelar>
        </section>

        <section id="datos" className="seccion">
          <Revelar className="seccion-cab">
            <p className="eyebrow">Datos de NASA</p>
            <h2>Seis tipos de datos, una sola vista.</h2>
          </Revelar>
          <div className="grid-3">
            {DATOS.map((d, i) => (
              <Revelar key={d.nombre} className="tarjeta tarjeta-dato" retraso={(i % 3) * 100}>
                <span className="etiqueta-dato">{d.tipo}</span>
                <h3>{d.nombre}</h3>
                <p className="mision">{d.mision}</p>
                <p className="texto-2">{d.uso}</p>
              </Revelar>
            ))}
          </div>

          <Revelar className="pasos">
            {PASOS.map(([t, d], i) => (
              <div key={t} className="paso" style={{ '--i': i }}>
                <span className="paso-num">{String(i + 1).padStart(2, '0')}</span>
                <h4>{t}</h4>
                <p className="texto-2">{d}</p>
              </div>
            ))}
          </Revelar>
        </section>
      </main>

      <footer className="pie">
        <div>
          <a href="#inicio" className="logo"><span className="logo-punto" />MARSWALK</a>
          <p className="texto-2 pequeno">Proyecto para NASA Space Apps Challenge 2026 · Cochabamba, Bolivia.</p>
        </div>
        <p className="texto-2 pequeno">
          Datos: NASA/JPL-Caltech, NASA Solar System Treks, MRO HiRISE (Univ. of Arizona), Mars Odyssey THEMIS (ASU),
          MGS MOLA, Mars 2020 MEDA (CAB) y MSL RAD. Proyecto independiente, sin respaldo oficial de NASA.
        </p>
      </footer>
    </>
  );
}
