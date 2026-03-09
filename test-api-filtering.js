// Script untuk menganalisis filtering video berdasarkan kategori
const http = require('http');

// Fungsi untuk mendeteksi kategori video (sama dengan frontend)
function detectVideoCategory(filename) {
    const name = filename.toLowerCase();

    if (name.includes('autocad') || name.includes('acad') || name.includes('dwg')) {
        return { id: 'autocad', name: 'AutoCAD', icon: 'fas fa-drafting-compass' };
    }
    if (name.includes('revit') || name.includes('rvt') || name.includes('bim')) {
        return { id: 'revit', name: 'Revit BIM', icon: 'fas fa-building' };
    }
    if (name.includes('civil') || name.includes('infraworks') || name.includes('civil-3d')) {
        return { id: 'civil', name: 'Civil 3D', icon: 'fas fa-road' };
    }
    if (name.includes('archicad') || name.includes('archi-cad')) {
        return { id: 'archicad', name: 'ArchiCAD', icon: 'fas fa-home' };
    }
    if (name.includes('navisworks') || name.includes('nwd')) {
        return { id: 'navisworks', name: 'Navisworks', icon: 'fas fa-project-diagram' };
    }
    if (name.includes('enscape')) {
        return { id: 'enscape', name: 'Enscape', icon: 'fas fa-eye' };
    }

    return { id: 'general', name: 'General BIM', icon: 'fas fa-play-circle' };
}

// Test filtering dengan data dari API
function testAPIFiltering() {
    http.get('http://10.0.0.90:5051/api/tutorials', (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const videos = JSON.parse(data);
                console.log(`📊 Total videos from API: ${videos.length}`);

                // Test filtering untuk AutoCAD
                const autocadVideos = videos.filter(video => {
                    const category = detectVideoCategory(video.name);
                    return category.id === 'autocad';
                });

                console.log(`🔍 AutoCAD videos found: ${autocadVideos.length}`);
                if (autocadVideos.length > 0) {
                    console.log('📝 Sample AutoCAD videos:');
                    autocadVideos.slice(0, 3).forEach(video => {
                        console.log(`   - ${video.name}`);
                    });
                }

                // Test filtering untuk Civil 3D
                const civilVideos = videos.filter(video => {
                    const category = detectVideoCategory(video.name);
                    return category.id === 'civil';
                });

                console.log(`🔍 Civil 3D videos found: ${civilVideos.length}`);
                if (civilVideos.length > 0) {
                    console.log('📝 Sample Civil 3D videos:');
                    civilVideos.slice(0, 3).forEach(video => {
                        console.log(`   - ${video.name}`);
                    });
                }

            } catch (error) {
                console.error('❌ Error parsing API response:', error.message);
            }
        });
    }).on('error', (error) => {
        console.error('❌ Error fetching API:', error.message);
    });
}

testAPIFiltering();
