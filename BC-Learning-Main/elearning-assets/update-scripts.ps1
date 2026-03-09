# Simple script untuk update script references saja
$files = Get-ChildItem -Path "*.html" -Exclude "*.bak*"

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)"
    
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Update script references only (safer)
    $content = $content -replace 'sidebar-loader\.js', 'component-loader.js'
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "✅ Updated script reference: $($file.Name)"
    } else {
        Write-Host "⏭️ Already updated: $($file.Name)"
    }
}

Write-Host "`n🎉 Script reference update completed!"