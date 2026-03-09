# PowerShell script untuk fix script loading order di semua file elearning
$files = Get-ChildItem -Path "*.html" -Exclude "*.bak*"

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)"
    
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Fix script loading order - sidebar-loader.js should come before script.js
    $content = $content -replace '<script src="js/script\.js"></script>\s*<script src="js/sidebar-loader\.js"></script>', '<script src="js/sidebar-loader.js"></script>
   <script src="js/script.js"></script>'
    
    if ($content -ne $originalContent) {
        # Backup original file (if not already exists)
        if (-not (Test-Path "$($file.FullName).bak3")) {
            Copy-Item $file.FullName "$($file.FullName).bak3"
        }
        
        # Write updated content
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "✅ Fixed script order in: $($file.Name)"
    }
    else {
        Write-Host "⏭️ Already fixed: $($file.Name)"
    }
}

Write-Host "`n🎉 Script loading order fix completed!"