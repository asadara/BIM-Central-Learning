@echo off
:: Force immediate output without buffering
echo [BOOT] Test script initiated at %DATE% %TIME%

:: DEBUG: Log startup information
echo [DEBUG] Test script starting > test_debug.log
echo [DEBUG] Current directory: %CD% >> test_debug.log
echo [DEBUG] Script path: %~dp0 >> test_debug.log
echo [DEBUG] Arguments: %* >> test_debug.log
echo [DEBUG] ErrorLevel: %ERRORLEVEL% >> test_debug.log

:: Double-click detection test
if "%*"=="" (
    echo [DEBUG] No arguments provided - likely double-click execution >> test_debug.log
    echo.
    echo ================================================================================
    echo                      DOUBLE-CLICK TEST DETECTED
    echo ================================================================================
    echo.
    echo [SUCCESS] Test script started successfully via double-click!
    echo [INFO] If you can see this message, double-click detection is working.
    echo [INFO] Press any key to continue...
    echo.
    echo [DEBUG] About to call pause >> test_debug.log
    pause
    echo [DEBUG] User pressed key, continuing... >> test_debug.log
    echo.
    echo [SUCCESS] Double-click detection test PASSED!
    echo [INFO] The script correctly detected double-click execution.
    echo [INFO] This means the issue is NOT with double-click detection.
    echo.
    pause
) else (
    echo [DEBUG] Arguments provided - likely command line execution >> test_debug.log
    echo.
    echo ================================================================================
    echo                      COMMAND LINE TEST DETECTED
    echo ================================================================================
    echo.
    echo [INFO] Test script started from command line with arguments: %*
    echo [SUCCESS] Command line detection test PASSED!
    echo.
    pause
)

echo [DEBUG] Test script completed >> test_debug.log
