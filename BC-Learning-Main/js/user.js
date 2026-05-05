// ✅ Fixed: JWT Token expiration check
function isTokenExpired(token) {
   if (!token) return true;

   try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
   } catch (error) {

      return true;
   }
}

// ✅ Fixed: Better error handling and data validation
function getUserData() {
   try {
      const userData = localStorage.getItem("user");
      if (!userData) return null;

      const parsed = JSON.parse(userData);
      // Validate essential fields
      if (!parsed || typeof parsed !== 'object') return null;

      // Check token expiration
      if (parsed.token && isTokenExpired(parsed.token)) {

         // Clear all user-related localStorage items
         localStorage.removeItem("user");
         localStorage.removeItem("username");
         localStorage.removeItem("email");
         localStorage.removeItem("role");
         localStorage.removeItem("userimg");
         localStorage.removeItem("token");
         return null;
      }

      return parsed;
   } catch (e) {

      localStorage.removeItem("user"); // Clean up corrupted data
      return null;
   }
}

// ✅ Fixed: Better data validation and error handling
function setUserData(data) {
   try {
      if (!data || typeof data !== 'object') {
         throw new Error('Invalid user data provided');
      }

      // Normalize data structure
      const normalizedData = {
         id: data.id || data.userId || data.sub || null,
         username: data.username || data.name || '',
         name: data.name || data.username || '',
         email: data.email || '',
         role: data.role || 'Student',
         level: data.level || data.bimLevel || data.bim_level || 'BIM Modeller',
         bimLevel: data.bimLevel || data.level || data.bim_level || 'BIM Modeller',
         organization: data.organization || '',
         photo: data.photo || data.image || data.img || '/img/user-default.png',
         token: data.token || ""
      };

      // Ensure consistent photo path across all sections
      if (normalizedData.photo && normalizedData.photo.includes('/elearning-assets/')) {
         // Convert elearning photo path to main site path for consistency
         normalizedData.photo = '/img/user-default.png';
      }

      localStorage.setItem("user", JSON.stringify(normalizedData));
      localStorage.setItem("username", normalizedData.name);
      localStorage.setItem("email", normalizedData.email);
      localStorage.setItem("role", normalizedData.role);
      localStorage.setItem("userimg", normalizedData.photo);
      localStorage.setItem("token", normalizedData.token);
      localStorage.removeItem("bcl_progress_sync_disabled");
      window.currentUser = normalizedData;
   } catch (error) {

   }
}

function clearStoredUserAuth() {
   localStorage.removeItem("user");
   localStorage.removeItem("username");
   localStorage.removeItem("email");
   localStorage.removeItem("role");
   localStorage.removeItem("userimg");
   localStorage.removeItem("token");
   localStorage.removeItem("bcl_progress_sync_hash");
   localStorage.removeItem("bcl_progress_sync_time");
   window.currentUser = null;
}

