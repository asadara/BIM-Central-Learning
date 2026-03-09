# PowerShell script untuk menambahkan page-tracker.js ke semua halaman e-learning
$elearningPath = "C:\BCL\BC-Learning-Main\elearning-assets"
$htmlFiles = Get-ChildItem -Path $elearningPath -Filter "*.html" -Recurse

Write-Host "🔄 Adding page-tracker.js to e-learning HTML files..." -ForegroundColor Yellow

foreach ($file in $htmlFiles) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        
        # Skip jika sudah ada page-tracker.js
        if ($content -match "page-tracker\.js") {
            Write-Host "⏭️ Skipping $($file.Name) - already has page-tracker.js" -ForegroundColor Cyan
            continue
        }
        
        # Cari lokasi untuk menambahkan script sebelum </body>
        if ($content -match '</body>') {
            $newContent = $content -replace '(\s*</body>)', "`n   <!-- Page tracker untuk last page functionality -->`n   <script src=`"../js/page-tracker.js`"></script>`n`$1"
            
            # Write file dengan encoding UTF8
            [System.IO.File]::WriteAllText($file.FullName, $newContent, [System.Text.Encoding]::UTF8)
            Write-Host "✅ Updated $($file.Name)" -ForegroundColor Green
        }
        else {
            Write-Host "⚠️ No </body> tag found in $($file.Name)" -ForegroundColor Yellow
        }
        
    }
    catch {
        Write-Host "❌ Error updating $($file.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🎉 Page tracker installation completed!" -ForegroundColor Green