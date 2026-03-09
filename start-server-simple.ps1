# Simple server startup script
Push-Location C:\BCL\backend
$env:USE_HTTPS = 'false'
$env:HTTP_PORT = '5051'
& node server.js
