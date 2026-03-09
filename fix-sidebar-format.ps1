# Fix Sidebar Format Issues - PowerShell Script
$pages = @(
    "about.html",
    "contact.html", 
    "login.html",
    "profile.html",
    "register.html",
    "teachers.html",
    "teacher_profile.html",
    "update.html",
    "watch-video.html"
)

foreach ($page in $pages) {
    $filePath = "c:\BCL\BC-Learning-Main\elearning-assets\$page"
    
    if (Test-Path $filePath) {
        Write-Host "Fixing format in $page..."
        
        # Read current content
        $content = Get-Content $filePath -Raw
        
        # Fix sidebar format
        $content = $content -replace '<!-- Sidebar -->`n   <div class="side-bar" id="sidebar-container"></div>', '<!-- Sidebar -->`r`n   <div class="side-bar" id="sidebar-container"></div>'
        
        # Fix script format
        $content = $content -replace '<script src="js/script\.js"></script>`n', '<script src="js/script.js"></script>'
        
        # Write updated content
        Set-Content $filePath -Value $content -Encoding UTF8
        
        Write-Host "Fixed $page"
    }
    else {
        Write-Host "File not found: $page"
    }
}

Write-Host ""
Write-Host "Format fix completed for all pages!"