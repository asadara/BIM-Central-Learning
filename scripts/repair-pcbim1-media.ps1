param(
    [switch]$Apply,
    [switch]$SkipFastStart,
    [ValidateSet('pc-bim1', 'pc-bim02')]
    [string]$Source = 'pc-bim1',
    [int[]]$Years = @()
)

$ErrorActionPreference = 'Stop'

$pcMediaRoot = if ($Source -eq 'pc-bim02') {
    '\\pc-bim02'
} else {
    [IO.Path]::GetFullPath('G:\')
}
$Years = if (@($Years).Count -gt 0) {
    @($Years)
} elseif ($Source -eq 'pc-bim02') {
    @(2025, 2026)
} else {
    @(2020, 2021, 2022, 2023, 2024, 2025)
}
$validVideoExtensions = @('.mp4', '.m4v', '.mov', '.avi', '.wmv', '.webm', '.mkv')
$audioRepairFileNames = @(
    'VID-20231016-WA0009.mp4',
    'VID-20231025-WA0020.mp4',
    'Video WhatsApp 2023-10-16 pukul 09.56.18_a61a816f.mp4'
)

function Resolve-Binary([string[]]$candidates) {
    foreach ($candidate in $candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }

        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }

        if ([IO.Path]::IsPathRooted($candidate) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return $candidate
        }
    }

    return $null
}

$ffmpeg = Resolve-Binary @(
    $env:FFMPEG_PATH,
    $env:FFMPEG_BIN,
    'C:\Program Files\ffmpeg\bin\ffmpeg.exe',
    'C:\ffmpeg\bin\ffmpeg.exe',
    'ffmpeg'
)
$ffprobe = Resolve-Binary @(
    $env:FFPROBE_PATH,
    $env:FFPROBE_BIN,
    'C:\Program Files\ffmpeg\bin\ffprobe.exe',
    'C:\ffmpeg\bin\ffprobe.exe',
    'ffprobe'
)

if (-not $ffmpeg -or -not $ffprobe) {
    throw 'FFmpeg and FFprobe are required.'
}

