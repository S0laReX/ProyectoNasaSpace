import pandas as pd
from fastapi.testclient import TestClient
from api.analysis import normalize_csv, analyze
from api.main import app

def test_same_cell_day_across_sensors_is_one_occupied_cell():
    raw=b'latitude,longitude,acq_date,acq_time,instrument,confidence\n-17.4,-66.1,2026-11-11,0552,VIIRS,n\n-17.4,-66.1,2026-11-11,0652,MODIS,90\n-17.4,-66.1,2026-11-11,0552,VIIRS,n\n'
    df,q=normalize_csv(raw)
    result=analyze(df,q,[-66.6,-17.7,-65.7,-16.9],None,None,'all',{})
    assert result['summary']['detections']==2
    assert result['summary']['occupied_cell_days']==1
    assert result['summary']['cross_sensor_cell_days']==1
    assert result['quality']['duplicate_rows']==1
    assert result['calendar'][0]['z_score'] is None

def test_anomaly_requires_complete_prior_seasons():
    rows=['latitude,longitude,acq_date,acq_time,instrument,confidence']
    for year,count in [(2023,1),(2024,2),(2025,3),(2026,6)]:
        rows += [f'-17.4,-66.1,{year}-11-{day:02},0552,VIIRS,n' for day in range(1,count+1)]
    df,q=normalize_csv('\n'.join(rows).encode())
    coverage=pd.DataFrame([{'sensor':'VIIRS','start':f'{y}-11-01','end':f'{y}-11-30'} for y in range(2023,2027)])
    result=analyze(df,q,[-66.6,-17.7,-65.7,-16.9],'2026-11-01','2026-11-30','all',{},coverage=coverage)
    assert result['calendar'][0]['z_score']==4.0
    assert result['calendar'][0]['alert'] is True
    coverage.loc[0,'start']='2023-11-02'
    result=analyze(df,q,[-66.6,-17.7,-65.7,-16.9],None,None,'all',{},coverage=coverage)
    assert result['calendar'][-1]['z_score'] is None

def test_read_endpoints_and_invalid_bounds():
    client=TestClient(app)
    assert client.get('/api/health').status_code==200
    assert len(client.get('/api/config').json()['districts'])==15
    response=client.get('/api/analysis')
    assert response.status_code==200
    assert 'filtered_records' not in response.json()
    assert client.get('/api/analysis?west=-65&east=-66').status_code==422
    export=client.get('/api/export/geojson')
    assert export.status_code==200
    assert export.json()['type']=='FeatureCollection'

def test_local_import_rejects_bad_schema_and_is_idempotent(tmp_path,monkeypatch):
    import api.main as main
    monkeypatch.setattr(main,'DATA',tmp_path)
    client=TestClient(main.app)
    raw=b'latitude,longitude,acq_date,acq_time,instrument,confidence\n-17.4,-66.1,2026-11-11,0552,VIIRS,n\n'
    for _ in range(2):
        assert client.post('/api/import',files=[('files',('sample.csv',raw,'text/csv'))]).status_code==200
    assert len(list((tmp_path/'uploads').glob('*.csv')))==1
    assert client.post('/api/import',files=[('files',('bad.csv',b'wrong\n1','text/csv'))]).status_code==422
