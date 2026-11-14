"""FIRMS read-only client. Credentials never leave the server except to NASA."""
import hashlib
import io
import json
import os
import re
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Literal

import httpx
import pandas as pd
from fastapi import HTTPException
from pydantic import BaseModel, Field, model_validator
from api.analysis import normalize_csv

SOURCES = ('MODIS_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'VIIRS_SNPP_NRT',
           'MODIS_SP', 'VIIRS_NOAA20_SP', 'VIIRS_NOAA21_SP', 'VIIRS_SNPP_SP')

class SyncRequest(BaseModel):
    source: Literal['MODIS_NRT','VIIRS_NOAA20_NRT','VIIRS_NOAA21_NRT','VIIRS_SNPP_NRT',
                    'MODIS_SP','VIIRS_NOAA20_SP','VIIRS_NOAA21_SP','VIIRS_SNPP_SP'] = 'VIIRS_NOAA21_NRT'
    west: float = -66.6
    south: float = -17.7
    east: float = -65.7
    north: float = -16.9
    days: int = Field(default=2, ge=1, le=5)
    start: date | None = None

    @model_validator(mode='after')
    def validate_area(self):
        # This application uses UTM19S: only bounded regional queries are supported.
        if not (-70 <= self.west < self.east <= -62 and -24 <= self.south < self.north <= -9):
            raise ValueError('Selecciona un área regional alrededor de Cochabamba (lon −70 a −62, lat −24 a −9).')
        if (self.east-self.west)*(self.north-self.south)>16:
            raise ValueError('Reduce el área a un máximo de 16 grados cuadrados.')
        if self.start and self.start>datetime.now(timezone.utc).date():
            raise ValueError('No se pueden consultar fechas futuras.')
        return self

def map_key(root: Path) -> str:
    value=os.environ.get('FIRMS_MAP_KEY','').strip()
    path=root/'.env'
    if not value and path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            name,sep,entry=line.strip().partition('=')
            if sep and name.strip()=='FIRMS_MAP_KEY':
                value=entry.strip().strip('\"\'')
                break
    if value and not re.fullmatch(r'[a-zA-Z0-9_-]{8,128}',value):
        raise HTTPException(503,'FIRMS_MAP_KEY tiene un formato inválido. Revisa el archivo .env local.')
    return value

async def download(query: SyncRequest, key: str) -> bytes:
    area=','.join(str(v) for v in (query.west,query.south,query.east,query.north))
    url=f'https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{query.source}/{area}/{query.days}'
    if query.start:url+='/'+query.start.isoformat()
    try:
        async with httpx.AsyncClient(timeout=45,follow_redirects=False) as client:
            async with client.stream('GET',url) as response:
                if response.status_code==429:raise HTTPException(429,'NASA alcanzó el límite de consultas. Intenta más tarde.')
                if response.status_code in (401,403):raise HTTPException(502,'NASA rechazó la MAP_KEY. Verifica su vigencia.')
                if response.status_code!=200:raise HTTPException(502,'NASA no pudo completar la consulta. Intenta más tarde.')
                chunks=[];size=0
                async for chunk in response.aiter_bytes():
                    size+=len(chunk)
                    if size>30_000_000:raise HTTPException(413,'La respuesta supera 30 MB. Reduce el área o los días.')
                    chunks.append(chunk)
                return b''.join(chunks)
    except httpx.RequestError:
        # Exception text contains the URL, and therefore the secret: never expose it.
        raise HTTPException(502,'No se pudo conectar con NASA FIRMS. Revisa internet e intenta nuevamente.') from None

def save_response(raw: bytes, query: SyncRequest, data: Path) -> dict:
    try:
        table=pd.read_csv(io.BytesIO(raw),dtype=str)
        if not {'latitude','longitude','acq_date','acq_time'}.issubset(table.columns):raise ValueError()
        table['instrument']='MODIS' if query.source.startswith('MODIS') else 'VIIRS'
        normalized=table.to_csv(index=False).encode('utf-8')
        frame,quality=normalize_csv(normalized)
        if quality['invalid_rows']:raise ValueError()
    except (ValueError,UnicodeError,pd.errors.ParserError):
        raise HTTPException(502,'FIRMS no devolvió un CSV válido. Verifica la clave, el producto y sus fechas disponibles.') from None
    digest=hashlib.sha256(normalized).hexdigest()
    record={'provider':'NASA FIRMS','source':query.source,'area':[query.west,query.south,query.east,query.north],
            'days':query.days,'start':query.start.isoformat() if query.start else None,
            'downloaded_at':datetime.now(timezone.utc).isoformat(),'sha256':digest,'rows':len(frame),
            'documentation':'https://firms.modaps.eosdis.nasa.gov/api/area/'}
    folder=data/'uploads';folder.mkdir(exist_ok=True,parents=True)
    # Empty valid queries are recorded, never claimed as verified coverage.
    if len(frame):
        target=folder/(digest+'.csv');temp=folder/(digest+'.tmp');temp.write_bytes(normalized);temp.replace(target)
    meta=folder/'firms-latest.json';temp=folder/'firms-latest.tmp'
    temp.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(meta)
    (folder/(digest+'.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
    return {**record,'quality':quality,'note':'Descarga local; no declara cobertura histórica completa.'}
