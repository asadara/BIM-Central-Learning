// level-request.js - Level Upgrade Request System

// Level requirements data
const levelRequirements = {
    coordinator: {
        title: 'BIM Coordinator',
        requirements: [
            { id: 'courses', text: 'Complete all BIM Modeller courses', completed: true },
            { id: 'certification', text: 'Pass BIM Modeller certification exam', completed: true },
            { id: 'experience', text: 'Minimum 6 months at current level', completed: false },
            { id: 'training', text: 'Complete coordinator-specific training modules', completed: false }
        ],
        benefits: [
            'Access to coordination and management courses',
            'Advanced clash detection training',
            'Team leadership modules',
            'Higher complexity project assignments'
        ]
    },
    manager: {
        title: 'BIM Manager',
        requirements: [
            { id: 'coordinator', text: 'Must be BIM Coordinator first', completed: false },
            { id: 'coordinator_experience', text: 'Minimum 12 months as BIM Coordinator', completed: false },
            { id: 'coordinator_cert', text: 'Pass BIM Coordinator certification', completed: false },
            { id: 'management', text: 'Complete management training programs', completed: false }
        ],
        benefits: [
            'Strategic BIM implementation courses',
            'Executive leadership training',
            'Enterprise BIM standards development',
            'Full access to all platform features'
        ]
    }
};

// Global variables
let currentUser = null;
let requestHistory = [];
let userProgress = null;

// API base URL
const API_BASE = '/api';

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
    loadUserData();
    loadUserProgress();
    updateLevelProgress();
    setupUpgradeCards();
    setupRequestModal();
    loadRequestHistory();
    setupFileUpload();
});

async function loadUserData() {
    try {
        // Get current user from localStorage (set by login)
        const userData = JSON.parse(localStorage.getItem('currentUser') || '{}');
        currentUser = userData;

        if (userData.name) {
            document.getElementById('user-name').textContent = userData.name;
            document.getElementById('user-role').textContent = userData.role || 'Student';
            document.getElementById('user-level').textContent = userData.level || 'BIM Modeller';
            document.getElementById('current-level').textContent = userData.level || 'BIM Modeller';

            if (userData.profileImage) {
                document.getElementById('user-img').src = userData.profileImage;
            }
        }

        // Load user progress from API
        await loadUserProgress();

    } catch (error) {
        console.error('Error loading user data:', error);
        showErrorMessage('Failed to load user data');
    }
}

