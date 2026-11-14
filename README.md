# Tunari Fuego

Prototipo local para explorar actividad térmica MODIS/VIIRS en Cochabamba. Interfaz en español, mapa con distritos GAMC, filtros por distrito y fechas, área de interés mediante el encuadre del mapa, calendario mensual, importación FIRMS y exportación CSV/GeoJSON.

## Ejecutar

Desde esta carpeta, ejecutar `./start.ps1` en PowerShell y abrir http://127.0.0.1:8000. El servidor escucha únicamente en este equipo. Ctrl+C lo detiene.

Dependencias ya instaladas en `.venv` y `node_modules`. Para reconstruir: `npm run build`. Para desarrollo: ejecutar el backend con `.venv/Scripts/python.exe -m uvicorn api.main:app --reload` y en otra terminal `npm run dev`. El proxy de Vite dirige `/api` al backend.

## Diseño de software

Monolito modular: React + TypeScript + Vite para la interfaz; Leaflet para cartografía; FastAPI para HTTP; Pandas, GeoPandas y PyProj para normalización, intersecciones y grilla UTM 19S. Una sola aplicación sirve el resultado compilado y la API. No requiere Docker, base de datos externa ni claves para la muestra local. Los CSV originales se conservan y las importaciones usan nombres SHA-256 para evitar repetir archivos idénticos. API de lectura municipal sin modificaciones.

`api/analysis.py` contiene las reglas científicas, `api/main.py` los contratos HTTP, y `src/` la presentación. `data/layers/` conserva las capas municipales y `data/sources.json` la procedencia de la muestra NASA. Los archivos importados se guardan en `data/uploads/`.

## Datos y límites

- Incluye una detección real VIIRS NOAA-21 del 11 de noviembre de 2026, descargada de NASA FIRMS. Es una muestra regional, no evidencia de un incendio activo hoy.
- Las detecciones térmicas no equivalen a incendios confirmados. La grilla por día UTC reduce repetición espacial, pero no corrige diferencias de sensibilidad, nubosidad ni frecuencia de revisita entre sensores.
- La cartografía incluye distritos municipales. No se presenta la cota 2750 como límite del Parque Nacional Tunari: falta obtener su límite oficial.
- Falta importar y verificar el histórico 2000–2026. Un mes sin registros se muestra como desconocido; no se presupone cero incendios.
- El calendario muestra meses completos disponibles, incluso cuando el filtro de fechas delimita solo una parte de un mes; los puntos y métricas sí usan las fechas exactas.
- Z se calcula por sensor usando el mismo mes de tres o más años anteriores con cobertura completa declarada y varianza positiva. El máximo Z entre sensores es exploratorio y requiere calibración. El umbral 2 no es una alerta operativa validada.
- La cobertura se declara con CSV `sensor,start,end`, fechas ISO. Importar una declaración reemplaza la anterior. Verificar previamente los metadatos y la disponibilidad del sensor; no declarar cobertura completa para una muestra de siete días.
- El mapa limita la visualización a 5.000 puntos; las descargas incluyen todos los resultados filtrados. Cada CSV puede tener hasta 30 MB y un millón de filas. El análisis en memoria está pensado para recortes regionales de una hackathon.
- Mapa base OpenStreetMap y tipografías Google requieren internet; análisis, datos importados, distritos y exportación funcionan localmente. Sin internet se conserva un fondo neutro con las capas propias.

## Desafío y alcance

Enfoque local: https://spaceappschallenge-cbba.com/#retos

NASA: https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/

Implementado: exploración por área/distrito, normalización inicial de MODIS/VIIRS, calendario, comparación estacional condicionada a cobertura y exportaciones. Pendiente: histórico completo, calibración de armonización, validación científica y límite oficial de Tunari. La página NASA no respondió en la revisión previa; no se afirma cumplimiento integral de un pliego no verificable.

## Verificación

`npm run build` compila y verifica TypeScript. `.venv/Scripts/python.exe -m pytest tests -q` comprueba deduplicación espacial diaria entre sensores, condiciones de cobertura para Z y endpoints de lectura. Documentación API local: http://127.0.0.1:8000/docs.

## Integraciones NASA FIRMS y SIMB

En «Datos y metodología» encontrarás el panel «Fuentes conectadas».

1. Solicita tu MAP_KEY en https://firms.modaps.eosdis.nasa.gov/api/area/.
2. Copia `.env.example` a `.env` y completa `FIRMS_MAP_KEY=tu_clave` en tu editor. No compartas la clave ni la subas a Git. También se admite la variable de entorno del mismo nombre (tiene prioridad).
3. Pulsa «Revisar conexión». No es necesario reiniciar para releer `.env`.
4. Selecciona producto MODIS/VIIRS, 1–5 días y opcionalmente fecha inicial UTC. Sin fecha se consultan los días recientes. El área es el rectángulo elegido mediante «Analizar área visible»; la selección de distrito se aplica después en el análisis local.
5. Pulsa «Actualizar desde NASA». La actualización periódica opcional consulta cada 15 minutos solo mientras este panel permanezca montado y la pestaña visible. Se detiene ante errores; no es una tarea en segundo plano del sistema.

`POST /api/firms/sync` escribe únicamente archivos locales: la petición a NASA es GET. La respuesta se valida antes de guardarse; las descargas llevan hash, producto, área, fecha y número de observaciones en `data/uploads/`. No se guardan URLs con clave en los metadatos. No se declaran meses completos automáticamente. Las respuestas repetidas no duplican archivos CSV idénticos y el análisis elimina detecciones idénticas entre archivos.

Los productos NRT y SP dependen de su disponibilidad publicada por NASA. Esta consulta regional no sustituye la descarga masiva del histórico. Se limita a una región alrededor de Cochabamba y a 30 MB por respuesta. Las excepciones de transporte se redactan para no exponer la clave.

SIMB ofrece un WMS público verificado mediante GetCapabilities el 14 de noviembre de 2026:
https://simb-geo.produccion.gob.bo/geoserver/simb/wms?service=WMS&request=GetCapabilities

En el mapa puedes activar `areas_protegidas_nacionales` y `fs_bosques`. Son imágenes cartográficas que requieren internet, sin incorporación de puntos SIMB a los conteos NASA. La disponibilidad del servicio puede variar; la interfaz avisa ante errores de carga. La fecha y precisión de los límites y su uso como filtro vectorial requieren validación adicional. El WMS no sustituye un archivo oficial del Parque Nacional Tunari verificado para análisis.

Fuente: Sistema de Información y Monitoreo de Bosques (SIMB) – MPDyMA. https://simb.produccion.gob.bo/simb/. Sus condiciones publicadas permiten uso individual y académico, exigen atribución y restringen comercialización. La interfaz incorpora atribución y enlace de procedencia.

Validación: 10 pruebas locales aprobadas, incluyendo importación idempotente, respuestas vacías, rechazo de errores remotos, validación de consultas y protección de secretos. Las pruebas FIRMS usan respuestas simuladas; la consulta autenticada real requiere configurar una MAP_KEY válida. Compilación TypeScript/Vite aprobada.
