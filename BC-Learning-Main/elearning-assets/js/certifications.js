// Certification system functionality
const certificationsData = {
    certificates: [],
    badges: [],
    inProgress: []
};

let currentTab = 'all';
let currentBadgeCategory = 'all';

document.addEventListener('DOMContentLoaded', async function () {
    setupEventListeners();
    initializeTabSystem();
    await loadCertificationData();
});

function getUserData() {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
}

function getUserIdentity(user) {
    if (!user) return '';
    return String(user.id || user.userId || user.email || user.username || user.name || '').trim();
}

async function fetchQuizStats(userIdentity) {
    if (!userIdentity) return null;

    try {
        const response = await fetch(`/api/elearning/quiz/user/${encodeURIComponent(userIdentity)}/stats`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.warn('Quiz stats unavailable:', error.message);
        return null;
    }
}

async function fetchCertificates(userIdentity) {
    if (!userIdentity) return [];

    try {
        const response = await fetch(`/api/elearning/certificate/${encodeURIComponent(userIdentity)}`);
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('Certificates unavailable:', error.message);
        return [];
    }
}

async function fetchProgress() {
    const token = localStorage.getItem('token') || '';
    if (!token) return null;

    try {
        const response = await fetch('/api/elearning/progress/me', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data && data.success ? data.progress : null;
    } catch (error) {
        console.warn('Progress unavailable:', error.message);
        return null;
    }
}

function addMonths(dateString, months) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;

    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result.toISOString();
}

function mapCertificateRow(row) {
    const issueDate = row.issuedAt || row.issueDate || new Date().toISOString();
    const expiryDate = row.expiryDate || addMonths(issueDate, 24) || issueDate;
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};

    const skillSeed = [];
    if (row.quizId) skillSeed.push(String(row.quizId).replace(/[-_]/g, ' '));
    if (metadata.quizName) skillSeed.push(metadata.quizName);

    return {
        id: row.id,
        title: row.title || 'Certificate',
        issuer: row.issuer || 'BC Learning Academy',
        issueDate,
        expiryDate,
        status: new Date(expiryDate).getTime() >= Date.now() ? 'active' : 'expired',
        score: Number.isFinite(Number(row.score)) ? Number(row.score) : 0,
        category: row.moduleId || row.quizId || 'Certification',
        skills: skillSeed.length > 0 ? skillSeed.slice(0, 3) : ['BIM Competency'],
        verificationUrl: row.url || row.certificateUrl || `${window.location.origin}/elearning-assets/certification.html?cert=${encodeURIComponent(row.id)}`,
        credlyUrl: null,
        image: '/img/user-default.png'
    };
}

function buildBadges(quizStats, certCount) {
    const badges = [];
    const totalAttempts = toInt(quizStats?.totalAttempts, 0);
    const highestScore = toInt(quizStats?.highestScore, 0);
    const examsPassed = toInt(quizStats?.examsPassed, 0);

    if (totalAttempts >= 1) {
        badges.push({
            id: 'badge-starter',
            name: 'Quiz Starter',
            description: 'Completed your first quiz attempt',
            category: 'achievement',
            earnedDate: new Date().toISOString(),
            icon: 'fas fa-rocket',
            color: '#06BBCC',
            rarity: 'common'
        });
    }

    if (totalAttempts >= 10) {
        badges.push({
            id: 'badge-consistent',
            name: 'Consistency',
            description: 'Completed at least 10 quiz attempts',
            category: 'milestone',
            earnedDate: new Date().toISOString(),
            icon: 'fas fa-calendar-check',
            color: '#10B981',
            rarity: 'rare'
        });
    }

    if (highestScore >= 90) {
        badges.push({
            id: 'badge-high-score',
            name: 'High Scorer',
            description: 'Reached 90%+ score',
            category: 'skill',
            earnedDate: new Date().toISOString(),
            icon: 'fas fa-star',
            color: '#F59E0B',
            rarity: 'uncommon'
        });
    }

    if (examsPassed >= 1) {
        badges.push({
            id: 'badge-exam-pass',
            name: 'Exam Passer',
            description: 'Passed at least one exam',
            category: 'achievement',
            earnedDate: new Date().toISOString(),
            icon: 'fas fa-clipboard-check',
            color: '#22C55E',
            rarity: 'uncommon'
        });
    }

    if (certCount >= 1) {
        badges.push({
            id: 'badge-certified',
            name: 'Certified Learner',
            description: 'Earned first certificate',
            category: 'milestone',
            earnedDate: new Date().toISOString(),
            icon: 'fas fa-certificate',
            color: '#8B5CF6',
            rarity: certCount >= 3 ? 'legendary' : 'rare'
        });
    }

    return badges;
}