// ✅ Fixed: Improved UI update function with better error handling
async function updateUserUI() {
   // First check for regular JWT user data
   let user = getUserData();

   // If no regular user, check for admin session
   if (!user) {
      // Hindari probe session admin untuk guest murni agar tidak memunculkan 401 di console.
      const token = localStorage.getItem('token');
      const skipGlobalAdminProbe = window.BCL_SKIP_GLOBAL_ADMIN_SESSION_UI_PROBE === true;
      const isAdminPage =
         window.location.pathname.includes('/pages/sub/adminbcl') ||
         window.location.pathname.includes('/pages/sub/mapping-kompetensi');

      if (!skipGlobalAdminProbe && (token || isAdminPage)) {
         try {
            const adminResponse = await fetch('/api/admin/session', {
               credentials: 'include' // Include session cookies
            });

            if (adminResponse.ok) {
               const adminData = await adminResponse.json();
               if (adminData.authenticated && adminData.user) {
                  // Convert admin session to user-like object for UI compatibility
                  user = {
                     name: adminData.user.username || adminData.user.email,
                     email: adminData.user.email,
                     role: adminData.user.role || 'Administrator',
                     photo: '/img/user-default.png', // Admin avatar
                     isAdmin: true,
                     adminUser: adminData.user
                  };
               }
            }
         } catch (adminError) {
            // Continue with null user (guest mode)
         }
      }
   }

   // Standard navbar elements (used in main pages)
   const accountName = document.getElementById("account-name");
   const loginLink = document.getElementById("login-link");
   const logoutLink = document.getElementById("logout-link");
   const registerLink = document.getElementById("register-link");
   const dashboardLink = document.getElementById("dashboard-link");
   const profileLink = document.getElementById("profile-link");
   const adminToolsDivider = document.getElementById("admin-tools-divider");
   const competencyLink = document.getElementById("competency-link");
   const adminLink = document.getElementById("admin-link");

   // E-learning header elements (used in elearning-assets pages)
   const headerUserName = document.getElementById("header-user-name");
   const headerUserRole = document.getElementById("header-user-role");
   const headerUserImg = document.getElementById("header-user-img");
   const loggedInOptions = document.getElementById("logged-in-options");
   const guestOptions = document.getElementById("guest-options");

   if (!user) {
      // Not logged in - hide/show appropriate elements
      if (accountName) accountName.textContent = "Akun";
      if (loginLink) loginLink.hidden = false;
      if (logoutLink) logoutLink.hidden = true;
      if (registerLink) registerLink.hidden = false;
      if (dashboardLink) dashboardLink.hidden = true;
      if (profileLink) profileLink.hidden = true;
      if (adminToolsDivider) adminToolsDivider.hidden = true;
      if (competencyLink) competencyLink.hidden = true;
      if (adminLink) adminLink.hidden = true;

      // E-learning header elements
      if (headerUserName) headerUserName.textContent = "Guest";
      if (headerUserRole) headerUserRole.textContent = "visitor";
      if (loggedInOptions) loggedInOptions.style.display = "none";
      if (guestOptions) guestOptions.style.display = "block";

      return;
   }

   try {
      // Update standard navbar
      if (accountName) accountName.textContent = user.name || "Akun";
      if (loginLink) loginLink.hidden = true;
      if (logoutLink) logoutLink.hidden = false;
      if (registerLink) registerLink.hidden = true;
      if (dashboardLink) dashboardLink.hidden = false;
      if (profileLink) profileLink.hidden = false;
      if (adminToolsDivider) adminToolsDivider.hidden = true;
      if (competencyLink) competencyLink.hidden = true;
      if (adminLink) adminLink.hidden = true;

      // Update e-learning header elements
      if (headerUserName) headerUserName.textContent = user.name || "Guest";
      if (headerUserRole) headerUserRole.textContent = user.role || "student";
      if (headerUserImg) headerUserImg.src = user.photo || "/img/user-default.png";
      if (loggedInOptions) loggedInOptions.style.display = "block";
      if (guestOptions) guestOptions.style.display = "none";

      setupLogoutHandler(user);
      window.currentUser = user;

   } catch (error) {
      console.error('❌ Error updating user UI:', error);
   }
}

// Helper functions for cleaner code
function updateElement(id, text) {
   const element = document.getElementById(id);
   if (element) element.textContent = text || '';
}

function updateImageElement(id, src) {
   const element = document.getElementById(id);
   if (element) {
      element.src = src;
      element.onerror = () => element.src = "/img/user-default.png"; // Fallback
   }
}

function hideAuthButtons() {
   const loginLink = document.getElementById("login-link");
   const registerLink = document.getElementById("register-link");
   const logoutLink = document.getElementById("logout-link");
   const dashboardLink = document.getElementById("dashboard-link");
   const profileLink = document.getElementById("profile-link");

   if (loginLink) loginLink.hidden = true;
   if (registerLink) registerLink.hidden = true;
   if (logoutLink) logoutLink.hidden = false;
   if (dashboardLink) dashboardLink.hidden = false;
   if (profileLink) profileLink.hidden = false;
}

function showAuthButtons() {
   const loginLink = document.getElementById("login-link");
   const registerLink = document.getElementById("register-link");
   const logoutLink = document.getElementById("logout-link");
   const dashboardLink = document.getElementById("dashboard-link");
   const profileLink = document.getElementById("profile-link");

   if (loginLink) loginLink.hidden = false;
   if (registerLink) registerLink.hidden = false;
   if (logoutLink) logoutLink.hidden = true;
   if (dashboardLink) dashboardLink.hidden = true;
   if (profileLink) profileLink.hidden = true;
}

