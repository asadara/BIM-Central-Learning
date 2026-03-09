@echo off
echo 🎨 Image Mapping Tool for DOCX to Quiz Questions
echo ================================================
echo.

cd /d "%~dp0"

echo 📦 Installing dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo 🚀 Running image mapping tool...
node image-mapping-tool.js

echo.
echo ✅ Process completed!
pause
