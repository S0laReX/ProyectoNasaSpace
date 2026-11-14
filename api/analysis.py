"""Transparent prototype: occupied 1-km cells per UTC day, not independent fires."""
from __future__ import annotations
import io
import numpy as np
import pandas as pd
import geopandas as gpd
from pyproj import Transformer

MAX_ROWS = 1_000_000
TO_METERS = Transformer.from_crs(4326, 32719, always_xy=True)


def normalize_csv(raw: bytes) -> tuple[pd.DataFrame, dict]:
    df = pd.read_csv(io.BytesIO(raw), dtype=str, encoding='utf-8-sig')
    df.columns = df.columns.str.strip().str.lower()
    needed = {'latitude', 'longitude', 'acq_date', 'acq_time'}
    if not needed.issubset(df.columns):
        raise ValueError('El CSV debe incluir latitude, longitude, acq_date y acq_time.')
    if len(df) > MAX_ROWS:
        raise ValueError('Usa un recorte de hasta un millón de observaciones.')
    original = len(df)
    for col in ['latitude', 'longitude', 'frp']:
        df[col] = pd.to_numeric(df.get(col, pd.Series(index=df.index, dtype=float)), errors='coerce')
    inferred = pd.Series('VIIRS' if 'bright_ti4' in df.columns else 'MODIS', index=df.index)
    sensor = df.get('instrument', inferred).fillna(inferred).str.upper().str.strip()
    df['sensor'] = sensor.where(sensor.isin(['MODIS', 'VIIRS']))
    clock = df['acq_time'].fillna('').str.replace(r'\.0$', '', regex=True).str.zfill(4)
    timestamp = df['acq_date'].fillna('') + ' ' + clock
    df['timestamp'] = pd.to_datetime(timestamp, format='%Y-%m-%d %H%M', utc=True, errors='coerce')
    valid = (df.latitude.between(-90, 90) & df.longitude.between(-180, 180)
             & df.timestamp.notna() & df.sensor.notna())
    rejected = int((~valid).sum())
    df = df.loc[valid].copy()
    df['satellite'] = df.get('satellite', pd.Series('unknown', index=df.index)).fillna('unknown')
    df['confidence'] = df.get('confidence', pd.Series('', index=df.index)).fillna('')
    low = df.confidence.str.lower().isin(['l', 'low'])
    numeric = pd.to_numeric(df.confidence, errors='coerce')
    low |= (df.sensor == 'MODIS') & numeric.notna() & (numeric < 30)
    df['low_confidence'] = low
    # Different file versions may repeat the same sensor/platform observation.
    df['version'] = df.get('version', pd.Series('', index=df.index)).fillna('')
    df['_standard'] = (~df.version.str.contains('NRT', case=False)).astype(int)
    df = df.sort_values('_standard')
    before = len(df)
    df = df.drop_duplicates(['latitude', 'longitude', 'timestamp', 'sensor', 'satellite'], keep='last')
    df['date'] = df.timestamp.dt.strftime('%Y-%m-%d')
    df['frp'] = df.frp.where(df.frp >= 0)
    return df, {'input_rows': original, 'invalid_rows': rejected, 'duplicate_rows': before-len(df), 'valid_rows': len(df)}


