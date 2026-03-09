// profile.js - Enhanced User Profile Management System

// Initialize profile page
document.addEventListener('DOMContentLoaded', function () {
    loadUserProfile();
    initializeTabs();
    setupModals();
    setupFormValidation();
    setupPhotoUpload();
    setupGoalsTracking();
    loadProfileData();
});

// Tab Navigation System
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;

            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab
            button.classList.add('active');
            document.getElementById(tabId + '-tab').classList.add('active');

            // Load tab-specific data
            loadTabData(tabId);
        });
    });
}

// Load tab-specific data
function loadTabData(tabId) {
    switch (tabId) {
        case 'achievements':
            loadUserAchievements();
            break;
        case 'activity':
            loadActivityTimeline();
            break;
        case 'courses':
            loadEnrolledCourses();
            break;
        case 'social':
            loadSocialStats();
            break;
    }
}

// Modal Management
function setupModals() {
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const shareProfileBtn = document.getElementById('share-profile-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const modal = document.getElementById('edit-profile-modal');

    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            openEditProfileModal();
        });
    }

    if (shareProfileBtn) {
        shareProfileBtn.addEventListener('click', () => {
            shareProfile();
        });
    }

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            openSettingsModal();
        });
    }

    // Close modal events
    if (modal) {
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('#cancel-edit');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('show');
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.classList.remove('show');
            });
        }

        // Click outside modal to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    }
}

// Photo Upload Functionality
function setupPhotoUpload() {
    const avatarWrapper = document.querySelector('.avatar-wrapper');
    const avatarOverlay = document.querySelector('.avatar-overlay');
    const photoUpload = document.getElementById('photo-upload');

    if (avatarWrapper && avatarOverlay && photoUpload) {
        // Show upload overlay on hover
        avatarWrapper.addEventListener('mouseenter', () => {
            avatarOverlay.style.opacity = '1';
        });

        avatarWrapper.addEventListener('mouseleave', () => {
            avatarOverlay.style.opacity = '0';
        });

        // Handle click to upload
        avatarOverlay.addEventListener('click', () => {
            photoUpload.click();
        });

        // Handle file selection
        photoUpload.addEventListener('change', handlePhotoUpload);
    }
}

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (file) {
        // Validate file
        if (!file.type.startsWith('image/')) {
            showNotification('Please select a valid image file', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            showNotification('File size must be less than 5MB', 'error');
            return;
        }

        // Preview image with compression for persistence
        processProfileImage(file)
            .then((dataUrl) => {
                document.getElementById('profile-image').src = dataUrl;
                persistProfileImage(dataUrl);
                showNotification('Profile photo updated successfully!', 'success');
            })
            .catch((error) => {
                console.error('Error processing profile image:', error);
                showNotification('Failed to process image. Please try another file.', 'error');
            });

        // Upload to server (would normally send to backend)
        uploadProfileImage(file);
    }
}

function processProfileImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('File read failed'));
        reader.onload = function (e) {
            const img = new Image();
            img.onerror = () => resolve(e.target.result);
            img.onload = () => {
                const maxSize = 512;
                let width = img.width;
                let height = img.height;
                const scale = Math.min(1, maxSize / Math.max(width, height));
                if (scale < 1) {
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                let quality = 0.85;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);

                while (dataUrl.length > 1900000 && quality > 0.5) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                resolve(dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function persistProfileImage(imageSrc) {
    if (!imageSrc) return;

    try {
        const storedUser = localStorage.getItem('user');
        let userData = storedUser ? JSON.parse(storedUser) : {};
        userData = userData && typeof userData === 'object' ? userData : {};

        userData.photo = imageSrc;
        userData.profileImage = imageSrc;

        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('userimg', imageSrc);

        const cachedProfile = localStorage.getItem('userProfile');
        if (cachedProfile) {
            const profileData = JSON.parse(cachedProfile);
            if (profileData && typeof profileData === 'object') {
                profileData.photo = imageSrc;
                profileData.profileImage = imageSrc;
                localStorage.setItem('userProfile', JSON.stringify(profileData));
            }
        }

        const cachedUserData = localStorage.getItem('userData');
        if (cachedUserData) {
            const legacyUserData = JSON.parse(cachedUserData);
            if (legacyUserData && typeof legacyUserData === 'object') {
                legacyUserData.image = imageSrc;
                localStorage.setItem('userData', JSON.stringify(legacyUserData));
            }
        }

        if (window.currentUser && typeof window.currentUser === 'object') {
            window.currentUser.photo = imageSrc;
        }

        if (typeof updateUserUI === 'function') {
            updateUserUI();
        }

        if (window.componentLoader) {
            if (typeof window.componentLoader.syncHeaderUserInfo === 'function') {
                window.componentLoader.syncHeaderUserInfo();
            }
            if (typeof window.componentLoader.syncSidebarUserInfo === 'function') {
                window.componentLoader.syncSidebarUserInfo();
            }
        }
    } catch (error) {
        console.error('Error persisting profile image:', error);
    }
}

async function uploadProfileImage(file) {
    try {
        const formData = new FormData();
        formData.append('profile-image', file);

        const storedUser = localStorage.getItem('user');
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        const token = localStorage.getItem('token') || (parsedUser && parsedUser.token);

        const headers = {};
        if (token) {
            headers.authorization = `Bearer ${token}`;
        }

        const response = await fetch('/api/upload-profile-image', {
            method: 'POST',
            credentials: 'include',
            headers,
            body: formData
        });

        if (response.ok) {
            const result = await response.json().catch(() => null);
            console.log('Profile image uploaded:', result);

            if (result) {
                const imageUrl =
                    result.imageUrl ||
                    result.profileImage ||
                    result.profileImageUrl ||
                    result.url ||
                    result.path;

                if (imageUrl) {
                    document.getElementById('profile-image').src = imageUrl;
                    persistProfileImage(imageUrl);
                }
            }
        } else {
            console.error('Failed to upload profile image');
        }
    } catch (error) {
        console.error('Error uploading profile image:', error);
    }
}

// Form Validation and Handling
function setupFormValidation() {
    const profileForm = document.getElementById('profile-edit-form');
    const saveBtn = document.getElementById('save-profile');

    if (profileForm && saveBtn) {
        // Real-time validation
        const inputs = profileForm.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', () => validateField(input));
            input.addEventListener('input', () => clearFieldError(input));
        });

        // Save profile
        saveBtn.addEventListener('click', handleProfileSave);
    }
}

function validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';

    switch (field.name) {
        case 'name':
            if (!value) {
                isValid = false;
                errorMessage = 'Name is required';
            } else if (value.length < 2) {
                isValid = false;
                errorMessage = 'Name must be at least 2 characters';
            }
            break;

        case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!value) {
                isValid = false;
                errorMessage = 'Email is required';
            } else if (!emailRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
            break;

        case 'bio':
            if (value.length > 500) {
                isValid = false;
                errorMessage = 'Bio must be less than 500 characters';
            }
            break;
    }

    if (!isValid) {
        showFieldError(field, errorMessage);
        return false;
    }

    return true;
}

function showFieldError(field, message) {
    clearFieldError(field);

    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;

    field.parentNode.appendChild(errorElement);
    field.classList.add('error');
}

function clearFieldError(field) {
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    field.classList.remove('error');
}

async function handleProfileSave() {
    const form = document.getElementById('profile-edit-form');
    const saveBtn = document.getElementById('save-profile');

    // Validate all fields
    const inputs = form.querySelectorAll('input, textarea');
    let isFormValid = true;

    inputs.forEach(input => {
        if (!validateField(input)) {
            isFormValid = false;
        }
    });

    if (!isFormValid) {
        showNotification('Please correct the errors in the form', 'error');
        return;
    }

    // Show loading state
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // Collect form data
        const formData = new FormData(form);
        const profileData = Object.fromEntries(formData.entries());

        // Send to server
        const response = await fetch('/api/update-profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(profileData)
        });

        if (response.ok) {
            const result = await response.json();

            // Update UI with new data
            updateProfileDisplay(profileData);

            // Close modal
            document.getElementById('edit-profile-modal').classList.remove('show');

            showNotification('Profile updated successfully!', 'success');
        } else {
            throw new Error('Failed to update profile');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Failed to update profile. Please try again.', 'error');
    } finally {
        // Reset button state
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
}

