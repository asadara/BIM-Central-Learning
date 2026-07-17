(function adminWorkspaceEnhancement() {
    'use strict';

    const sectionLabels = {
        dashboard: 'Dasbor Admin',
        users: 'Pengguna & Akses',
        messages: 'Pesan Masuk',
        'training-batches': 'Batch Pelatihan',
        questions: 'Bank Pertanyaan',
        videos: 'Video Pembelajaran',
        'video-display': 'Tampilan Video',
        'pdf-management': 'Dokumen PDF',
        'learning-mapping': 'Pemetaan Pembelajaran',
        'bim-media': 'Media BIM',
        news: 'Berita & Informasi',
        plugins: 'Plugin',
        library: 'Perpustakaan',
        system: 'Konfigurasi Sistem',
        'server-control': 'Kontrol Server',
        'change-password': 'Ubah Kata Sandi'
    };

    const sectionEyebrows = {
        dashboard: 'Ringkasan sistem',
        users: 'Akun dan perizinan',
        messages: 'Komunikasi pengguna',
        'training-batches': 'Operasional pelatihan',
        questions: 'Konten pengetahuan',
        videos: 'Konten pembelajaran',
        'video-display': 'Kurasi tampilan',
        'pdf-management': 'Konten pembelajaran',
        'learning-mapping': 'Tata kelola pembelajaran',
        'bim-media': 'Kurasi media',
        news: 'Publikasi informasi',
        plugins: 'Ekstensi sistem',
        library: 'Manajemen pustaka',
        system: 'Status dan konfigurasi',
        'server-control': 'Operasional runtime',
        'change-password': 'Keamanan administrator'
    };

    function getSectionKey(section) {
        return section && section.id ? section.id.replace(/-section$/, '') : 'dashboard';
    }

    function getNavigationLabel(key) {
        const link = Array.from(document.querySelectorAll('#admin-sidebar .nav-link-modern[href^="#"]'))
            .find((item) => item.getAttribute('href') === `#${key}`);
        if (!link) return '';

        return Array.from(link.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent.trim())
            .filter(Boolean)
            .join(' ');
    }

    function syncWorkspaceContext() {
        const visibleSection = Array.from(document.querySelectorAll('.admin-section'))
            .find((section) => !section.classList.contains('d-none'));
        const key = getSectionKey(visibleSection);
        const title = document.getElementById('admin-workspace-section-title');
        const eyebrow = document.getElementById('admin-workspace-section-eyebrow');

        if (title) {
            title.textContent = sectionLabels[key] || getNavigationLabel(key) || 'Panel Admin';
        }
        if (eyebrow) {
            eyebrow.textContent = sectionEyebrows[key] || 'Administrasi sistem';
        }

        document.querySelectorAll('#admin-sidebar .nav-link-modern[href^="#"]').forEach((link) => {
            const isCurrent = link.getAttribute('href') === `#${key}`;
            link.toggleAttribute('aria-current', isCurrent);
            if (isCurrent) link.setAttribute('aria-current', 'page');
        });
    }

    function resetWorkspaceScroll() {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            });
        });
    }

    function initializeWorkspace() {
        const sections = document.querySelectorAll('.admin-section');
        if (!sections.length) return;

        const observer = new MutationObserver(syncWorkspaceContext);
        sections.forEach((section) => {
            observer.observe(section, { attributes: true, attributeFilter: ['class'] });
        });

        document.querySelectorAll('#admin-sidebar .nav-link-modern[href^="#"]').forEach((link) => {
            link.addEventListener('click', () => {
                window.requestAnimationFrame(syncWorkspaceContext);
                resetWorkspaceScroll();
            });
        });

        syncWorkspaceContext();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeWorkspace, { once: true });
    } else {
        initializeWorkspace();
    }
})();
