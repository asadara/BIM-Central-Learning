// badges.js - Badge Management System

// Badge data structure
const badgeData = {
    'first-course': {
        title: 'Langkah Pertama',
        description: 'Selesaikan materi pertama Anda',
        icon: 'fas fa-play-circle',
        requirements: ['Selesaikan satu materi apa pun'],
        category: 'learning',
        points: 10
    },
    'course-master': {
        title: 'Master Materi',
        description: 'Selesaikan 5 materi',
        icon: 'fas fa-books',
        requirements: ['Selesaikan 5 materi yang berbeda'],
        category: 'learning',
        points: 50
    },
    'knowledge-seeker': {
        title: 'Penjelajah Pengetahuan',
        description: 'Tuntaskan semua materi dalam satu kategori',
        icon: 'fas fa-search',
        requirements: ['Selesaikan semua materi dalam satu kategori'],
        category: 'learning',
        points: 75
    },
    'practice-starter': {
        title: 'Awal Latihan',
        description: 'Selesaikan 10 soal latihan',
        icon: 'fas fa-play',
        requirements: ['Selesaikan 10 soal latihan'],
        category: 'practice',
        points: 15
    },
    'accuracy-expert': {
        title: 'Akurasi Tinggi',
        description: 'Capai akurasi 90% dalam latihan',
        icon: 'fas fa-bullseye',
        requirements: ['Capai akurasi 90% atau lebih pada soal latihan'],
        category: 'practice',
        points: 40
    },
    'speed-demon': {
        title: 'Cepat Tuntas',
        description: 'Selesaikan 50 soal dalam waktu singkat',
        icon: 'fas fa-bolt',
        requirements: ['Selesaikan 50 soal latihan dalam batas waktu'],
        category: 'practice',
        points: 30
    },
    'exam-ready': {
        title: 'Siap Ujian',
        description: 'Lulus ujian formal pertama Anda',
        icon: 'fas fa-check-circle',
        requirements: ['Lulus satu ujian formal'],
        category: 'exam',
        points: 100
    },
    'high-achiever': {
        title: 'Prestasi Tinggi',
        description: 'Raih nilai 95% atau lebih pada ujian',
        icon: 'fas fa-star',
        requirements: ['Raih nilai 95% atau lebih pada satu ujian'],
        category: 'exam',
        points: 150
    },
    'certification-master': {
        title: 'Master Sertifikasi',
        description: 'Raih semua sertifikasi yang tersedia',
        icon: 'fas fa-crown',
        requirements: ['Raih seluruh sertifikasi untuk level Anda'],
        category: 'exam',
        points: 200
    },
    'early-bird': {
        title: 'Rajin Pagi',
        description: 'Selesaikan aktivitas sebelum pukul 08.00',
        icon: 'fas fa-sun',
        requirements: ['Selesaikan aktivitas belajar sebelum pukul 08.00 pada 5 hari berbeda'],
        category: 'special',
        points: 25
    },
    'streak-master': {
        title: 'Master Streak',
        description: 'Pertahankan streak belajar 7 hari',
        icon: 'fas fa-fire',
        requirements: ['Selesaikan aktivitas belajar selama 7 hari berturut-turut'],
        category: 'special',
        points: 60
    },
    'bim-legend': {
        title: 'Legenda BIM',
        description: 'Capai level BIM Manager',
        icon: 'fas fa-building',
        requirements: ['Capai status BIM Manager'],
        category: 'special',
        points: 500
    }
};

// User badge progress (would normally come from server)
let userBadgeProgress = {
    'first-course': { earned: false, progress: 0, total: 1 },
    'course-master': { earned: false, progress: 2, total: 5 },
    'knowledge-seeker': { earned: false, progress: 0, total: 1 },
    'practice-starter': { earned: false, progress: 7, total: 10 },
    'accuracy-expert': { earned: false, progress: 85, total: 90 },
    'speed-demon': { earned: false, progress: 23, total: 50 },
    'exam-ready': { earned: false, progress: 0, total: 1 },
    'high-achiever': { earned: false, progress: 0, total: 1 },
    'certification-master': { earned: false, progress: 0, total: 1 },
    'early-bird': { earned: false, progress: 2, total: 5 },
    'streak-master': { earned: false, progress: 3, total: 7 },
    'bim-legend': { earned: false, progress: 0, total: 1 }
};

