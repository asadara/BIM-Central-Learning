# Update Sidebar untuk Semua Halaman - PowerShell Script
$pages = @(
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

foreach ($page in $pages) {
    $filePath = "c:\BCL\BC-Learning-Main\elearning-assets\$page"
    
    if (Test-Path $filePath) {
        Write-Host "Updating $page..."
        
        # Read current content
        $content = Get-Content $filePath -Raw
        
        # Update sidebar container
        $content = $content -replace '<!-- Sidebar akan dimuat otomatis oleh component-loader\.js -->\s*<div class="sidebar-container"></div>', '<!-- Sidebar -->`n   <div class="side-bar" id="sidebar-container"></div>'
        
        # Add sidebar-loader.js if not present
        if ($content -notmatch 'sidebar-loader\.js') {
            $content = $content -replace '(\s*<script src="[^"]*loadComponents\.js"></script>)', '$1`n    <script src="./js/sidebar-loader.js"></script>'
        }
        
        # Write updated content
        Set-Content $filePath -Value $content -Encoding UTF8
        
        Write-Host "✓ Updated $page"
    }
    else {
        Write-Host "✗ File not found: $page"
    }
}

Write-Host ""
Write-Host "Sidebar update completed for all pages!"