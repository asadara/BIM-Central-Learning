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
   const profileLink = document.getElementById("profile-link");

   // E-learning header elements (used in elearning-assets pages)
   const headerUserName = document.getElementById("header-user-name");
   const headerUserRole = document.getElementById("header-user-role");
   const headerUserImg = document.getElementById("header-user-img");
   const loggedInOptions = document.getElementById("logged-in-options");
   const guestOptions = document.getElementById("guest-options");

   if (!user) {
      // Not logged in - hide/show appropriate elements
      if (accountName) accountName.textContent = "Account";
      if (loginLink) loginLink.hidden = false;
      if (logoutLink) logoutLink.hidden = true;
      if (registerLink) registerLink.hidden = false;
      if (profileLink) profileLink.hidden = true;

      // E-learning header elements
      if (headerUserName) headerUserName.textContent = "Guest";
      if (headerUserRole) headerUserRole.textContent = "visitor";
      if (loggedInOptions) loggedInOptions.style.display = "none";
      if (guestOptions) guestOptions.style.display = "block";

      return;
   }

   try {
      // Update standard navbar
      if (accountName) accountName.textContent = user.name || "Account";
      if (loginLink) loginLink.hidden = true;
      if (logoutLink) logoutLink.hidden = false;
      if (registerLink) registerLink.hidden = true;
      if (profileLink) profileLink.hidden = false;

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
   const profileLink = document.getElementById("profile-link");

   if (loginLink) loginLink.hidden = true;
   if (registerLink) registerLink.hidden = true;
   if (logoutLink) logoutLink.hidden = false;
   if (profileLink) profileLink.hidden = false;
}

function showAuthButtons() {
   const loginLink = document.getElementById("login-link");
   const registerLink = document.getElementById("register-link");
   const logoutLink = document.getElementById("logout-link");
   const profileLink = document.getElementById("profile-link");

   if (loginLink) loginLink.hidden = false;
   if (registerLink) registerLink.hidden = false;
   if (logoutLink) logoutLink.hidden = true;
   if (profileLink) profileLink.hidden = true;
}

function setupLogoutHandler(user) {
   // Logout click is now handled by global delegation

   // Show admin panel for admin users
   const adminLink = document.getElementById("admin-link");
   if (user.role && user.role.toLowerCase() === "admin" && adminLink) {
      adminLink.style.display = "block";
      adminLink.classList.remove("hidden");
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

            const lastPage = localStorage.getItem("lastPage") || "/elearning-assets/dashboard.html";
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

function bclMainToNonNegativeInt(value, fallback = 0) {
   const number = Number(value);
   if (!Number.isFinite(number) || number < 0) return fallback;
   return Math.floor(number);
}

function bclMainCollectProgressSnapshot() {
   const userData = bclMainParseJsonSafe(localStorage.getItem("userData"), {});
   const userProgress = userData && typeof userData.progress === "object" ? userData.progress : {};
   const practiceHistory = Array.isArray(userData.practiceHistory) ? userData.practiceHistory : [];
   const gamificationProgress = bclMainParseJsonSafe(localStorage.getItem("gamification_userProgress"), {});

   const coursesCompleted = Math.max(
      bclMainToNonNegativeInt(userProgress.coursesCompleted, 0),
      bclMainToNonNegativeInt(userData.coursesCompleted, 0),
      bclMainToNonNegativeInt(gamificationProgress.coursesCompleted, 0)
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

document.addEventListener("DOMContentLoaded", () => {
   bclMainInitializeProgressSync();
});
