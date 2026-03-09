# PowerShell script untuk fix navbar profile images di semua file elearning
$files = @("home.html", "watch-video.html", "update.html", "teacher_profile.html", "register.html", "profile.html", "playlist.html", "login.html")

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing: $file"
        
        $content = Get-Content $file -Raw
        $originalContent = $content
        
        # Fix navbar profile image path
        $content = $content -replace 'src="images/pic-1\.jpg" class="image"', 'src="/elearning-assets/images/pic-1.jpg" class="image"'
        
        if ($content -ne $originalContent) {
            # Backup original file (if not already exists)
            if (-not (Test-Path "$file.bak2")) {
                Copy-Item $file "$file.bak2"
            }
            
            # Write updated content
            Set-Content -Path $file -Value $content -NoNewline
            Write-Host "✅ Fixed navbar image in: $file"
        }
        else {
            Write-Host "⏭️ Already fixed: $file"
        }
    }
}

Write-Host "`n🎉 Navbar image fix completed!"