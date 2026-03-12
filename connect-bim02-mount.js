const axios = require('axios');
const { getOptionalEnv, getRequiredEnv } = require('./backend/config/runtimeConfig');

async function connectBIM02Mount() {
    // Use relative URL for production, localhost for testing
    const BASE_URL = getOptionalEnv('BCL_BASE_URL') || 'http://localhost:5052';
    const ADMIN_TOKEN = getRequiredEnv('ADMIN_TOKEN');

    console.log('🔌 Connecting PC-BIM02 LAN mount...');

    try {
        // First check current status
        console.log('\n📊 Checking current mount status...');
        const statusResponse = await axios.get(`${BASE_URL}/api/lan/mounts`);
        console.log('Current mounts:', statusResponse.data.mounts.map(m => ({
            id: m.id,
            name: m.name,
            status: m.status,
            lastConnected: m.lastConnected
        })));

        // Try to connect the mount
        console.log('\n🔌 Connecting mount pc-bim02...');
        const connectResponse = await axios.post(
            `${BASE_URL}/api/lan/mounts/pc-bim02/connect`,
            {},
            {
                headers: { 'x-admin-token': ADMIN_TOKEN }
            }
        );
        console.log('Connect result:', connectResponse.data);

        // Check status again
        console.log('\n📊 Checking status after connect...');
        const statusResponse2 = await axios.get(`${BASE_URL}/api/lan/mounts`);
        console.log('Updated mount status:', statusResponse2.data.mounts.find(m => m.id === 'pc-bim02'));

        console.log('\n✅ PC-BIM02 mount connection process completed!');

    } catch (error) {
        console.error('❌ Error connecting mount:', error.response?.data || error.message);
    }
}

connectBIM02Mount();
