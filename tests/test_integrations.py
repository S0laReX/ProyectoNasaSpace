import asyncio
import json
import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from api import firms, main

CSV=b'latitude,longitude,acq_date,acq_time,satellite,confidence\n-17.4,-66.1,2026-11-11,0552,N21,n\n'

def test_missing_key_and_status_do_not_expose_secret(monkeypatch,tmp_path):
    monkeypatch.setattr(main,'ROOT',tmp_path)
    monkeypatch.delenv('FIRMS_MAP_KEY',raising=False)
    client=TestClient(main.app)
    assert client.post('/api/firms/sync',json={}).status_code==409
    (tmp_path/'.env').write_text('FIRMS_MAP_KEY=test_secret_key_123')
    result=client.get('/api/integrations')
    assert result.json()['firms']['configured']
    assert 'test_secret_key' not in result.text

def test_sync_stores_validated_viirs_and_repeat_is_idempotent(monkeypatch,tmp_path):
    monkeypatch.setattr(main,'DATA',tmp_path)
    monkeypatch.setattr(main,'map_key',lambda _: 'test_secret_key_123')
    async def fake_download(query,key):return CSV
    monkeypatch.setattr(main,'download',fake_download)
    with TestClient(main.app) as client:
        for _ in range(2):
            result=client.post('/api/firms/sync',json={'source':'VIIRS_NOAA21_NRT'})
            assert result.status_code==200
            assert result.json()['rows']==1
        assert len(list((tmp_path/'uploads').glob('*.csv')))==1
        assert client.get('/api/analysis').json()['summary']['viirs']==1
        assert not (tmp_path/'coverage.csv').exists()
        assert 'test_secret_key' not in json.dumps(client.get('/api/integrations').json())
    main.load_data.cache_clear()

def test_invalid_remote_payload_does_not_modify_data(tmp_path):
    with pytest.raises(HTTPException) as err:
        firms.save_response(b'Invalid MAP_KEY: secret',firms.SyncRequest(),tmp_path)
    assert err.value.status_code==502
    assert 'secret' not in err.value.detail
    assert list(tmp_path.iterdir())==[]

def test_empty_csv_is_recorded_without_creating_detections(tmp_path):
    result=firms.save_response(CSV.splitlines()[0]+b'\n',firms.SyncRequest(),tmp_path)
    assert result['rows']==0
    assert not list((tmp_path/'uploads').glob('*.csv'))

def test_query_rejects_bad_product_days_or_world():
    client=TestClient(main.app)
    for payload in [{'source':'https://example.com'},{'days':7},{'west':-180,'east':180}]:
        assert client.post('/api/firms/sync',json=payload).status_code==422

def test_transport_errors_redact_secret(monkeypatch):
    original=httpx.AsyncClient
    def handler(request):raise httpx.ConnectError('URL contains supersecret123',request=request)
    monkeypatch.setattr(firms.httpx,'AsyncClient',lambda **kwargs:original(transport=httpx.MockTransport(handler),**kwargs))
    with pytest.raises(HTTPException) as err:
        asyncio.run(firms.download(firms.SyncRequest(),'supersecret123'))
    assert 'supersecret123' not in err.value.detail
