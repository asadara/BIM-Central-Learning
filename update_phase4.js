const fs = require('fs');
const path = 'C:/BCL/BC-Learning-Main/elearning-assets/phase4-dashboard.html';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('networkFetchInFlight')) {
  content = content.replace(
    'let isRestarting = false; // Prevent multiple restart attempts',
    'let isRestarting = false; // Prevent multiple restart attempts        let networkFetchInFlight = false; // Prevent overlapping network info requests'
  );
}

const newFunction = [
  "async function fetchNetworkInfo() {",
  "            const infoDiv = document.getElementById('network-info');",
  "            if (!infoDiv) {",
  "                console.warn('❌ network-info element not found');",
  "                return;",
  "            }",
  "            if (networkFetchInFlight) {",
  "                console.log('⏳ Network info request already in progress');",
  "                return;",
  "            }",
  "            networkFetchInFlight = true;",
  "            infoDiv.innerHTML = '<span class=loading></span> Memuat info jaringan...';",
  "            console.log('🔍 Starting network info fetch...');",
  "            // Add small delay to ensure server is ready",
  "            await new Promise(resolve => setTimeout(resolve, 300));",
  "            let timeoutId = null;",
  "            let controller = null;",
  "            try {",
  "                console.log('📡 Fetching from /api/network-info...');",
  "                if (typeof AbortController !== 'undefined') {",
  "                    controller = new AbortController();",
  "                    timeoutId = setTimeout(() => controller.abort(), 10000);",
  "                }",
  "                const response = await fetch('/api/network-info', {",
  "                    method: 'GET',",
  "                    headers: {",
  "                        'Accept': 'application/json'",
  "                    },",
  "                    signal: controller ? controller.signal : undefined",
  "                });",
  "                console.log('📨 Response received:', response.status, response.statusText);",
  "                if (!response.ok) {",
  "                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);",
  "                }",
  "                const data = await response.json();",
  "                console.log('📊 Data received:', data);",
  "                let html = '<b>IP Server:</b> ' + (data.serverIPs && data.serverIPs.length ? data.serverIPs.join(', ') : '-') + '<br>';",
  "                html += '<b>IP Anda:</b> ' + (data.userIP || '-') + '<br>';",
  "                infoDiv.innerHTML = html;",
  "                console.log('✅ Network info loaded successfully');",
  "            } catch (err) {",
  "                console.error('❌ Network info failed:', err.message);",
  "                console.error('❌ Error details:', err);",
  "                if (err.name === 'AbortError') {",
  "                    infoDiv.innerHTML = '<span style=color:#ef4444>⏰ Timeout: Server tidak merespons</span>';",
  "                } else if (err.message.includes('fetch') || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {",
  "                    infoDiv.innerHTML = '<span style=color:#ef4444>🌐 Network Error: Akses melalui URL server yang benar</span>';",
  "                    console.log('💡 Pastikan mengakses dashboard melalui: http://localhost:5051/elearning-assets/phase4-dashboard.html');",
  "                } else if (err.message.includes('CORS')) {",
  "                    infoDiv.innerHTML = '<span style=color:#ef4444>🚫 CORS Error: Gunakan URL server</span>';",
  "                } else {",
  "                    infoDiv.innerHTML = '<span style=color:#ef4444>❌ Gagal memuat info jaringan</span>';",
  "                }",
  "            } finally {",
  "                if (timeoutId) {",
  "                    clearTimeout(timeoutId);",
  "                }",
  "                networkFetchInFlight = false;",
  "            }",
  "        }",
  "        // Render system cards"
].join('\n');

content = content.replace(/async function fetchNetworkInfo\(\) \{[\s\S]*?\}\s*\/\/ Render system cards/, newFunction);
fs.writeFileSync(path, content, 'utf8');
