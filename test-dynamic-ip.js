const LANMountManager = require('./backend/utils/lanMountManager');

async function testDynamicIP() {
    console.log('🔍 Testing Dynamic IP Resolution for PC-BIM02...');

    const lanManager = new LANMountManager();
    const mount = lanManager.getMountById('pc-bim02');

    if (!mount) {
        console.log('❌ Mount pc-bim02 not found');
        return;
    }

    console.log('Current config:');
    console.log(`  Host: ${mount.host}`);
    console.log(`  Remote Path: ${mount.remotePath}`);
    console.log(`  Share Name: ${mount.shareName}`);

    // Test hostname resolution
    try {
        console.log('\n🔍 Testing hostname resolution...');
        const resolvedIP = await lanManager._resolveHostnameToIP('PC-BIM02');

        if (resolvedIP) {
            console.log(`✅ Hostname 'PC-BIM02' resolved to: ${resolvedIP}`);

            if (resolvedIP !== mount.host) {
                console.log(`📋 IP changed! Config: ${mount.host} → Resolved: ${resolvedIP}`);

                // Test if the resolved IP works
                const testUncPath = `\\\\${resolvedIP}\\PROJECT BIM 2025`;
                console.log(`🔍 Testing UNC path with resolved IP: ${testUncPath}`);

                const result = await lanManager._executeCommand(`dir "${testUncPath}" /b`);
                if (result.success) {
                    console.log('✅ SUCCESS: Resolved IP UNC path is accessible!');
                    console.log('📊 Directory contents preview:');
                    console.log(result.stdout.split('\n').slice(0, 5).join('\n'));
                } else {
                    console.log('❌ FAIL: Resolved IP UNC path not accessible');
                    console.log('Error:', result.error);
                }
            } else {
                console.log('📋 IP unchanged - current config is still valid');
            }
        }
    } catch (error) {
        console.log('❌ Hostname resolution failed:', error.message);
    }

    // Test enhanced mount access
    console.log('\n🔍 Testing enhanced mount access (with hostname resolution)...');
    try {
        const accessResult = await lanManager.testMountAccess('pc-bim02');
        console.log('Access result:', accessResult);

        if (accessResult.accessible) {
            console.log(`✅ SUCCESS: Mount accessible via ${accessResult.method}`);
            console.log(`   Path: ${accessResult.path}`);
        } else {
            console.log('❌ FAIL: Mount not accessible');
            console.log('   Message:', accessResult.message);
        }
    } catch (error) {
        console.log('❌ Mount access test failed:', error.message);
    }
}

testDynamicIP();