function Assert-PcBim1Path([string]$targetPath) {
    $resolved = [IO.Path]::GetFullPath($targetPath)
    if (-not $resolved.StartsWith($pcMediaRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe path outside $Source root: $resolved"
    }
    $isApprovedPath = if ($Source -eq 'pc-bim02') {
        $resolved -match '^\\\\pc-bim02\\PROJECT BIM 20(25|26)(\\|$)'
    } else {
        $resolved -match '^G:\\PROJECT 20(20|21|22|23|24|25)(\\|$)'
    }
    if (-not $isApprovedPath) {
        throw "Unsafe path outside approved $Source year roots: $resolved"
    }
    return $resolved
}

function Get-VideoProbe([string]$filePath) {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $json = & $ffprobe `
            -v error `
            -show_entries 'format=format_name,duration,size,bit_rate:stream=codec_type,codec_name,profile,pix_fmt,sample_rate,channels' `
            -of json `
            -- $filePath 2>$null
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($LASTEXITCODE -ne 0 -or -not $json) {
        return $null
    }

    try {
        $payload = $json | ConvertFrom-Json
        $video = @($payload.streams | Where-Object { $_.codec_type -eq 'video' }) | Select-Object -First 1
        $audio = @($payload.streams | Where-Object { $_.codec_type -eq 'audio' }) | Select-Object -First 1
        $duration = 0.0
        [double]::TryParse(
            [string]$payload.format.duration,
            [Globalization.NumberStyles]::Float,
            [Globalization.CultureInfo]::InvariantCulture,
            [ref]$duration
        ) | Out-Null

        if (-not $video -or $duration -le 0) {
            return $null
        }

        return [pscustomobject]@{
            VideoCodec = [string]$video.codec_name
            VideoProfile = [string]$video.profile
            PixelFormat = [string]$video.pix_fmt
            AudioCodec = if ($audio) { [string]$audio.codec_name } else { 'none' }
            DurationSeconds = $duration
            FormatName = [string]$payload.format.format_name
        }
    } catch {
        return $null
    }
}

function Test-MoovNearStart([string]$filePath) {
    $stream = [IO.File]::Open(
        $filePath,
        [IO.FileMode]::Open,
        [IO.FileAccess]::Read,
        [IO.FileShare]::ReadWrite
    )

    try {
        $readLength = [int][math]::Min([long]4194304, [long]$stream.Length)
        if ($readLength -le 0) {
            return $false
        }
        $buffer = New-Object byte[] $readLength
        $actual = $stream.Read($buffer, 0, $readLength)
        $header = [Text.Encoding]::ASCII.GetString($buffer, 0, $actual)
        return $header.IndexOf('moov', [StringComparison]::Ordinal) -ge 0
    } finally {
        $stream.Dispose()
    }
}

function Get-UniqueMp4Destination([IO.FileInfo]$source) {
    $preferred = Join-Path $source.DirectoryName "$($source.BaseName).mp4"
    if (-not (Test-Path -LiteralPath $preferred)) {
        return $preferred
    }

    $browserReady = Join-Path $source.DirectoryName "$($source.BaseName)_browser.mp4"
    if (-not (Test-Path -LiteralPath $browserReady)) {
        return $browserReady
    }

    $counter = 2
    while ($true) {
        $candidate = Join-Path $source.DirectoryName "$($source.BaseName)_browser_$counter.mp4"
        if (-not (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
        $counter += 1
    }
}

function Get-RepairBackupPath([string]$sourcePath, [string]$backupSuffix) {
    $preferredPath = "$sourcePath$backupSuffix"
    if ($preferredPath.Length -lt 240) {
        return Assert-PcBim1Path $preferredPath
    }

    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        $pathBytes = [Text.Encoding]::UTF8.GetBytes($sourcePath.ToLowerInvariant())
        $hash = ([BitConverter]::ToString($sha256.ComputeHash($pathBytes))).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha256.Dispose()
    }

    $shortName = ".__bcl-original-$($hash.Substring(0, 16))$backupSuffix"
    return Assert-PcBim1Path (Join-Path ([IO.Path]::GetDirectoryName($sourcePath)) $shortName)
}

function Get-RepairAction([IO.FileInfo]$file, $probe) {
    if ($file.Name.StartsWith('._')) {
        return 'exclude-sidecar'
    }
    if ($null -eq $probe) {
        return 'exclude-invalid'
    }

    $extension = $file.Extension.ToLowerInvariant()
    $needsVideoTranscode = $probe.VideoCodec -ne 'h264' `
        -or $probe.PixelFormat -notin @('yuv420p', 'yuvj420p')

    if ($extension -in @('.avi', '.wmv', '.mkv', '.webm') -or $needsVideoTranscode) {
        return 'transcode'
    }
    if ($extension -eq '.mov') {
        return 'remux-container'
    }
    if ($audioRepairFileNames -contains $file.Name `
        -and -not (Test-Path -LiteralPath "$($file.FullName).original-web-incompatible.bak")) {
        return 'repair-audio'
    }
    if (-not $SkipFastStart `
        -and $extension -in @('.mp4', '.m4v') `
        -and -not (Test-MoovNearStart $file.FullName)) {
        return 'faststart'
    }

    return 'compatible'
}

function Test-RepairedMedia(
    [string]$outputPath,
    $sourceProbe,
    [bool]$allowTruncatedRecovery = $false
) {
    $outputProbe = Get-VideoProbe $outputPath
    if ($null -eq $outputProbe) {
        throw "Output validation failed: no readable video stream in $outputPath"
    }
    if ($outputProbe.VideoCodec -ne 'h264') {
        throw "Output validation failed: codec is $($outputProbe.VideoCodec)"
    }
    if ($outputProbe.PixelFormat -notin @('yuv420p', 'yuvj420p')) {
        throw "Output validation failed: pixel format is $($outputProbe.PixelFormat)"
    }
    if ($sourceProbe -and $sourceProbe.DurationSeconds -gt 0) {
        $allowedDelta = [math]::Max(2.0, $sourceProbe.DurationSeconds * 0.02)
        $durationDelta = [math]::Abs($outputProbe.DurationSeconds - $sourceProbe.DurationSeconds)
        $isAcceptableTruncatedRecovery = $allowTruncatedRecovery `
            -and $outputProbe.DurationSeconds -ge ($sourceProbe.DurationSeconds * 0.5) `
            -and $outputProbe.DurationSeconds -le ($sourceProbe.DurationSeconds + $allowedDelta)
        if ($durationDelta -gt $allowedDelta -and -not $isAcceptableTruncatedRecovery) {
            throw "Output validation failed: duration delta is $([math]::Round($durationDelta, 2)) seconds"
        }
    }

    return $outputProbe
}

function Install-RepairedMedia(
    [string]$sourcePath,
    [string]$temporaryPath,
    [string]$destinationPath,
    [string]$backupSuffix
) {
    $sourcePath = Assert-PcBim1Path $sourcePath
    $temporaryPath = Assert-PcBim1Path $temporaryPath
    $destinationPath = Assert-PcBim1Path $destinationPath
    $backupPath = Get-RepairBackupPath $sourcePath $backupSuffix

    if (Test-Path -LiteralPath $backupPath) {
        throw "Backup already exists: $backupPath"
    }
    if ($destinationPath -ne $sourcePath -and (Test-Path -LiteralPath $destinationPath)) {
        throw "Destination already exists: $destinationPath"
    }

    Move-Item -LiteralPath $sourcePath -Destination $backupPath
    try {
        Move-Item -LiteralPath $temporaryPath -Destination $destinationPath
    } catch {
        if (-not (Test-Path -LiteralPath $sourcePath) -and (Test-Path -LiteralPath $backupPath)) {
            Move-Item -LiteralPath $backupPath -Destination $sourcePath
        }
        throw
    }

    return $backupPath
}

function Invoke-MediaRepair([IO.FileInfo]$file, $probe, [string]$action) {
    $sourcePath = Assert-PcBim1Path $file.FullName

    if ($action -eq 'compatible' -or $action -eq 'exclude-sidecar') {
        return [pscustomobject]@{
            Action = $action
            Source = $sourcePath
            Destination = $sourcePath
            Backup = $null
        }
    }

    if ($action -eq 'exclude-invalid') {
        $backupPath = Get-RepairBackupPath $sourcePath '.invalid-media.bak'
        if ($Apply) {
            if (Test-Path -LiteralPath $backupPath) {
                throw "Invalid-media backup already exists: $backupPath"
            }
            Move-Item -LiteralPath $sourcePath -Destination $backupPath
        }
        return [pscustomobject]@{
            Action = $action
            Source = $sourcePath
            Destination = $null
            Backup = $backupPath
        }
    }

    $destinationPath = if ($action -in @('transcode', 'remux-container') `
        -and $file.Extension.ToLowerInvariant() -ne '.mp4') {
        Get-UniqueMp4Destination $file
    } else {
        $sourcePath
    }
    $destinationPath = Assert-PcBim1Path $destinationPath
    $temporaryName = ".__bcl-$PID-$([Guid]::NewGuid().ToString('N')).repair.tmp.mp4"
    $temporaryPath = Assert-PcBim1Path (Join-Path ([IO.Path]::GetDirectoryName($destinationPath)) $temporaryName)
    $backupSuffix = if ($action -eq 'faststart') {
        '.original-slowstart.bak'
    } else {
        '.original-web-incompatible.bak'
    }

    if (-not $Apply) {
        return [pscustomobject]@{
            Action = $action
            Source = $sourcePath
            Destination = $destinationPath
            Backup = Get-RepairBackupPath $sourcePath $backupSuffix
        }
    }

    if (Test-Path -LiteralPath $temporaryPath) {
        throw "Temporary output already exists: $temporaryPath"
    }

    $arguments = @('-hide_banner', '-loglevel', 'error', '-nostats', '-y')
    if ($action -in @('repair-audio', 'transcode')) {
        $arguments += @('-err_detect', 'ignore_err')
    }
    $arguments += @('-i', $sourcePath, '-map', '0:v:0', '-map', '0:a?')

    if ($action -eq 'transcode') {
        $arguments += @(
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '20',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k'
        )
    } elseif ($action -eq 'repair-audio') {
        $arguments += @(
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '128k'
        )
    } else {
        $arguments += @('-c', 'copy')
    }
    $arguments += @('-movflags', '+faststart', $temporaryPath)

    & $ffmpeg @arguments
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $temporaryPath -PathType Leaf)) {
        Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
        throw "FFmpeg failed for $sourcePath"
    }

    try {
        $allowTruncatedRecovery = $action -eq 'transcode' `
            -and $file.Extension.Equals('.avi', [StringComparison]::OrdinalIgnoreCase)
        [void](Test-RepairedMedia $temporaryPath $probe $allowTruncatedRecovery)
        $backupPath = Install-RepairedMedia `
            -sourcePath $sourcePath `
            -temporaryPath $temporaryPath `
            -destinationPath $destinationPath `
            -backupSuffix $backupSuffix
    } catch {
        Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
        throw
    }

    return [pscustomobject]@{
        Action = $action
        Source = $sourcePath
        Destination = $destinationPath
        Backup = $backupPath
    }
}

$yearRoots = foreach ($year in $Years) {
    $yearFolder = if ($Source -eq 'pc-bim02') { "PROJECT BIM $year" } else { "PROJECT $year" }
    $root = Assert-PcBim1Path (Join-Path $pcMediaRoot $yearFolder)
    if (Test-Path -LiteralPath $root -PathType Container) {
        $root
    }
}

if (@($yearRoots).Count -eq 0) {
    throw "No $Source year roots were found."
}

$files = @(
    foreach ($yearRoot in $yearRoots) {
        Get-ChildItem -LiteralPath $yearRoot -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $validVideoExtensions -contains $_.Extension.ToLowerInvariant() }
    }
) | Sort-Object FullName

