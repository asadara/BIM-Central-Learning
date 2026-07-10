document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/elearning/modules')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('modules-list');
            if (Array.isArray(data)) {
                container.innerHTML = data.map(mod => `
                        <div class="box">
                            <div class="tutor">
                                <img src="/img/media-thumbnail.svg" alt="Thumbnail Modul">
                                <div class="info">
                                    <h3>${mod.author || 'Tim BCL'}</h3>
                                    <span>${mod.date || ''}</span>
                                </div>
                            </div>
                            <div class="thumb">
                                <img src="${mod.thumbnail || '/img/media-thumbnail.svg'}" alt="${mod.title || 'Thumbnail Modul'}" onerror="this.onerror=null;this.src='/img/media-thumbnail.svg'">
                                <span>${mod.videos ? mod.videos.length + ' video' : ''}</span>
                            </div>
                            <h3 class="title">${mod.title}</h3>
                            <p>${mod.description || ''}</p>
                            <a href="#" class="inline-btn">Lihat Modul</a>
                        </div>
                    `).join('');
            } else {
                container.textContent = 'Belum ada modul yang tersedia.';
            }
        })
        .catch(() => {
            document.getElementById('modules-list').textContent = 'Gagal memuat modul.';
        });

    // Optionally, load navbar if modular
    fetch('components/navbar.html')
        .then(res => res.text())
        .then(html => {
            document.getElementById('navbar').innerHTML = html;
        });
});
