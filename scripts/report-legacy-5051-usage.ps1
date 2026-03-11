$logPath = "C:\BCL\logs\legacy-5051-access.log"

if (-not (Test-Path $logPath)) {
    Write-Host "legacy-5051-access.log not found"
    exit 0
}

$entries = Get-Content $logPath | Where-Object { $_ -match '\|' }
if (-not $entries) {
    Write-Host "No legacy 5051 access entries recorded yet"
    exit 0
}

$parsed = foreach ($line in $entries) {
    $parts = $line -split '\s+\|\s+'
    if ($parts.Length -lt 7) { continue }

    [PSCustomObject]@{
        Timestamp = $parts[0]
        ClientIp = $parts[1]
        Method = $parts[2]
        Path = $parts[3]
        Status = $parts[4]
        Duration = $parts[5]
        UserAgent = $parts[6]
    }
}

Write-Host "Legacy 5051 usage summary"
Write-Host "Log file: $logPath"
Write-Host "Total entries: $($parsed.Count)"

Write-Host ""
Write-Host "Last 10 hits:"
$parsed | Select-Object -Last 10 | Format-Table Timestamp, ClientIp, Method, Path, Status, Duration -AutoSize

Write-Host ""
Write-Host "Top paths:"
$parsed |
    Group-Object Path |
    Sort-Object Count -Descending |
    Select-Object -First 10 Count, Name |
    Format-Table -AutoSize

Write-Host ""
Write-Host "Top client IPs:"
$parsed |
    Group-Object ClientIp |
    Sort-Object Count -Descending |
    Select-Object -First 10 Count, Name |
    Format-Table -AutoSize