$inventory = New-Object System.Collections.Generic.List[object]
foreach ($file in $files) {
    $probe = if ($file.Name.StartsWith('._')) { $null } else { Get-VideoProbe $file.FullName }
    $action = Get-RepairAction $file $probe
    $inventory.Add([pscustomobject]@{
        File = $file
        Probe = $probe
        Action = $action
        SizeBytes = $file.Length
        DurationSeconds = if ($probe) { $probe.DurationSeconds } else { 0 }
    })
}

Write-Output "$($Source.ToUpperInvariant()) media repair mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"
Write-Output "FFmpeg: $ffmpeg"
Write-Output "FFprobe: $ffprobe"
Write-Output ''
$inventory |
    Group-Object Action |
    ForEach-Object {
        [pscustomobject]@{
            Action = $_.Name
            Files = $_.Count
            SizeGB = [math]::Round((($_.Group | Measure-Object SizeBytes -Sum).Sum) / 1GB, 2)
            DurationHours = [math]::Round((($_.Group | Measure-Object DurationSeconds -Sum).Sum) / 3600, 2)
        }
    } |
    Sort-Object Action |
    Format-Table -AutoSize

if (-not $Apply) {
    Write-Output ''
    Write-Output 'Dry-run complete. Re-run with -Apply to modify media files.'
    exit 0
}

$completed = 0
$failed = 0
$results = New-Object System.Collections.Generic.List[object]
$repairQueue = @($inventory | Where-Object { $_.Action -notin @('compatible', 'exclude-sidecar') })

foreach ($item in $repairQueue) {
    $completed += 1
    Write-Output "START|$completed/$($repairQueue.Count)|$($item.Action)|$($item.File.FullName)"
    try {
        $result = Invoke-MediaRepair $item.File $item.Probe $item.Action
        $results.Add($result)
        Write-Output "DONE|$completed/$($repairQueue.Count)|$($item.Action)|$($result.Destination)|backup=$($result.Backup)"
    } catch {
        $failed += 1
        Write-Output "FAILED|$completed/$($repairQueue.Count)|$($item.Action)|$($item.File.FullName)|$($_.Exception.Message)"
    }
}

Write-Output ''
Write-Output "SUMMARY|processed=$($repairQueue.Count)|succeeded=$($results.Count)|failed=$failed"
if ($failed -gt 0) {
    exit 1
}