function buildInProgress(quizStats, certCount, progress) {
    const attempts = toInt(quizStats?.totalAttempts, 0);
    const examsPassed = toInt(quizStats?.examsPassed, 0);
    const coursesCompleted = toInt(progress?.coursesCompleted, 0);

    return [
        {
            id: 'progress-cert-3',
            title: 'Certification Collector',
            progress: Math.min(100, Math.round((certCount / 3) * 100)),
            requirements: [
                { name: 'Earn 1 certificate', completed: certCount >= 1 },
                { name: 'Earn 2 certificates', completed: certCount >= 2 },
                { name: 'Earn 3 certificates', completed: certCount >= 3 }
            ],
            estimatedCompletion: new Date(Date.now() + (1000 * 60 * 60 * 24 * 30)).toISOString(),
            category: 'certification'
        },
        {
            id: 'progress-learning-path',
            title: 'Learning Path Mastery',
            progress: Math.min(100, Math.round(((coursesCompleted + examsPassed + attempts) / 20) * 100)),
            requirements: [
                { name: 'Complete 5 courses', completed: coursesCompleted >= 5 },
                { name: 'Pass 2 exams', completed: examsPassed >= 2 },
                { name: 'Finish 10 quizzes/practice', completed: attempts >= 10 }
            ],
            estimatedCompletion: new Date(Date.now() + (1000 * 60 * 60 * 24 * 45)).toISOString(),
            category: 'badge'
        }
    ];
}

async function loadCertificationData() {
    const user = getUserData();
    const identity = getUserIdentity(user);

    if (!identity) {
        certificationsData.certificates = [];
        certificationsData.badges = [];
        certificationsData.inProgress = [];
        updateOverviewStats(null, null);
        loadCertificates();
        loadBadges();
        loadInProgress();
        return;
    }

    const [certRows, quizStats, progress] = await Promise.all([
        fetchCertificates(identity),
        fetchQuizStats(identity),
        fetchProgress()
    ]);

    certificationsData.certificates = certRows.map(mapCertificateRow);
    certificationsData.badges = buildBadges(quizStats, certificationsData.certificates.length);
    certificationsData.inProgress = buildInProgress(quizStats, certificationsData.certificates.length, progress);

    updateOverviewStats(quizStats, progress);
    loadCertificates();
    loadBadges();
    loadInProgress();
}

function updateOverviewStats(quizStats, progress) {
    const totalCerts = certificationsData.certificates.filter((cert) => cert.status === 'active').length;
    const totalBadges = certificationsData.badges.length;

    const completedCourses = toInt(progress?.coursesCompleted, 0);
    const totalCourses = Math.max(completedCourses, 1);
    const completionRate = Math.round((completedCourses / totalCourses) * 100);

    const scores = certificationsData.certificates.map((cert) => toInt(cert.score, 0)).filter((score) => score > 0);
    const averageScore = scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : toInt(quizStats?.averageScore, 0);
    const skillScore = (averageScore / 100 * 5).toFixed(1);

    setText('total-certificates', totalCerts);
    setText('total-badges', totalBadges);
    setText('completion-rate', `${completionRate}%`);
    setText('skill-score', skillScore);
}

function loadCertificates() {
    const container = document.getElementById('certificates-container');
    if (!container) return;

    container.innerHTML = '';

    if (certificationsData.certificates.length === 0) {
        container.innerHTML = '<div class="no-results">No certificates earned yet. Complete your first exam to earn a certificate!</div>';
        return;
    }

    certificationsData.certificates.forEach((cert) => {
        container.appendChild(createCertificateCard(cert));
    });
}

