param(
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectsCacheRoot = Join-Path $root 'data\projects-explorer-cache'
$mediaCacheRoot = Join-Path $projectsCacheRoot 'media'
$validExtensions = @('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.mp4', '.mov', '.webm', '.avi', '.mkv', '.wmv', '.m4v', '.ifc')
$modelExtensions = @('.ifc')
$videoExtensions = @('.mp4', '.mov', '.webm', '.avi', '.mkv', '.wmv', '.m4v')
$pcBim02Excluded = @('clash', 'clash detection', 'texture image marbel')
$defaultExcluded = @('tender', 'clash', 'clash detection', 'texture image marbel')

function Get-SafeCacheName([string]$value) {
    $safeValue = if ($null -ne $value) { $value } else { '' }
    return [uri]::EscapeDataString($safeValue.Trim()).Replace('%', '_')
}

function Get-CacheFileName([string]$year, [string]$sourceId, [string]$projectName) {
    return ('{0}__{1}__{2}.json' -f (Get-SafeCacheName $year), (Get-SafeCacheName $sourceId), (Get-SafeCacheName $projectName))
}

function Normalize-FolderLabel([string]$value) {
    $normalized = if ($null -ne $value) { $value } else { '' }
    $normalized = $normalized.ToLowerInvariant()
    $normalized = $normalized -replace '^[\s._-]*\d+[\s._-]*', ''
    $normalized = $normalized -replace '[._-]+', ' '
    $normalized = $normalized -replace '\s+', ' '
    return $normalized.Trim()
}

function Test-IncomingDataFolder([string]$folderName) {
    $normalized = Normalize-FolderLabel $folderName
    return $normalized -match '\bincoming\s*data\b' `
        -or $normalized -match '\bincomingdata\b' `
        -or $normalized -match '\bdata\s*incoming\b' `
        -or $normalized -match '\bdataincoming\b'
}

function Should-SkipDirectory([string]$sourceId, [string]$folderName) {
    $normalized = Normalize-FolderLabel $folderName
    if (Test-IncomingDataFolder $folderName) {
        return $true
    }

    $normalizedSourceId = if ($null -ne $sourceId) { $sourceId } else { '' }
    $excluded = if ($normalizedSourceId.ToLowerInvariant().StartsWith('pc-bim02')) { $pcBim02Excluded } else { $defaultExcluded }
    foreach ($item in $excluded) {
        $normalizedItem = Normalize-FolderLabel $item
        if ($normalizedItem -and $normalized.Contains($normalizedItem)) {
            return $true
        }
    }
    return $false
}

function Get-MediaUrl([string]$mediaRoute, [string]$baseDir, [string]$fullPath) {
    $normalizedBase = $baseDir.TrimEnd('\', '/')
    $relative = $fullPath.Substring($normalizedBase.Length).TrimStart('\', '/').Replace('\', '/')
    return '{0}/{1}' -f $mediaRoute.TrimEnd('/'), [uri]::EscapeUriString($relative)
}

function Get-MediaDisplayUrl([string]$mediaUrl) {
    $encodedUrl = [uri]::EscapeDataString($mediaUrl)
    return "/api/media-proxy?url=$encodedUrl"
}

function Scan-MediaFiles([string]$projectPath, [string]$baseDir, [string]$mediaRoute, [string]$sourceId) {
    $results = New-Object System.Collections.Generic.List[object]
    $stack = New-Object System.Collections.Generic.Stack[string]
    $stack.Push($projectPath)

    while ($stack.Count -gt 0) {
        $currentPath = $stack.Pop()
        $entries = @(Get-ChildItem -LiteralPath $currentPath -Force -ErrorAction SilentlyContinue)

        foreach ($entry in $entries) {
            if ($entry.PSIsContainer) {
                if (-not (Should-SkipDirectory $sourceId $entry.Name)) {
                    $stack.Push($entry.FullName)
                }
                continue
            }

            $ext = $entry.Extension.ToLowerInvariant()
            if ($validExtensions -notcontains $ext) {
                continue
            }

            $mediaUrl = Get-MediaUrl $mediaRoute $baseDir $entry.FullName
            $mediaKind = if ($modelExtensions -contains $ext) { 'model' } elseif ($videoExtensions -contains $ext) { 'video' } else { 'image' }
            $results.Add([pscustomobject]@{
                url = $mediaUrl
                displayUrl = Get-MediaDisplayUrl $mediaUrl
                sizeBytes = [int64]$entry.Length
                durationSeconds = $null
                mediaKind = $mediaKind
            })
        }
    }

    return $results
}

if (!(Test-Path $projectsCacheRoot)) {
    throw "Projects cache root not found: $projectsCacheRoot"
}

if ($Clean -and (Test-Path $mediaCacheRoot)) {
    Remove-Item -LiteralPath $mediaCacheRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $mediaCacheRoot | Out-Null

$projectCacheFiles = Get-ChildItem -LiteralPath $projectsCacheRoot -Filter 'projects-*.json' -File
$validCacheFiles = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
$written = 0
$skipped = 0
$removedStale = 0

foreach ($projectCacheFile in $projectCacheFiles) {
    $projectData = Get-Content -LiteralPath $projectCacheFile.FullName -Raw | ConvertFrom-Json
    $sourcesById = @{}
    foreach ($source in @($projectData.sources)) {
        if ($source.id) {
            $sourcesById[[string]$source.id] = $source
        }
    }

    foreach ($project in @($projectData.projects)) {
        $sourceId = [string]$project.sourceId
        $source = $sourcesById[$sourceId]
        $mediaRoute = if ($source -and $source.mediaRoute) { [string]$source.mediaRoute } else { '/media' }
        $projectPath = [string]$project.path
        $projectYear = [string]$projectData.year
        $projectName = [string]$project.name

        if (Should-SkipDirectory $sourceId $projectName) {
            $skipped++
            continue
        }

        if (!(Test-Path -LiteralPath $projectPath)) {
            $skipped++
            continue
        }

        $baseDir = [System.IO.Path]::GetDirectoryName($projectPath)
        $mediaDetails = Scan-MediaFiles $projectPath $baseDir $mediaRoute $sourceId
        $payload = [pscustomobject]@{
            year = $projectYear
            project = $projectName
            sourceId = $sourceId
            sourceName = [string]$project.source
            media = @($mediaDetails | ForEach-Object { $_.url })
            mediaDetails = @($mediaDetails)
            totalMedia = @($mediaDetails).Count
            scannedFolders = 1
            message = 'Static media cache'
        }

        $cacheFileName = Get-CacheFileName $projectYear $sourceId $projectName
        $cacheFilePath = Join-Path $mediaCacheRoot $cacheFileName
        [void]$validCacheFiles.Add($cacheFilePath)
        $payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $cacheFilePath
        $written++
    }
}

foreach ($mediaCacheFile in @(Get-ChildItem -LiteralPath $mediaCacheRoot -Filter '*.json' -File -ErrorAction SilentlyContinue)) {
    if (-not $validCacheFiles.Contains($mediaCacheFile.FullName)) {
        Remove-Item -LiteralPath $mediaCacheFile.FullName -Force
        $removedStale++
    }
}

Write-Output "Project media cache updated. Written: $written, skipped: $skipped, removed stale: $removedStale"