function setupLogoutHandler(user) {
   // Logout click is now handled by global delegation

   // Show admin panel for admin users
   const adminLink = document.getElementById("admin-link");
   const competencyLink = document.getElementById("competency-link");
   const adminToolsDivider = document.getElementById("admin-tools-divider");
   const isAdminUser = user.isAdmin || (user.role && user.role.toLowerCase() === "admin");

   if (isAdminUser) {
      if (adminToolsDivider) adminToolsDivider.hidden = false;
      if (adminLink) adminLink.hidden = false;
      if (competencyLink) competencyLink.hidden = false;
   } else {
      if (adminToolsDivider) adminToolsDivider.hidden = true;
      if (adminLink) adminLink.hidden = true;
      if (competencyLink) competencyLink.hidden = true;
   }
}

// Global delegated event listener for logout
document.addEventListener('click', (e) => {
    const logoutBtn = e.target.closest('#logout-link');
    if (logoutBtn) {
        e.preventDefault();
        handleLogout();
    }
});

async function handleLogout() {
   try {
      // 1. Clear local storage (Client-side JWT logout)
      localStorage.clear();
      window.currentUser = null;

      // 2. Call server logout (Server-side Session logout)
      // This is crucial if the user has an active Admin Session cookie
      try {
          await fetch('/api/admin/logout', {
              method: 'POST',
              credentials: 'include'
          });
       } catch (serverErr) {
       }

      // 3. Redirect to login page or refresh
      if (window.location.pathname !== "/pages/login.html") {
         window.location.href = "/pages/login.html";
      } else {
         window.location.reload();
      }
   } catch (error) {
      console.error('❌ Logout error:', error);
      // Force redirect even if there's an error
      window.location.href = "/pages/login.html";
   }
}

// ✅ Fixed: Improved login form handler with better error handling and fallback
function setupLoginForm() {
   const loginForm = document.getElementById("login-form");
   if (!loginForm) return;

   loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const email = document.getElementById("email")?.value.trim();
      const password = document.getElementById("password")?.value.trim();

      if (!email || !password) {
         alert("❌ Harap isi semua kolom!");
         return;
      }

      // Add loading state
      const submitButton = loginForm.querySelector('button[type="submit"]');
      const originalText = submitButton ? submitButton.textContent : '';
      if (submitButton) {
         submitButton.textContent = 'Logging in...';
         submitButton.disabled = true;
      }

      try {
         // Use relative URL for API calls (works with reverse proxy)
         let apiUrl = `/api/login`;

         let response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
         });

         // With reverse proxy, fallback attempts are not needed
         // All API calls go through the same origin

         const result = await response.json();

         if (response.ok && (result.success || result.token)) {
            const user = {
               name: result.name || result.username,
               email: result.email || email,
               role: result.role || result.bimLevel || "Student",
               photo: result.photo || "/img/user-default.png",
               token: result.token,
               bimLevel: result.bimLevel,
               organization: result.organization
            };
            setUserData(user);

            const lastPage = getPostLoginDestination("/elearning-assets/dashboard.html");
            alert("✅ Login berhasil!");
            window.location.href = lastPage;
         } else {
            alert("❌ Login gagal: " + (result.error || result.message || 'Unknown error'));
         }
      } catch (err) {
         console.error('❌ Login error:', err);

         // Provide more helpful error messages
         let errorMessage = "❌ Koneksi ke server gagal. ";

         if (err.message.includes('fetch')) {
            errorMessage += "Pastikan server backend sedang berjalan.";
         } else if (err.message.includes('NetworkError')) {
            errorMessage += "Periksa koneksi jaringan Anda.";
         } else {
            errorMessage += err.message;
         }

         alert(errorMessage);
      } finally {
         // Restore button state
         if (submitButton) {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
         }
      }
   });
}

// ✅ Fixed: Improved initialization with error handling
document.addEventListener("DOMContentLoaded", () => {
   try {
      window.currentUser = getUserData();

      updateUserUI();
      setupLoginForm();

      // Listen for component loading completion (for e-learning pages)
      document.addEventListener('componentsLoaded', () => {
         updateUserUI();
      });
   } catch (error) {
      console.error('❌ user.js: Failed to initialize user management system:', error);
   }
});

// ✅ NEW: Listen for storage changes to sync auth state across sections
window.addEventListener('storage', (e) => {
   if (e.key === 'user' || e.key === 'token' || e.key === 'username') {
      // Re-check user data and update UI
      window.currentUser = getUserData();
      updateUserUI();
   }
});

function bclMainParseJsonSafe(value, fallback) {
   try {
      if (!value) return fallback;
      return JSON.parse(value);
   } catch (error) {
      return fallback;
   }
}

