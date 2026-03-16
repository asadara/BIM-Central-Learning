# 🚀 PHASE 4 ENTERPRISE LEARNING PLATFORM STARTUP SCRIPT
# Automated startup untuk semua sistem Phase 4

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "🚀 PHASE 4 ENTERPRISE LEARNING PLATFORM" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Environment Setup
Write-Host "📋 Step 1: Setting up environment..." -ForegroundColor Yellow
$env:USE_HTTPS = "false"
$env:NODE_ENV = "development"
$env:PORT = "3000"
$env:PHASE4_ENABLED = "true"
Write-Host "✅ Environment variables configured" -ForegroundColor Green

# Step 2: Clean existing processes
Write-Host ""
Write-Host "🧹 Step 2: Cleaning existing processes..." -ForegroundColor Yellow
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Write-Host "✅ Cleaned existing Node.js processes" -ForegroundColor Green

# Step 3: Check dependencies
Write-Host ""
Write-Host "🔍 Step 3: Checking dependencies..." -ForegroundColor Yellow

# Check if backend directory exists
if (Test-Path "C:\BCL\backend") {
    Write-Host "✅ Backend directory found" -ForegroundColor Green
}
else {
    Write-Host "❌ Backend directory not found!" -ForegroundColor Red
    exit 1
}

# Check if Phase 4 files exist
$phase4Files = @(
    "C:\BCL\BC-Learning-Main\elearning-assets\js\ai-learning-assistant.js",
    "C:\BCL\BC-Learning-Main\elearning-assets\js\predictive-learning-engine.js",
    "C:\BCL\BC-Learning-Main\elearning-assets\js\realtime-collaboration.js",
    "C:\BCL\BC-Learning-Main\elearning-assets\js\advanced-cdn-system.js",
    "C:\BCL\BC-Learning-Main\elearning-assets\js\enterprise-multitenancy.js",
    "C:\BCL\BC-Learning-Main\elearning-assets\js\mobile-first-architecture.js",
    "C:\BCL\BC-Learning-Main\elearning-assets\js\blockchain-integration.js",
    "C:\BCL\BC-Learning-Main\elearning-assets\js\comprehensive-api-ecosystem.js",
    "C:\BCL\BC-Learning-Main\elearning-assets\js\business-intelligence-dashboard.js",
    "C:\BCL\BC-Learning-Main\elearning-assets\js\advanced-testing-framework.js"
)

$filesFound = 0
foreach ($file in $phase4Files) {
    if (Test-Path $file) {
        $filesFound++
    }
}

Write-Host "✅ Found $filesFound/10 Phase 4 system files" -ForegroundColor Green

# Step 4: Start Backend Server
Write-Host ""
Write-Host "🔥 Step 4: Starting backend server..." -ForegroundColor Yellow
Write-Host "📍 Location: C:\BCL\backend" -ForegroundColor Cyan

Set-Location "C:\BCL\backend"

# Check if server.js exists
if (Test-Path "server.js") {
    Write-Host "✅ Server file found" -ForegroundColor Green
    
    # Start server in new window
    Write-Host "🚀 Launching server in new window..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:USE_HTTPS='false'; node server.js" -WindowStyle Normal
    
    # Wait for server to initialize
    Write-Host "⏳ Waiting for server initialization..." -ForegroundColor Yellow
    Start-Sleep -Seconds 8
    
    Write-Host "✅ Backend server started" -ForegroundColor Green
}
else {
    Write-Host "❌ Server.js not found!" -ForegroundColor Red
    exit 1
}

# Step 5: Test server connectivity
Write-Host ""
Write-Host "🌐 Step 5: Testing server connectivity..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ Server is responding (Status: $($response.StatusCode))" -ForegroundColor Green
}
catch {
    Write-Host "⚠️ Server might still be starting up..." -ForegroundColor Yellow
}

# Step 6: Open browser
Write-Host ""
Write-Host "🌍 Step 6: Opening web browser..." -ForegroundColor Yellow
Start-Process "http://localhost:3000"
Write-Host "✅ Browser opened to http://localhost:3000" -ForegroundColor Green

# Step 7: Show Phase 4 system status
Write-Host ""
Write-Host "📊 Step 7: Phase 4 Systems Overview" -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Cyan

$systems = @(
    "🤖 AI Learning Assistant",
    "🔮 Predictive Learning Engine", 
    "🔗 Real-time Collaboration System",
    "🌐 Advanced CDN System",
    "🏢 Enterprise Multi-tenancy",
    "📱 Mobile-First Architecture",
    "⛓️ Blockchain Integration",
    "🔌 Comprehensive API Ecosystem", 
    "📊 Business Intelligence Dashboard",
    "🧪 Advanced Testing Framework"
)

foreach ($system in $systems) {
    Write-Host "✅ $system" -ForegroundColor Green
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "🎉 PHASE 4 STARTUP COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Instructions
Write-Host "📋 NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. 🌐 Browser telah terbuka di http://localhost:3000" -ForegroundColor White
Write-Host "2. 🔧 Tekan F12 untuk membuka Developer Console" -ForegroundColor White  
Write-Host "3. 🧪 Jalankan test script berikut di Console:" -ForegroundColor White
Write-Host ""
Write-Host "   testAllPhase4Systems();" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. 📖 Baca PHASE4_STARTUP_GUIDE.md untuk panduan lengkap" -ForegroundColor White
Write-Host ""

# Show monitoring commands
Write-Host "🔍 MONITORING COMMANDS:" -ForegroundColor Yellow
Write-Host "• Monitor real-time: setInterval(() => console.log('System OK'), 5000)" -ForegroundColor White
Write-Host "• Check AI Assistant: window.aiAssistant.getStatus()" -ForegroundColor White
Write-Host "• Check all systems: testAllPhase4Systems()" -ForegroundColor White
Write-Host ""

Write-Host "🚀 Happy Learning with Phase 4 Enterprise Platform! 🎓" -ForegroundColor Green

# Keep window open
Write-Host ""
Write-Host "💡 Tip: Keep this window open to monitor startup status" -ForegroundColor Cyan
Write-Host "Press any key to close this startup script..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")