function updateProfileDisplay(data) {
    if (data.name) {
        document.getElementById('profile-name').textContent = data.name;
    }

    if (data.bio) {
        document.getElementById('profile-bio').textContent = data.bio;
    }

    // Update other profile elements as needed
}

// Goals Tracking System
function setupGoalsTracking() {
    const goalCheckboxes = document.querySelectorAll('.goal-checkbox input[type="checkbox"]');

    goalCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const goalItem = e.target.closest('.goal-item');
            updateGoalProgress(e.target.id, e.target.checked);

            // Add completion animation
            if (e.target.checked) {
                goalItem.classList.add('completed');
                showGoalCompletionAnimation(goalItem);
            } else {
                goalItem.classList.remove('completed');
            }
        });
    });
}

function updateGoalProgress(goalId, completed) {
    // Send goal progress to server
    fetch('/api/update-goal-progress', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            goalId: goalId,
            completed: completed
        })
    }).catch(error => {
        console.error('Error updating goal progress:', error);
    });
}

function showGoalCompletionAnimation(goalItem) {
    // Add celebration effect
    const celebration = document.createElement('div');
    celebration.className = 'goal-celebration';
    celebration.innerHTML = '🎉';

    goalItem.appendChild(celebration);

    setTimeout(() => {
        if (goalItem.contains(celebration)) {
            goalItem.removeChild(celebration);
        }
    }, 2000);
}

// Load User Profile Data
function loadUserProfile() {
    // First check if user is logged in using the existing user system
    const currentUser = window.currentUser || getUserData();

    if (!currentUser || !currentUser.name) {
        // User not logged in, redirect to login
        console.warn('User not logged in, redirecting to login page');
        setTimeout(() => {
            if (confirm('You need to login first. Redirect to login page?')) {
                window.location.href = '/elearning-assets/login.html';
            }
        }, 1000);
        return;
    }

    // Load from localStorage or API
    const userData = getUserData();

    if (userData) {
        updateProfileUI(userData);
    } else {
        // Load from server
        fetchProfileFromServer();
    }
}

function updateProfileUI(userData) {
    // Update profile information
    if (userData.name) {
        document.getElementById('profile-name').textContent = userData.name;
    }

    if (userData.role) {
        document.getElementById('user-level').textContent = userData.role;
    }

    if (userData.photo || userData.profileImage) {
        document.getElementById('profile-image').src = userData.photo || userData.profileImage;
    }

    // Update stats
    updateProfileStats(userData);
}

function updateProfileStats(userData) {
    // Update XP, join date, streak, etc.
    const totalXp = userData.xp || 2450;
    const joinDate = userData.joinDate || 'Jan 2024';
    const currentStreak = userData.streak || 7;

    document.getElementById('total-xp').textContent = totalXp.toLocaleString();
    document.getElementById('join-date').textContent = joinDate;
    document.getElementById('current-streak').textContent = currentStreak;
}

