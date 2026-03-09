const LANMountManager = require('./backend/utils/lanMountManager');

async function testMountAccess() {
    console.log('Testing PC-BIM02 mount access with enhanced logic...');

    const lanManager = new LANMountManager();
    const mount = lanManager.getMountById('pc-bim02');

    if (!mount) {
        console.log('❌ Mount pc-bim02 not found in configuration');
        return;
    }

    console.log('Mount configuration:', {
        id: mount.id,
        remotePath: mount.remotePath,
        localMountPoint: mount.localMountPoint,
        status: mount.status
    });

    try {
        console.log('🔍 Testing mount access...');
        const accessResult = await lanManager.testMountAccess('pc-bim02');

        console.log('Access result:', accessResult);

        if (accessResult.accessible) {
            console.log(`✅ Mount accessible via ${accessResult.method}: ${accessResult.path}`);

            // Try to list contents if UNC path
            if (accessResult.method === 'unc') {
                console.log('🔍 Testing UNC path access...');
                const fs = require('fs');
                try {
                    const items = fs.readdirSync(accessResult.path);
                    console.log(`✅ UNC path listing successful: ${items.length} items found`);
                    console.log('First 5 items:', items.slice(0, 5));
                } catch (listError) {
                    console.log(`❌ UNC path listing failed: ${listError.message}`);
                }
            }
        } else {
            console.log(`❌ Mount not accessible: ${accessResult.message}`);
        }
    } catch (error) {
        console.error('❌ Mount access test failed:', error.message);
    }
}

testMountAccess();
