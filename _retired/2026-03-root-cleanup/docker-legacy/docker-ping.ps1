$ErrorActionPreference = 'Stop'

try {
    $docker = (Get-Command docker -ErrorAction Stop).Source

    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $docker
    $psi.Arguments = 'info'
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    $proc = [System.Diagnostics.Process]::new()
    $proc.StartInfo = $psi

    if (-not $proc.Start()) {
        exit 1
    }

    if (-not $proc.WaitForExit(15000)) {
        try {
            $proc.Kill()
            $proc.WaitForExit(3000)
        } catch {
        }
        exit 1
    }

    exit $proc.ExitCode
} catch {
    exit 1
}
