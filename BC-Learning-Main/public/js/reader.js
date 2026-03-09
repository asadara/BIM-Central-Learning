// PDF Learning Reader Implementation
console.log("pdfjs loaded", typeof pdfjsLib);

// Dynamic configuration - will be set when reader loads
let courseReaderConfig = {
    courseId: null,
    title: "Loading...",
    pdfUrl: null,
    chapters: []
};

// Get material ID from URL parameter or default
const urlParams = new URLSearchParams(window.location.search);
const explicitMaterialId = urlParams.get('material');
const materialId = explicitMaterialId || 'bim-modul-01';
const materialFileParam = urlParams.get('file') || urlParams.get('path');
const returnParam = urlParams.get('return');
const useFileOnly = !!materialFileParam && !explicitMaterialId;

console.log("worker src", pdfjsLib.GlobalWorkerOptions.workerSrc);
console.log("Loading material:", materialId);

// Global variables
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.2; // Default scale tailored for full screen
let canvas = null;
let ctx = null;
let savedPageNum = 1;
let mouseMode = 'scroll'; // 'scroll' or 'zoom'

// DOM elements
const canvasElement = document.getElementById('pdf-canvas');
const loadingIndicator = document.getElementById('loading-indicator');
const errorBox = document.getElementById('error-box');
const errorMessage = document.getElementById('error-message');
const courseTitle = document.getElementById('course-title');
const thumbnailContainer = document.getElementById('thumbnail-container');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const pageInfo = document.getElementById('page-info');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const fitWidthBtn = document.getElementById('fit-width');
const fitPageBtn = document.getElementById('fit-page');
const lastReadBtn = document.getElementById('last-read-btn');
const mouseModeBtn = document.getElementById('mouse-mode-btn');
const readingProgress = document.getElementById('reading-progress');
const finishReadingBtn = document.getElementById('finish-reading-btn');
const nextModuleBtn = document.getElementById('next-module-btn');
const viewerContainer = document.getElementById('viewer-container');

// Initialize the reader
function initReader() {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');

    // Set course title
    courseTitle.textContent = courseReaderConfig.title;

    // Load PDF
    loadPDF();

    // Set up event listeners
    setupEventListeners();

    // Restore progress from localStorage
    restoreProgress();
}

function setupEventListeners() {
    prevBtn.addEventListener('click', onPrevPage);
    nextBtn.addEventListener('click', onNextPage);
    zoomInBtn.addEventListener('click', () => changeZoom(0.1));
    zoomOutBtn.addEventListener('click', () => changeZoom(-0.1));
    
    if (fitWidthBtn) fitWidthBtn.addEventListener('click', fitToWidth);
    if (fitPageBtn) fitPageBtn.addEventListener('click', fitToPage);
    if (lastReadBtn) lastReadBtn.addEventListener('click', goToLastRead);
    if (mouseModeBtn) mouseModeBtn.addEventListener('click', toggleMouseMode);

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // New reading action buttons
    finishReadingBtn.addEventListener('click', finishReading);
    nextModuleBtn.addEventListener('click', goToNextModule);

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            onPrevPage();
        } else if (e.key === 'ArrowRight') {
            onNextPage();
        }
    });

    // Mouse Wheel Zoom
    const viewer = document.getElementById('viewer-container');
    if (viewer) {
        viewer.addEventListener('wheel', (e) => {
            // Check mouse mode
            if (mouseMode === 'zoom') {
                e.preventDefault(); // Prevent scrolling
                if (e.deltaY < 0) {
                    changeZoom(0.1);
                } else {
                    changeZoom(-0.1);
                }
            } else {
                // Default Scroll Mode
                // Support Ctrl + Wheel for zoom
                if (e.ctrlKey) {
                    e.preventDefault();
                    if (e.deltaY < 0) {
                        changeZoom(0.1);
                    } else {
                        changeZoom(-0.1);
                    }
                }
            }
        }, { passive: false });
    }
}

