param(
    [string]$BaseUrl = $env:BCL_BASE_URL,
    [string]$Year = $env:BCL_PROJECT_YEAR,
    [string]$SourceId = $env:BCL_PROJECT_SOURCE_ID,
    [string]$ProjectName = $env:BCL_PROJECT_NAME,
    [ValidateSet('image', 'video', 'model', 'all')]
    [string]$MediaType = $(if ($env:BCL_MEDIA_TYPE) { $env:BCL_MEDIA_TYPE } else { 'image' }),
    [int]$MaxMediaChecks = $(if ($env:BCL_MAX_MEDIA_CHECKS) { [int]$env:BCL_MAX_MEDIA_CHECKS } else { 3 })
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    $BaseUrl = 'http://127.0.0.1:5052'
}

$BaseUrl = $BaseUrl.TrimEnd('/')

function Write-Fail([string]$Message) {
    Write-Error "FAIL Test-BclProjectsClient: $Message"
    exit 1
}

function Invoke-BclJson([string]$Path) {
    $url = "$BaseUrl$Path"
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
        if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
            Write-Fail "$Path returned HTTP $($response.StatusCode)"
        }
        return $response.Content | ConvertFrom-Json
    } catch {
        Write-Fail "$Path request failed: $($_.Exception.Message)"
    }
}

function Invoke-BclProbe([string]$Path) {
    $url = "$BaseUrl$Path"
    $request = [System.Net.HttpWebRequest]::Create($url)
    $request.Method = 'GET'
    $request.Timeout = 30000
    $request.ReadWriteTimeout = 30000
    $request.AddRange(0, 0)

    try {
        $response = $request.GetResponse()
        try {
            return [pscustomobject]@{
                StatusCode = [int]$response.StatusCode
                Content = ''
                Headers = $response.Headers
            }
        } finally {
            $response.Close()
        }
    } catch {
        $response = $_.Exception.Response
        if ($null -ne $response) {
            $statusCode = [int]$response.StatusCode
            try {
                $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
                $body = $reader.ReadToEnd()
                return [pscustomobject]@{
                    StatusCode = $statusCode
                    Content = $body
                    Headers = $response.Headers
                }
            } finally {
                $response.Close()
            }
        }
        throw
    }
}

function Test-PreferredMedia($Url, $Detail) {
    $value = [string]$Url
    if ([string]::IsNullOrWhiteSpace($value) -and $null -ne $Detail) {
        $value = [string]$Detail.url
    }
    $value = $value.Split('?')[0].ToLowerInvariant()
    $kind = if ($null -ne $Detail -and $Detail.mediaKind) { ([string]$Detail.mediaKind).ToLowerInvariant() } else { '' }

    if ($MediaType -eq 'all') {
        return $value -match '\.(png|jpe?g|webp|gif|bmp|mp4|mov|webm|avi|mkv|wmv|m4v|ifc)$' -or $kind -match '^(image|video|model)$'
    }
    if ($MediaType -eq 'image') {
        return $kind -eq 'image' -or $value -match '\.(png|jpe?g|webp|gif|bmp)$'
    }
    if ($MediaType -eq 'video') {
        return $kind -eq 'video' -or $value -match '\.(mp4|mov|webm|avi|mkv|wmv|m4v)$'
    }
    if ($MediaType -eq 'model') {
        return $kind -eq 'model' -or $value -match '\.ifc$'
    }
    return $false
}

function Get-ProjectScopes($YearsPayload) {
    if (-not [string]::IsNullOrWhiteSpace($Year)) {
        return @([pscustomobject]@{ Year = $Year; SourceId = $(if ($SourceId) { $SourceId } else { $null }) })
    }

    $scopes = New-Object System.Collections.Generic.List[object]
    $sources = @($YearsPayload.sources)
    if ($sources.Count -gt 0 -and $null -ne $YearsPayload.yearsBySource) {
        foreach ($source in @($sources | Sort-Object priority)) {
            $sourceYears = @($YearsPayload.yearsBySource.($source.id)) |
                ForEach-Object { [string]$_ } |
                Where-Object { $_ -match '^(19|20)\d{2}$' } |
                Sort-Object -Descending -Unique
            foreach ($sourceYear in $sourceYears) {
                $scopes.Add([pscustomobject]@{ Year = $sourceYear; SourceId = $source.id })
            }
        }
        return $scopes.ToArray()
    }

    foreach ($item in @($YearsPayload.years | ForEach-Object { [string]$_ } | Where-Object { $_ -match '^(19|20)\d{2}$' } | Sort-Object -Descending -Unique)) {
        $scopes.Add([pscustomobject]@{ Year = $item; SourceId = $null })
    }
    return $scopes.ToArray()
}

