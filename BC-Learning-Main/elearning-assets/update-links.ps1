# PowerShell script untuk mengupdate link di file HTML elearning
# Membedakan antara NAVBAR (ke /pages/) dan SIDEBAR (ke /elearning-assets/)

$files = Get-ChildItem -Path "*.html" -Exclude "*.bak"

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)"
    
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # NAVBAR UPDATES (di header section)
    # Logo link tetap ke elearning home
    $content = $content -replace 'href="home\.html" class="logo"', 'href="/elearning-assets/home.html" class="logo"'
    
    # Search form ke pages
    $content = $content -replace 'action="search\.html"', 'action="/pages/search.html"'
    
    # Profile section di navbar ke pages folder
    $content = $content -replace 'href="profile\.html" class="btn"', 'href="/pages/profile.html" class="btn"'
    $content = $content -replace 'href="login\.html" class="option-btn"', 'href="/pages/login.html" class="option-btn"'
    $content = $content -replace 'href="register\.html" class="option-btn"', 'href="/pages/register.html" class="option-btn"'
    
    # CONTENT AREA UPDATES (internal navigation dalam elearning)
    # Teachers, courses, playlist dll tetap dalam elearning-assets
    $content = $content -replace 'href="(teachers|courses|playlist)\.html"', 'href="/elearning-assets/$1.html"'
    
    if ($content -ne $originalContent) {
        # Backup original file
        Copy-Item $file.FullName "$($file.FullName).bak"
        
        # Write updated content
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "✅ Updated: $($file.Name)"
    } else {
        Write-Host "⏭️ No changes needed: $($file.Name)"
    }
}

Write-Host "`n🎉 Navbar/Sidebar link update completed!"