function createCertificateCard(cert) {
    const card = document.createElement('div');
    card.className = 'certificate-card';

    const statusClass = cert.status === 'active' ? 'active' : 'expired';
    const daysUntilExpiry = Math.ceil((new Date(cert.expiryDate).getTime() - Date.now()) / 86400000);

    card.innerHTML = `
        <div class="cert-header">
            <div class="cert-badge ${statusClass}">
                <i class="fas fa-certificate"></i>
            </div>
            <div class="cert-status">
                <span class="status-text ${statusClass}">${cert.status.toUpperCase()}</span>
                ${daysUntilExpiry > 0 && daysUntilExpiry < 90 ? `<span class="expiry-warning">Expires in ${daysUntilExpiry} days</span>` : ''}
            </div>
        </div>
        <div class="cert-content">
            <h3>${escapeHtml(cert.title)}</h3>
            <p class="cert-issuer">Issued by ${escapeHtml(cert.issuer)}</p>
            <p class="cert-date">Earned on ${formatDate(cert.issueDate)}</p>
            <div class="cert-score">
                <span>Score: <strong>${toInt(cert.score, 0)}%</strong></span>
            </div>
            <div class="cert-skills">
                ${(cert.skills || []).slice(0, 3).map((skill) => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('')}
            </div>
        </div>
        <div class="cert-actions">
            <button class="btn secondary" onclick="viewCertificate('${escapeHtml(cert.id)}')"><i class="fas fa-eye"></i> View</button>
            <button class="btn secondary" onclick="downloadCertificate('${escapeHtml(cert.id)}')"><i class="fas fa-download"></i> Download</button>
            <button class="btn" onclick="shareCertificate('${escapeHtml(cert.id)}')"><i class="fas fa-share"></i> Share</button>
        </div>
    `;

    return card;
}

function loadBadges() {
    const container = document.getElementById('badges-container');
    if (!container) return;

    container.innerHTML = '';

    let filteredBadges = certificationsData.badges;
    if (currentBadgeCategory !== 'all') {
        filteredBadges = certificationsData.badges.filter((badge) => badge.category === currentBadgeCategory);
    }

    if (filteredBadges.length === 0) {
        container.innerHTML = '<div class="no-results">No badges found for this category.</div>';
        return;
    }

    filteredBadges.forEach((badge) => {
        container.appendChild(createBadgeCard(badge));
    });
}

function createBadgeCard(badge) {
    const card = document.createElement('div');
    card.className = `badge-card ${badge.rarity}`;

    card.innerHTML = `
        <div class="badge-icon" style="background-color: ${badge.color};">
            <i class="${badge.icon}"></i>
        </div>
        <div class="badge-content">
            <h4>${escapeHtml(badge.name)}</h4>
            <p>${escapeHtml(badge.description)}</p>
            <div class="badge-meta">
                <span class="badge-date">Earned ${formatDate(badge.earnedDate)}</span>
                <span class="badge-rarity ${badge.rarity}">${badge.rarity.toUpperCase()}</span>
            </div>
        </div>
        <div class="badge-actions">
            <button class="btn secondary" onclick="viewBadge('${badge.id}')"><i class="fas fa-info-circle"></i></button>
            <button class="btn secondary" onclick="shareBadge('${badge.id}')"><i class="fas fa-share"></i></button>
        </div>
    `;

    card.addEventListener('click', () => viewBadge(badge.id));
    return card;
}

function loadInProgress() {
    const container = document.getElementById('progress-container');
    if (!container) return;

    container.innerHTML = '';

    if (certificationsData.inProgress.length === 0) {
        container.innerHTML = '<div class="no-results">No certifications in progress. Start a new learning path!</div>';
        return;
    }

    certificationsData.inProgress.forEach((item) => {
        const completed = item.requirements.filter((req) => req.completed).length;
        const total = item.requirements.length;

        const card = document.createElement('div');
        card.className = 'progress-card';
        card.innerHTML = `
            <div class="progress-header">
                <h3>${escapeHtml(item.title)}</h3>
                <span class="progress-percentage">${item.progress}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${item.progress}%"></div>
            </div>
            <div class="progress-requirements">
                <h4>Requirements (${completed}/${total} completed):</h4>
                <ul>
                    ${item.requirements.map((req) => `
                        <li class="${req.completed ? 'completed' : 'pending'}">
                            <i class="fas fa-${req.completed ? 'check' : 'clock'}"></i>${escapeHtml(req.name)}
                        </li>
                    `).join('')}
                </ul>
            </div>
            <div class="progress-footer">
                <span class="estimated-completion"><i class="fas fa-calendar"></i>Estimated completion: ${formatDate(item.estimatedCompletion)}</span>
                <button class="btn" onclick="continueProgress('${item.id}')">Continue Learning</button>
            </div>
        `;

        container.appendChild(card);
    });
}

