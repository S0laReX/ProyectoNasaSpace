import Escena from '../components/Escena';
import Revelar from '../components/Revelar';

const OBJETIVOS = [
  {
    titulo: 'Ciencia en un antiguo lago',
    texto: 'Jezero albergó un lago y un delta hace unos 3.500 millones de años. Los sedimentos del delta son el mejor lugar para buscar señales de vida microbiana antigua.',
  },
  {
    titulo: 'La seguridad va primero',
    texto: 'Cada ruta se evalúa con la pendiente del modelo de terreno, la radiación registrada en superficie y la autonomía del traje, con reserva para volver al hábitat.',
  },
  {
    titulo: 'Saber qué esperar',
    texto: 'Las fotos de Perseverance en cada punto del recorrido muestran el terreno desde el suelo, como lo verá la tripulación al llegar.',
  },
];

const DATOS = [
  { tipo: 'Óptico', nombre: 'HiRISE y CTX', mision: 'Mars Reconnaissance Orbiter', uso: 'Rocas, dunas y obstáculos a 25 cm por píxel.' },
  { tipo: 'Topográfico', nombre: 'DTM CTX de Jezero', mision: 'Mars Reconnaissance Orbiter (USGS)', uso: 'Pendiente y elevación cada 40 m: de aquí salen las zonas seguras y no seguras.' },
  { tipo: 'Topográfico', nombre: 'MOLA', mision: 'Mars Global Surveyor', uso: 'Relieve regional: bordes del cráter y frente del delta.' },
  { tipo: 'Térmico', nombre: 'THEMIS día y noche', mision: 'Mars Odyssey', uso: 'Inercia térmica: roca firme, cálida de noche, frente a polvo suelto.' },
  { tipo: 'Telemetría', nombre: 'Waypoints de Perseverance', mision: 'Mars 2020', uso: 'Recorrido real, elevación, inclinación e hitos del terreno ya transitado.' },
  { tipo: 'Atmosférico', nombre: 'MEDA', mision: 'Mars 2020', uso: 'Temperatura, presión y horas de luz para programar la EVA.' },
  { tipo: 'Radiación', nombre: 'RAD', mision: 'Curiosity (MSL)', uso: 'Dosis de referencia en superficie para cada caminata.' },
];

const PASOS = [
  ['Capturar', 'Teselas WMTS de Mars Trek, el DTM de USGS y el JSON de la misión Mars 2020.'],
  ['Unificar', 'Todo en proyección equirectangular sobre el mismo mapa.'],
  ['Evaluar', 'Distancia, tiempo, consumibles, pendiente y dosis por ruta.'],
  ['Decidir', 'Alertas claras y vista de superficie de cada parada.'],
];

export default function Inicio() {
  return (
    <>
      <nav className="nav" aria-label="Principal">
        <a href="#inicio" className="logo">Marswalk</a>
        <div className="nav-links">
          <a href="#mision">Misión</a>
          <a href="#inicio">Mapa</a>
          <a href="#datos">Datos</a>
        </div>
        <a href="#inicio" className="boton primario">Planificar EVA</a>
      </nav>

      <Escena />

      <main>
        <section id="mision" className="seccion seccion-mision">
          <Revelar className="seccion-cab">
            <h2>Una caminata por Jezero, planificada como en el centro de control.</h2>
          </Revelar>
          <ul className="objetivos">
            {OBJETIVOS.map((o, i) => (
              <Revelar como="li" key={o.titulo} className="objetivo" retraso={i * 120}>
                <h3>{o.titulo}</h3>
                <p>{o.texto}</p>
              </Revelar>
            ))}
          </ul>
        </section>

        <section id="datos" className="seccion">
          <Revelar className="seccion-cab">
            <h2>Seis tipos de datos, una sola vista.</h2>
          </Revelar>
          <div className="tabla-envoltura">
            <table className="tabla-datos">
              <thead>
                <tr><th scope="col">Tipo</th><th scope="col">Dato</th><th scope="col">Misión</th><th scope="col">Para qué sirve</th></tr>
              </thead>
              <tbody>
                {DATOS.map((d) => (
                  <tr key={d.nombre}>
                    <td>{d.tipo}</td>
                    <th scope="row">{d.nombre}</th>
                    <td className="mision">{d.mision}</td>
                    <td>{d.uso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Revelar className="pasos-bloque">
            <h3>Del dato a la decisión</h3>
            <ol className="pasos">
              {PASOS.map(([t, d], i) => (
                <li key={t} className="paso" style={{ '--i': i }}>
                  <span className="paso-num">{i + 1}</span>
                  <h4>{t}</h4>
                  <p>{d}</p>
                </li>
              ))}
            </ol>
          </Revelar>
        </section>
      </main>

      <footer className="pie">
        <div className="pie-cuerpo">
          <div className="pie-equipo">
            <p className="pie-nombre">Eternauts of the Valley</p>
            <p className="pie-texto">
              Equipo de Cochabamba, Bolivia, en NASA Space Apps Challenge 2026. Marswalk es nuestra respuesta al reto
              Interplanetary Survival Guide: un mapa para planificar caminatas seguras en Marte.
            </p>
            <a className="pie-destacado" href="https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/">
              Ver el reto en Space Apps
            </a>
          </div>

          <nav className="pie-columnas" aria-label="Pie de página">
            <div>
              <h2 className="pie-titulo">Marswalk</h2>
              <ul>
                <li><a href="#inicio">Mapa de Jezero</a></li>
                <li><a href="#mision">Misión</a></li>
                <li><a href="#datos">Datos</a></li>
              </ul>
            </div>
            <div>
              <h2 className="pie-titulo">Fuentes de datos</h2>
              <ul>
                <li><a href="https://trek.nasa.gov/mars/">Mars Trek</a></li>
                <li><a href="https://mars.nasa.gov/mars2020/">Misión Mars 2020</a></li>
                <li><a href="https://astrogeology.usgs.gov/">USGS Astrogeology</a></li>
                <li><a href="https://www.giss.nasa.gov/tools/mars24/">Mars24, hora en Marte</a></li>
              </ul>
            </div>
            <div>
              <h2 className="pie-titulo">El reto</h2>
              <ul>
                <li><a href="https://www.spaceappschallenge.org/">NASA Space Apps Challenge</a></li>
                <li><a href="https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/">Interplanetary Survival Guide</a></li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="pie-base">
          <p>
            Datos: NASA/JPL-Caltech, NASA Solar System Treks, USGS Astrogeology (DTM CTX de Mars 2020), MRO HiRISE (Univ. of Arizona),
            Mars Odyssey THEMIS (ASU), MGS MOLA, Mars 2020 MEDA (CAB) y MSL RAD.
          </p>
          <p className="pie-aviso">Proyecto independiente de Eternauts of the Valley, sin respaldo oficial de NASA.</p>
        </div>
      </footer>
    </>
  );
}
