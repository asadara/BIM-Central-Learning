// Test script untuk verifikasi filtering video berdasarkan kategori
const testVideos = [
    { name: "Complete Pelatihan AutoCad _ DAY 1.mp4", size: "137.15 MB", path: "/videos/test.mp4" },
    { name: "Learning Enscape 3.4 with Revit.mp4", size: "139.79 MB", path: "/videos/test2.mp4" },
    { name: "Tutorial Civil3D No-01.mp4", size: "36.24 MB", path: "/videos/test3.mp4" },
    { name: "ArchiCAD Design Modeling.mp4", size: "45.52 MB", path: "/videos/test4.mp4" },
    { name: "Navisworks Tutorial.mp4", size: "21.59 MB", path: "/videos/test5.mp4" }
];

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

// Test filtering untuk setiap kategori
function testFiltering() {
    const categories = ['autocad', 'revit', 'civil', 'archicad', 'navisworks', 'enscape'];

    categories.forEach(categoryId => {
        const filteredVideos = testVideos.filter(video => {
            const videoCategory = detectVideoCategory(video.name);
            return videoCategory.id === categoryId;
        });

        console.log(`\n📂 Category: ${categoryId.toUpperCase()}`);
        console.log(`   Found ${filteredVideos.length} videos:`);
        filteredVideos.forEach(video => {
            console.log(`   - ${video.name}`);
        });
    });
}

// Jalankan test
testFiltering();