function translateBadgeCategory(category) {
    const labels = {
        learning: 'belajar',
        practice: 'latihan',
        exam: 'ujian',
        special: 'khusus'
    };

    return labels[category] || category;
}

// Initialize badges page
document.addEventListener('DOMContentLoaded', function () {
    loadUserData();
    updateBadgeStats();
    updateProgressBar();
    renderBadges();
    setupBadgeModal();
    setupCardInteractions();
    setupAchievementEffects();
});

function loadUserData() {
    const userData = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (userData.name) {
        document.getElementById('user-name').textContent = userData.name;
        document.getElementById('user-role').textContent = userData.role || 'Student';
        document.getElementById('user-level').textContent = userData.level || 'BIM Modeller';

        if (userData.profileImage) {
            document.getElementById('user-img').src = userData.profileImage;
        }
    }
}

function updateBadgeStats() {
    const earnedBadges = Object.values(userBadgeProgress).filter(badge => badge.earned).length;
    const totalBadges = Object.keys(badgeData).length;
    const completionRate = Math.round((earnedBadges / totalBadges) * 100);

    document.getElementById('earned-badges').textContent = earnedBadges;
    document.getElementById('available-badges').textContent = totalBadges;
    document.getElementById('completion-rate').textContent = completionRate + '%';
}

function renderBadges() {
    Object.keys(badgeData).forEach(badgeId => {
        const badgeElement = document.querySelector(`[data-badge="${badgeId}"]`);
        if (badgeElement) {
            const progress = userBadgeProgress[badgeId];
            const badge = badgeData[badgeId];

            // Update badge status
            if (progress.earned) {
                badgeElement.classList.remove('locked');
                badgeElement.classList.add('earned');
                badgeElement.querySelector('.badge-status').textContent = 'Diraih';
                badgeElement.querySelector('.badge-status').className = 'badge-status earned';
            } else if (progress.progress > 0) {
                badgeElement.classList.remove('locked');
                badgeElement.classList.add('in-progress');
                badgeElement.querySelector('.badge-status').textContent = 'Sedang Proses';
                badgeElement.querySelector('.badge-status').className = 'badge-status in-progress';
            }

            // Add click event for badge details
            badgeElement.addEventListener('click', () => showBadgeModal(badgeId));
        }
    });
}