function initializeTabSystem() {
    showAllContent();
}

function setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach((button) => button.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            filterContent();
        });
    });

    document.querySelectorAll('.category-filter').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-filter').forEach((button) => button.classList.remove('active'));
            btn.classList.add('active');
            currentBadgeCategory = btn.dataset.category;
            loadBadges();
        });
    });

    document.querySelectorAll('.close-modal').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.target.closest('.modal').style.display = 'none';
        });
    });

    document.getElementById('verify-btn')?.addEventListener('click', verifyCertificate);
    document.getElementById('verify-certificates')?.addEventListener('click', () => {
        document.getElementById('verification-modal').style.display = 'flex';
    });

    document.getElementById('share-profile')?.addEventListener('click', () => {
        document.getElementById('share-modal').style.display = 'flex';
    });
}

function filterContent() {
    if (currentTab === 'all') {
        showAllContent();
    } else {
        showOnlySection(currentTab);
    }
}

function showAllContent() {
    document.getElementById('tab-certificates').style.display = 'block';
    document.getElementById('tab-badges').style.display = 'block';
    document.getElementById('tab-in-progress').style.display = 'block';
}

function showOnlySection(section) {
    document.getElementById('tab-certificates').style.display = 'none';
    document.getElementById('tab-badges').style.display = 'none';
    document.getElementById('tab-in-progress').style.display = 'none';

    const selected = document.getElementById(`tab-${section}`);
    if (selected) selected.style.display = 'block';
}

