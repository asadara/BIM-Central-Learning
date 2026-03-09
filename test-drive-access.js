const fs = require('fs');
const path = require('path');

console.log('Testing X: drive access from Node.js...');

try {
    // Check if X: exists
    const stats = fs.statSync('X:');
    console.log('✅ X: drive exists, isDirectory:', stats.isDirectory());

    // Try to list contents
    const items = fs.readdirSync('X:');
    console.log('✅ X: drive contents:', items.length, 'items');
    console.log('First 5 items:', items.slice(0, 5));

} catch (error) {
    console.error('❌ X: drive access failed:', error.message);
    console.error('Error code:', error.code);

    // Try alternative approach - check if drive letter is mapped
    try {
        const drives = require('child_process').execSync('wmic logicaldisk get name', { encoding: 'utf8' });
        console.log('Available drives:', drives.split('\n').filter(line => line.trim()).join(', '));
    } catch (wmicError) {
        console.error('Failed to list drives via WMIC:', wmicError.message);
    }
}
