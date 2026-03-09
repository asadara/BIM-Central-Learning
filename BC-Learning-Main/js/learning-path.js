document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/elearning/modules')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('modules-list');
            if (Array.isArray(data)) {
                container.innerHTML = data.map(mod => `
                        <div class="box">
                            <div class="tutor">
                                <img src="/BC-Learning-Main/img/default.jpg" alt="Module Thumbnail">
                                <div class="info">
                                    <h3>${mod.author || 'BCL Team'}</h3>
                                    <span>${mod.date || ''}</span>
                                </div>
                            </div>
                            <div class="thumb">
                                <img src="/BC-Learning-Main/img/course-1.jpg" alt="">
                                <span>${mod.videos ? mod.videos.length + ' videos' : ''}</span>
                            </div>
                            <h3 class="title">${mod.title}</h3>
                            <p>${mod.description || ''}</p>
                            <a href="#" class="inline-btn">Lihat Modul</a>
                        </div>
                    `).join('');
            } else {
                container.textContent = 'No modules found.';
            }
        })
        .catch(() => {
            document.getElementById('modules-list').textContent = 'Failed to load modules.';
        });

    // Optionally, load navbar if modular
    fetch('components/navbar.html')
        .then(res => res.text())
        .then(html => {
            document.getElementById('navbar').innerHTML = html;
        });
});