function getPostLoginDestination(defaultPath = "/elearning-assets/dashboard.html") {
   const searchParams = new URLSearchParams(window.location.search);
   const redirectParam = searchParams.get("redirect");
   const authRedirectPage = localStorage.getItem("authRedirectPage");
   const lastPage = localStorage.getItem("lastPage");

   if (authRedirectPage) {
      localStorage.removeItem("authRedirectPage");
      return authRedirectPage;
   }

   if (redirectParam) {
      return redirectParam;
   }

   return lastPage || defaultPath;
}

window.getPostLoginDestination = getPostLoginDestination;

function bclMainToNonNegativeInt(value, fallback = 0) {
   const number = Number(value);
   if (!Number.isFinite(number) || number < 0) return fallback;
   return Math.floor(number);
}

function bclMainCountLearningMarkers(prefixes) {
   let total = 0;

   for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;

      if (prefixes.some((prefix) => key.startsWith(prefix))) {
         total += 1;
      }
   }

   return total;
}

function bclMainCollectProgressSnapshot() {
   const userData = bclMainParseJsonSafe(localStorage.getItem("userData"), {});
   const userProgress = userData && typeof userData.progress === "object" ? userData.progress : {};
   const practiceHistory = Array.isArray(userData.practiceHistory) ? userData.practiceHistory : [];
   const gamificationProgress = bclMainParseJsonSafe(localStorage.getItem("gamification_userProgress"), {});

   const coursesCompleted = Math.max(
      bclMainToNonNegativeInt(userProgress.coursesCompleted, 0),
      bclMainToNonNegativeInt(userData.coursesCompleted, 0),
      bclMainToNonNegativeInt(gamificationProgress.coursesCompleted, 0),
      bclMainCountLearningMarkers([
         "bcl_completed_",
         "bcl_video_completed_",
         "bcl_page_completed_"
      ])
   );

   const practiceAttempts = Math.max(
      bclMainToNonNegativeInt(userProgress.practiceAttempts, 0),
      bclMainToNonNegativeInt(userData.practiceAttempts, 0),
      practiceHistory.length
   );

   const examsPassed = Math.max(
      bclMainToNonNegativeInt(userProgress.examsPassed, 0),
      bclMainToNonNegativeInt(userData.examsPassed, 0),
      bclMainToNonNegativeInt(gamificationProgress.examsPassed, 0)
   );

   const certificatesEarned = Math.max(
      bclMainToNonNegativeInt(userProgress.certificatesEarned, 0),
      bclMainToNonNegativeInt(userData.certificatesEarned, 0),
      bclMainToNonNegativeInt(gamificationProgress.certificatesEarned, 0)
   );

   const currentLevel = String(
      userProgress.currentLevel ||
      userData.level ||
      localStorage.getItem("level") ||
      "BIM Modeller"
   ).trim();

   const toNextLevel = bclMainToNonNegativeInt(
      userProgress.toNextLevel ?? userData.toNextLevel ?? 0,
      0
   );

   return {
      coursesCompleted,
      practiceAttempts,
      examsPassed,
      certificatesEarned,
      currentLevel,
      toNextLevel
   };
}

function bclMainHasAnyProgress(snapshot) {
   if (!snapshot || typeof snapshot !== "object") return false;
   return (
      bclMainToNonNegativeInt(snapshot.coursesCompleted, 0) > 0 ||
      bclMainToNonNegativeInt(snapshot.practiceAttempts, 0) > 0 ||
      bclMainToNonNegativeInt(snapshot.examsPassed, 0) > 0 ||
      bclMainToNonNegativeInt(snapshot.certificatesEarned, 0) > 0
   );
}

function bclMainGetProgressSyncToken() {
   const user = getUserData();
   if (!user || user.isAdmin) return null;

   const token = String(user.token || localStorage.getItem("token") || "").trim();
   if (!token) return null;

   if (isTokenExpired(token)) {
      clearStoredUserAuth();
      return null;
   }

   if (user.token && user.token !== token) {
      return null;
   }

   return token;
}