function setupBadgeModal() {
    const modal = document.getElementById('badge-modal');
    const closeBtn = document.querySelector('.close-modal');

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function showBadgeModal(badgeId) {
    const badge = badgeData[badgeId];
    const progress = userBadgeProgress[badgeId];
    const modal = document.getElementById('badge-modal');

    // Update modal content
    document.getElementById('modal-badge-icon').className = badge.icon;
    document.getElementById('modal-badge-title').textContent = badge.title;
    document.getElementById('modal-badge-description').textContent = badge.description;

    // Update requirements
    const requirementsList = document.getElementById('modal-badge-requirements');
    requirementsList.innerHTML = '';
    badge.requirements.forEach(req => {
        const li = document.createElement('li');
        li.textContent = req;
        requirementsList.appendChild(li);
    });

    // Update progress
    const progressPercentage = Math.round((progress.progress / progress.total) * 100);
    document.getElementById('modal-badge-progress').style.width = progressPercentage + '%';
    document.getElementById('modal-progress-text').textContent = `${progress.progress}/${progress.total} selesai`;

    // Show modal
    modal.style.display = 'block';
}

// Simulate badge progress updates (would normally come from server events)
function updateBadgeProgress(badgeId, newProgress) {
    if (userBadgeProgress[badgeId]) {
        userBadgeProgress[badgeId].progress = newProgress;

        // Check if badge is earned
        if (newProgress >= userBadgeProgress[badgeId].total) {
            userBadgeProgress[badgeId].earned = true;
            showBadgeEarnedNotification(badgeId);
        }

        updateBadgeStats();
        renderBadges();
    }
}

function showBadgeEarnedNotification(badgeId) {
    const badge = badgeData[badgeId];

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'badge-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="${badge.icon}"></i>
            <h3>Lencana Diraih!</h3>
            <p>${badge.title}</p>
            <small>+${badge.points} poin</small>
        </div>
    `;

    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// New enhanced functions for the user-friendly badges page
function updateProgressBar() {
    const earnedBadges = Object.values(userBadgeProgress).filter(badge => badge.earned).length;
    const totalBadges = Object.keys(badgeData).length;
    const completionRate = (earnedBadges / totalBadges) * 100;

    // Update overall progress bar
    document.getElementById('overall-progress').style.width = completionRate + '%';
    document.getElementById('progress-text').textContent = `${earnedBadges} dari ${totalBadges} lencana telah diraih`;

    // Update milestone markers
    updateMilestones(completionRate);

    // Update streak counter (simulated)
    const currentStreak = Math.floor(Math.random() * 7) + 1; // Simulate streak
    document.getElementById('current-streak').textContent = currentStreak;
}

function updateMilestones(completionRate) {
    const milestones = document.querySelectorAll('.milestone');
    milestones.forEach(milestone => {
        const threshold = parseInt(milestone.dataset.threshold);
        if (completionRate >= threshold) {
            milestone.classList.add('active');
        } else {
            milestone.classList.remove('active');
        }
    });
}

function setupCardInteractions() {
    const badgeCards = document.querySelectorAll('.badge-card');

    badgeCards.forEach(card => {
        const badgeId = card.dataset.badge;
        const front = card.querySelector('.badge-front');
        const back = card.querySelector('.badge-back');

        // 3D flip effect on hover
        card.addEventListener('mouseenter', () => {
            if (!card.classList.contains('locked')) {
                front.style.transform = 'rotateY(180deg)';
                back.style.transform = 'rotateY(0deg)';
            }
        });

        card.addEventListener('mouseleave', () => {
            front.style.transform = 'rotateY(0deg)';
            back.style.transform = 'rotateY(180deg)';
        });

        // Click to show modal
        card.addEventListener('click', (e) => {
            if (e.target.closest('.badge-status') || e.target.closest('.badge-front') || e.target.closest('.badge-back')) {
                showBadgeModal(badgeId);
            }
        });

        // Update progress ring
        updateProgressRing(card, badgeId);
    });
}

function updateProgressRing(card, badgeId) {
    const progress = userBadgeProgress[badgeId];
    const progressRing = card.querySelector('.progress-ring');
    const progressText = card.querySelector('.progress-text');

    if (progressRing && progressText) {
        const percentage = Math.round((progress.progress / progress.total) * 100);
        const circumference = 2 * Math.PI * 36; // radius = 36
        const strokeDasharray = circumference;
        const strokeDashoffset = circumference - (percentage / 100) * circumference;

        // Update the progress ring (would need CSS variables or direct style manipulation)
        progressText.textContent = percentage + '%';

        // Add earned state styling
        if (progress.earned) {
            progressRing.style.background = 'conic-gradient(var(--main-color) 0deg, var(--main-color) 360deg)';
        }
    }
}

function setupAchievementEffects() {
    // Add celebration effects for newly earned badges
    const earnedCards = document.querySelectorAll('.badge-card:not(.locked)');

    earnedCards.forEach(card => {
        const badgeId = card.dataset.badge;
        const progress = userBadgeProgress[badgeId];

        if (progress.earned) {
            addCelebrationEffect(card);
        }
    });

    // Add sparkle effects to locked cards
    const lockedCards = document.querySelectorAll('.badge-card.locked');
    lockedCards.forEach(card => {
        addSparkleEffect(card);
    });
}

function addCelebrationEffect(card) {
    const glow = card.querySelector('.badge-glow');
    if (glow) {
        glow.style.animation = 'pulse 2s infinite';
    }

    // Add confetti effect (simplified)
    setTimeout(() => {
        createConfetti(card);
    }, 500);
}

function addSparkleEffect(card) {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle-effect';
    sparkle.innerHTML = '✨';
    sparkle.style.cssText = `
        position: absolute;
        top: -10px;
        right: -10px;
        font-size: 20px;
        animation: sparkle 3s infinite;
        pointer-events: none;
    `;

    card.style.position = 'relative';
    card.appendChild(sparkle);

    // Remove sparkle after animation
    setTimeout(() => {
        if (card.contains(sparkle)) {
            card.removeChild(sparkle);
        }
    }, 3000);
}

function createConfetti(card) {
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.cssText = `
                position: absolute;
                width: 8px;
                height: 8px;
                background: ${['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'][Math.floor(Math.random() * 5)]};
                border-radius: 50%;
                top: ${Math.random() * 100}%;
                left: ${Math.random() * 100}%;
                animation: confetti-fall 1s ease-out forwards;
                pointer-events: none;
                z-index: 1000;
            `;

            card.appendChild(confetti);

            setTimeout(() => {
                if (card.contains(confetti)) {
                    card.removeChild(confetti);
                }
            }, 1000);
        }, i * 100);
    }
}

// Enhanced badge modal with animations
function showBadgeModal(badgeId) {
    const badge = badgeData[badgeId];
    const progress = userBadgeProgress[badgeId];
    const modal = document.getElementById('badge-modal');

    if (!modal) return;

    // Update modal content with enhanced styling
    const modalIcon = document.getElementById('modal-badge-icon');
    const modalTitle = document.getElementById('modal-badge-title');
    const modalDesc = document.getElementById('modal-badge-description');

    if (modalIcon) modalIcon.className = `${badge.icon} modal-badge-icon-large`;
    if (modalTitle) modalTitle.textContent = badge.title;
    if (modalDesc) modalDesc.textContent = badge.description;

    // Update requirements with enhanced styling
    const requirementsList = document.getElementById('modal-badge-requirements');
    if (requirementsList) {
        requirementsList.innerHTML = '';
        badge.requirements.forEach(req => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fas fa-check-circle"></i> ${req}`;
            requirementsList.appendChild(li);
        });
    }

    // Update progress with animation
    const progressFill = document.getElementById('modal-badge-progress');
    const progressText = document.getElementById('modal-progress-text');

    if (progressFill && progressText) {
        const progressPercentage = Math.round((progress.progress / progress.total) * 100);
        progressFill.style.width = '0%';
        progressText.textContent = `${progress.progress}/${progress.total} completed`;

        // Animate progress bar
        setTimeout(() => {
            progressFill.style.transition = 'width 1s ease-in-out';
            progressFill.style.width = progressPercentage + '%';
        }, 300);
    }

    // Show modal with animation
    modal.classList.add('show');

    // Add badge earned celebration if applicable
    if (progress.earned) {
        setTimeout(() => {
            showBadgeEarnedNotification(badgeId);
        }, 1000);
    }
}

