const PDF_ROLE_FILTERS = [
    {
        id: 'all',
        label: 'All PDF',
        icon: 'fas fa-th-large',
        eyebrow: 'Library View',
        description: 'Browse every published PDF chapter across all role tracks.',
        accent: 'linear-gradient(135deg, #0f172a, #1e3a8a)'
    },
    {
        id: 'bim-modeller',
        label: 'BIM Modeller',
        icon: 'fas fa-cube',
        eyebrow: 'Foundation Track',
        description: 'Model production, quantity takeoff, collaboration, and core BIM execution.',
        accent: 'linear-gradient(135deg, #0f766e, #14b8a6)'
    },
    {
        id: 'bim-coordinator',
        label: 'BIM Coordinator',
        icon: 'fas fa-project-diagram',
        eyebrow: 'Coordination Track',
        description: 'Issue resolution, coordination flow, model federation, and cross-discipline review.',
        accent: 'linear-gradient(135deg, #7c2d12, #f97316)'
    },
    {
        id: 'bim-manager',
        label: 'BIM Manager',
        icon: 'fas fa-sitemap',
        eyebrow: 'Management Track',
        description: 'Governance, standards, strategy, and BIM delivery oversight.',
        accent: 'linear-gradient(135deg, #581c87, #a855f7)'
    }
];

const PDF_ROLE_LOOKUP = new Map(PDF_ROLE_FILTERS.map((item) => [item.id, item]));
const PDF_ROLE_QUERY_KEY = 'pdfRole';
let pdfRoleCardsBuilt = false;
let learningSectionsGuideBuilt = false;
const LEARNING_SECTION_CARDS = [
    {
        id: 'pdf-section',
        label: 'PDF Learning Courses',
        icon: 'fas fa-file-pdf',
        summary: 'Materi bacaan per bab untuk belajar bertahap sesuai jalur peran.',
        accent: 'linear-gradient(135deg, #b91c1c, #ef4444)'
    },
    {
        id: 'video-section',
        label: 'Video Learning Courses',
        icon: 'fas fa-play-circle',
        summary: 'Tutorial visual software dan praktik kerja BIM yang bisa dipelajari lebih cepat.',
        accent: 'linear-gradient(135deg, #0f766e, #14b8a6)'
    }
];