async function bclMainSyncProgressToServer(force = false) {
   try {
      const token = bclMainGetProgressSyncToken();
      if (!token) return;

      const snapshot = bclMainCollectProgressSnapshot();
      if (!bclMainHasAnyProgress(snapshot) && !force) return;

      const hash = JSON.stringify(snapshot);
      const hashKey = "bcl_progress_sync_hash";
      const timeKey = "bcl_progress_sync_time";
      const previousHash = localStorage.getItem(hashKey);
      const previousTime = Number(localStorage.getItem(timeKey) || 0);
      const now = Date.now();

      if (!force && previousHash === hash && now - previousTime < 60000) {
         return;
      }

      const response = await fetch("/api/elearning/progress/sync", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
         },
         body: JSON.stringify(snapshot)
      });

      if (response.status === 401 || response.status === 403) {
         clearStoredUserAuth();
         localStorage.setItem("bcl_progress_sync_disabled", "1");
         if (typeof updateUserUI === "function") {
            await updateUserUI();
         }
         return;
      }

      if (response.ok) {
         localStorage.setItem(hashKey, hash);
         localStorage.setItem(timeKey, String(now));
         localStorage.removeItem("bcl_progress_sync_disabled");
         return;
      }

      throw new Error(`Progress sync failed (${response.status})`);
   } catch (error) {
   }
}

function bclMainInitializeProgressSync() {
   const token = bclMainGetProgressSyncToken();
   if (!token) return;

   setTimeout(() => {
      bclMainSyncProgressToServer(true);
   }, 1500);

   setInterval(() => {
      bclMainSyncProgressToServer(false);
   }, 60000);

   document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
         bclMainSyncProgressToServer(true);
      }
   });

   window.addEventListener("beforeunload", () => {
      bclMainSyncProgressToServer(true);
   });
}

const bclMainReadingCatalog = (() => {
   const groups = [
      {
         groupId: "bim-mindset",
         groupLabel: "BIM Mindset",
         pages: [
            { path: "/pages/bim-mindset.html", label: "BIM Mindset" }
         ]
      },
      {
         groupId: "bim-governance",
         groupLabel: "BIM Governance",
         pages: [
            { path: "/pages/regulasi-bim.html", label: "Regulasi BIM" },
            { path: "/pages/manajemen-informasi-validity.html", label: "Definisi dan Status Informasi" },
            { path: "/pages/manajemen-informasi-flow.html", label: "Alur Informasi Proyek" },
            { path: "/pages/manajemen-informasi-authority.html", label: "Otoritas dan Validasi Data" },
            { path: "/pages/manajemen-informasi-decision.html", label: "Informasi untuk Keputusan" },
            { path: "/pages/peran-role.html", label: "Peran dalam Sistem BIM" },
            { path: "/pages/peran-responsibility.html", label: "Batas Tanggung Jawab Informasi" },
            { path: "/pages/peran-authority.html", label: "Hak dan Kewenangan Keputusan" },
            { path: "/pages/peran-interface.html", label: "Koordinasi Antar Peran" },
            { path: "/pages/quality-gate.html", label: "Quality Gate Data BIM" },
            { path: "/pages/risk-impact.html", label: "Risiko Salah Pakai Informasi" },
            { path: "/pages/change-control.html", label: "Issue, RFI, dan Perubahan" },
            { path: "/pages/trace-lessons.html", label: "Audit Trail dan Lessons Learned" }
         ]
      },
      {
         groupId: "bim-delivery-workflow",
         groupLabel: "BIM Delivery Workflow",
         pages: [
            { path: "/pages/workflow-overview.html", label: "Peta Alur BIM" },
            { path: "/pages/workflow-standar.html", label: "Standar dan Aturan Main" },
            { path: "/pages/workflow-produksi.html", label: "Produksi Model" },
            { path: "/pages/workflow-koordinasi.html", label: "Koordinasi dan Integrasi" },
            { path: "/pages/workflow-simulasi.html", label: "Simulasi dan Analisis" },
            { path: "/pages/workflow-deliverables.html", label: "Dokumen Teknis" },
            { path: "/pages/workflow-tools.html", label: "Tools dan Workflow" }
         ]
      }
   ];

   const catalog = {};

   groups.forEach((group) => {
      const totalPages = group.pages.length;

      group.pages.forEach((page, index) => {
         const pagePath = String(page.path || "").trim().toLowerCase();
         const slug = pagePath.split("/").pop().replace(/\.html$/i, "");
         const nextPage = group.pages[index + 1] || null;

         catalog[pagePath] = {
            groupId: group.groupId,
            groupLabel: group.groupLabel,
            totalPages,
            order: index + 1,
            pageId: slug,
            pageLabel: page.label,
            pagePath,
            moduleId: `${group.groupId}__${slug}`,
            nextPath: nextPage ? nextPage.path : "",
            nextLabel: nextPage ? nextPage.label : ""
         };
      });
   });

   return catalog;
})();

