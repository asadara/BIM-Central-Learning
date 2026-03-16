$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$hiddenStart = Join-Path $root 'start-bcl-http-hidden.bat'
$fallbackStart = Join-Path $root 'start-bcl-http.bat'
$startScript = if (Test-Path $hiddenStart) { $hiddenStart } else { $fallbackStart }

function Show-Message($message, $title = 'BCL Server Info', $icon = 'Info') {
    try {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show($message, $title, 'OK', $icon) | Out-Null
    } catch {
    }
}

if (!(Test-Path $startScript)) {
    Show-Message "Launcher tidak ditemukan: $startScript" 'BCL Server Error' 'Error'
    exit 1
}

$statusUrl = 'http://127.0.0.1/api/server/status'
$mainUrl = 'http://localhost/'
$dashboardUrl = 'http://localhost/elearning-assets/phase4-dashboard.html'

$alreadyRunning = $false
try {
    $response = Invoke-WebRequest -Uri $statusUrl -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -eq 200) {
        $alreadyRunning = $true
    }
} catch {
}

if (-not $alreadyRunning) {
    Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', "`"$startScript`"" `
        -WorkingDirectory $root `
        -WindowStyle Hidden

    $ready = $false
    for ($i = 0; $i -lt 45; $i++) {
        Start-Sleep -Seconds 2
        try {
            $response = Invoke-WebRequest -Uri $statusUrl -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {
        }
    }

    if (-not $ready) {
        Show-Message "BCL tidak merespons di $statusUrl. Cek logs di C:\BCL\logs." 'BCL Server Error' 'Error'
        exit 1
    }
}

$ip = 'localhost'
try {
    $candidate = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*' -and
            $_.PrefixOrigin -ne 'WellKnown'
        } |
        Select-Object -ExpandProperty IPAddress -First 1

    if ($candidate) {
        $ip = $candidate
    }
} catch {
}

$message = if ($alreadyRunning) {
    "BCL Server sudah berjalan.`n`nMain: $mainUrl`nDashboard: $dashboardUrl`nLAN: http://$ip/"
} else {
    "BCL Server berhasil dijalankan.`n`nMain: $mainUrl`nDashboard: $dashboardUrl`nLAN: http://$ip/"
}

Show-Message $message

try {
    Start-Process $dashboardUrl
    Start-Process $mainUrl
} catch {
}
