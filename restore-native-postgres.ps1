param(
    [string]$DumpPath,
    [string]$GlobalsPath,
    [string]$DbHost = '127.0.0.1',
    [int]$Port = 5432,
    [string]$AdminUser = 'postgres',
    [string]$AdminPassword = 'secure_password_2025',
    [string]$AppDb = 'bcl_database',
    [string]$AppUser = 'bcl_user',
    [string]$AppPassword = 'secure_password_2025'
)

$ErrorActionPreference = 'Stop'

function Find-PgBin {
    $candidates = @(
        'C:\Program Files\PostgreSQL\15\bin',
        'C:\Program Files\PostgreSQL\16\bin',
        'C:\Program Files\PostgreSQL\17\bin'
    )

    foreach ($candidate in $candidates) {
        if (Test-Path (Join-Path $candidate 'psql.exe')) {
            return $candidate
        }
    }

    throw 'PostgreSQL bin directory not found. Install PostgreSQL service first.'
}

if (-not $DumpPath) {
    $latestDir = Get-ChildItem (Join-Path $PSScriptRoot 'migrations\postgres-native') -Directory -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $latestDir) {
        throw 'No migration backup directory found.'
    }
    $DumpPath = Join-Path $latestDir.FullName 'bcl_database.dump'
    $GlobalsPath = Join-Path $latestDir.FullName 'globals.sql'
}

if (-not (Test-Path $DumpPath)) {
    throw "Dump file not found: $DumpPath"
}

if (-not $GlobalsPath) {
    $GlobalsPath = Join-Path ([System.IO.Path]::GetDirectoryName($DumpPath)) 'globals.sql'
}

$pgBin = Find-PgBin
$psql = Join-Path $pgBin 'psql.exe'
$pgRestore = Join-Path $pgBin 'pg_restore.exe'

$env:PGPASSWORD = $AdminPassword

& $psql -h $DbHost -p $Port -U $AdminUser -d postgres -c "select version();" *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Cannot connect to native PostgreSQL service using the provided admin credentials.'
}

$roleExists = & $psql -h $DbHost -p $Port -U $AdminUser -d postgres -At -c "SELECT 1 FROM pg_roles WHERE rolname = '$AppUser';"
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to check whether application role exists.'
}

if (Test-Path $GlobalsPath) {
    if ($roleExists -match '1') {
        Write-Output "[INFO] Application role $AppUser already exists - skipping globals restore."
    } else {
        & $psql -h $DbHost -p $Port -U $AdminUser -d postgres -v ON_ERROR_STOP=1 -f $GlobalsPath
        if ($LASTEXITCODE -ne 0) {
            throw 'Failed to restore PostgreSQL global roles.'
        }
    }
}

if ($roleExists -match '1') {
    & $psql -h $DbHost -p $Port -U $AdminUser -d postgres -v ON_ERROR_STOP=1 -c "ALTER ROLE $AppUser WITH LOGIN PASSWORD '$AppPassword';"
} else {
    & $psql -h $DbHost -p $Port -U $AdminUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE $AppUser LOGIN PASSWORD '$AppPassword';"
}
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to ensure application role exists.'
}

& $psql -h $DbHost -p $Port -U $AdminUser -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$AppDb' AND pid <> pg_backend_pid();"
& $psql -h $DbHost -p $Port -U $AdminUser -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $AppDb;"
& $psql -h $DbHost -p $Port -U $AdminUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $AppDb OWNER $AppUser;"
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to recreate application database.'
}

& $pgRestore -h $DbHost -p $Port -U $AdminUser -d $AppDb --no-owner --role=$AppUser --clean --if-exists $DumpPath
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to restore application dump into native PostgreSQL.'
}

Write-Output '[SUCCESS] Native PostgreSQL restore completed.'
Write-Output "[INFO] Database: $AppDb"
Write-Output "[INFO] Role: $AppUser"
