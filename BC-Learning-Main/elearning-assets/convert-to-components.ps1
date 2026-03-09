# PowerShell script untuk mengubah semua file HTML menjadi menggunakan component system
$files = Get-ChildItem -Path "*.html" -Exclude "*.bak*"

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)"
    
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Replace hardcoded header dengan component placeholder
    $headerPattern = '<header class="header">.*?</header>'
    $headerReplacement = '<!-- Header akan dimuat otomatis oleh component-loader.js -->
   <div class="header-container"></div>'
    $content = $content -replace $headerPattern, $headerReplacement, 'Singleline'
    
    # Replace hardcoded footer dengan component placeholder  
    $footerPattern = '<footer class="footer">.*?</footer>'
    $footerReplacement = '<!-- Footer akan dimuat otomatis oleh component-loader.js -->
   <div class="footer-container"></div>'
    $content = $content -replace $footerPattern, $footerReplacement, 'Singleline'
    
    # Update sidebar placeholder comment
    $content = $content -replace '<!-- Sidebar akan dimuat otomatis oleh sidebar-loader\.js -->', '<!-- Sidebar akan dimuat otomatis oleh component-loader.js -->'
    
    # Update script references
    $content = $content -replace '<script src="js/sidebar-loader\.js"></script>', '<script src="js/component-loader.js"></script>'
    
    if ($content -ne $originalContent) {
        # Backup original file
        if (-not (Test-Path "$($file.FullName).bak4")) {
            Copy-Item $file.FullName "$($file.FullName).bak4"
        }
        
        # Write updated content
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "✅ Converted to component system: $($file.Name)"
    }
    else {
        Write-Host "⏭️ Already using components: $($file.Name)"
    }
}

Write-Host "`n🎉 Component system conversion completed!"