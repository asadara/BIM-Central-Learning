// Quick test script to count tutorials
const http = require('http');

const options = {
    hostname: '10.0.0.90',
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
            const tutorials = JSON.parse(data);
            console.log(`🎥 Total videos found: ${tutorials.length}`);
            console.log('✅ First few videos:');
            tutorials.slice(0, 10).forEach((video, index) => {
                console.log(`   ${index + 1}. ${video.name} (${video.size} MB)`);
            });

            if (tutorials.length > 10) {
                console.log(`   ... and ${tutorials.length - 10} more videos`);
            }
        } catch (error) {
            console.error('❌ Error parsing response:', error.message);
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
});

req.end();
