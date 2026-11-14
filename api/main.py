from pathlib import Path
from functools import lru_cache
import io,json,hashlib
import asyncio
import pandas as pd
from fastapi import FastAPI,UploadFile,HTTPException,Query
from fastapi.responses import Response,FileResponse
from fastapi.staticfiles import StaticFiles
from api.analysis import normalize_csv,analyze
from api.firms import SyncRequest, SOURCES, map_key, download, save_response

ROOT=Path(__file__).resolve().parent.parent
DATA=ROOT/'data';DATA.mkdir(exist_ok=True)
app=FastAPI(title='Tunari Fuego',version='0.1.0',description='Prototipo local de calendario MODIS/VIIRS. Sin cambios en servicios municipales.')
sync_lock=asyncio.Lock()

@app.get('/api/integrations')
def integrations():
    latest=DATA/'uploads/firms-latest.json'
    return {'firms':{'configured':bool(map_key(ROOT)),'sources':SOURCES,
                     'last_sync':json.loads(latest.read_text(encoding='utf-8')) if latest.exists() else None},
            'simb':{'url':'https://simb.produccion.gob.bo/simb/',
                    'status':'wms_available',
                    'wms':'https://simb-geo.produccion.gob.bo/geoserver/simb/wms',
                    'layers':['areas_protegidas_nacionales','fs_bosques'],
                    'attribution':'Fuente: Sistema de Información y Monitoreo de Bosques (SIMB) – MPDyMA.',
                    'note':'Consulta complementaria. No se incorporan focos SIMB a los conteos NASA.'}}

@app.post('/api/firms/sync')
async def sync_firms(query:SyncRequest):
    key=map_key(ROOT)
    if not key:raise HTTPException(409,'Configura FIRMS_MAP_KEY en .env del proyecto. Solicítala gratuitamente en NASA FIRMS.')
    if sync_lock.locked():raise HTTPException(409,'Ya hay una descarga FIRMS en curso.')
    async with sync_lock:
        raw=await download(query,key)
        result=save_response(raw,query,DATA)
        load_data.cache_clear()
        return result

@lru_cache
def layers():
    return {p.stem:json.loads(p.read_text(encoding='utf-8')) for p in (DATA/'layers').glob('*.geojson')}

@lru_cache(maxsize=2)
def load_data(signature:tuple):
    frames=[];quality={'input_rows':0,'invalid_rows':0,'duplicate_rows':0,'valid_rows':0}
    for path,_,_ in signature:
        frame,q=normalize_csv(Path(path).read_bytes());frames.append(frame)
        for key in quality:quality[key]+=q[key]
    if not frames:raise HTTPException(409,'No hay CSV cargados.')
    # Normalize together so overlapping imports do not count twice.
    frame=pd.concat(frames,ignore_index=True)
    before=len(frame);frame=frame.drop_duplicates(['latitude','longitude','timestamp','sensor','satellite'])
    quality['duplicate_rows']+=before-len(frame);quality['valid_rows']=len(frame)
    return frame,quality

def current():
    paths=([DATA/'observations.csv'] if (DATA/'observations.csv').exists() else [])+list((DATA/'uploads').glob('*.csv'))
    return load_data(tuple((str(p),p.stat().st_mtime_ns,p.stat().st_size) for p in paths))

@app.get('/api/health')
def health():return {'status':'ok','app':'Tunari Fuego','version':'0.1.0'}

@app.get('/api/config')
def config():
    return {'layers':layers(),'sources':json.loads((DATA/'sources.json').read_text(encoding='utf-8')) if (DATA/'sources.json').exists() else [],
            'districts':[f['properties']['distrito'] for f in layers().get('distritos',{}).get('features',[])],
            'historical_archive_loaded':False,'tunari_boundary_verified':False,
            'official_challenge':'https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/'}

def compute(west,south,east,north,start,end,district,cell_m):
    df,q=current()
    coverage=pd.read_csv(DATA/'coverage.csv') if (DATA/'coverage.csv').exists() else None
    try:return analyze(df,q,[west,south,east,north],start,end,district,layers(),cell_m,coverage)
    except (ValueError,KeyError) as e:raise HTTPException(422,str(e)) from e

@app.get('/api/analysis')
def analysis(west:float=-66.6,south:float=-17.7,east:float=-65.7,north:float=-16.9,
             start:str|None=None,end:str|None=None,district:str='all',cell_m:int=Query(1000,ge=500,le=5000)):
    result=compute(west,south,east,north,start,end,district,cell_m);result.pop('filtered_records');return result

@app.get('/api/export/{format}')
def export(format:str,west:float=-66.6,south:float=-17.7,east:float=-65.7,north:float=-16.9,
           start:str|None=None,end:str|None=None,district:str='all',cell_m:int=Query(1000,ge=500,le=5000)):
    result=compute(west,south,east,north,start,end,district,cell_m);records=result['filtered_records']
    if format=='csv':
        content=pd.DataFrame(records,columns=['latitude','longitude','date','timestamp','sensor','satellite','confidence','frp','cell']).to_csv(index=False).encode('utf-8-sig');media='text/csv';name='focos_filtrados.csv'
    elif format=='geojson':
        content=json.dumps({'type':'FeatureCollection','features':[{'type':'Feature','geometry':{'type':'Point','coordinates':[r['longitude'],r['latitude']]},'properties':r} for r in records]},ensure_ascii=False).encode();media='application/geo+json';name='focos_filtrados.geojson'
    elif format=='calendar':
        content=pd.DataFrame(result['calendar']).to_csv(index=False).encode('utf-8-sig');media='text/csv';name='calendario.csv'
    else:raise HTTPException(404,'Formato desconocido')
    return Response(content,media_type=media,headers={'Content-Disposition':f'attachment; filename="{name}"'})

@app.post('/api/import')
async def import_csv(files:list[UploadFile]):
    folder=DATA/'uploads';folder.mkdir(exist_ok=True);results=[]
    for file in files:
        raw=await file.read(30_000_001)
        if len(raw)>30_000_000:raise HTTPException(413,'Cada CSV puede pesar hasta 30 MB. Recorta el archivo.')
        try:_,q=normalize_csv(raw)
        except (ValueError,UnicodeError,pd.errors.ParserError) as e:raise HTTPException(422,str(e)) from e
        digest=hashlib.sha256(raw).hexdigest();(folder/(digest+'.csv')).write_bytes(raw)
        results.append({'filename':file.filename,'sha256':digest,**q})
    load_data.cache_clear();return {'imports':results}

@app.post('/api/coverage')
async def import_coverage(file:UploadFile):
    raw=await file.read(100_001)
    if len(raw)>100_000:raise HTTPException(413,'La tabla de cobertura es demasiado grande.')
    try:
        from api.analysis import covered_months
        frame=pd.read_csv(io.BytesIO(raw));covered_months(frame)
    except (ValueError,KeyError) as e:raise HTTPException(422,'Cobertura requiere sensor,start,end válidos.') from e
    (DATA/'coverage.csv').write_bytes(raw);return {'status':'ok','note':'Cobertura declarada por quien importa; verificar con metadatos del archivo y disponibilidad del sensor.'}

if (ROOT/'dist/assets').exists():
    app.mount('/assets',StaticFiles(directory=ROOT/'dist/assets'),name='assets')

@app.get('/')
def index():
    if not (ROOT/'dist/index.html').exists():raise HTTPException(503,'Ejecuta npm run build.')
    return FileResponse(ROOT/'dist/index.html')
