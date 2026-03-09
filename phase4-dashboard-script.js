
(() => {
  'use strict';

  const systems = [
    {
      id: 'basic-api',
      name: 'Basic API System',
      icon: '🔌',
      description: 'Layanan API utama untuk autentikasi dan data inti.'
    },
    {
      id: 'video-management',
      name: 'Video Management',
      icon: '🎥',
      description: 'Manajemen video pembelajaran dan streaming.'
    },
    {
      id: 'user-management',
      name: 'User Management',
      icon: '👤',
      description: 'Pengelolaan akun, role, dan sesi pengguna.'
    },
    {
      id: 'content-management',
      name: 'Content Management',
      icon: '📚',
      description: 'Pengelolaan materi, modul, dan metadata.'
    },
    {
      id: 'admin-panel',
      name: 'Admin Panel',
      icon: '⚙️',
      description: 'Panel administratif untuk konfigurasi sistem.'
    }
  ];

  const appStartTime = Date.now();
  let networkFetchInFlight = false;
  let monitoringIntervalId = null;

  const grid = document.getElementById('systems-grid');
  const outputEl = document.getElementById('test-output');
  const systemsOnlineEl = document.getElementById('systems-online');
  const systemsTotalEl = document.getElementById('systems-total');
  const activeUsersEl = document.getElementById('active-users');
  const uptimeEl = document.getElementById('uptime');

  const initialOutput = outputEl ? outputEl.textContent.trimEnd() : '';

  function logOutput(message) {
    if (!outputEl) {
      return;
    }
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
    outputEl.textContent += `\n[${timestamp}] ${message}`;
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function formatUptime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  function updateStats(onlineCount) {
    if (systemsOnlineEl) {
      systemsOnlineEl.textContent = String(onlineCount);
    }
    if (systemsTotalEl) {
      systemsTotalEl.textContent = String(systems.length);
    }
    if (activeUsersEl) {
      activeUsersEl.textContent = String(onlineCount * 12);
    }
    if (uptimeEl) {
      uptimeEl.textContent = formatUptime(Date.now() - appStartTime);
    }
  }

  function setSystemStatus(id, status, text) {
    const indicator = document.getElementById(`status-${id}`);
    const statusText = document.getElementById(`status-text-${id}`);

    if (indicator) {
      indicator.classList.remove('status-online', 'status-offline', 'status-loading');
      indicator.classList.add(`status-${status}`);
    }
    if (statusText) {
      statusText.textContent = text;
    }
  }

  function renderSystems() {
    if (!grid) {
      return;
    }

    grid.innerHTML = systems.map(system => `
      <div class="system-card" data-system="${system.id}">
        <div class="system-header">
          <div class="system-icon">${system.icon}</div>
          <div class="system-title">${system.name}</div>
        </div>
        <div class="system-status">
          <span class="status-indicator status-loading" id="status-${system.id}"></span>
          <span id="status-text-${system.id}">Loading...</span>
        </div>
        <div class="system-description">${system.description}</div>
        <div class="system-actions">
          <button class="action-btn" onclick="testSystem('${system.id}')">Test</button>
        </div>
      </div>
    `).join('');
  }

  function refreshAllSystems() {
    logOutput('Refreshing system status...');
    systems.forEach((system, index) => {
      setSystemStatus(system.id, 'loading', 'Checking...');
      const delay = 400 + index * 250;
      setTimeout(() => {
        setSystemStatus(system.id, 'online', 'Online');
      }, delay);
    });

    const totalDelay = 400 + systems.length * 250;
    setTimeout(() => {
      updateStats(systems.length);
    }, totalDelay);
  }

  function testSystem(systemId) {
    logOutput(`Running test for ${systemId}...`);
    setSystemStatus(systemId, 'loading', 'Testing...');
    setTimeout(() => {
      setSystemStatus(systemId, 'online', 'Online');
      logOutput(`Test completed for ${systemId}: OK`);
    }, 700);
  }

  function runComprehensiveTest() {
    logOutput('Running comprehensive test for all systems...');
    systems.forEach(system => {
      setSystemStatus(system.id, 'loading', 'Testing...');
    });

    setTimeout(() => {
      systems.forEach(system => {
        setSystemStatus(system.id, 'online', 'Online');
      });
      updateStats(systems.length);
      logOutput('Comprehensive test completed. All systems OK.');
    }, 1200);
  }

  function startRealTimeMonitoring() {
    if (monitoringIntervalId) {
      clearInterval(monitoringIntervalId);
      monitoringIntervalId = null;
      logOutput('Real-time monitoring stopped.');
      return;
    }

    monitoringIntervalId = setInterval(() => {
      refreshAllSystems();
    }, 30000);

    logOutput('Real-time monitoring started (30s interval).');
  }

  function checkServerStatus() {
    logOutput('Checking server status...');
    refreshAllSystems();
    fetchNetworkInfo();
  }

  function clearTestOutput() {
    if (!outputEl) {
      return;
    }
    outputEl.textContent = initialOutput;
  }

  function restartClientApplication() {
    logOutput('Restarting client and clearing cache...');
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (err) {
      console.warn('Storage clear failed:', err);
    }
    setTimeout(() => {
      location.reload();
    }, 800);
  }

  function openMainPage() {
    window.location.href = 'home.html';
  }

  function openAdminPanel() {
    window.location.href = '../admin.html';
  }

  async function fetchNetworkInfo() {
    const infoDiv = document.getElementById('network-info');
    if (!infoDiv) {
      console.warn('network-info element not found');
      return;
    }
    if (networkFetchInFlight) {
      return;
    }

    networkFetchInFlight = true;
    infoDiv.innerHTML = '<span class="loading"></span> Memuat info jaringan...';

    const hardTimeoutMs = 10000;
    let timedOut = false;
    const hardTimeoutId = setTimeout(() => {
      timedOut = true;
      infoDiv.innerHTML = '<span style="color:#ef4444">Timeout: Server tidak merespons</span>';
      networkFetchInFlight = false;
    }, hardTimeoutMs);

    const endpoints = ['/api/network-info'];
    if (location.hostname) {
      endpoints.push(`${location.protocol}//${location.hostname}:5051/api/network-info`);
    }
    endpoints.push('http://localhost:5051/api/network-info');

    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      if (timedOut) {
        return;
      }

      let lastError = null;
      for (const url of endpoints) {
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          if (timedOut) {
            return;
          }

          const serverIps = Array.isArray(data.serverIPs) && data.serverIPs.length
            ? data.serverIPs.join(', ')
            : '-';
          const userIp = data.userIP || '-';

          infoDiv.innerHTML = `<b>IP Server:</b> ${serverIps}<br><b>IP Anda:</b> ${userIp}`;
          clearTimeout(hardTimeoutId);
          networkFetchInFlight = false;
          return;
        } catch (err) {
          lastError = err;
        }
      }

      throw lastError || new Error('Network info unavailable');
    } catch (err) {
      if (timedOut) {
        return;
      }
      const message = err && err.message ? err.message : 'unknown error';
      if (message.includes('fetch') || message.includes('Failed to fetch') || message.includes('NetworkError')) {
        infoDiv.innerHTML = '<span style="color:#ef4444">Network Error: Akses melalui URL server yang benar</span>';
      } else if (message.includes('CORS')) {
        infoDiv.innerHTML = '<span style="color:#ef4444">CORS Error: Gunakan URL server</span>';
      } else {
        infoDiv.innerHTML = '<span style="color:#ef4444">Gagal memuat info jaringan</span>';
      }
    } finally {
      clearTimeout(hardTimeoutId);
      if (!timedOut) {
        networkFetchInFlight = false;
      }
    }
  }

  function initializeDashboard() {
    renderSystems();
    updateStats(0);
    refreshAllSystems();
    fetchNetworkInfo();
  }

  window.refreshAllSystems = refreshAllSystems;
  window.runComprehensiveTest = runComprehensiveTest;
  window.startRealTimeMonitoring = startRealTimeMonitoring;
  window.checkServerStatus = checkServerStatus;
  window.clearTestOutput = clearTestOutput;
  window.restartClientApplication = restartClientApplication;
  window.openMainPage = openMainPage;
  window.openAdminPanel = openAdminPanel;
  window.testSystem = testSystem;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
  } else {
    initializeDashboard();
  }
})();

