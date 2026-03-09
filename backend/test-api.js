// Quick test of the tutorials API
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5150,
    path: '/api/tutorials',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const videos = JSON.parse(data);
            console.log(`✅ Found ${videos.length} videos`);
            if (videos.length > 0) {
                console.log('📹 First video:', videos[0].name);
                console.log('📁 Path:', videos[0].path);
                console.log('🖼️ Thumbnail:', videos[0].thumbnail);
            }
        } catch (error) {
            console.log('❌ Response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Error:', error.message);
});

req.end();