function viewCertificate(certId) {
    const cert = certificationsData.certificates.find((item) => item.id === certId);
    if (!cert) return;

    const preview = document.getElementById('certificate-preview');
    const details = document.getElementById('certificate-details');

    preview.innerHTML = `
        <div class="certificate-template">
            <div class="cert-border">
                <div class="cert-header-template">
                    <h2>BC Learning Academy</h2>
                    <h3>Certificate of Achievement</h3>
                </div>
                <div class="cert-body-template">
                    <p>This is to certify that</p>
                    <h1 class="recipient-name">${escapeHtml(getUserData()?.name || getUserData()?.username || 'Certificate Holder')}</h1>
                    <p>has successfully completed</p>
                    <h2 class="course-title">${escapeHtml(cert.title)}</h2>
                    <p>with a score of <strong>${toInt(cert.score, 0)}%</strong></p>
                    <div class="cert-details-template">
                        <div class="cert-date">Date: ${formatDate(cert.issueDate)}</div>
                        <div class="cert-id">Certificate ID: ${escapeHtml(cert.id)}</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    details.innerHTML = `
        <div class="cert-info">
            <h4>Certificate Information</h4>
            <div class="info-grid">
                <div class="info-item"><label>Certificate ID:</label><span>${escapeHtml(cert.id)}</span></div>
                <div class="info-item"><label>Issue Date:</label><span>${formatDate(cert.issueDate)}</span></div>
                <div class="info-item"><label>Expiry Date:</label><span>${formatDate(cert.expiryDate)}</span></div>
                <div class="info-item"><label>Score Achieved:</label><span>${toInt(cert.score, 0)}%</span></div>
                <div class="info-item"><label>Verification URL:</label><a href="${cert.verificationUrl}" target="_blank">${escapeHtml(cert.verificationUrl)}</a></div>
            </div>
            <div class="skills-covered">
                <h5>Skills Covered:</h5>
                <div class="skills-list">${(cert.skills || []).map((skill) => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('')}</div>
            </div>
        </div>
    `;

    document.getElementById('certificate-modal').style.display = 'flex';
}

function viewBadge(badgeId) {
    const badge = certificationsData.badges.find((item) => item.id === badgeId);
    if (!badge) return;

    const detail = document.getElementById('badge-detail');
    detail.innerHTML = `
        <div class="badge-detail-view">
            <div class="badge-display">
                <div class="badge-icon-large" style="background-color: ${badge.color};"><i class="${badge.icon}"></i></div>
                <div class="badge-rarity-indicator ${badge.rarity}">${badge.rarity.toUpperCase()}</div>
            </div>
            <div class="badge-info">
                <h3>${escapeHtml(badge.name)}</h3>
                <p>${escapeHtml(badge.description)}</p>
                <div class="badge-metadata">
                    <div class="meta-item"><label>Category:</label><span>${escapeHtml(badge.category)}</span></div>
                    <div class="meta-item"><label>Earned Date:</label><span>${formatDate(badge.earnedDate)}</span></div>
                    <div class="meta-item"><label>Rarity:</label><span class="rarity-${badge.rarity}">${escapeHtml(badge.rarity)}</span></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('badge-modal').style.display = 'flex';
}

function verifyCertificate() {
    const certId = document.getElementById('cert-id-input').value.trim();
    const resultDiv = document.getElementById('verification-result');

    if (!certId) {
        resultDiv.innerHTML = '<div class="verification-error">Please enter a certificate ID.</div>';
        return;
    }

    const cert = certificationsData.certificates.find((item) => String(item.id).toLowerCase() === certId.toLowerCase());
    if (!cert) {
        resultDiv.innerHTML = `
            <div class="verification-failed">
                <i class="fas fa-times-circle"></i>
                <h4>Certificate Not Found</h4>
                <p>The certificate ID "${escapeHtml(certId)}" could not be verified.</p>
            </div>
        `;
        return;
    }

    resultDiv.innerHTML = `
        <div class="verification-success">
            <i class="fas fa-check-circle"></i>
            <h4>Certificate Verified!</h4>
            <div class="verified-info">
                <p><strong>Title:</strong> ${escapeHtml(cert.title)}</p>
                <p><strong>Recipient:</strong> ${escapeHtml(getUserData()?.name || getUserData()?.username || 'Certificate Holder')}</p>
                <p><strong>Issue Date:</strong> ${formatDate(cert.issueDate)}</p>
                <p><strong>Status:</strong> ${cert.status.toUpperCase()}</p>
            </div>
        </div>
    `;
}

function downloadCertificate(certId) {
    const cert = certificationsData.certificates.find((item) => item.id === certId);
    if (!cert) return;
    if (cert.verificationUrl) {
        window.open(cert.verificationUrl, '_blank');
    }
}

function shareCertificate(certId) {
    const cert = certificationsData.certificates.find((item) => item.id === certId);
    if (!cert) return;

    const shareUrl = cert.verificationUrl || `${window.location.origin}/elearning-assets/certification.html?cert=${encodeURIComponent(certId)}`;

    if (navigator.share) {
        navigator.share({
            title: cert.title,
            text: `I just earned my ${cert.title} certificate!`,
            url: shareUrl
        });
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl);
        alert('Certificate link copied to clipboard!');
    }
}

function continueProgress(progressId) {
    const progress = certificationsData.inProgress.find((item) => item.id === progressId);
    if (!progress) return;

    if (progress.title.toLowerCase().includes('certification')) {
        window.location.href = '/elearning-assets/exams.html';
    } else {
        window.location.href = '/elearning-assets/dashboard.html';
    }
}

function shareBadge(badgeId) {
    const badge = certificationsData.badges.find((item) => item.id === badgeId);
    if (!badge) return;
    alert(`Badge shared: ${badge.name}`);
}

function shareToLinkedIn() {
    const certCount = certificationsData.certificates.length;
    const text = `I've earned ${certCount} professional certifications through BC Learning Academy!`;
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function copyProfileLink() {
    const user = getUserData() || {};
    const profileUrl = `${window.location.origin}/profile/${user.id || user.username || 'user'}`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(profileUrl);
        alert('Profile link copied to clipboard!');
    }
}

function generateResume() {
    alert('Resume generation feature is in preparation.');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function toInt(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return fallback;
    return Math.floor(number);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = String(value ?? '');
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
