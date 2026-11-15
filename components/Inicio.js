'use client';
import Escena from './Escena';
import Revelar from './Revelar';
import ProgresoScroll from './ProgresoScroll';
import { SelectorIdioma, useIdioma } from './Idioma';

// La página completa: navegación, escena (globo → mapa), misión, datos y pie. Todo el texto sale del diccionario.
const RETO = 'https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/';

export default function Inicio() {
  const { t } = useIdioma();
  const objetivos = t('mision.objetivos');
  const filas = t('datos.filas');
  const pasos = t('datos.pasos');

  return (
    <>
      <nav className="nav" aria-label={t('nav.principal')}>
        <a href="#inicio" className="logo">Marswalk</a>
        <div className="nav-links">
          <a href="#mision">{t('nav.mision')}</a>
          <a href="#inicio">{t('nav.mapa')}</a>
          <a href="#datos">{t('nav.datos')}</a>
        </div>
        <SelectorIdioma />
        <a href="#inicio" className="boton primario">{t('nav.planificar')}</a>
        <ProgresoScroll />
      </nav>

      <Escena />

      <main>
        <section id="mision" className="seccion seccion-mision">
          <Revelar className="seccion-cab">
            <h2>{t('mision.titulo')}</h2>
          </Revelar>
          <ul className="objetivos">
            {objetivos.map((o, i) => (
              <Revelar como="li" key={i} className="objetivo" retraso={i * 120}>
                <h3>{o.titulo}</h3>
                <p>{o.texto}</p>
              </Revelar>
            ))}
          </ul>
        </section>

        <section id="datos" className="seccion">
          <Revelar className="seccion-cab">
            <h2>{t('datos.titulo')}</h2>
          </Revelar>
          <div className="tabla-envoltura">
            <table className="tabla-datos">
              <thead>
                <tr>
                  <th scope="col">{t('datos.cabecera.tipo')}</th>
                  <th scope="col">{t('datos.cabecera.dato')}</th>
                  <th scope="col">{t('datos.cabecera.mision')}</th>
                  <th scope="col">{t('datos.cabecera.uso')}</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((d, i) => (
                  <Revelar como="tr" key={i} retraso={i * 60} className="">
                    <td>{d.tipo}</td>
                    <th scope="row">{d.nombre}</th>
                    <td className="mision">{d.mision}</td>
                    <td>{d.uso}</td>
                  </Revelar>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pasos-bloque">
            <Revelar><h3>{t('datos.pasosTitulo')}</h3></Revelar>
            <ol className="pasos">
              {pasos.map(([titulo, texto], i) => (
                <Revelar como="li" key={i} className="paso" retraso={i * 110}>
                  <span className="paso-num">{i + 1}</span>
                  <h4>{titulo}</h4>
                  <p>{texto}</p>
                </Revelar>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="pie">
        <div className="pie-cuerpo">
          <div className="pie-equipo">
            <p className="pie-nombre">Eternauts of the Valley</p>
            <p className="pie-texto">{t('pie.texto')}</p>
            <a className="pie-destacado" href={RETO}>{t('pie.verReto')}</a>
          </div>

          <nav className="pie-columnas" aria-label={t('pie.aria')}>
            <div>
              <h2 className="pie-titulo">Marswalk</h2>
              <ul>
                <li><a href="#inicio">{t('pie.mapa')}</a></li>
                <li><a href="#mision">{t('nav.mision')}</a></li>
                <li><a href="#datos">{t('nav.datos')}</a></li>
              </ul>
            </div>
            <div>
              <h2 className="pie-titulo">{t('pie.fuentes')}</h2>
              <ul>
                <li><a href="https://trek.nasa.gov/mars/">Mars Trek</a></li>
                <li><a href="https://mars.nasa.gov/mars2020/">{t('pie.m2020')}</a></li>
                <li><a href="https://astrogeology.usgs.gov/">USGS Astrogeology</a></li>
                <li><a href="https://www.giss.nasa.gov/tools/mars24/">{t('pie.mars24')}</a></li>
              </ul>
            </div>
            <div>
              <h2 className="pie-titulo">{t('pie.reto')}</h2>
              <ul>
                <li><a href="https://www.spaceappschallenge.org/">NASA Space Apps Challenge</a></li>
                <li><a href={RETO}>Interplanetary Survival Guide</a></li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="pie-base">
          <p>{t('pie.creditos')}</p>
          <p className="pie-aviso">{t('pie.aviso')}</p>
        </div>
      </footer>
    </>
  );
}