function Get-MediaDetailsMap($MediaPayload) {
    $map = @{}
    foreach ($detail in @($MediaPayload.mediaDetails)) {
        if ($detail -and $detail.url) {
            $map[[string]$detail.url] = $detail
        }
    }
    return $map
}

function Get-ProjectMedia([string]$ScopeYear, [string]$Name, [string]$ScopeSourceId) {
    $query = if ($ScopeSourceId) { "?sourceId=$([uri]::EscapeDataString($ScopeSourceId))" } else { '' }
    $path = "/api/project-media/$([uri]::EscapeDataString($ScopeYear))/$([uri]::EscapeDataString($Name))$query"
    return Invoke-BclJson $path
}

$yearsPayload = Invoke-BclJson '/api/years'
$scopes = @(Get-ProjectScopes $yearsPayload)
if ($scopes.Count -eq 0) {
    Write-Fail 'No project year/source scope was returned by /api/years'
}

$target = $null

foreach ($scope in $scopes) {
    $query = if ($scope.SourceId) { "?sourceId=$([uri]::EscapeDataString($scope.SourceId))" } else { '' }
    $projectsPayload = Invoke-BclJson "/api/projects/$([uri]::EscapeDataString($scope.Year))$query"
    foreach ($project in @($projectsPayload.projects)) {
        if ($ProjectName -and $project.name -ne $ProjectName) { continue }
        if ($SourceId -and $project.sourceId -ne $SourceId) { continue }
        if (-not $ProjectName -and [int]($project.mediaCount) -le 0) { continue }

        $mediaPayload = Get-ProjectMedia $scope.Year $project.name $(if ($project.sourceId) { $project.sourceId } else { $scope.SourceId })
        $details = Get-MediaDetailsMap $mediaPayload
        $media = @($mediaPayload.media | Where-Object {
            $detail = $details[[string]$_]
            Test-PreferredMedia $_ $detail
        })

        if ($media.Count -gt 0) {
            $target = [pscustomobject]@{
                Year = $scope.Year
                SourceId = $(if ($project.sourceId) { $project.sourceId } else { $scope.SourceId })
                ProjectName = $project.name
                MediaPayload = $mediaPayload
                Media = $media
            }
            break
        }
    }
    if ($null -ne $target) { break }
}

if ($null -eq $target) {
    Write-Fail "No project with $MediaType media found"
}

$targetDetails = Get-MediaDetailsMap $target.MediaPayload
$checked = 0
$failures = New-Object System.Collections.Generic.List[string]

foreach ($mediaUrl in @($target.Media | Select-Object -First ([Math]::Max(1, $MaxMediaChecks)))) {
    $detail = $targetDetails[[string]$mediaUrl]
    if ($detail -and ([string]$detail.availability).ToLowerInvariant() -in @('unavailable', 'invalid', 'missing')) {
        $failures.Add("Metadata unavailable: $mediaUrl ($($detail.sourceStatus))")
        continue
    }

    $proxyPath = "/api/media-proxy?url=$([uri]::EscapeDataString([string]$mediaUrl))"
    $probe = Invoke-BclProbe $proxyPath
    $checked++
    if ($probe.StatusCode -ne 200 -and $probe.StatusCode -ne 206) {
        $failures.Add("$proxyPath returned HTTP $($probe.StatusCode): $($probe.Content)")
    } else {
        $mediaSource = ''
        $contentType = ''
        try { $mediaSource = [string]$probe.Headers['X-Media-Source'] } catch {}
        try { $contentType = [string]$probe.Headers['Content-Type'] } catch {}
        Write-Output "Proxy OK: HTTP $($probe.StatusCode) $mediaSource $contentType $mediaUrl"
    }
}

if ($failures.Count -gt 0) {
    Write-Fail ($failures -join ' | ')
}

Write-Output 'OK Test-BclProjectsClient passed'
Write-Output "Base URL: $BaseUrl"
Write-Output "Project: $($target.Year) / $($target.SourceId) / $($target.ProjectName)"
Write-Output "Media type: $MediaType"
Write-Output "Media checked: $checked"
