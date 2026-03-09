@echo off
echo Creating BCL Admin Desktop Shortcut...
echo.

:: Create a simple VBS script to make the shortcut
echo Set oWS = WScript.CreateObject("WScript.Shell") > CreateShortcut.vbs
echo sLinkFile = oWS.ExpandEnvironmentStrings("%%USERPROFILE%%\Desktop\BCL Admin Start.lnk") >> CreateShortcut.vbs
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> CreateShortcut.vbs
echo oLink.TargetPath = "C:\BCL\start-bcl-fixed.bat" >> CreateShortcut.vbs
echo oLink.WorkingDirectory = "C:\BCL" >> CreateShortcut.vbs
echo oLink.Description = "Start BCL Enterprise Server (Admin Access)" >> CreateShortcut.vbs
echo oLink.IconLocation = "C:\Windows\System32\SHELL32.dll,13" >> CreateShortcut.vbs
echo oLink.Save >> CreateShortcut.vbs

:: Run the VBS script
cscript CreateShortcut.vbs

:: Clean up
del CreateShortcut.vbs

echo.
echo ✅ Desktop shortcut created successfully!
echo.
echo Shortcut location: %%USERPROFILE%%\Desktop\BCL Admin Start.lnk
echo.
echo You can now double-click "BCL Admin Start" on your desktop
echo to start the BCL server with admin access.
echo.
pause
