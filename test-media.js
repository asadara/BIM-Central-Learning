const http = require('http');

const getProjectMedia = (projectName) => {
    return new Promise((resolve, reject) => {
        const encodedProject = encodeURIComponent(projectName);
        const options = {
            hostname: 'localhost',
            port: parseInt(process.env.BCL_PORT, 10) || 5052,
            path: `/api/project-media/2025/${encodedProject}`,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(new Error('Failed to parse response: ' + e.message));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.setTimeout(5000, () => {
            req.destroy(new Error('Request timeout after 5000ms'));
        });

        req.end();
    });
};

// Test with a local project
getProjectMedia('04. PLTM CIKAMUNDING')
    .then(data => {
        console.log('✅ Response message:', data.message);
        console.log('📁 Media files found:', data.totalMedia);
        console.log('🔢 Scanned folders:', data.scannedFolders);
    })
    .catch(err => {
        console.error('❌ Error:', err.message);
    });