function toggleMouseMode() {
    const icon = mouseModeBtn.querySelector('i');
    const span = mouseModeBtn.querySelector('span');
    
    if (mouseMode === 'scroll') {
        mouseMode = 'zoom';
        icon.className = 'fas fa-search-plus';
        if (span) span.textContent = 'Zoom';
        mouseModeBtn.title = 'Mouse Wheel: Zoom (Click to switch to Scroll)';
        mouseModeBtn.classList.add('primary'); // Highlight active state
    } else {
        mouseMode = 'scroll';
        icon.className = 'fas fa-hand-paper';
        if (span) span.textContent = 'Scroll';
        mouseModeBtn.title = 'Mouse Wheel: Scroll (Ctrl+Wheel to Zoom)';
        mouseModeBtn.classList.remove('primary');
    }
}

function toggleSidebar() {
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
}

function loadPDF() {
    console.log("Loading PDF from:", courseReaderConfig.pdfUrl);

    loadingIndicator.style.display = 'flex';
    errorBox.style.display = 'none';

    const handlePdfLoaded = function (pdf) {
        console.log("PDF loaded successfully, totalPages:", pdf.numPages);

        pdfDoc = pdf;
        loadingIndicator.style.display = 'none';

        // Update page info
        updatePageInfo();

        // Enable navigation buttons
        updateButtons();

        // Render first page (or saved page if auto-restore logic is desired, currently we just init at 1 and let restoreProgress handle jumps or button display)
        // Check if we should auto-jump or just wait for user
        if (savedPageNum > 1) {
            pageNum = savedPageNum;
        }
        renderPage(pageNum);

        // Generate Thumbnails
        renderThumbnails();
    };

    const showLoadError = function (error) {
        console.error("Error loading PDF:", error);
        loadingIndicator.style.display = 'none';
        errorBox.style.display = 'block';
        errorMessage.textContent = `Failed to load PDF from ${courseReaderConfig.pdfUrl}. Error: ${error.message}`;
    };

    const primaryTask = pdfjsLib.getDocument({ url: courseReaderConfig.pdfUrl });
    primaryTask.promise.then(handlePdfLoaded).catch(async function (error) {
        console.warn("Primary PDF load failed, trying fallback fetch:", error);
        try {
            const response = await fetch(courseReaderConfig.pdfUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.arrayBuffer();
            const fallbackTask = pdfjsLib.getDocument({ data: data });
            const pdf = await fallbackTask.promise;
            handlePdfLoaded(pdf);
        } catch (fallbackError) {
            showLoadError(fallbackError);
        }
    });
}

// Sequential thumbnail rendering with immediate placeholders
async function renderThumbnails() {
    if (!thumbnailContainer || !pdfDoc) return;
    
    thumbnailContainer.innerHTML = '';
    
    const renderQueue = [];

    // 1. Create ALL placeholders first
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'thumbnail-wrapper';
        wrapper.dataset.pageNumber = i;
        wrapper.onclick = () => goToPage(i);
        
        // Create canvas for thumbnail
        const thumbCanvas = document.createElement('canvas');
        // Ensure canvas fits the container width
        thumbCanvas.style.width = '100%';
        thumbCanvas.style.height = 'auto';
        thumbCanvas.style.backgroundColor = '#fff'; // Placeholder color
        wrapper.appendChild(thumbCanvas);
        
        // Create label
        const label = document.createElement('div');
        label.className = 'thumbnail-label';
        label.textContent = i;
        wrapper.appendChild(label);
        
        thumbnailContainer.appendChild(wrapper);
        
        renderQueue.push({ pageNumber: i, canvas: thumbCanvas });
    }

    // 2. Process render queue in background
    processThumbnailQueue(renderQueue);
}

async function processThumbnailQueue(queue) {
    for (const item of queue) {
        try {
            await renderThumbnailPage(item.pageNumber, item.canvas);
            
            // Add a tiny delay to allow UI updates between renders
            await new Promise(resolve => setTimeout(resolve, 10));
        } catch (e) {
            console.warn(`Error rendering thumbnail for page ${item.pageNumber}`, e);
        }
    }
}