async function loadUserProgress() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.warn('No auth token found');
            return;
        }

        const response = await fetch(`${API_BASE}/level-requests/user/progress?userId=${currentUser.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            userProgress = await response.json();
            if (userProgress.success) {
                updateProgressDisplay(userProgress.data);
            }
        } else {
            console.warn('Failed to load user progress:', response.status);
        }
    } catch (error) {
        console.error('Error loading user progress:', error);
    }
}

function updateProgressDisplay(progressData) {
    if (!progressData) return;

    // Update current level display
    document.getElementById('current-level').textContent = progressData.currentLevel;

    // Update progress bar
    const progressPercent = progressData.levelProgress || 0;
    document.getElementById('level-progress').style.width = progressPercent + '%';
    document.querySelector('.progress-text').textContent = progressPercent + '% towards next level';

    // Update level date (you might want to add this to the API response)
    const levelDateElement = document.getElementById('level-date');
    if (levelDateElement) {
        levelDateElement.textContent = 'January 2025'; // Placeholder - should come from API
    }
}

function updateLevelProgress() {
    // Simulate level progress calculation
    const currentLevel = document.getElementById('current-level').textContent;
    let progress = 75; // Example progress

    // Update progress based on completed requirements
    if (currentLevel === 'BIM Modeller') {
        const coordinatorReqs = levelRequirements.coordinator.requirements;
        const completedReqs = coordinatorReqs.filter(req => req.completed).length;
        progress = Math.round((completedReqs / coordinatorReqs.length) * 100);
    }

    document.getElementById('level-progress').style.width = progress + '%';
    document.querySelector('.progress-text').textContent = progress + '% towards next level';
}

function setupUpgradeCards() {
    const upgradeCards = document.querySelectorAll('.upgrade-card');

    upgradeCards.forEach(card => {
        const targetLevel = card.dataset.targetLevel;
        const requirements = levelRequirements[targetLevel].requirements;

        // Update requirement status
        const requirementItems = card.querySelectorAll('.requirement-item');
        requirementItems.forEach((item, index) => {
            if (requirements[index]) {
                const req = requirements[index];
                if (req.completed) {
                    item.classList.remove('pending');
                    item.classList.add('completed');
                    item.querySelector('.req-icon i').className = 'fas fa-check-circle';
                } else {
                    item.classList.remove('completed');
                    item.classList.add('pending');
                    item.querySelector('.req-icon i').className = 'fas fa-clock';
                }
            }
        });

        // Check if upgrade is available
        const allCompleted = requirements.every(req => req.completed);
        const upgradeBtn = card.querySelector('.request-upgrade-btn');

        if (allCompleted && !card.classList.contains('locked')) {
            upgradeBtn.disabled = false;
            upgradeBtn.addEventListener('click', () => showRequestModal(targetLevel));
        }
    });
}

function showRequestForm(targetLevel) {
    const formSection = document.getElementById('request-form-section');
    const targetLevelInput = document.getElementById('target-level');

    targetLevelInput.value = levelRequirements[targetLevel].title;
    formSection.style.display = 'block';
    formSection.scrollIntoView({ behavior: 'smooth' });
}

function setupRequestForm() {
    const form = document.getElementById('upgrade-form');
    const cancelBtn = document.getElementById('cancel-request');
    const formSection = document.getElementById('request-form-section');

    cancelBtn.addEventListener('click', () => {
        formSection.style.display = 'none';
        form.reset();
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitUpgradeRequest();
    });
}

async function submitUpgradeRequest() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            showErrorMessage('Authentication required. Please log in again.');
            return;
        }

        const form = document.getElementById('upgrade-form');
        const formData = new FormData(form);

        // Create request data
        const requestData = {
            userId: currentUser.id,
            targetLevel: formData.get('target-level'),
            reason: formData.get('request-reason'),
            workExperience: formData.get('work-experience'),
            projectExamples: formData.get('project-examples'),
            additionalCertifications: formData.get('additional-certifications'),
            supervisorEmail: formData.get('supervisor-email')
        };

        // Validate required fields
        if (!requestData.targetLevel || !requestData.reason) {
            showErrorMessage('Please fill in all required fields.');
            return;
        }

        // Show loading state
        const submitBtn = document.getElementById('submit-request');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

        // Submit request to API
        const response = await fetch(`${API_BASE}/level-requests`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Success - hide form and show success message
            document.getElementById('request-form-section').style.display = 'none';
            showSuccessMessage();

            // Reset form
            form.reset();

            // Reload request history
            await loadRequestHistory();

        } else {
            // Error
            const errorMsg = result.error || 'Failed to submit request';
            showErrorMessage(errorMsg);
        }

    } catch (error) {
        console.error('Error submitting upgrade request:', error);
        showErrorMessage('Network error. Please try again.');
    } finally {
        // Reset button state
        const submitBtn = document.getElementById('submit-request');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Request';
    }
}

function showSuccessMessage() {
    const message = document.createElement('div');
    message.className = 'success-message';
    message.innerHTML = `
        <div class="message-content">
            <i class="fas fa-check-circle"></i>
            <h3>Request Submitted Successfully!</h3>
            <p>Your level upgrade request has been submitted and will be reviewed within 3-5 business days.</p>
        </div>
    `;

    document.body.appendChild(message);

    setTimeout(() => {
        message.classList.add('show');
    }, 100);

    setTimeout(() => {
        message.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(message);
        }, 300);
    }, 4000);
}

async function loadRequestHistory() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.warn('No auth token found for request history');
            return;
        }

        const response = await fetch(`${API_BASE}/level-requests/my?userId=${currentUser.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                requestHistory = result.data;
                renderRequestHistory();
            }
        } else {
            console.warn('Failed to load request history:', response.status);
            renderRequestHistory(); // Render what we have
        }
    } catch (error) {
        console.error('Error loading request history:', error);
        renderRequestHistory(); // Render what we have
    }
}