function humanizePdfCategory(value) {
    return String(value || '')
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function getPdfCategoryLabel(material) {
    return (
        material?.categoryLabel ||
        material?.roleTrackLabel ||
        humanizePdfCategory(material?.category || material?.category_name || 'general')
    );
}

function getPdfThumbnailUrl(material) {
    if (!material?.id) return '';
    return `/api/learning-materials/thumbnail/${encodeURIComponent(material.id)}`;
}

function getPdfCardMetaLabel(material) {
    return material?.moduleTopicLabel || material?.description || getPdfCategoryLabel(material);
}

function getPdfMaterialsCache() {
    if (Array.isArray(window.allMaterials)) return window.allMaterials;
    if (typeof allMaterials !== 'undefined' && Array.isArray(allMaterials)) return allMaterials;
    return [];
}

function getSectionElement(sectionId) {
    return document.getElementById(sectionId);
}

function isSectionHidden(sectionId) {
    const section = getSectionElement(sectionId);
    return !section || section.style.display === 'none';
}

function isSectionExpanded(sectionId) {
    const section = getSectionElement(sectionId);
    return !!section && section.classList.contains('expanded');
}

function setSectionExpanded(sectionId, expanded) {
    const section = getSectionElement(sectionId);
    if (!section) return;

    const content = section.querySelector('.collapsible-content');
    if (!content) return;

    section.style.display = '';

    if (expanded) {
        section.classList.remove('collapsed');
        section.classList.add('expanded');
        content.classList.add('expanded');
        content.style.display = 'block';
        content.style.padding = '2rem';
        return;
    }

    section.classList.remove('expanded');
    section.classList.add('collapsed');
    content.classList.remove('expanded');
    content.style.display = 'none';
}

function collapseOtherLearningSections(activeSectionId) {
    LEARNING_SECTION_CARDS.forEach((sectionMeta) => {
        if (sectionMeta.id !== activeSectionId) {
            setSectionExpanded(sectionMeta.id, false);
        }
    });
}

function getLearningSectionCount(sectionId) {
    if (sectionId === 'pdf-section') {
        return getPdfMaterialsCache().length;
    }

    if (sectionId === 'video-section') {
        return Array.isArray(window.bclCourseCatalog) ? window.bclCourseCatalog.length : 0;
    }

    return 0;
}

function focusLearningSection(sectionId) {
    const section = getSectionElement(sectionId);
    if (!section) return;

    section.style.display = '';
    setSectionExpanded(sectionId, true);
    collapseOtherLearningSections(sectionId);
    syncLearningSectionsGuide();
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getPdfRoleQueryValue() {
    try {
        const url = new URL(window.location.href);
        const queryValue = (url.searchParams.get(PDF_ROLE_QUERY_KEY) || '').trim().toLowerCase();
        return PDF_ROLE_LOOKUP.has(queryValue) ? queryValue : 'all';
    } catch (error) {
        return 'all';
    }
}

function updatePdfRoleQuery(category) {
    try {
        const url = new URL(window.location.href);
        if (!category || category === 'all') {
            url.searchParams.delete(PDF_ROLE_QUERY_KEY);
        } else {
            url.searchParams.set(PDF_ROLE_QUERY_KEY, category);
        }
        window.history.replaceState({}, '', url.toString());
    } catch (error) {
        // ignore URL update errors
    }
}

function getRoleCounts(materials) {
    const counts = {
        all: Array.isArray(materials) ? materials.length : 0,
        'bim-modeller': 0,
        'bim-coordinator': 0,
        'bim-manager': 0
    };

    (Array.isArray(materials) ? materials : []).forEach((material) => {
        const category = String(material?.category || material?.category_name || '').toLowerCase();
        if (Object.prototype.hasOwnProperty.call(counts, category)) {
            counts[category] += 1;
        }
    });

    return counts;
}

function patchRenderedPdfCards(materials) {
    const materialMap = new Map(
        (Array.isArray(materials) ? materials : []).map((material) => [
            String(material?.id || ''),
            material
        ])
    );

    document.querySelectorAll('.materials-container .box[data-material-id]').forEach((card) => {
        const material = materialMap.get(card.getAttribute('data-material-id'));
        if (!material) return;

        const badge = card.querySelector('.category-badge');
        if (badge) {
            badge.textContent = getPdfCategoryLabel(material);
        }
    });
}

function renderPdfMaterialsCards(materials, showAll = false) {
    const container = document.querySelector('.materials-container');
    const showMoreContainer = document.querySelector('.show-more-container');
    const showMoreBtn = document.querySelector('.show-more-btn');

    if (!container) return;

    if (!materials || materials.length === 0) {
        container.innerHTML = '<div class="text-center py-4" style="grid-column: 1 / -1;"><i class="fas fa-book fa-3x text-muted mb-3"></i><p>No materials found for this category</p></div>';
        if (showMoreContainer) showMoreContainer.style.display = 'none';
        return;
    }

    const maxVisible = 12;
    const materialsToShow = showAll ? materials : materials.slice(0, maxVisible);
    const hasMoreMaterials = materials.length > maxVisible;

    container.innerHTML = '';

    materialsToShow.forEach((material) => {
        const card = document.createElement('article');
        card.className = 'box pdf-material-card';
        card.setAttribute('data-material-id', material.id);
        card.setAttribute('tabindex', material.filePath || material.file_path ? '0' : '-1');

        const materialTitle = material.title || material.name || 'Untitled';
        const materialFilePath = material.filePath || material.file_path || '';
        const materialLevel = material.level || material.bimLevel || 'Beginner';
        const materialDescription = material.description || material.summary || 'No description available';
        const materialMeta = getPdfCardMetaLabel(material);

        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'thumb';

        const thumbnailImg = document.createElement('img');
        thumbnailImg.alt = `${materialTitle} thumbnail`;
        thumbnailImg.loading = 'lazy';
        thumbnailImg.src = getPdfThumbnailUrl(material);
        thumbnailImg.onerror = () => {
            thumbnailImg.style.display = 'none';
            if (!thumbDiv.querySelector('.pdf-thumb-fallback')) {
                const fallback = document.createElement('div');
                fallback.className = 'pdf-thumb-fallback';
                fallback.innerHTML = `<i class="fas fa-file-pdf"></i><span>${materialTitle}</span>`;
                thumbDiv.appendChild(fallback);
            }
        };

        thumbDiv.appendChild(thumbnailImg);

        const categoryBadge = document.createElement('span');
        categoryBadge.className = 'category-badge';
        categoryBadge.textContent = getPdfCategoryLabel(material);
        thumbDiv.appendChild(categoryBadge);

        if (materialFilePath) {
            const openHint = document.createElement('span');
            openHint.className = 'pdf-open-hint';
            openHint.innerHTML = '<i class="fas fa-arrow-up-right-from-square"></i>';
            thumbDiv.appendChild(openHint);
        }

        const title = document.createElement('h3');
        title.className = 'title';
        title.textContent = materialTitle;

        const meta = document.createElement('p');
        meta.className = 'pdf-card-meta';
        meta.textContent = materialMeta;

        const stats = document.createElement('div');
        stats.className = 'course-stats';

        const pageCountDiv = document.createElement('div');
        pageCountDiv.innerHTML = '<i class="fas fa-file-alt"></i> Loading pages...';
        pageCountDiv.className = 'page-count';
        pageCountDiv.setAttribute('data-material-id', material.id);

        const readCountDiv = document.createElement('div');
        readCountDiv.className = 'read-count';
        readCountDiv.setAttribute('data-material-id', material.id);
        readCountDiv.innerHTML = `<i class="fas fa-book-reader"></i> ${Number(material.readCount || 0)} Reads`;

        const levelDiv = document.createElement('div');
        levelDiv.className = 'pdf-level-chip';
        levelDiv.innerHTML = `<i class="fas fa-signal"></i> ${materialLevel}`;

        stats.appendChild(pageCountDiv);
        stats.appendChild(readCountDiv);
        stats.appendChild(levelDiv);

        const desc = document.createElement('p');
        desc.className = 'description';
        desc.textContent = materialDescription;

        card.appendChild(thumbDiv);
        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(stats);
        card.appendChild(desc);

        if (materialFilePath) {
            const openMaterial = () => openPDFReader(material.id, materialTitle);
            card.addEventListener('click', openMaterial);
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openMaterial();
                }
            });
        } else {
            card.classList.add('is-disabled');
        }

        container.appendChild(card);
    });

    if (showMoreContainer && showMoreBtn) {
        if (hasMoreMaterials) {
            showMoreContainer.style.display = 'block';
            showMoreBtn.innerHTML = showAll
                ? '<i class="fas fa-chevron-up"></i><span>Show Less PDF Courses</span>'
                : '<i class="fas fa-chevron-down"></i><span>Show More PDF Courses</span>';
        } else {
            showMoreContainer.style.display = 'none';
        }
    }

    if (typeof loadPageCounts === 'function') {
        loadPageCounts(materials);
    }
}