function bclMainNormalizePathname(pathname) {
   return String(pathname || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/\/{2,}/g, "/")
      .toLowerCase();
}

function bclMainGetReadingConfig() {
   return bclMainReadingCatalog[bclMainNormalizePathname(window.location.pathname)] || null;
}

function bclMainGetReadingGroupProgress(groupId) {
   let completed = 0;
   let total = 0;

   Object.values(bclMainReadingCatalog).forEach((config) => {
      if (config.groupId !== groupId) return;
      total += 1;
      if (localStorage.getItem(`bcl_page_completed_${config.moduleId}`) === "1") {
         completed += 1;
      }
   });

   return { completed, total };
}

function bclMainAuthFetch(url, options = {}) {
   const token = bclMainGetProgressSyncToken();
   const headers = {
      ...(options.headers || {})
   };

   if (token) {
      headers.Authorization = `Bearer ${token}`;
   }

   return fetch(url, {
      ...options,
      headers
   });
}

async function bclMainTrackLearningActivity(payload) {
   const token = bclMainGetProgressSyncToken();
   if (!token) return false;

   try {
      const response = await bclMainAuthFetch("/api/elearning/activity/track", {
         method: "POST",
         headers: {
            "Content-Type": "application/json"
         },
         body: JSON.stringify(payload)
      });

      return response.ok;
   } catch (error) {
      return false;
   }
}

function bclMainInjectReadingTrackerStyles() {
   if (document.getElementById("bcl-reading-tracker-style")) return;

   const style = document.createElement("style");
   style.id = "bcl-reading-tracker-style";
   style.textContent = `
      .bcl-reading-tracker {
         position: fixed;
         right: 18px;
         bottom: 18px;
         z-index: 1080;
         width: min(360px, calc(100vw - 24px));
         background: rgba(255, 255, 255, 0.97);
         border: 1px solid rgba(24, 29, 56, 0.12);
         border-radius: 18px;
         box-shadow: 0 20px 50px rgba(24, 29, 56, 0.18);
         padding: 16px;
         backdrop-filter: blur(10px);
         opacity: 0;
         transform: translateY(18px);
         pointer-events: none;
         transition: opacity 0.22s ease, transform 0.22s ease;
      }

      .bcl-reading-tracker.is-visible {
         opacity: 1;
         transform: translateY(0);
         pointer-events: auto;
      }

      .bcl-reading-tracker__eyebrow {
         display: inline-flex;
         align-items: center;
         gap: 8px;
         font-size: 0.76rem;
         font-weight: 700;
         letter-spacing: 0.08em;
         text-transform: uppercase;
         color: #5b5fe8;
         margin-bottom: 10px;
      }

      .bcl-reading-tracker__title {
         margin: 0;
         font-size: 1.05rem;
         font-weight: 800;
         color: #181d38;
      }

      .bcl-reading-tracker__page {
         margin: 6px 0 12px;
         font-size: 0.92rem;
         color: #5f6480;
      }

      .bcl-reading-tracker__meta {
         display: flex;
         flex-wrap: wrap;
         gap: 8px;
         margin-bottom: 12px;
      }

      .bcl-reading-tracker__pill {
         display: inline-flex;
         align-items: center;
         justify-content: center;
         min-height: 30px;
         padding: 6px 10px;
         border-radius: 999px;
         font-size: 0.82rem;
         font-weight: 700;
         line-height: 1.2;
      }

      .bcl-reading-tracker__pill--neutral {
         background: #eef1ff;
         color: #4f46e5;
      }

      .bcl-reading-tracker__pill--success {
         background: #e7f8ef;
         color: #0f9f60;
      }

      .bcl-reading-tracker__button {
         width: 100%;
         border: none;
         border-radius: 12px;
         padding: 11px 14px;
         font-weight: 700;
         color: #ffffff;
         background: linear-gradient(135deg, #fb873f, #f26a1b);
         transition: transform 0.18s ease, opacity 0.18s ease;
      }

      .bcl-reading-tracker__button:disabled {
         opacity: 0.65;
         cursor: not-allowed;
      }

      .bcl-reading-tracker__button:not(:disabled):hover {
         transform: translateY(-1px);
      }

      .bcl-reading-tracker__topbar {
         display: flex;
         align-items: flex-start;
         justify-content: space-between;
         gap: 10px;
      }

      .bcl-reading-tracker__toggle {
         flex: 0 0 auto;
         width: 34px;
         height: 34px;
         border: none;
         border-radius: 10px;
         background: #eef1ff;
         color: #4f46e5;
         display: inline-flex;
         align-items: center;
         justify-content: center;
         font-size: 0.98rem;
         line-height: 1;
      }

      .bcl-reading-tracker__body {
         margin-top: 10px;
      }

      .bcl-reading-tracker__hint,
      .bcl-reading-tracker__next {
         margin: 10px 0 0;
         font-size: 0.82rem;
         color: #6b7280;
      }

      .bcl-reading-tracker__next a {
         color: #fb873f;
         font-weight: 700;
         text-decoration: none;
      }

      .bcl-reading-tracker__next a:hover {
         text-decoration: underline;
      }

      .bcl-reading-tracker.is-compact {
         width: min(260px, calc(100vw - 24px));
         padding: 12px 14px;
      }

      .bcl-reading-tracker.is-compact .bcl-reading-tracker__body {
         display: none;
      }

      .bcl-reading-tracker.is-compact .bcl-reading-tracker__title {
         font-size: 0.96rem;
      }

      .bcl-reading-tracker.is-compact .bcl-reading-tracker__page {
         margin: 4px 0 0;
         font-size: 0.8rem;
      }

      @media (max-width: 767.98px) {
         .bcl-reading-tracker {
            right: 12px;
            left: 12px;
            bottom: 12px;
            width: auto;
            padding: 14px;
         }
      }
   `;

   document.head.appendChild(style);
}