function renderThumbnailPage(pageNumber, canvas) {
    return pdfDoc.getPage(pageNumber).then(function(page) {
        // Calculate dynamic scale to fit ~180px width (sidebar is 220px)
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const targetWidth = 180;
        const scale = targetWidth / unscaledViewport.width;
        
        const viewport = page.getViewport({ scale: scale }); 
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: canvas.getContext('2d'),
            viewport: viewport
        };
        
        return page.render(renderContext).promise;
    });
}

function renderPage(num) {
    console.log("Rendering page:", num, "scale:", scale);

    pageRendering = true;

    pdfDoc.getPage(num).then(function (page) {
        const viewport = page.getViewport({ scale: scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        const renderTask = page.render(renderContext);

        renderTask.promise.then(function () {
            pageRendering = false;
            console.log("Page rendered:", num, "scale:", scale);

            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }

            // Update TOC/Thumbnail active state
            updateThumbnailActive();

            // Save progress
            saveProgress();
        });
    });
}

function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

function onPrevPage() {
    if (pageNum <= 1) return;
    pageNum--;
    updatePageInfo();
    updateButtons();
    queueRenderPage(pageNum);
}

function onNextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    updatePageInfo();
    updateButtons();
    queueRenderPage(pageNum);
}

function goToPage(pageNumber) {
    if (pageNumber < 1 || pageNumber > pdfDoc.numPages) return;
    pageNum = pageNumber;
    updatePageInfo();
    updateButtons();
    queueRenderPage(pageNum);
}

function changeZoom(delta) {
    scale = Math.max(0.2, Math.min(5.0, scale + delta));
    queueRenderPage(pageNum);
}

function fitToWidth() {
    if (!pdfDoc) return;
    pdfDoc.getPage(pageNum).then(function(page) {
        const viewport = page.getViewport({ scale: 1.0 });
        const containerWidth = viewerContainer.clientWidth - 64; // minus padding
        if (containerWidth > 0) {
            scale = containerWidth / viewport.width;
            queueRenderPage(pageNum);
        }
    });
}

function fitToPage() {
    if (!pdfDoc) return;
    pdfDoc.getPage(pageNum).then(function(page) {
        const viewport = page.getViewport({ scale: 1.0 });
        const containerHeight = viewerContainer.clientHeight - 64; // minus padding
        if (containerHeight > 0) {
            scale = containerHeight / viewport.height;
            queueRenderPage(pageNum);
        }
    });
}

function goToLastRead() {
    if (savedPageNum && savedPageNum > 1) {
        goToPage(savedPageNum);
    }
}

function updatePageInfo() {
    if (!pdfDoc) return;
    pageInfo.textContent = `${pageNum} / ${pdfDoc.numPages}`;
}

function updateButtons() {
    if (!pdfDoc) return;
    prevBtn.disabled = pageNum <= 1;
    nextBtn.disabled = pageNum >= pdfDoc.numPages;

    // Check saved page logic for button visibility
    if (lastReadBtn) {
        if (savedPageNum > 1 && savedPageNum !== pageNum) {
            lastReadBtn.style.display = 'flex';
            const span = lastReadBtn.querySelector('span');
            if(span) span.textContent = `Resume Pg ${savedPageNum}`;
        } else {
            lastReadBtn.style.display = 'none';
        }
    }

    // Update reading progress
    updateReadingProgress();
}

