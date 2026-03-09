
let allMaterials = [];
let pdfCurrentCategory = 'all';
let videoCurrentCategory = 'all';
let showAllPDFMaterials = false;

document.addEventListener('DOMContentLoaded', () => {
  loadLearningMaterials();
  loadCourses();

  const pdfFilterButtons = document.querySelectorAll('.pdf-filter .filter-btn');
  pdfFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      pdfFilterButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      pdfCurrentCategory = button.dataset.pdfCategory || 'all';
      filterMaterials(pdfCurrentCategory);
    });
  });

  const videoFilterButtons = document.querySelectorAll('.video-filter .filter-btn');
  videoFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      videoFilterButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      videoCurrentCategory = button.dataset.videoCategory || 'all';
      filterCourses(videoCurrentCategory);
    });
  });

  initExpandedSections();
});

async function loadCourses() {
  // video courses are rendered by courses.js
  setTimeout(() => {
    filterCourses(videoCurrentCategory);
  }, 1200);
}

async function loadLearningMaterials() {
  const container = document.querySelector('.materials-container');
  container.innerHTML = '<div class="loading-materials" style="grid-column: 1 / -1; text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Loading learning materials...</p></div>';

  try {
    const response = await fetch('/api/pdf-display/selected');
    if (!response.ok) throw new Error('Failed to load materials');
    const data = await response.json();
    allMaterials = data.pdfs || data.selectedPDFs || [];
    renderMaterials(allMaterials, showAllPDFMaterials);
  } catch (error) {
    console.error('Error loading materials:', error);
    container.innerHTML = '<div class="alert alert-danger" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">Failed to load learning materials</div>';
  }
}

function filterMaterials(category) {
  let filteredMaterials = allMaterials;
  if (category !== 'all') {
    filteredMaterials = allMaterials.filter((material) =>
      (material.category || material.category_name || '').toLowerCase() === category.toLowerCase()
    );
  }
  renderMaterials(filteredMaterials, showAllPDFMaterials);
}

