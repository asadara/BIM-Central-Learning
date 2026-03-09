@echo off
REM ============================================
REM BCL Video Conversion Batch Script
REM Converts videos to H.264/MP4 for browser compatibility
REM ============================================
setlocal enabledelayedexpansion

echo.
echo ============================================
echo BCL VIDEO CONVERTER - BATCH MODE
echo ============================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Check if FFmpeg is installed
where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo [WARNING] FFmpeg not found in PATH
    echo Checking common installation paths...
    
    if exist "C:\Program Files\ffmpeg\bin\ffmpeg.exe" (
        set "FFMPEG_PATH=C:\Program Files\ffmpeg\bin"
        echo [OK] Found FFmpeg at C:\Program Files\ffmpeg\bin
    ) else if exist "C:\ffmpeg\bin\ffmpeg.exe" (
        set "FFMPEG_PATH=C:\ffmpeg\bin"
        echo [OK] Found FFmpeg at C:\ffmpeg\bin
    ) else (
        echo.
        echo [ERROR] FFmpeg not found!
        echo Please install FFmpeg:
        echo   1. Download from: https://ffmpeg.org/download.html
        echo   2. Or use chocolatey: choco install ffmpeg
        echo   3. Or use winget: winget install Gyan.FFmpeg
        echo.
        pause
        exit /b 1
    )
)

REM Set default paths
set "SCRIPT_DIR=%~dp0"
set "CONVERTER=%SCRIPT_DIR%video-converter.js"
set "OUTPUT_DIR=Y:\BCL-Converted-Videos"
set "INPUT_DIR=G:\BIM CENTRAL LEARNING"

REM Check if converter script exists
if not exist "%CONVERTER%" (
    echo [ERROR] video-converter.js not found at: %CONVERTER%
    pause
    exit /b 1
)

echo [OK] Script directory: %SCRIPT_DIR%
echo [OK] Converter found: %CONVERTER%
echo.

REM Menu
:MENU
echo Select an option:
echo.
echo   1. Convert ALL videos in BIM Central Learning folder
echo   2. Convert a SINGLE video file
echo   3. Convert videos in a SPECIFIC folder
echo   4. Check if a video is H.264 compatible
echo   5. List converted videos
echo   6. Exit
echo.
set /p choice="Enter choice (1-6): "

if "%choice%"=="1" goto CONVERT_ALL
if "%choice%"=="2" goto CONVERT_SINGLE
if "%choice%"=="3" goto CONVERT_FOLDER
if "%choice%"=="4" goto CHECK_VIDEO
if "%choice%"=="5" goto LIST_CONVERTED
if "%choice%"=="6" goto END
goto MENU

:CONVERT_ALL
echo.
echo ============================================
echo CONVERTING ALL VIDEOS
echo ============================================
echo Input:  %INPUT_DIR%
echo Output: %OUTPUT_DIR%
echo.
echo This may take a very long time depending on the number of videos.
set /p confirm="Are you sure? (y/n): "
if /i not "%confirm%"=="y" goto MENU

echo.
echo Starting batch conversion...
echo.
node "%CONVERTER%" "%INPUT_DIR%" "%OUTPUT_DIR%"
if errorlevel 1 (
    echo.
    echo [ERROR] Conversion failed with errors
) else (
    echo.
    echo [SUCCESS] Batch conversion completed!
)
echo.
pause
goto MENU

:CONVERT_SINGLE
echo.
echo ============================================
echo CONVERT SINGLE VIDEO
echo ============================================
echo.
set /p videoPath="Enter full path to video file: "

if not exist "%videoPath%" (
    echo [ERROR] File not found: %videoPath%
    pause
    goto MENU
)

echo.
echo Converting: %videoPath%
echo Output directory: %OUTPUT_DIR%
echo.
node "%CONVERTER%" "%videoPath%" "%OUTPUT_DIR%"
if errorlevel 1 (
    echo.
    echo [ERROR] Conversion failed
) else (
    echo.
    echo [SUCCESS] Video converted!
)
echo.
pause
goto MENU

:CONVERT_FOLDER
echo.
echo ============================================
echo CONVERT FOLDER
echo ============================================
echo.
set /p folderPath="Enter folder path containing videos: "

if not exist "%folderPath%" (
    echo [ERROR] Folder not found: %folderPath%
    pause
    goto MENU
)

echo.
echo Converting all videos in: %folderPath%
echo Output directory: %OUTPUT_DIR%
echo.
node "%CONVERTER%" "%folderPath%" "%OUTPUT_DIR%"
if errorlevel 1 (
    echo.
    echo [ERROR] Conversion failed with errors
) else (
    echo.
    echo [SUCCESS] Folder conversion completed!
)
echo.
pause
goto MENU

:CHECK_VIDEO
echo.
echo ============================================
echo CHECK VIDEO COMPATIBILITY
echo ============================================
echo.
set /p checkPath="Enter path to video file: "

if not exist "%checkPath%" (
    echo [ERROR] File not found: %checkPath%
    pause
    goto MENU
)

echo.
echo Checking: %checkPath%
echo.
node "%CONVERTER%" --check "%checkPath%"
echo.
pause
goto MENU

:LIST_CONVERTED
echo.
echo ============================================
echo CONVERTED VIDEOS
echo ============================================
echo.
echo Location: %OUTPUT_DIR%
echo.
if exist "%OUTPUT_DIR%" (
    dir /b /a-d "%OUTPUT_DIR%\*.mp4" 2>nul
    if errorlevel 1 (
        echo No converted videos found.
    )
) else (
    echo Output directory does not exist yet.
)
echo.
pause
goto MENU

:END
echo.
echo Goodbye!
exit /b 0