function renderRequestHistory() {
    const historyList = document.getElementById('request-history-list');

    if (!requestHistory || requestHistory.length === 0) {
        historyList.innerHTML = '<p class="no-history">No previous requests found.</p>';
        return;
    }

    historyList.innerHTML = '';

    requestHistory.forEach(request => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';

        const statusClass = request.status.replace('_', ' ');
        const statusIcon = getStatusIcon(request.status);

        historyItem.innerHTML = `
            <div class="history-icon ${request.status}">
                <i class="${statusIcon}"></i>
            </div>
            <div class="history-content">
                <h4>${request.targetLevel} Upgrade Request</h4>
                <p class="history-date">Submitted: ${formatDate(request.submittedAt)}</p>
                <p class="history-status">Status: <span class="status ${request.status}">${statusClass}</span></p>
                <p class="history-description">${request.reason}</p>
            </div>
        `;

        historyList.appendChild(historyItem);
    });
}

function getStatusIcon(status) {
    switch (status) {
        case 'under_review':
            return 'fas fa-clock';
        case 'approved':
            return 'fas fa-check-circle';
        case 'rejected':
            return 'fas fa-times-circle';
        case 'pending_additional_info':
            return 'fas fa-question-circle';
        default:
            return 'fas fa-clock';
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
        </div>
    `;

    document.body.appendChild(errorDiv);

    setTimeout(() => {
        errorDiv.classList.add('show');
    }, 100);

    setTimeout(() => {
        errorDiv.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(errorDiv)) {
                document.body.removeChild(errorDiv);
            }
        }, 300);
    }, 5000);
}

// Success message styles
function addMessageStyles() {
    if (!document.getElementById('level-request-styles')) {
        const style = document.createElement('style');
        style.id = 'level-request-styles';
        style.textContent = `
            .success-message, .error-message {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
            }

            .success-message.show, .error-message.show {
                opacity: 1;
                transform: translateX(0);
            }

            .success-message .message-content, .error-message .error-content {
                background: white;
                border-radius: 8px;
                padding: 16px 20px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                gap: 12px;
                border-left: 4px solid #10b981;
            }

            .error-message .error-content {
                border-left-color: #ef4444;
            }

            .success-message i {
                color: #10b981;
                font-size: 20px;
            }

            .error-message i {
                color: #ef4444;
                font-size: 20px;
            }

            .success-message h3 {
                margin: 0;
                color: #065f46;
                font-size: 16px;
                font-weight: 600;
            }

            .success-message p {
                margin: 4px 0 0 0;
                color: #374151;
                font-size: 14px;
            }

            .error-message span {
                color: #dc2626;
                font-size: 14px;
                font-weight: 500;
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize styles
addMessageStyles();

// Modal and file upload functionality
function setupRequestModal() {
    const modal = document.getElementById('request-modal');
    const backdrop = document.getElementById('modal-backdrop');
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = document.getElementById('cancel-request');
    const form = document.getElementById('upgrade-form');

    // Close modal events
    closeBtn.addEventListener('click', closeRequestModal);
    cancelBtn.addEventListener('click', closeRequestModal);
    backdrop.addEventListener('click', closeRequestModal);

    // Form submission
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitUpgradeRequest();
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            closeRequestModal();
        }
    });
}

function showRequestModal(targetLevel) {
    const modal = document.getElementById('request-modal');
    const currentLevelSummary = document.getElementById('current-level-summary');
    const targetLevelSummary = document.getElementById('target-level-summary');
    const targetLevelInput = document.getElementById('target-level');

    // Update modal content
    currentLevelSummary.textContent = document.getElementById('current-level').textContent;
    targetLevelSummary.textContent = levelRequirements[targetLevel].title;
    targetLevelInput.value = levelRequirements[targetLevel].title;

    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Focus first input
    setTimeout(() => {
        document.getElementById('request-reason').focus();
    }, 100);
}

function closeRequestModal() {
    const modal = document.getElementById('request-modal');
    const form = document.getElementById('upgrade-form');

    modal.style.display = 'none';
    document.body.style.overflow = 'auto';

    // Reset form and file uploads
    form.reset();
    document.getElementById('uploaded-files').innerHTML = '';
    uploadedFiles = [];
}

function setupFileUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('evidence-files');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadedFilesContainer = document.getElementById('uploaded-files');

    let uploadedFiles = [];

    // Drag and drop functionality
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    });

    // Click to upload
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        handleFiles(files);
    });

    function handleFiles(files) {
        const validFiles = files.filter(file => {
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            return allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024; // 10MB limit
        });

        if (validFiles.length !== files.length) {
            showErrorMessage('Some files were rejected. Only PDF, DOC, DOCX, and images under 10MB are allowed.');
        }

        validFiles.forEach(file => {
            if (uploadedFiles.length >= 5) {
                showErrorMessage('Maximum 5 files allowed.');
                return;
            }

            uploadedFiles.push(file);
            displayUploadedFile(file);
        });
    }

    function displayUploadedFile(file) {
        const fileElement = document.createElement('div');
        fileElement.className = 'uploaded-file';
        fileElement.innerHTML = `
            <div class="file-info">
                <i class="fas fa-file"></i>
                <div class="file-details">
                    <span>${file.name}</span>
                    <span>${formatFileSize(file.size)}</span>
                </div>
            </div>
            <button type="button" class="remove-file" data-filename="${file.name}">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Remove file functionality
        fileElement.querySelector('.remove-file').addEventListener('click', () => {
            uploadedFiles = uploadedFiles.filter(f => f.name !== file.name);
            uploadedFilesContainer.removeChild(fileElement);
        });

        uploadedFilesContainer.appendChild(fileElement);
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Make uploadedFiles accessible to form submission
    window.uploadedFiles = uploadedFiles;
}

// Update submit function to handle files
async function submitUpgradeRequest() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            showErrorMessage('Authentication required. Please log in again.');
            return;
        }

        const form = document.getElementById('upgrade-form');
        const formData = new FormData(form);

        // Create request data
        const requestData = {
            userId: currentUser.id,
            targetLevel: formData.get('target-level'),
            reason: formData.get('request-reason'),
            workExperience: formData.get('work-experience'),
            projectExamples: formData.get('project-examples'),
            additionalCertifications: formData.get('additional-certifications'),
            supervisorEmail: formData.get('supervisor-email')
        };

        // Validate required fields
        if (!requestData.targetLevel || !requestData.reason) {
            showErrorMessage('Please fill in all required fields.');
            return;
        }

        // Add files to FormData if any
        if (window.uploadedFiles && window.uploadedFiles.length > 0) {
            window.uploadedFiles.forEach((file, index) => {
                formData.append('evidenceFiles', file);
            });
        }

        // Show loading state
        const submitBtn = document.getElementById('submit-request');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

        // Submit request to API
        const response = await fetch(`${API_BASE}/level-requests`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // Don't set Content-Type for FormData - let browser set it with boundary
            },
            body: formData
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Success
            closeRequestModal();
            showSuccessMessage();

            // Reload request history and stats
            await loadRequestHistory();
            updateStats();

        } else {
            // Error
            const errorMsg = result.error || 'Failed to submit request';
            showErrorMessage(errorMsg);
        }

    } catch (error) {
        console.error('Error submitting upgrade request:', error);
        showErrorMessage('Network error. Please try again.');
    } finally {
        // Reset button state
        const submitBtn = document.getElementById('submit-request');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Upgrade Request';
    }
}

function updateStats() {
    // Update statistics based on current request history
    const pendingCount = requestHistory.filter(r => r.status === 'pending' || r.status === 'under_review').length;
    const approvedCount = requestHistory.filter(r => r.status === 'approved').length;
    const rejectedCount = requestHistory.filter(r => r.status === 'rejected').length;

    document.getElementById('pending-count').textContent = pendingCount;
    document.getElementById('approved-count').textContent = approvedCount;
    document.getElementById('rejected-count').textContent = rejectedCount;
}

// Export functions for external use
window.levelRequestSystem = {
    submitRequest: submitUpgradeRequest,
    getRequestHistory: () => requestHistory,
    getLevelRequirements: () => levelRequirements,
    showRequestModal: showRequestModal,
    closeRequestModal: closeRequestModal
};