function filterCourses(category) {
  const courseCards = document.querySelectorAll('.courses .box');
  if (!courseCards || courseCards.length === 0) {
    setTimeout(() => filterCourses(category), 600);
    return;
  }

  courseCards.forEach((card) => {
    const cardCategory = card.getAttribute('data-category') || 'general';
    if (category === 'all' || cardCategory.toLowerCase() === category.toLowerCase()) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

function renderMaterials(materials, showAll = false) {
  const container = document.querySelector('.materials-container');
  const showMoreContainer = document.querySelector('.show-more-container');
  const showMoreBtn = document.querySelector('.show-more-btn');

  if (!materials || materials.length === 0) {
    container.innerHTML = '<div class="text-center py-4" style="grid-column: 1 / -1;"><i class="fas fa-book fa-3x text-muted mb-3"></i><p>No materials found for this category</p></div>';
    if (showMoreContainer) showMoreContainer.style.display = 'none';
    return;
  }

  const maxVisible = 6;
  const materialsToShow = showAll ? materials : materials.slice(0, maxVisible);
  const hasMoreMaterials = materials.length > maxVisible;

  container.innerHTML = '';

  materialsToShow.forEach((material) => {
    const card = document.createElement('div');
    card.className = 'box';
    card.setAttribute('data-material-id', material.id);

    const materialTitle = material.title || material.name || 'Untitled';
    const materialFilePath = material.filePath || material.file_path || '';
    const materialCategory = material.category || material.category_name || 'General';
    const materialLevel = material.level || material.bimLevel || 'Beginner';
    const materialDescription = material.description || material.summary || 'No description available';

    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'thumb';

    const thumbnailImg = document.createElement('img');
    thumbnailImg.alt = `${materialTitle} thumbnail`;

    function tryThumbnailPaths() {
      const specialNames = [];
      if (materialTitle === 'Quantity Take-Off') specialNames.push('Quantity Take-Off ');
      if (materialTitle === 'Pemodelan dan Produksi Data Model BIM') specialNames.push('Pemodelan dan Produksi Data BIM');
      if (materialTitle === 'Pemodelan dan Produksi Data Model BIM MEP') specialNames.push('Pemodelan dan Produksi Data BIM MEP');
      if (materialTitle === 'Penyesuaian Data Teknik') specialNames.push('Penyesuaian Data Teknik');
      if (materialTitle === 'Solusi BIM') specialNames.push('Solusi BIM');
      if (materialTitle === 'Manajemen Data Kolaboratif') specialNames.push('Manajemen Data Kolaboratif');

      const baseTitle = materialTitle.replace(/Model\s+/i, '').trim();
      let filenameVariations = [];
      if (materialFilePath) {
        const pathParts = materialFilePath.split(/[\\/]/);
        const filename = pathParts[pathParts.length - 1];
        if (filename) {
          const decoded = decodeURIComponent(filename);
          const baseFile = decoded.replace(/\.pdf$/i, '');
          filenameVariations = [baseFile, baseFile.trim(), baseFile + ' '];
        }
      }

      const variations = [
        materialTitle,
        baseTitle,
        materialTitle ? materialTitle.replace(/\s+/g, ' ') : '',
        baseTitle.replace(/\s+/g, ' '),
        materialTitle ? materialTitle.replace(/Data Model/i, 'Data') : '',
        materialTitle ? materialTitle.replace(/Model BIM/i, 'BIM') : '',
        ...filenameVariations,
        ...specialNames
      ].filter(Boolean);

      const uniqueVariations = [...new Set(variations.map((v) => v.replace(/[\\/]/g, '')))].filter(Boolean);

      const allPaths = [];
      uniqueVariations.forEach((name) => {
        const trimmed = name.trim();
        if (trimmed) {
          allPaths.push(`/thumbnails/pdf/${encodeURIComponent(trimmed)}.jpg`);
          allPaths.push(`/thumbnails/pdf/${encodeURIComponent(trimmed)}.jpeg`);
          allPaths.push(`/thumbnails/pdf/${encodeURIComponent(trimmed + ' ')}.jpg`);
        }

        if (name !== trimmed) {
          allPaths.push(`/thumbnails/pdf/${encodeURIComponent(name)}.jpg`);
          allPaths.push(`/thumbnails/pdf/${encodeURIComponent(name)}.jpeg`);
        }
      });

      let currentIndex = 0;
      const tryNextPath = () => {
        if (currentIndex < allPaths.length) {
          thumbnailImg.src = allPaths[currentIndex];
          currentIndex += 1;
        } else {
          thumbnailImg.style.display = 'none';
          const fallbackIcon = document.createElement('i');
          fallbackIcon.className = 'fas fa-file-pdf fa-4x';
          fallbackIcon.style.color = '#DC2626';
          fallbackIcon.style.position = 'absolute';
          fallbackIcon.style.top = '50%';
          fallbackIcon.style.left = '50%';
          fallbackIcon.style.transform = 'translate(-50%, -50%)';
          thumbDiv.appendChild(fallbackIcon);
        }
      };

      thumbnailImg.onerror = tryNextPath;
      tryNextPath();
    }

    tryThumbnailPaths();
    thumbDiv.appendChild(thumbnailImg);

    const categoryBadge = document.createElement('span');
    categoryBadge.className = 'category-badge';
    const badgeIcon = document.createElement('i');
    badgeIcon.className = 'fas fa-crown';
    categoryBadge.appendChild(badgeIcon);
    categoryBadge.appendChild(document.createTextNode(` ${materialCategory}`));
    thumbDiv.appendChild(categoryBadge);

    const title = document.createElement('h3');
    title.className = 'title';
    title.textContent = materialTitle;

    const stats = document.createElement('div');
    stats.className = 'course-stats';

    const pageCountDiv = document.createElement('div');
    pageCountDiv.innerHTML = '<i class="fas fa-file-alt"></i> Loading pages...';
    pageCountDiv.className = 'page-count';
    pageCountDiv.setAttribute('data-material-id', material.id);

    const levelDiv = document.createElement('div');
    levelDiv.innerHTML = `<i class="fas fa-level-up-alt"></i> ${materialLevel}`;

    stats.appendChild(pageCountDiv);
    stats.appendChild(levelDiv);

    const desc = document.createElement('p');
    desc.className = 'description';
    desc.textContent = materialDescription;

    const actions = document.createElement('div');
    actions.className = 'course-actions';

    if (materialFilePath) {
      const readBtn = document.createElement('button');
      readBtn.className = 'preview-btn pdf-btn';
      readBtn.onclick = () => openPDFReader(material.id, materialTitle);

      const readIcon = document.createElement('i');
      readIcon.className = 'fas fa-book';
      readBtn.appendChild(readIcon);
      readBtn.appendChild(document.createTextNode(' Read PDF'));
      actions.appendChild(readBtn);
    } else {
      const noFileSpan = document.createElement('span');
      noFileSpan.className = 'text-muted';
      noFileSpan.textContent = 'File not available';
      actions.appendChild(noFileSpan);
    }

    card.appendChild(thumbDiv);
    card.appendChild(title);
    card.appendChild(stats);
    card.appendChild(desc);
    card.appendChild(actions);
    container.appendChild(card);
  });

  if (showMoreContainer && showMoreBtn) {
    if (hasMoreMaterials) {
      showMoreContainer.style.display = 'block';
      if (showAll) {
        showMoreBtn.innerHTML = '<i class="fas fa-chevron-up"></i><span>Show Less PDF Courses</span>';
      } else {
        showMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>Show More PDF Courses</span>';
      }
    } else {
      showMoreContainer.style.display = 'none';
    }
  }

  loadPageCounts(materials);
}

function togglePDFMaterials() {
  showAllPDFMaterials = !showAllPDFMaterials;

  let filteredMaterials = allMaterials;
  if (pdfCurrentCategory !== 'all') {
    filteredMaterials = allMaterials.filter((material) =>
      (material.category || material.category_name || '').toLowerCase() === pdfCurrentCategory.toLowerCase()
    );
  }

  renderMaterials(filteredMaterials, showAllPDFMaterials);
}

async function loadPageCounts(materials) {
  for (const material of materials) {
    try {
      const response = await fetch(`/api/learning-materials/toc/${material.id}`);
      if (response.ok) {
        const data = await response.json();
        const pageCountSpan = document.querySelector(`.page-count[data-material-id="${material.id}"]`);
        if (pageCountSpan && data.toc && data.toc.totalPages) {
          pageCountSpan.innerHTML = `<i class="fas fa-file-alt"></i> ${data.toc.totalPages} Pages`;
        }
      }
    } catch (error) {
      const pageCountSpan = document.querySelector(`.page-count[data-material-id="${material.id}"]`);
      if (pageCountSpan) {
        pageCountSpan.innerHTML = '<i class="fas fa-file-alt"></i> Unknown';
      }
    }
  }
}

const style = document.createElement('style');
style.textContent = `
.page-count {
  color: #28a745;
  font-weight: 500;
}
.filter-btn {
  background: var(--light-bg);
  color: var(--black);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin: 2px;
}
.filter-btn:hover,
.filter-btn.active {
  background: var(--main-color);
  color: white;
}
.loading-materials {
  grid-column: 1 / -1;
  text-align: center;
  padding: 2rem;
  color: #666;
}
.materials-container .box .thumb img {
  width: 100%;
  height: 200px;
  object-fit: contain;
  border-radius: 5px;
  background: #f8f9fa;
}
.materials-container .box .thumb {
  height: 200px;
  overflow: hidden;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}
.materials-container .box {
  height: auto;
  min-height: 400px;
  display: flex;
  flex-direction: column;
}
.materials-container .box .thumb .fas.fa-file-pdf {
  font-size: 4rem;
  color: #DC2626;
}
.pdf-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.95);
  z-index: 9999;
  display: none;
  backdrop-filter: blur(5px);
}
.pdf-modal-overlay.active {
  display: flex;
  align-items: center;
  justify-content: center;
}
.pdf-modal-content {
  width: 95vw;
  height: 95vh;
  background: white;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}
.pdf-modal-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
}
.pdf-modal-close {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  border: 2px solid #333;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 10001;
}
.pdf-modal-close:hover {
  background: #333;
  color: white;
  transform: scale(1.1);
}
body.modal-active {
  overflow: hidden;
}
`;

document.head.appendChild(style);

function openPDFReader(materialId) {
  const modal = document.getElementById('pdf-modal');
  const iframe = document.getElementById('pdf-modal-iframe');
  if (!modal || !iframe) return;
  iframe.src = `${window.location.origin}/public/reader.html?material=${encodeURIComponent(materialId)}`;
  modal.classList.add('active');
  document.body.classList.add('modal-active');
}

function closePDFModal() {
  const modal = document.getElementById('pdf-modal');
  const iframe = document.getElementById('pdf-modal-iframe');
  if (!modal || !iframe) return;
  modal.classList.remove('active');
  document.body.classList.remove('modal-active');
  setTimeout(() => {
    iframe.src = '';
  }, 300);
}

const pdfModal = document.getElementById('pdf-modal');
if (pdfModal) {
  pdfModal.addEventListener('click', (e) => {
    if (e.target === pdfModal) closePDFModal();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('pdf-modal');
    if (modal && modal.classList.contains('active')) {
      closePDFModal();
    }
  }
});

function initExpandedSections() {
  const expandedSections = document.querySelectorAll('.collapsible-section.expanded');
  expandedSections.forEach((section) => {
    const content = section.querySelector('.collapsible-content');
    if (content) {
      content.classList.add('expanded');
      content.style.display = 'block';
      content.style.padding = '2rem';
    }
  });
}

function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const content = section.querySelector('.collapsible-content');
  if (!content) return;

  if (section.classList.contains('expanded')) {
    section.classList.remove('expanded');
    section.classList.add('collapsed');
    content.classList.remove('expanded');
    content.style.display = 'none';
  } else {
    section.classList.remove('collapsed');
    section.classList.add('expanded');
    content.classList.add('expanded');
    content.style.display = 'block';
    content.style.padding = '2rem';
  }
}
