const fs = require('fs');
const path = require('path');

// Test reading the folder with apostrophe
const testPath = `G:\\BIM CENTRAL LEARNING\\7. Audio Visual Learning\\1. AERIAL SURVEY\\Terra Drone\\Zoom\\2022-04-12 13.24.25 Data AeroGeosurvey's Zoom Meeting`;

console.log('Testing folder:', testPath);
console.log('Path exists:', fs.existsSync(testPath));

try {
    const files = fs.readdirSync(testPath, { withFileTypes: true });
    console.log('✅ Successfully read directory!');
    console.log('Found', files.length, 'items');
    console.log('\nVideo files:');
    files.forEach(f => {
        if (f.name.includes('video1213112062')) {
            console.log(' 🎬 FOUND:', f.name, '| Is File:', f.isFile());
        }
    });

    // List all items
    console.log('\nAll items:');
    files.forEach(f => {
        const type = f.isDirectory() ? '[DIR]' : '[FILE]';
        console.log(`  ${type} ${f.name}`);
    });
} catch (error) {
    console.error('❌ Error reading directory:');
    console.error('  Message:', error.message);
    console.error('  Code:', error.code);
    console.error('  errno:', error.errno);
}
