const http = require('http');

// Test PC-BIM02 projects fetching
console.log('Testing PC-BIM02 media fetching...');

const testProjectsAPI = () => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '10.0.0.90',
            port: 5051,
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

        req.end();
    });
};

const testMediaFetching = async (projectName) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '10.0.0.90',
            port: 5051,
            path: `/api/project-media/2025/${encodeURIComponent(projectName)}`,
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
                    reject(new Error('Failed to parse media response: ' + e.message));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.end();
    });
};

const runTests = async () => {
    try {
        console.log('1. Testing projects API...');
        const projectsData = await testProjectsAPI();

        console.log('✅ Projects API response:');
        console.log(`   - Total projects: ${projectsData.projects ? projectsData.projects.length : 0}`);
        console.log(`   - Sources: ${projectsData.sources ? projectsData.sources.map(s => s.id).join(', ') : 'none'}`);

        const pcBim02Projects = projectsData.projects ? projectsData.projects.filter(p => p.sourceId === 'pc-bim02-2025') : [];
        console.log(`   - PC-BIM02 projects: ${pcBim02Projects.length}`);

        if (pcBim02Projects.length > 0) {
            console.log('2. Testing media fetching for first PC-BIM02 project...');
            const firstProject = pcBim02Projects[0];
            console.log(`   - Testing project: ${firstProject.name}`);

            try {
                const mediaData = await testMediaFetching(firstProject.name);
                console.log('✅ Media fetching successful:');
                console.log(`   - Media files found: ${mediaData.media ? mediaData.media.length : 0}`);
                console.log(`   - Message: ${mediaData.message || 'No message'}`);
            } catch (mediaError) {
                console.log('❌ Media fetching failed:', mediaError.message);
            }
        } else {
            console.log('2. No PC-BIM02 projects found to test media fetching');

            // Show what projects we did find
            if (projectsData.projects && projectsData.projects.length > 0) {
                console.log('   Available projects:');
                projectsData.projects.forEach(p => {
                    console.log(`   - ${p.name} (${p.sourceId})`);
                });
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
};

runTests();