async function fetchProfileFromServer() {
    try {
        const response = await fetch('/api/profile', {
            credentials: 'include'
        });

        if (response.ok) {
            const profileData = await response.json();
            updateProfileUI(profileData);

            // Cache in localStorage
            localStorage.setItem('userProfile', JSON.stringify(profileData));
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Load Profile Data for Tabs
function loadProfileData() {
    // Load overview stats
    loadOverviewStats();

    // Load initial tab data
    loadTabData('overview');
}

async function loadOverviewStats() {
    try {
        const response = await fetch('/api/profile/stats', {
            credentials: 'include'
        });

        if (response.ok) {
            const stats = await response.json();
            updateOverviewStats(stats);
        }
    } catch (error) {
        console.error('Error loading overview stats:', error);
        // Use mock data for demo
        updateOverviewStats({
            coursesCompleted: 12,
            certifications: 3,
            studyHours: 156,
            connections: 24
        });
    }
}

function updateOverviewStats(stats) {
    document.getElementById('total-courses').textContent = stats.coursesCompleted || 12;
    document.getElementById('certificates').textContent = stats.certifications || 3;
    document.getElementById('study-hours').textContent = stats.studyHours || 156;
    document.getElementById('connections').textContent = stats.connections || 24;
}

// Tab-specific data loading functions
async function loadUserAchievements() {
    const container = document.getElementById('user-badges');

    if (!container) return;

    try {
        const response = await fetch('/api/profile/achievements', {
            credentials: 'include'
        });

        if (response.ok) {
            const achievements = await response.json();
            renderAchievements(achievements);
        } else {
            // Show placeholder
            container.innerHTML = `
                <div class="badge-placeholder">
                    <i class="fas fa-medal"></i>
                    <p>Achievements will be loaded here</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading achievements:', error);
        container.innerHTML = `
            <div class="badge-placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load achievements</p>
            </div>
        `;
    }
}

function renderAchievements(achievements) {
    const container = document.getElementById('user-badges');

    if (achievements.length === 0) {
        container.innerHTML = `
            <div class="badge-placeholder">
                <i class="fas fa-medal"></i>
                <p>No achievements yet. Keep learning!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = achievements.map(achievement => `
        <div class="badge-card">
            <div class="badge-icon">
                <i class="${achievement.icon}"></i>
            </div>
            <div class="badge-content">
                <h4>${achievement.title}</h4>
                <p>${achievement.description}</p>
                <div class="badge-meta">
                    <span class="badge-date">${new Date(achievement.dateEarned).toLocaleDateString()}</span>
                    <span class="badge-rarity ${achievement.rarity}">${achievement.rarity}</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadActivityTimeline() {
    const container = document.getElementById('activity-timeline');

    if (!container) return;

    try {
        const response = await fetch('/api/profile/activity', {
            credentials: 'include'
        });

        if (response.ok) {
            const activities = await response.json();
            renderActivityTimeline(activities);
        } else {
            container.innerHTML = `
                <div class="timeline-placeholder">
                    <i class="fas fa-history"></i>
                    <p>Activity timeline will be loaded here</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading activity:', error);
        container.innerHTML = `
            <div class="timeline-placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load activity timeline</p>
            </div>
        `;
    }
}

function renderActivityTimeline(activities) {
    const container = document.getElementById('activity-timeline');

    if (activities.length === 0) {
        container.innerHTML = `
            <div class="timeline-placeholder">
                <i class="fas fa-history"></i>
                <p>No recent activity</p>
            </div>
        `;
        return;
    }

    container.innerHTML = activities.map(activity => `
        <div class="timeline-item">
            <div class="timeline-icon ${activity.type}">
                <i class="${activity.icon}"></i>
            </div>
            <div class="timeline-content">
                <h4>${activity.title}</h4>
                <p>${activity.description}</p>
                <div class="timeline-time">${new Date(activity.timestamp).toLocaleDateString()}</div>
            </div>
        </div>
    `).join('');
}

async function loadEnrolledCourses() {
    const container = document.getElementById('enrolled-courses');

    if (!container) return;

    try {
        const response = await fetch('/api/profile/courses', {
            credentials: 'include'
        });

        if (response.ok) {
            const courses = await response.json();
            renderEnrolledCourses(courses);
        } else {
            container.innerHTML = `
                <div class="course-placeholder">
                    <i class="fas fa-book"></i>
                    <p>Enrolled courses will be loaded here</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        container.innerHTML = `
            <div class="course-placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load enrolled courses</p>
            </div>
        `;
    }
}

function renderEnrolledCourses(courses) {
    const container = document.getElementById('enrolled-courses');

    if (courses.length === 0) {
        container.innerHTML = `
            <div class="course-placeholder">
                <i class="fas fa-book"></i>
                <p>No courses enrolled yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = courses.map(course => `
        <div class="course-card">
            <div class="course-thumbnail">
                <img src="${course.thumbnail}" alt="${course.title}" onerror="this.src='/elearning-assets/images/default-course.jpg'">
            </div>
            <div class="course-info">
                <h4>${course.title}</h4>
                <p>${course.description}</p>
                <div class="course-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${course.progress}%"></div>
                    </div>
                    <span>${course.progress}% Complete</span>
                </div>
                <div class="course-meta">
                    <span><i class="fas fa-clock"></i> ${course.duration}</span>
                    <span><i class="fas fa-star"></i> ${course.rating}</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadSocialStats() {
    try {
        const response = await fetch('/api/profile/social', {
            credentials: 'include'
        });

        if (response.ok) {
            const socialData = await response.json();
            updateSocialStats(socialData);
        }
    } catch (error) {
        console.error('Error loading social stats:', error);
        // Use mock data
        updateSocialStats({
            followers: 0,
            following: 0,
            discussions: 0
        });
    }
}

function updateSocialStats(data) {
    document.getElementById('followers-count').textContent = data.followers || 0;
    document.getElementById('following-count').textContent = data.following || 0;
    document.getElementById('discussions-count').textContent = data.discussions || 0;
}

// Edit Profile Modal Functions
function openEditProfileModal() {
    const modal = document.getElementById('edit-profile-modal');
    const userData = getUserData();

    if (userData) {
        // Populate form with current data
        document.getElementById('edit-name').value = userData.name || '';
        document.getElementById('edit-email').value = userData.email || '';
        document.getElementById('edit-bio').value = userData.bio || '';
        document.getElementById('edit-location').value = userData.location || '';
        document.getElementById('edit-company').value = userData.company || '';
    }

    modal.classList.add('show');
}

function shareProfile() {
    const profileUrl = window.location.href;

    if (navigator.share) {
        navigator.share({
            title: 'My BIM Learning Profile',
            text: 'Check out my BIM learning progress and achievements!',
            url: profileUrl
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(profileUrl).then(() => {
            showNotification('Profile link copied to clipboard!', 'success');
        }).catch(() => {
            showNotification('Unable to copy link. URL: ' + profileUrl, 'info');
        });
    }
}

function openSettingsModal() {
    // For now, just show a notification
    showNotification('Settings panel coming soon!', 'info');
}

// Utility Functions - Synchronized with existing user system
function getUserData() {
    // Use the same data sources as user.js system
    try {
        // First try the main user object from user.js
        const userData = localStorage.getItem('user');
        if (userData) {
            const parsed = JSON.parse(userData);
            if (parsed && typeof parsed === 'object' && !parsed.photo) {
                const storedImage = localStorage.getItem('userimg');
                if (storedImage) {
                    parsed.photo = storedImage;
                }
            }
            return parsed;
        }

        // Fallback to individual localStorage keys used by the system
        const username = localStorage.getItem('username');
        const role = localStorage.getItem('role');
        const userimg = localStorage.getItem('userimg');
        const email = localStorage.getItem('email');
        const token = localStorage.getItem('token');

        if (username) {
            return {
                name: username,
                role: role || 'Student',
                photo: userimg || '/img/user-default.png',
                email: email || '',
                token: token || ''
            };
        }

        // Last fallback to currentUser if set by user.js
        return window.currentUser || {};
    } catch (error) {
        console.error('Error getting user data:', error);
        return {};
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);

    // Hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

// Export functions for use by other modules
window.profileSystem = {
    updateProfile: updateProfileUI,
    loadAchievements: loadUserAchievements,
    loadActivity: loadActivityTimeline,
    showNotification: showNotification
};
