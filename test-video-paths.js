// test-video-paths.js - Debug script to check video paths in cache
const http = require('http');

function fetchVideos() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: parseInt(process.env.BCL_PORT, 10) || 5052,
            path: '/api/tutorials',
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.end();
    });
}

async function main() {
    console.log('🔍 Fetching videos from http://localhost:5052/api/tutorials...\n');
    try {
        const videos = await fetchVideos();

        console.log(`📊 Total videos: ${videos.length}\n`);

        // Find video1213112062.mp4
        const target = videos.find(v => v.name === 'video1213112062.mp4');

        if (target) {
            console.log('✅ Found video1213112062.mp4:');
            console.log(`   Name: ${target.name}`);
            console.log(`   Path: ${target.path}`);
            console.log(`   Size: ${target.size} MB`);
            console.log(`   Thumbnail: ${target.thumbnail}`);
            console.log(`   Category: ${target.category.name}`);
        } else {
            console.log('❌ video1213112062.mp4 NOT found in cache');
        }

        // Check for deeply nested videos
        console.log('\n📁 Checking for nested paths:\n');
        const nested = videos.filter(v => v.path.includes('%'));
        console.log(`   Videos with encoded paths: ${nested.length}`);
        if (nested.length > 0) {
            console.log(`   Example 1: ${nested[0].name}`);
            console.log(`   Path 1: ${nested[0].path}`);
            if (nested.length > 1) {
                console.log(`   Example 2: ${nested[1].name}`);
                console.log(`   Path 2: ${nested[1].path}`);
            }
        }

        // Check videos from "7. Audio Visual Learning" folder
        console.log('\n📺 Videos from 7. Audio Visual Learning folder:\n');
        const audioVisual = videos.filter(v => v.path.includes('7.%20Audio'));
        console.log(`   Found: ${audioVisual.length} videos`);
        if (audioVisual.length > 0) {
            audioVisual.slice(0, 3).forEach((v, i) => {
                console.log(`   [${i + 1}] ${v.name}`);
                console.log(`       Path: ${v.path}`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

main();
