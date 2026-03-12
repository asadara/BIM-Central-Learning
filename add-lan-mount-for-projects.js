/**
 * Script untuk menambahkan PC-BIM02 sebagai source data project
 * Jalankan dengan: node add-lan-mount-for-projects.js
 */

const axios = require('axios');
const { getOptionalEnv, getRequiredEnv } = require('./backend/config/runtimeConfig');

// Use relative URL for production, localhost for testing
const BASE_URL = getOptionalEnv('BCL_BASE_URL') || 'http://localhost:5052';
const ADMIN_TOKEN = getRequiredEnv('ADMIN_TOKEN');
const PC_BIM02_USERNAME = getRequiredEnv('PC_BIM02_USERNAME');
const PC_BIM02_PASSWORD = getRequiredEnv('PC_BIM02_PASSWORD');
const PC_BIM02_DRIVE = getOptionalEnv('PC_BIM02_DRIVE') || 'X:';

async function setupLanMountForProjects() {
    console.log('🚀 Setting up LAN mount for PC-BIM02 PROJECT BIM 2025...');

    try {
        // Step 1: Add the LAN mount configuration
        console.log('\n📝 Adding LAN mount configuration...');

        const mountConfig = {
            id: 'pc-bim02',
            name: 'PC-BIM02 PROJECT BIM 2025',
            host: 'pc-bim02',
            shareName: 'PROJECT BIM 2025',
            remotePath: '\\\\pc-bim02\\PROJECT BIM 2025',
            localMountPoint: PC_BIM02_DRIVE,
            enabled: true,
            username: PC_BIM02_USERNAME,
            password: PC_BIM02_PASSWORD,
            notes: 'Network share dari PC-BIM02 untuk project 2025'
        };

        const addMountResponse = await axios.post(`${BASE_URL}/api/lan/mounts`, mountConfig, {
            headers: { 'x-admin-token': ADMIN_TOKEN }
        });

        console.log('✅ LAN mount configuration added:', addMountResponse.data.mount);

        // Step 2: Test connection (optional, but recommended)
        console.log('\n🔗 Testing connection...');

        try {
            const testResponse = await axios.post(`${BASE_URL}/api/lan/mounts/${mountConfig.id}/test`);
            console.log('✅ Connection test result:', testResponse.data.result);
        } catch (error) {
            console.warn('⚠️  Connection test failed, but mount was configured:', error.message);
        }

        // Step 3: Get current mount configurations to confirm
        console.log('\n📋 Current LAN mount configurations:');

        const mountsResponse = await axios.get(`${BASE_URL}/api/lan/mounts`);
        console.log('\n📂 Available LAN mounts:');
        mountsResponse.data.mounts.forEach(mount => {
            console.log(`- ${mount.id}: ${mount.name} (${mount.status})`);
        });

        console.log('\n🎉 Setup complete! PC-BIM02 has been added as a project data source.');
        console.log('\n🔧 Next steps:');
        console.log('1. Make sure PC-BIM02 is accessible on the network');
        console.log('2. Ensure sharing permissions are correct');
        console.log('3. Manually connect using: POST /api/lan/mounts/pc-bim02/connect');
        console.log('4. Restart the server to enable the new project source');

        console.log('\n📖 API Endpoints untuk manage LAN mounts:');
        console.log('- GET /api/lan/mounts - List all mounts');
        console.log('- POST /api/lan/mounts/{id}/connect - Connect mount');
        console.log('- GET /api/lan/mounts/{id}/status - Check status');
        console.log('- DELETE /api/lan/mounts/{id} - Remove mount');

    } catch (error) {
        console.error('❌ Error setting up LAN mount:', error.response?.data || error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Ensure PC-BIM02 is accessible from this machine');
        console.log('2. Check network connectivity and sharing permissions');
        console.log('3. Verify the path \\\\pc-bim02\\PROJECT BIM 2025 exists');
        console.log('4. Try accessing it manually first: net use X: \\\\pc-bim02\\PROJECT BIM 2025');
    }
}

// Manual steps untuk integrate dengan projects API
function showManualIntegrationSteps() {
    console.log('\n📋 MANUAL INTEGRATION STEPS:');
    console.log('===============================');

    console.log('\n1. Connect the LAN mount first:');
    console.log('   POST http://localhost:5052/api/lan/mounts/pc-bim02/connect');

    console.log('\n2. Modify server.js untuk support multi-source projects:');
    console.log('   - Cari fungsi /api/years dan /api/projects/:year');
    console.log('   - Update untuk scan dari PROJECT_SOURCES array');
    console.log('   - Enable pc-bim02-2025 source setelah mount connected');

    console.log('\n3. Test dengan membuka http://localhost:5052/pages/projects.html');

    console.log('\n4. Projects akan muncul dari kedua source:');
    console.log('   - Local: G:/PROJECT 20XX/');
    console.log('   - LAN: X:/ (mount dari PC-BIM02)');
}

// Run the setup
setupLanMountForProjects()
    .then(() => {
        showManualIntegrationSteps();
    })
    .catch(error => {
        console.error('❌ Setup failed:', error.message);
    });