function syncPdfFilterButtons() {
    document.querySelectorAll('.pdf-filter .filter-btn').forEach((button) => {
        const isActive = button.dataset.pdfCategory === (pdfCurrentCategory || 'all');
        button.classList.toggle('active', isActive);
    });
}

function renderPdfRoleCards() {
    const host = document.querySelector('.pdf-role-entry');
    if (!host) return;

    const counts = getRoleCounts(getPdfMaterialsCache());
    host.innerHTML = `
        <div class="pdf-role-entry__intro">
            <span class="pdf-role-entry__eyebrow">Learning Paths</span>
            <p>Pilih jalur pembelajaran sesuai peran Anda, lalu mulai pelajari modul yang tersedia.</p>
        </div>
        <div class="pdf-role-entry__grid">
            ${PDF_ROLE_FILTERS.filter((item) => item.id !== 'all').map((role) => {
                const count = counts[role.id] || 0;
                const isActive = role.id === (pdfCurrentCategory || 'all');
                const statusLabel = count > 0 ? 'Available' : 'Coming Soon';
                const ctaLabel = count > 0 ? 'Open Track' : 'View Roadmap';

                return `
                    <button class="pdf-role-card ${isActive ? 'is-active' : ''}" data-role-card="${role.id}" style="--role-accent:${role.accent};" type="button">
                        <div class="pdf-role-card__topline">
                            <span>${role.eyebrow}</span>
                            <span class="pdf-role-card__status ${count > 0 ? 'is-live' : 'is-empty'}">${statusLabel}</span>
                        </div>
                        <div class="pdf-role-card__title">
                            <i class="${role.icon}"></i>
                            <strong>${role.label}</strong>
                        </div>
                        <p class="pdf-role-card__description">${role.description}</p>
                        <div class="pdf-role-card__meta">
                            <span>${count} chapter${count === 1 ? '' : 's'}</span>
                            <span>${ctaLabel}</span>
                        </div>
                    </button>
                `;
            }).join('')}
        </div>
    `;

    host.querySelectorAll('[data-role-card]').forEach((button) => {
        button.addEventListener('click', () => {
            const category = button.getAttribute('data-role-card') || 'all';
            pdfCurrentCategory = category;
            showAllPDFMaterials = false;
            filterMaterials(category);
            const section = document.getElementById('pdf-section');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

function renderLearningSectionsGuide() {
    const host = document.querySelector('.learning-sections-guide');
    if (!host) return;

    host.innerHTML = `
        <div class="learning-sections-guide__intro">
            <span class="learning-sections-guide__eyebrow">Course Navigator</span>
            <h2>Pilih format pembelajaran yang ingin Anda buka.</h2>
        </div>
        <div class="learning-sections-guide__grid">
            ${LEARNING_SECTION_CARDS.map((sectionMeta) => {
                const count = getLearningSectionCount(sectionMeta.id);
                const expanded = isSectionExpanded(sectionMeta.id);
                const hidden = isSectionHidden(sectionMeta.id);
                const statusLabel = hidden
                    ? 'Tersembunyi'
                    : (expanded ? 'Sedang Dibuka' : 'Terlipat');
                const actionLabel = expanded ? 'Lihat Bagian' : 'Buka Bagian';

                return `
                    <button
                        class="learning-sections-guide__card ${expanded ? 'is-active' : ''} ${hidden ? 'is-hidden' : ''}"
                        type="button"
                        data-learning-section="${sectionMeta.id}"
                        style="--section-accent:${sectionMeta.accent};"
                    >
                        <div class="learning-sections-guide__card-topline">
                            <span>${statusLabel}</span>
                            <span>${count} item</span>
                        </div>
                        <div class="learning-sections-guide__card-title">
                            <i class="${sectionMeta.icon}"></i>
                            <strong>${sectionMeta.label}</strong>
                        </div>
                        <p>${sectionMeta.summary}</p>
                        <div class="learning-sections-guide__card-footer">
                            <span>${sectionMeta.id === 'pdf-section' ? 'Modul dan chapter' : 'Kategori video'}</span>
                            <span>${actionLabel}</span>
                        </div>
                    </button>
                `;
            }).join('')}
        </div>
    `;

    host.querySelectorAll('[data-learning-section]').forEach((button) => {
        button.addEventListener('click', () => {
            const sectionId = button.getAttribute('data-learning-section');
            if (!sectionId) return;
            focusLearningSection(sectionId);
        });
    });
}

function ensureLearningSectionsGuide() {
    if (learningSectionsGuideBuilt) return;

    const anchor = document.querySelector('.pdf-role-entry') || document.getElementById('pdf-section');
    if (!anchor || !anchor.parentNode) return;

    const guide = document.createElement('section');
    guide.className = 'learning-sections-guide';
    anchor.parentNode.insertBefore(guide, anchor);
    learningSectionsGuideBuilt = true;
}

function syncLearningSectionsGuide() {
    ensureLearningSectionsGuide();
    renderLearningSectionsGuide();
}

function ensurePdfRoleEntry() {
    if (pdfRoleCardsBuilt) return;

    const pdfSection = document.getElementById('pdf-section');
    if (!pdfSection || !pdfSection.parentNode) return;

    const entry = document.createElement('section');
    entry.className = 'pdf-role-entry';
    pdfSection.parentNode.insertBefore(entry, pdfSection);
    pdfRoleCardsBuilt = true;
}

function applyDefaultLearningSectionLayout() {
    const pdfSection = getSectionElement('pdf-section');
    const videoSection = getSectionElement('video-section');
    if (!pdfSection || !videoSection) return;

    const pdfExpanded = pdfSection.classList.contains('expanded');
    const videoExpanded = videoSection.classList.contains('expanded');

    if (pdfExpanded && videoExpanded) {
        setSectionExpanded('pdf-section', true);
        setSectionExpanded('video-section', false);
        return;
    }

    if (!pdfExpanded && !videoExpanded) {
        setSectionExpanded('pdf-section', true);
    }
}

function buildPdfRoleFilterButtons() {
    const container = document.querySelector('.pdf-filter');
    if (!container) return;

    container.innerHTML = PDF_ROLE_FILTERS.map((filter) => `
        <button class="filter-btn ${filter.id === (pdfCurrentCategory || 'all') ? 'active' : ''}" data-pdf-category="${filter.id}">
            <i class="${filter.icon}"></i> ${filter.label}
        </button>
    `).join('');

    const buttons = container.querySelectorAll('.filter-btn');
    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            buttons.forEach((item) => item.classList.remove('active'));
            button.classList.add('active');
            pdfCurrentCategory = button.dataset.pdfCategory || 'all';
            showAllPDFMaterials = false;
            filterMaterials(pdfCurrentCategory);
        });
    });
}

function renderPdfRoleEmptyState(category) {
    const container = document.querySelector('.materials-container');
    const roleMeta = PDF_ROLE_LOOKUP.get(category);
    if (!container || !roleMeta || category === 'all') return;

    container.innerHTML = `
        <div class="pdf-role-empty">
            <span class="pdf-role-empty__eyebrow">${roleMeta.eyebrow}</span>
            <h3>${roleMeta.label} materials are being prepared.</h3>
            <p>This track is already reserved in the LMS structure so your team can fill it gradually without changing the navigation again.</p>
        </div>
    `;
}

function syncPdfRoleUi() {
    ensurePdfRoleEntry();
    renderPdfRoleCards();
    syncPdfFilterButtons();
}

function installPdfRoleStyles() {
    if (document.getElementById('pdf-role-entry-styles')) return;

    const style = document.createElement('style');
    style.id = 'pdf-role-entry-styles';
    style.textContent = `
        .learning-sections-guide {
            margin-bottom: 2.4rem;
            padding: 2.4rem;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 24px;
            background:
                radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 26%),
                linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
        }
        .learning-sections-guide__intro {
            max-width: 74rem;
            margin-bottom: 2rem;
        }
        .learning-sections-guide__eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 0.6rem;
            padding: 0.45rem 0.9rem;
            border-radius: 999px;
            background: rgba(15, 23, 42, 0.06);
            color: #0f172a;
            font-size: 1.2rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .learning-sections-guide h2 {
            margin: 1rem 0 0.8rem;
            font-size: clamp(2.3rem, 3vw, 3.4rem);
            line-height: 1.15;
            color: #0f172a;
        }
        .learning-sections-guide p {
            margin: 0;
            color: #475569;
            font-size: 1.45rem;
            line-height: 1.7;
        }
        .learning-sections-guide__grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1.4rem;
        }
        .learning-sections-guide__card {
            position: relative;
            overflow: hidden;
            padding: 1.8rem;
            border: 1px solid rgba(148, 163, 184, 0.24);
            border-radius: 20px;
            background:
                linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.98)),
                var(--section-accent);
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
            text-align: left;
            transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .learning-sections-guide__card:hover {
            transform: translateY(-4px);
            border-color: rgba(15, 23, 42, 0.14);
            box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
        }
        .learning-sections-guide__card.is-active {
            border-color: rgba(15, 23, 42, 0.16);
            box-shadow: 0 18px 36px rgba(15, 23, 42, 0.14);
        }
        .learning-sections-guide__card.is-hidden {
            opacity: 0.72;
        }
        .learning-sections-guide__card-topline,
        .learning-sections-guide__card-footer {
            display: flex;
            justify-content: space-between;
            gap: 1rem;
            font-size: 1.15rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: #64748b;
        }
        .learning-sections-guide__card-title {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin: 1.2rem 0 0.9rem;
            color: #0f172a;
        }
        .learning-sections-guide__card-title i {
            font-size: 1.9rem;
        }
        .learning-sections-guide__card-title strong {
            font-size: 1.95rem;
            line-height: 1.2;
        }
        .learning-sections-guide__card p {
            margin-bottom: 1.4rem;
            font-size: 1.35rem;
            line-height: 1.65;
        }
        .pdf-role-entry {
            margin-bottom: 2.4rem;
            padding: 2.4rem;
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 24px;
            background:
                radial-gradient(circle at top right, rgba(14, 165, 233, 0.10), transparent 28%),
                linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
        }
        .pdf-role-entry__intro {
            max-width: 68rem;
            margin-bottom: 2rem;
        }
        .pdf-role-entry__eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 0.6rem;
            padding: 0.45rem 0.9rem;
            border-radius: 999px;
            background: rgba(15, 23, 42, 0.06);
            color: #0f172a;
            font-size: 1.2rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .pdf-role-entry h2 {
            margin: 1rem 0 0.8rem;
            font-size: clamp(2.4rem, 3.2vw, 3.8rem);
            line-height: 1.08;
            color: #0f172a;
        }
        .pdf-role-entry p {
            margin: 0;
            max-width: 60rem;
            font-size: 1.5rem;
            line-height: 1.7;
            color: #475569;
        }
        .pdf-role-entry__grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 1.4rem;
        }
        .pdf-role-card {
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            gap: 1.1rem;
            min-height: 220px;
            padding: 1.8rem;
            border: 1px solid rgba(15, 23, 42, 0.1);
            border-radius: 22px;
            background: #ffffff;
            text-align: left;
            transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .pdf-role-card::before {
            content: '';
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            height: 4px;
            background: var(--role-accent);
        }
        .pdf-role-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 16px 35px rgba(15, 23, 42, 0.12);
            border-color: rgba(15, 23, 42, 0.18);
        }
        .pdf-role-card.is-active {
            border-color: rgba(15, 23, 42, 0.28);
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
            background: linear-gradient(180deg, rgba(248, 250, 252, 0.94), #ffffff);
        }
        .pdf-role-card__topline,
        .pdf-role-card__meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            font-size: 1.2rem;
            color: #64748b;
        }
        .pdf-role-card__status {
            padding: 0.35rem 0.75rem;
            border-radius: 999px;
            font-weight: 700;
            letter-spacing: 0.03em;
        }
        .pdf-role-card__status.is-live {
            background: rgba(22, 163, 74, 0.12);
            color: #166534;
        }
        .pdf-role-card__status.is-empty {
            background: rgba(148, 163, 184, 0.16);
            color: #475569;
        }
        .pdf-role-card__title {
            display: flex;
            align-items: center;
            gap: 1rem;
            color: #0f172a;
        }
        .pdf-role-card__title i {
            font-size: 2rem;
        }
        .pdf-role-card__title strong {
            font-size: 2rem;
            line-height: 1.15;
        }
        .pdf-role-card__description {
            flex: 1;
            margin: 0;
            color: #475569;
            font-size: 1.4rem;
            line-height: 1.65;
        }
        .pdf-role-card__meta {
            font-weight: 600;
            color: #0f172a;
        }
        .pdf-role-empty {
            grid-column: 1 / -1;
            padding: 3.6rem 2rem;
            border: 1px dashed rgba(100, 116, 139, 0.35);
            border-radius: 18px;
            background: linear-gradient(180deg, rgba(248, 250, 252, 0.9), #ffffff);
            text-align: center;
        }
        .pdf-role-empty__eyebrow {
            display: inline-block;
            margin-bottom: 1rem;
            font-size: 1.15rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #64748b;
        }
        .pdf-role-empty h3 {
            margin: 0 0 0.8rem;
            font-size: 2.2rem;
            color: #0f172a;
        }
        .pdf-role-empty p {
            max-width: 56rem;
            margin: 0 auto;
            font-size: 1.45rem;
            line-height: 1.7;
            color: #475569;
        }
        .materials-container .pdf-material-card {
            position: relative;
            display: flex;
            flex-direction: column;
            min-height: 420px;
            padding: 0;
            overflow: hidden;
            border: 1px solid rgba(148, 163, 184, 0.25);
            border-radius: 22px;
            background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
            box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
            cursor: pointer;
        }
        .materials-container .pdf-material-card:hover {
            transform: translateY(-6px);
            border-color: rgba(14, 116, 144, 0.22);
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
        }
        .materials-container .pdf-material-card.is-disabled {
            cursor: default;
            opacity: 0.8;
        }
        .materials-container .pdf-material-card .thumb {
            position: relative;
            height: 250px;
            padding: 1.2rem;
            overflow: hidden;
            border-radius: 22px 22px 0 0;
            background:
                linear-gradient(180deg, rgba(15, 23, 42, 0.05), rgba(15, 23, 42, 0.02)),
                #eef2f7;
        }
        .materials-container .pdf-material-card .thumb img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: top center;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
        }
        .materials-container .pdf-material-card .category-badge {
            position: absolute;
            top: 1.8rem;
            left: 1.8rem;
            right: auto;
            display: inline-flex;
            align-items: flex-start;
            max-width: min(calc(100% - 6.8rem), 22rem);
            padding: 0.75rem 1rem 0.7rem;
            border: 1px solid rgba(255, 255, 255, 0.28);
            border-radius: 12px;
            background: rgba(15, 23, 42, 0.78);
            color: #f8fafc;
            font-size: 1.08rem;
            font-weight: 700;
            line-height: 1.35;
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
        }
        .pdf-open-hint {
            position: absolute;
            top: 1.8rem;
            right: 1.8rem;
            width: 3.2rem;
            height: 3.2rem;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.92);
            color: #0f172a;
            box-shadow: 0 10px 22px rgba(15, 23, 42, 0.16);
        }
        .pdf-thumb-fallback {
            width: 100%;
            height: 100%;
            border-radius: 14px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            background: linear-gradient(180deg, #e2e8f0, #cbd5e1);
            color: #0f172a;
            text-align: center;
            padding: 1.6rem;
        }
        .pdf-thumb-fallback i {
            font-size: 4rem;
            color: #dc2626;
        }
        .pdf-thumb-fallback span {
            font-size: 1.25rem;
            font-weight: 700;
            line-height: 1.4;
        }
        .materials-container .pdf-material-card .title,
        .materials-container .pdf-material-card .pdf-card-meta,
        .materials-container .pdf-material-card .course-stats,
        .materials-container .pdf-material-card .description {
            padding-left: 1.8rem;
            padding-right: 1.8rem;
        }
        .materials-container .pdf-material-card .title {
            margin: 1.5rem 0 0.6rem;
            color: #0f172a;
            font-size: 1.9rem;
            line-height: 1.28;
        }
        .pdf-card-meta {
            margin: 0 0 1rem;
            color: #0f766e;
            font-size: 1.25rem;
            font-weight: 700;
            letter-spacing: 0.01em;
        }
        .materials-container .pdf-material-card .course-stats {
            gap: 0.8rem;
            flex-wrap: wrap;
            align-items: center;
            margin: 0 0 1rem;
            font-size: 1.22rem;
        }
        .pdf-level-chip {
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
            padding: 0.45rem 0.8rem;
            border-radius: 999px;
            background: rgba(14, 116, 144, 0.1);
            color: #0f766e;
            font-weight: 700;
        }
        .materials-container .pdf-material-card .description {
            margin: 0 0 1.8rem;
            color: #475569;
            font-size: 1.35rem;
            line-height: 1.65;
        }
        @media (max-width: 991px) {
            .learning-sections-guide {
                padding: 2rem 1.6rem;
            }
            .learning-sections-guide__grid {
                grid-template-columns: 1fr;
            }
            .pdf-role-entry {
                padding: 2rem 1.6rem;
            }
            .pdf-role-entry__grid {
                grid-template-columns: 1fr;
            }
            .materials-container .pdf-material-card .thumb {
                height: 220px;
            }
        }
    `;

    document.head.appendChild(style);
}

function installPdfRoleOverrides() {
    const initialRole = getPdfRoleQueryValue();
    if (typeof pdfCurrentCategory !== 'undefined') {
        pdfCurrentCategory = initialRole;
    }

    if (typeof loadLearningMaterials === 'function' && !loadLearningMaterials.__pdfRoleWrapped) {
        const originalLoadLearningMaterials = loadLearningMaterials;
        loadLearningMaterials = async function wrappedLoadLearningMaterials(...args) {
            const result = await originalLoadLearningMaterials.apply(this, args);
            syncPdfRoleUi();
            syncLearningSectionsGuide();

            if ((pdfCurrentCategory || 'all') !== 'all') {
                showAllPDFMaterials = false;
                filterMaterials(pdfCurrentCategory);
            } else {
                patchRenderedPdfCards(getPdfMaterialsCache());
            }

            return result;
        };
        loadLearningMaterials.__pdfRoleWrapped = true;
    }

    if (typeof filterMaterials === 'function' && !filterMaterials.__pdfRoleWrapped) {
        const originalFilterMaterials = filterMaterials;
        filterMaterials = function wrappedFilterMaterials(category) {
            const normalizedCategory = PDF_ROLE_LOOKUP.has(category) ? category : 'all';
            pdfCurrentCategory = normalizedCategory;
            updatePdfRoleQuery(normalizedCategory);
            const result = originalFilterMaterials(normalizedCategory);
            syncPdfRoleUi();
            syncLearningSectionsGuide();
            patchRenderedPdfCards(getPdfMaterialsCache());

            if (normalizedCategory !== 'all') {
                const hasVisibleCards = document.querySelectorAll('.materials-container .box').length > 0;
                if (!hasVisibleCards) {
                    renderPdfRoleEmptyState(normalizedCategory);
                }
            }

            return result;
        };
        filterMaterials.__pdfRoleWrapped = true;
    }

    if (typeof renderMaterials === 'function' && !renderMaterials.__pdfRoleWrapped) {
        renderMaterials = function wrappedRenderMaterials(materials, showAll) {
            renderPdfMaterialsCards(materials, showAll);
            patchRenderedPdfCards(materials);
        };
        renderMaterials.__pdfRoleWrapped = true;
    }

    installPdfRoleStyles();
    ensurePdfRoleEntry();
    ensureLearningSectionsGuide();
    applyDefaultLearningSectionLayout();
    buildPdfRoleFilterButtons();
    syncPdfRoleUi();
    syncLearningSectionsGuide();

    document.addEventListener('bcl:courses-loaded', () => {
        syncLearningSectionsGuide();
    });

    if (typeof window.toggleSection === 'function' && !window.toggleSection.__learningGuideWrapped) {
        const originalToggleSection = window.toggleSection;
        window.toggleSection = function wrappedToggleSection(sectionId) {
            const wasExpanded = isSectionExpanded(sectionId);
            const result = originalToggleSection.apply(this, arguments);

            if (!wasExpanded && isSectionExpanded(sectionId)) {
                collapseOtherLearningSections(sectionId);
            }

            syncLearningSectionsGuide();
            return result;
        };
        window.toggleSection.__learningGuideWrapped = true;
    }

    if (typeof window.startLearning === 'function' && !window.startLearning.__learningGuideWrapped) {
        const originalStartLearning = window.startLearning;
        window.startLearning = function wrappedStartLearning(...args) {
            const result = originalStartLearning.apply(this, args);
            setSectionExpanded('video-section', true);
            syncLearningSectionsGuide();
            return result;
        };
        window.startLearning.__learningGuideWrapped = true;
    }

    if (typeof window.backToCourses === 'function' && !window.backToCourses.__learningGuideWrapped) {
        const originalBackToCourses = window.backToCourses;
        window.backToCourses = function wrappedBackToCourses(...args) {
            const result = originalBackToCourses.apply(this, args);
            const pdfSection = getSectionElement('pdf-section');
            if (pdfSection) {
                pdfSection.style.display = '';
            }
            applyDefaultLearningSectionLayout();
            syncLearningSectionsGuide();
            return result;
        };
        window.backToCourses.__learningGuideWrapped = true;
    }
}

installPdfRoleOverrides();
