$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (!(Test-Path 'dist/index.html')) {
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar la interfaz.' }
}
Write-Host 'Tunari Fuego: http://127.0.0.1:8000 (Ctrl+C para detener)'
& .\.venv\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000
