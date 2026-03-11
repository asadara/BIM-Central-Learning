const http = require('http');

const getProjects = () => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: parseInt(process.env.BCL_PORT, 10) || 5052,
            path: '/api/projects/2025',
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

getProjects()
    .then(data => {
        console.log('📊 2025 Projects Found:', data.projects.length);
        data.projects.forEach(project => {
            console.log(`  - ${project.name} (${project.sourceId})`);
        });
    })
    .catch(err => {
        console.error('Error:', err.message);
    });
