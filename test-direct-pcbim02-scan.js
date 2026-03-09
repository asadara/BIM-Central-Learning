const fs = require('fs');
const path = require('path');

console.log('🔍 Direct PC-BIM02 Folder Scanning Test');
console.log('=====================================');

// Direct UNC path access test
const pcBim02UncPath = '\\\\10.0.0.122\\PROJECT BIM 2025';

console.log(`Testing direct access to: ${pcBim02UncPath}`);

try {
    console.log('1. Testing if path exists...');
    const pathExists = fs.existsSync(pcBim02UncPath);
    console.log(`   Result: ${pathExists ? '✅ EXISTS' : '❌ NOT EXISTS'}`);

    if (pathExists) {
        console.log('2. Testing if path is directory...');
        const stats = fs.statSync(pcBim02UncPath);
        console.log(`   Result: ${stats.isDirectory() ? '✅ IS DIRECTORY' : '❌ NOT DIRECTORY'}`);

        if (stats.isDirectory()) {
            console.log('3. Testing folder reading...');
            const items = fs.readdirSync(pcBim02UncPath, { withFileTypes: true });
            console.log(`   Result: ✅ SUCCESS - Found ${items.length} items`);

            console.log('4. Listing first 10 items:');
            items.slice(0, 10).forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.isDirectory() ? '[DIR]' : '[FILE]'} ${item.name}`);
            });

            // Test accessing a specific project folder
            if (items.length > 0) {
                const firstFolder = items.find(item => item.isDirectory());
                if (firstFolder) {
                    console.log(`5. Testing access to first project: ${firstFolder.name}`);
                    const projectPath = path.join(pcBim02UncPath, firstFolder.name);
                    try {
                        const projectItems = fs.readdirSync(projectPath, { withFileTypes: true });
                        console.log(`   ✅ Project folder accessible - ${projectItems.length} items inside`);

                        // Look for media folders
                        const mediaFolders = projectItems.filter(item =>
                            item.isDirectory() &&
                            (item.name.toLowerCase().includes('render') ||
                                item.name.toLowerCase().includes('presentasi') ||
                                item.name.toLowerCase().includes('images'))
                        );

                        if (mediaFolders.length > 0) {
                            console.log(`   📁 Found potential media folders: ${mediaFolders.map(f => f.name).join(', ')}`);
                        } else {
                            console.log(`   📁 No standard media folders found, scanning all subfolders...`);
                        }

                    } catch (projectError) {
                        console.log(`   ❌ Cannot access project folder: ${projectError.message}`);
                    }
                }
            }
        }
    }

} catch (error) {
    console.log(`❌ CRITICAL ERROR: ${error.message}`);
    console.log(`Error code: ${error.code}`);
    console.log(`Error stack: ${error.stack}`);
}

console.log('\n🏁 Direct scanning test completed.');
