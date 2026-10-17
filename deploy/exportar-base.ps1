# Exporta la base de conocimiento local (documentos, chunks y embeddings) a
# kb.dump, para restaurarla en la EC2 sin regenerar embeddings.
# Deja fuera los datos del historial de chat y la base de Keycloak.
#
# Uso, en PowerShell desde la raiz del repo (con "docker compose up -d db"):
#   .\deploy\exportar-base.ps1
#
# No uses "pg_dump ... > kb.dump" en PowerShell: la redireccion reescribe el
# binario en UTF-16 y el archivo queda corrupto. Por eso se escribe dentro del
# contenedor y se copia con "docker compose cp".

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function Leer($clave, $defecto) {
    $linea = Get-Content .env | Where-Object { $_ -match "^$clave=" } | Select-Object -Last 1
    if ($linea) { return $linea.Split("=", 2)[1].Trim() } else { return $defecto }
}
$usuario = Leer "POSTGRES_USER" "dcagent"
$base = Leer "POSTGRES_DB" "dcagent"

Write-Host "Contenido de la base local:"
docker compose exec -T db psql -U $usuario -d $base -c "SELECT source, count(*) AS documentos FROM documents GROUP BY source;"
docker compose exec -T db psql -U $usuario -d $base -c "SELECT count(*) AS chunks FROM chunks;"

docker compose exec -T db pg_dump -U $usuario -d $base -Fc --no-owner --no-privileges `
    --exclude-table-data=chat_history -f /tmp/kb.dump
if ($LASTEXITCODE -ne 0) { throw "pg_dump fallo" }
docker compose cp db:/tmp/kb.dump .\kb.dump
docker compose exec -T db rm /tmp/kb.dump

$mb = [math]::Round((Get-Item .\kb.dump).Length / 1MB, 1)
Write-Host "`nListo: kb.dump ($mb MB). Anota los conteos de arriba para comparar en la EC2."
Write-Host "Subelo con: scp -i .\clave.pem .\kb.dump ubuntu@<IP>:~/agenteDCComics/"
