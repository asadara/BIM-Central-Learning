# Script untuk batch update semua file HTML e-learning menggunakan sidebar component

$files = @(
    "about.html",
    "contact.html", 
    "login.html",
    "playlist.html",
    "profile.html",
    "register.html",
    "teachers.html",
    "teacher_profile.html",
    "update.html",
    "watch-video.html"
)

$basePath = "C:\BCL\BC-Learning-Main\elearning-assets"

foreach ($file in $files) {
    $filePath = Join-Path $basePath $file
    
    if (Test-Path $filePath) {
        Write-Host "Updating $file..."
        
        # Read file content
        $content = Get-Content $filePath -Raw
        
        # Replace sidebar HTML with component loader
        $content = $content -replace '(?s)<div class="side-bar">.*?</div>\s*</div>', '<div class="sidebar-container"></div>'
        
        # Add sidebar-loader.js script if not exists
        if ($content -notmatch 'sidebar-loader\.js') {
            $content = $content -replace '(<script src="js/script\.js"></script>)', '$1`n   <script src="js/sidebar-loader.js"></script>'
        }
        
        # Write back to file
        Set-Content $filePath $content -NoNewline
        
        Write-Host "Updated $file successfully!"
    }
    else {
        Write-Host "File not found: $file"
    }
}

Write-Host "Batch update completed!"