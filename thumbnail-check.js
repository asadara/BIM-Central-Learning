const fs = require('fs');
const path = require('path');

const THUMBNAIL_DIR = path.join(__dirname, 'backend/public/thumbnails');
const FALLBACK_IMG = path.join(__dirname, 'BC-Learning-Main/img/fallback-thumb.png');

console.log('🖼️ THUMBNAIL ANALYSIS REPORT');
console.log('='.repeat(50));

console.log('📁 Thumbnail directory:', THUMBNAIL_DIR);
console.log('📁 Fallback image:', FALLBACK_IMG);

if (!fs.existsSync(THUMBNAIL_DIR)) {
    console.log('❌ Thumbnail directory not found!');
    process.exit(1);
}

if (!fs.existsSync(FALLBACK_IMG)) {
    console.log('❌ Fallback thumbnail not found!');
} else {
    console.log('✅ Fallback thumbnail exists');
    const stats = fs.statSync(FALLBACK_IMG);
    console.log('   Size:', (stats.size / 1024).toFixed(1), 'KB');
}

const thumbs = fs.readdirSync(THUMBNAIL_DIR).filter(f => f.endsWith('.jpg'));
console.log('\n📊 Total thumbnails found:', thumbs.length);

if (thumbs.length > 0) {
    console.log('📋 Sample thumbnails:');
    thumbs.slice(0, 3).forEach(thumb => {
        const fullPath = path.join(THUMBNAIL_DIR, thumb);
        const stats = fs.statSync(fullPath);
        console.log('   •', thumb.substring(0, 50) + (thumb.length > 50 ? '...' : ''), '-', (stats.size / 1024).toFixed(1), 'KB');
    });

    if (thumbs.length > 3) {
        console.log('   ... and', thumbs.length - 3, 'more');
    }
}

console.log('\n🔍 Server route configuration:');
console.log('✅ Thumbnail route: /thumbnails/* →', THUMBNAIL_DIR);
console.log('✅ Fallback route: ../img/fallback-thumb.png →', FALLBACK_IMG);

console.log('\n📋 Troubleshooting untuk client-side thumbnail issues:');
console.log('1. Clear browser cache (Ctrl+Shift+R)');
console.log('2. Check network tab for 404 errors on thumbnail URLs');
console.log('3. Verify thumbnails load at: http://10.0.0.90/thumbnails/filename.jpg');
console.log('4. Check if firewall blocks image requests');
console.log('5. Try different browser (Chrome, Firefox, Edge)');
console.log('6. Check if images are blocked in browser settings');