function bclMainInitReadingTracker() {
   const config = bclMainGetReadingConfig();
   if (!config || document.body.dataset.bclReadingTrackerReady === "1") return;

   document.body.dataset.bclReadingTrackerReady = "1";
   bclMainInjectReadingTrackerStyles();

   const title = document.querySelector("h1")?.textContent?.trim() || config.pageLabel;
   const sessionOpenKey = `bcl_page_session_opened_${config.moduleId}`;
   const localOpenKey = `bcl_page_opened_${config.moduleId}`;

   let scrolledEnough = false;
   let dwellReady = false;
   let saving = false;
   let hasBeenRevealed = false;
   let isCompact = false;

   const container = document.createElement("aside");
   container.className = "bcl-reading-tracker";
   container.innerHTML = `
      <div class="bcl-reading-tracker__topbar">
         <div>
            <div class="bcl-reading-tracker__eyebrow">
               <i class="fas fa-book-reader"></i>
               Materi Halaman
            </div>
            <h3 class="bcl-reading-tracker__title">${config.groupLabel}</h3>
            <p class="bcl-reading-tracker__page">${title}</p>
         </div>
         <button type="button" class="bcl-reading-tracker__toggle" data-reading-toggle aria-label="Kecilkan widget">
            <i class="fas fa-minus"></i>
         </button>
      </div>
      <div class="bcl-reading-tracker__body">
         <div class="bcl-reading-tracker__meta">
            <span class="bcl-reading-tracker__pill bcl-reading-tracker__pill--neutral" data-reading-progress></span>
            <span class="bcl-reading-tracker__pill" data-reading-status></span>
         </div>
         <button type="button" class="bcl-reading-tracker__button" data-reading-complete></button>
         <p class="bcl-reading-tracker__hint" data-reading-hint></p>
         <p class="bcl-reading-tracker__next" data-reading-next></p>
      </div>
   `;

   document.body.appendChild(container);

   const progressNode = container.querySelector("[data-reading-progress]");
   const statusNode = container.querySelector("[data-reading-status]");
   const buttonNode = container.querySelector("[data-reading-complete]");
   const hintNode = container.querySelector("[data-reading-hint]");
   const nextNode = container.querySelector("[data-reading-next]");
   const toggleNode = container.querySelector("[data-reading-toggle]");

   function updateReadingTrackerUi() {
      const groupProgress = bclMainGetReadingGroupProgress(config.groupId);
      const pageCompleted = localStorage.getItem(`bcl_page_completed_${config.moduleId}`) === "1";
      const tokenAvailable = Boolean(bclMainGetProgressSyncToken());
      const readyToComplete = scrolledEnough && dwellReady;

      container.classList.toggle("is-visible", hasBeenRevealed);
      container.classList.toggle("is-compact", isCompact);
      toggleNode.innerHTML = `<i class="fas fa-${isCompact ? "plus" : "minus"}"></i>`;
      toggleNode.setAttribute("aria-label", isCompact ? "Perbesar widget" : "Kecilkan widget");

      progressNode.textContent = `${groupProgress.completed}/${groupProgress.total} halaman selesai`;
      statusNode.className = `bcl-reading-tracker__pill ${pageCompleted ? "bcl-reading-tracker__pill--success" : "bcl-reading-tracker__pill--neutral"}`;
      statusNode.textContent = pageCompleted ? "Sudah selesai" : readyToComplete ? "Siap ditandai" : "Belum selesai";

      if (pageCompleted) {
         buttonNode.disabled = true;
         buttonNode.textContent = "Materi sudah selesai dipelajari";
         hintNode.textContent = "Status halaman ini sudah masuk ke progres belajar Anda.";
      } else if (!tokenAvailable) {
         buttonNode.disabled = !readyToComplete;
         buttonNode.textContent = readyToComplete ? "Masuk untuk simpan progres" : "Baca sampai akhir untuk aktifkan";
         hintNode.textContent = readyToComplete
            ? "Masuk terlebih dahulu agar progres halaman ini tercatat di dashboard."
            : "Tombol aktif setelah Anda membaca sampai bagian akhir dan minimal 20 detik.";
      } else if (saving) {
         buttonNode.disabled = true;
         buttonNode.textContent = "Menyimpan progres...";
         hintNode.textContent = "Mohon tunggu, progres halaman sedang dikirim ke dashboard.";
      } else {
         buttonNode.disabled = !readyToComplete;
         buttonNode.textContent = readyToComplete ? "Tandai selesai dipelajari" : "Baca sampai akhir untuk aktifkan";
         hintNode.textContent = readyToComplete
            ? "Klik untuk menyimpan progres halaman ini ke dashboard."
            : "Tombol aktif setelah Anda membaca sampai bagian akhir dan minimal 20 detik.";
      }

      if (pageCompleted && groupProgress.completed >= groupProgress.total) {
         nextNode.textContent = "Track ini sudah selesai dipelajari.";
      } else if (config.nextPath && config.nextLabel) {
         nextNode.innerHTML = `Lanjutkan ke <a href="${config.nextPath}">${config.nextLabel}</a>`;
      } else {
         nextNode.textContent = "";
      }
   }

   toggleNode.addEventListener("click", () => {
      if (!hasBeenRevealed) return;
      isCompact = !isCompact;
      updateReadingTrackerUi();
   });

   function refreshScrollState() {
      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      const scrollPercent = maxScroll <= 1 ? 100 : (window.scrollY / maxScroll) * 100;
      scrolledEnough = scrollPercent >= 85;
      if (scrolledEnough) {
         hasBeenRevealed = true;
      }
      updateReadingTrackerUi();
   }

   buttonNode.addEventListener("click", async () => {
      if (saving) return;

      const token = bclMainGetProgressSyncToken();
      if (!token) {
         localStorage.setItem("lastPage", window.location.pathname + window.location.search + window.location.hash);
         window.location.href = "/pages/login.html";
         return;
      }

      if (!scrolledEnough || !dwellReady) return;

      saving = true;
      updateReadingTrackerUi();

      localStorage.setItem(`bcl_page_completed_${config.moduleId}`, "1");

      await bclMainTrackLearningActivity({
         moduleId: config.moduleId,
         moduleType: "page",
         eventType: "completed",
         title,
         category: config.groupId,
         source: "pages",
         progressPercent: 100
      });

      await bclMainSyncProgressToServer(true);

      saving = false;
      isCompact = true;
      updateReadingTrackerUi();
   });

   window.addEventListener("scroll", refreshScrollState, { passive: true });
   window.addEventListener("resize", refreshScrollState);

   setTimeout(() => {
      dwellReady = true;
      updateReadingTrackerUi();
   }, 20000);

   localStorage.setItem(localOpenKey, "1");

   if (!sessionStorage.getItem(sessionOpenKey)) {
      sessionStorage.setItem(sessionOpenKey, "1");
      bclMainTrackLearningActivity({
         moduleId: config.moduleId,
         moduleType: "page",
         eventType: "opened",
         title,
         category: config.groupId,
         source: "pages",
         progressPercent: 10
      });
   }

   refreshScrollState();
   updateReadingTrackerUi();
}

document.addEventListener("DOMContentLoaded", () => {
   bclMainInitializeProgressSync();
   bclMainInitReadingTracker();
});
