$ErrorActionPreference = 'Stop'

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $PSScriptRoot "migrations\postgres-native\$timestamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

docker inspect bcl-postgres *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Container bcl-postgres is not available.'
}

$dumpPath = Join-Path $backupDir 'bcl_database.dump'
$globalsPath = Join-Path $backupDir 'globals.sql'
$containerDumpPath = '/tmp/bcl_database.dump'

& docker exec bcl-postgres sh -lc "rm -f $containerDumpPath && pg_dump -U bcl_user -d bcl_database -Fc -f $containerDumpPath"
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to export database dump from Docker PostgreSQL.'
}

& docker cp "bcl-postgres:$containerDumpPath" $dumpPath
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $dumpPath)) {
    throw 'Failed to copy database dump from Docker container.'
}

& docker exec bcl-postgres sh -lc "rm -f $containerDumpPath" *> $null

$globals = & docker exec bcl-postgres sh -lc "pg_dumpall -U bcl_user --globals-only"
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to export global roles from Docker PostgreSQL.'
}
$globals | Out-File -FilePath $globalsPath -Encoding utf8

if (Test-Path (Join-Path $PSScriptRoot '.env')) {
    Copy-Item (Join-Path $PSScriptRoot '.env') (Join-Path $backupDir 'root.env.snapshot') -Force
}
if (Test-Path (Join-Path $PSScriptRoot 'backend\.env')) {
    Copy-Item (Join-Path $PSScriptRoot 'backend\.env') (Join-Path $backupDir 'backend.env.snapshot') -Force
}

Write-Output "[SUCCESS] Docker PostgreSQL backup created."
Write-Output "[INFO] Backup directory: $backupDir"