function updateThumbnailActive() {
    if (!pdfDoc || !thumbnailContainer) return;

    const wrappers = thumbnailContainer.querySelectorAll('.thumbnail-wrapper');
    wrappers.forEach(w => w.classList.remove('active'));

    const currentWrapper = thumbnailContainer.querySelector(`.thumbnail-wrapper[data-page-number="${pageNum}"]`);
    if (currentWrapper) {
        currentWrapper.classList.add('active');
        // Scroll thumbnail into view
        currentWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function saveProgress() {
    const progress = {
        pageNumber: pageNum,
        scale: scale
    };
    localStorage.setItem(`bcl_reader_${courseReaderConfig.courseId}`, JSON.stringify(progress));
    
    // Update local savedPageNum variable so button state updates correctly
    savedPageNum = pageNum;
    // Don't hide the resume button immediately if we just saved the current page, 
    // but usually "Resume" implies "Resume from saved state". 
    // If we are AT the saved state, the button is hidden by updateButtons.
    updateButtons(); 
}

// Close PDF Reader Modal
function closePDFReader() {
    // Save progress before closing
    saveProgress();

    // If opened in a modal/overlay, close it
    if (window.parent !== window) {
        // If opened in an iframe or modal, close parent modal
        if (window.parent.closePDFModal) {
            window.parent.closePDFModal();
        } else {
            // Fallback: go back to courses page
            window.location.href = '/elearning-assets/courses.html';
        }
    } else {
        // If opened directly, go back to return page when provided
        if (returnParam) {
            window.location.href = returnParam;
        } else {
            window.location.href = '/elearning-assets/courses.html';
        }
    }
}

function restoreProgress() {
    const saved = localStorage.getItem(`bcl_reader_${courseReaderConfig.courseId}`);
    if (saved) {
        try {
            const progress = JSON.parse(saved);
            savedPageNum = progress.pageNumber || 1;
            
            // If we have a saved scale, use it
            if (progress.scale) {
                scale = progress.scale;
            }
            
            console.log("Restored progress:", progress);
        } catch (e) {
            console.warn("Failed to restore progress:", e);
        }
    }
}

// Update reading progress display
function updateReadingProgress() {
    if (!pdfDoc || !readingProgress) return;

    const progressPercent = Math.round((pageNum / pdfDoc.numPages) * 100);
    readingProgress.textContent = `${progressPercent}%`;

    // Update button states based on progress
    if (progressPercent >= 95) {
        finishReadingBtn.disabled = false;
        finishReadingBtn.style.opacity = '1';
    } else {
        finishReadingBtn.disabled = true;
        finishReadingBtn.style.opacity = '0.6';
    }
}

// Finish reading functionality
function finishReading() {
    if (!pdfDoc) return;

    const progressPercent = Math.round((pageNum / pdfDoc.numPages) * 100);
    if (progressPercent < 95) {
        alert('Please read at least 95% of the material before finishing.');
        return;
    }

    // Mark as completed in localStorage
    const completionData = {
        materialId: courseReaderConfig.courseId,
        completedAt: new Date().toISOString(),
        totalPages: pdfDoc.numPages,
        lastPageRead: pageNum,
        progressPercent: progressPercent
    };

    localStorage.setItem(`bcl_completed_${courseReaderConfig.courseId}`, JSON.stringify(completionData));

    // Show completion message
    alert(`🎉 Congratulations! You have completed reading "${courseReaderConfig.title}"`);

    // Close the reader
    closePDFReader();
}

// Go to next module functionality
async function goToNextModule() {
    try {
        // Get all materials to find the next one
        const materialsResponse = await fetch(`${window.location.origin}/api/learning-materials`);
        if (!materialsResponse.ok) {
            throw new Error('Failed to load materials list');
        }

        const materialsData = await materialsResponse.json();
        const allMaterials = materialsData.data || [];

        // Find current material index
        const currentIndex = allMaterials.findIndex(m => m.id === courseReaderConfig.courseId);
        if (currentIndex === -1) {
            alert('Current material not found in the materials list.');
            return;
        }

        // Find next material (same category if possible)
        let nextMaterial = null;
        const currentMaterial = allMaterials[currentIndex];

        // First try to find next material in same category
        if (currentMaterial.category) {
            nextMaterial = allMaterials.find((m, index) =>
                index > currentIndex &&
                m.category === currentMaterial.category &&
                m.status === 'active'
            );
        }

        // If no next material in same category, find any next material
        if (!nextMaterial) {
            nextMaterial = allMaterials.find((m, index) =>
                index > currentIndex &&
                m.status === 'active'
            );
        }

        if (!nextMaterial) {
            alert('No next module available. You have reached the end of available materials.');
            return;
        }

        // Confirm navigation
        if (confirm(`Navigate to next module: "${nextMaterial.title}"?`)) {
            // Close current reader
            closePDFReader();

            // Small delay to ensure modal closes
            setTimeout(() => {
                // Navigate to next material
                window.location.href = `/public/reader.html?material=${encodeURIComponent(nextMaterial.id)}`;
            }, 300);
        }

    } catch (error) {
        console.error('Error navigating to next module:', error);
        alert('Failed to navigate to next module. Please try again.');
    }
}

// Load material configuration and TOC
async function loadMaterialConfig() {
    try {
        console.log("🔍 Loading material configuration for:", materialId);

        if (useFileOnly) {
            const baseUrl = window.location.origin && window.location.origin !== 'null'
                ? window.location.origin
                : '';
            const normalizedFile = materialFileParam.startsWith('http')
                ? materialFileParam
                : `${baseUrl}${materialFileParam.startsWith('/') ? '' : '/'}${materialFileParam}`;

            const filename = materialFileParam.split('?')[0].split('#')[0].split('/').pop() || 'PDF Document';
            const cleanTitle = decodeURIComponent(filename).replace(/\.pdf$/i, '');

            courseReaderConfig = {
                courseId: `file:${normalizedFile}`,
                title: cleanTitle,
                pdfUrl: normalizedFile,
                chapters: []
            };

            if (finishReadingBtn) finishReadingBtn.style.display = 'none';
            if (nextModuleBtn) nextModuleBtn.style.display = 'none';

            initReader();
            return;
        }

        // Load material data
        const baseUrl = window.location.origin && window.location.origin !== 'null'
            ? window.location.origin
            : '';

        let material = null;
        let materialResponse = await fetch(`${baseUrl}/api/learning-materials/${materialId}`);

        if (materialResponse.ok) {
            const materialData = await materialResponse.json();
            material = materialData.data;
        } else {
            console.warn(`⚠️ Direct material lookup failed (${materialResponse.status}). Falling back to list search.`);
            const listResponse = await fetch(`${baseUrl}/api/learning-materials`);
            if (!listResponse.ok) {
                throw new Error(`Material not found: ${materialResponse.status}`);
            }
            const listData = await listResponse.json();
            const allMaterials = listData.data || [];
            material = allMaterials.find(m =>
                m.id == materialId || String(m.id) === String(materialId)
            );
            if (!material) {
                throw new Error(`Material not found in list: ${materialId}`);
            }
        }

        // Note: TOC data fetch is no longer needed for rendering the sidebar, but we might keep it if needed later.
        // For now, we rely on the PDF itself to generate thumbnails.
        
        // Update configuration - construct full URL for PDF
        const filePath = material.filePath || material.file_path || '';

        courseReaderConfig = {
            courseId: material.id,
            title: material.title,
            pdfUrl: filePath.startsWith('http') ? filePath : `${baseUrl}${filePath}`,
            chapters: [] // Chapters ignored in favor of thumbnails
        };

        console.log("✅ Material configuration loaded:", courseReaderConfig);

        // Now initialize the reader
        initReader();

    } catch (error) {
        console.error("❌ Failed to load material configuration:", error);

        // Fallback to basic configuration
        let fallbackUrl = `/materials/${materialId}.pdf`;
        let fallbackTitle = `Material: ${materialId}`;
        let fallbackCourseId = materialId;

        if (materialFileParam) {
            fallbackUrl = materialFileParam.startsWith('http')
                ? materialFileParam
                : `${window.location.origin}${materialFileParam.startsWith('/') ? '' : '/'}${materialFileParam}`;

            const filename = materialFileParam.split('?')[0].split('#')[0].split('/').pop() || 'PDF Document';
            fallbackTitle = decodeURIComponent(filename).replace(/\.pdf$/i, '');
            fallbackCourseId = `file:${fallbackUrl}`;
        }

        courseReaderConfig = {
            courseId: fallbackCourseId,
            title: fallbackTitle,
            pdfUrl: fallbackUrl,
            chapters: []
        };

        console.log("⚠️ Using fallback configuration");
        initReader();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', loadMaterialConfig);