def analyze(df: pd.DataFrame, quality: dict, bounds: list[float], start: str | None,
            end: str | None, district: str, layers: dict, cell_m: int = 1000,
            coverage: pd.DataFrame | None = None) -> dict:
    west, south, east, north = bounds
    if not (-180 <= west < east <= 180 and -80 <= south < north <= 84):
        raise ValueError('Revisa el área: oeste < este y sur < norte, entre latitudes −80 y 84.')
    if start and end and start > end:
        raise ValueError('La fecha inicial debe ser anterior a la final.')
    data = df.loc[df.longitude.between(west,east) & df.latitude.between(south,north)].copy()
    if district != 'all' and not data.empty:
        districts = gpd.GeoDataFrame.from_features(layers['distritos']['features'], crs=4326)
        selected = districts.loc[districts.distrito == district]
        if selected.empty: raise ValueError('Distrito desconocido.')
        pts = gpd.GeoSeries(gpd.points_from_xy(data.longitude, data.latitude), index=data.index, crs=4326)
        data = data.loc[pts.intersects(selected.geometry.union_all())]
    # Exclude low-confidence detections; original files remain intact.
    data = data.loc[~data.low_confidence].copy()
    if not data.empty:
        x, y = TO_METERS.transform(data.longitude.to_numpy(),data.latitude.to_numpy())
        data['cell'] = (np.floor(np.asarray(x)/cell_m).astype(np.int64).astype(str) + '_'
                        + np.floor(np.asarray(y)/cell_m).astype(np.int64).astype(str))
    else:
        data['cell'] = pd.Series(dtype=str)
    data['month'] = data.date.str[:7]
    # Compute the reference history before applying the display's date filter.
    per_sensor = data.drop_duplicates(['cell','date','sensor']).groupby(['month','sensor']).size()
    daily = data.drop_duplicates(['cell','date']).groupby('month').size()
    coverage_months = covered_months(coverage)
    months = sorted(set(data.month.tolist()) | set(coverage_months))
    calendar = []
    for month in months:
        row = {'month': month, 'occupied_cell_days': int(daily.get(month,0)),
               'modis': int(per_sensor.get((month,'MODIS'),0)), 'viirs': int(per_sensor.get((month,'VIIRS'),0)),
               'z_score': None, 'baseline_median': None, 'baseline_years': 0, 'alert': False,
               'coverage': 'declared_complete' if month in coverage_months else 'unknown',
               'reason': 'Sin cobertura mensual completa declarada.'}
        # Per-sensor references prevent a switch of sensor from defining an alert.
        scores=[];medians=[];counts=[]
        for sensor in ['MODIS','VIIRS']:
            if sensor not in coverage_months.get(month,set()): continue
            history = [float(per_sensor.get((m,sensor),0)) for m in months
                       if m < month and m[5:] == month[5:] and sensor in coverage_months.get(m,set())]
            if len(history) >= 3:
                std = float(np.std(history,ddof=1))
                if std > 0:
                    scores.append((row['modis' if sensor=='MODIS' else 'viirs']-float(np.mean(history)))/std)
                    medians.append(float(np.median(history)));counts.append(len(history))
        if scores:
            row.update(z_score=round(max(scores),3),baseline_median=medians[scores.index(max(scores))],
                       baseline_years=min(counts),alert=max(scores)>=2,
                       reason='Mayor Z por sensor, con al menos 3 años previos del mismo mes y cobertura declarada.')
        elif month in coverage_months:
            row['reason']='Se requieren 3 años previos comparables y varianza histórica positiva.'
        if (not start or month >= start[:7]) and (not end or month <= end[:7]):calendar.append(row)
    shown=data
    if start:shown=shown.loc[shown.date >= start]
    if end:shown=shown.loc[shown.date <= end]
    records=[]
    for _,r in shown.iterrows():
        records.append({'latitude':float(r.latitude),'longitude':float(r.longitude),'date':r.date,
                        'timestamp':r.timestamp.isoformat(),'sensor':r.sensor,'satellite':r.satellite,
                        'confidence':str(r.confidence),'frp':None if pd.isna(r.frp) else float(r.frp),'cell':r.cell})
    occupied=shown.drop_duplicates(['cell','date'])
    bysensor=shown.drop_duplicates(['cell','date','sensor'])
    return {'quality':quality,'summary':{'detections':len(shown),'occupied_cell_days':len(occupied),
            'modis':int((shown.sensor=='MODIS').sum()),'viirs':int((shown.sensor=='VIIRS').sum()),
            'cross_sensor_cell_days':int(bysensor.groupby(['cell','date']).size().gt(1).sum()),
            'start':None if shown.empty else shown.date.min(),'end':None if shown.empty else shown.date.max()},
            'calendar':calendar,'points':records[:5000],'map_limit':5000,'filtered_records':records,
            'method':{'cell_m':cell_m,'crs':'EPSG:32719','day':'UTC','status':'prototype_not_calibrated',
            'note':'Celda-día ocupada no equivale a incendio independiente. La grilla reduce repetición; no corrige por sí sola la sensibilidad y cobertura de MODIS/VIIRS.'}}


def covered_months(coverage: pd.DataFrame | None) -> dict[str,set[str]]:
    result={}
    if coverage is None or coverage.empty:return result
    for _,r in coverage.iterrows():
        sensor=str(r['sensor']).upper()
        if sensor not in ['MODIS','VIIRS']:raise ValueError('Cobertura: sensor debe ser MODIS o VIIRS.')
        start=pd.Timestamp(r['start']);end=pd.Timestamp(r['end'])
        if start > end:raise ValueError('Cobertura: fecha inicial mayor a la final.')
        for period in pd.period_range(start,end,freq='M'):
            if start <= period.start_time and end.normalize() >= period.end_time.normalize():
                result.setdefault(str(period),set()).add(sensor)
    return result