// Enhanced notification system
function showBadgeEarnedNotification(badgeId) {
    const badge = badgeData[badgeId];

    // Create enhanced notification
    const notification = document.createElement('div');
    notification.className = 'badge-notification enhanced';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                <i class="${badge.icon}"></i>
            </div>
            <div class="notification-text">
                <h3>Lencana Diraih!</h3>
                <p><strong>${badge.title}</strong></p>
                <small>+${badge.points} XP • kategori ${translateBadgeCategory(badge.category)}</small>
            </div>
            <div class="notification-sparkles">
                ✨ ✨ ✨
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // Add sound effect (simulated)
    playAchievementSound();

    // Show notification with animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Hide notification after 4 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 500);
    }, 4000);
}

function playAchievementSound() {
    // Simulate achievement sound (would use Web Audio API in real implementation)
    console.log('🎵 Achievement unlocked sound!');
}

// Category filtering functionality
function setupCategoryFilters() {
    const categoryHeaders = document.querySelectorAll('.category-header');

    categoryHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const category = header.closest('.badge-category');
            const badgesGrid = category.querySelector('.badges-grid');

            // Toggle category expansion
            category.classList.toggle('expanded');
            badgesGrid.style.display = category.classList.contains('expanded') ? 'grid' : 'none';
        });
    });
}

// Progress tracking simulation
function simulateProgressUpdates() {
    // Simulate real-time progress updates
    setInterval(() => {
        const randomBadge = Object.keys(userBadgeProgress)[Math.floor(Math.random() * Object.keys(userBadgeProgress).length)];
        const currentProgress = userBadgeProgress[randomBadge];

        if (!currentProgress.earned && currentProgress.progress < currentProgress.total) {
            const newProgress = Math.min(currentProgress.progress + Math.floor(Math.random() * 2), currentProgress.total);
            updateBadgeProgress(randomBadge, newProgress);
        }
    }, 30000); // Update every 30 seconds for demo purposes
}

// Initialize additional features
document.addEventListener('DOMContentLoaded', function () {
    // ... existing code ...

    setupCategoryFilters();
    simulateProgressUpdates(); // Remove in production
});

// Export functions for use by other modules
window.badgeSystem = {
    updateProgress: updateBadgeProgress,
    getBadgeProgress: () => userBadgeProgress,
    getBadgeData: () => badgeData,
    showBadgeModal: showBadgeModal,
    updateStats: updateBadgeStats
};
