@echo off
echo Creating desktop shortcut for BCL Admin...

powershell -Command "
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut([System.Environment]::GetFolderPath('Desktop') + '\BCL Admin Start.lnk')
$Shortcut.TargetPath = '%~dp0start-bcl-fixed.bat'
$Shortcut.WorkingDirectory = '%~dp0'
$Shortcut.Description = 'Start BCL Enterprise Server (Admin Access)'
$Shortcut.IconLocation = 'C:\Windows\System32\SHELL32.dll,13'
$Shortcut.Save()
"

echo.
echo ✅ Desktop shortcut created: "BCL Admin Start.lnk"
echo.
echo Double-click the shortcut on your desktop to start the BCL server.
echo.
pause
