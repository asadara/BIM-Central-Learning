// ✅ Independent E-Learning User Management
// This script manages user authentication specifically for the e-learning section

// ✅ User data management functions (compatible with all sections)
function isTokenExpired(token) {
   if (!token) return true;

   try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
   } catch (error) {
      console.warn('❌ Error checking token expiration:', error);
      return true;
   }
}

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
      console.warn('❌ Error parsing user data from localStorage:', e);
      localStorage.removeItem("user"); // Clean up corrupted data
      return null;
   }
}

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
         photo: data.photo || data.image || data.img || '/elearning-assets/images/pic-1.jpg',
         token: data.token || ""
      };

      localStorage.setItem("user", JSON.stringify(normalizedData));
      localStorage.setItem("username", normalizedData.name);
      localStorage.setItem("email", normalizedData.email);
      localStorage.setItem("role", normalizedData.role);
      localStorage.setItem("userimg", normalizedData.photo);
      localStorage.setItem("token", normalizedData.token);
      localStorage.removeItem("bcl_progress_sync_disabled");
      window.currentUser = normalizedData;

   } catch (error) {
      console.error('❌ Error saving user data in e-learning:', error);
   }
}

// ✅ Fixed: Improved UI update function for E-Learning header component
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

function updateUserUI() {
   const user = getUserData();

   // E-Learning specific header elements
   const headerUserName = document.getElementById("header-user-name");
   const headerUserRole = document.getElementById("header-user-role");
   const headerUserImg = document.getElementById("header-user-img");
   const loggedInOptions = document.getElementById("logged-in-options");
   const guestOptions = document.getElementById("guest-options");

   // Main navbar elements (for compatibility)
   const accountName = document.getElementById("account-name");
   const loginLink = document.getElementById("login-link");
   const logoutLink = document.getElementById("logout-link");
   const registerLink = document.getElementById("register-link");
   const profileLink = document.getElementById("profile-link");

   if (!user) {
      // Not logged in - show guest options
      if (headerUserName) headerUserName.textContent = "Guest";
      if (headerUserRole) headerUserRole.textContent = "visitor";
      if (headerUserImg) headerUserImg.src = "/elearning-assets/images/pic-1.jpg";
      if (loggedInOptions) loggedInOptions.style.display = "none";
      if (guestOptions) guestOptions.style.display = "block";

      // Main navbar compatibility
      if (accountName) accountName.textContent = "Account";
      if (loginLink) loginLink.hidden = false;
      if (logoutLink) logoutLink.hidden = true;
      if (registerLink) registerLink.hidden = false;
      if (profileLink) profileLink.hidden = true;

      return;
   }

   try {
      // Update E-Learning header
      if (headerUserName) headerUserName.textContent = user.name || "User";
      if (headerUserRole) headerUserRole.textContent = user.role || "Student";
      if (headerUserImg) headerUserImg.src = user.photo || "/elearning-assets/images/pic-1.jpg";
      if (loggedInOptions) loggedInOptions.style.display = "block";
      if (guestOptions) guestOptions.style.display = "none";

      // Main navbar compatibility
      if (accountName) accountName.textContent = user.name || "Account";
      if (loginLink) loginLink.hidden = true;
      if (logoutLink) logoutLink.hidden = false;
      if (registerLink) registerLink.hidden = true;
      if (profileLink) profileLink.hidden = false;

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
   const logoutLink = document.getElementById("logout-link");
   if (logoutLink && !logoutLink.dataset.bound) {
      logoutLink.addEventListener("click", function (e) {
         e.preventDefault();
         handleLogout();
      });
      logoutLink.dataset.bound = "true";
   }

   // Show admin panel for admin users
   const adminLink = document.getElementById("admin-link");
   if (user.role && user.role.toLowerCase() === "admin" && adminLink) {
      adminLink.style.display = "block";
      adminLink.classList.remove("hidden");
   }
}

function handleLogout() {
   try {
      localStorage.clear();
      window.currentUser = null;

      // Redirect to login page or refresh
      if (window.location.pathname !== "/login.html") {
         window.location.href = "/login.html";
      } else {
         window.location.reload();
      }
   } catch (error) {
      console.error('❌ Error during logout:', error);
      // Force redirect even if there's an error
      window.location.href = "/login.html";
   }
}

// ✅ Fixed: Improved login form handler with better error handling
function setupLoginForm() {
   const loginForm = document.getElementById("login-form");
   if (!loginForm) return;

   const buildLoginEndpointCandidates = () => {
      const candidates = ['/api/login'];
      const { protocol, hostname } = window.location;
      const isHttp = protocol === 'http:' || protocol === 'https:';

      if (hostname && isHttp) {
         candidates.push(`${protocol}//${hostname}:5052/api/login`);
      }

      candidates.push(`${window.location.protocol}//localhost:5052/api/login`);
      return [...new Set(candidates)];
   };

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
         let response = null;
         let result = null;
         let lastError = null;
         const requestBody = JSON.stringify({ email, password });

         for (const endpoint of buildLoginEndpointCandidates()) {
            try {
               response = await fetch(endpoint, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: requestBody,
               });

               result = await response.json();
               break;
            } catch (error) {
               lastError = error;
            }
         }

         if (!response || !result) {
            throw lastError || new Error('Login endpoint unavailable');
         }

         if (response.ok && (result.success || result.token)) {
            const user = {
               name: result.name || result.username,
               role: result.role || "Student",
               photo: result.photo || "/img/user-default.png",
               token: result.token,
            };
            setUserData(user);

            // Check for auth redirect page first (from auth modal)
            const authRedirectPage = localStorage.getItem("authRedirectPage");
            if (authRedirectPage) {
               localStorage.removeItem("authRedirectPage"); // Clear it after use
               alert("✅ Login berhasil!");
               window.location.href = authRedirectPage;
            } else {
               const lastPage = localStorage.getItem("lastPage") || "/pages/dashboard.html";
               alert("✅ Login berhasil!");
               window.location.href = lastPage;
            }
         } else {
            alert("❌ Login gagal: " + (result.error || result.message || 'Unknown error'));
         }
      } catch (err) {
         console.error("❌ Login Error:", err);
         alert("❌ Error: " + err.message);
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

      // DISABLED: Do not create sample user automatically - causes dummy account issues
      // if (!window.currentUser || !window.currentUser.name) {
      //    console.log('⚠️ No user data found, creating sample user for testing...');
      //    const sampleUser = {
      //       name: "John Doe",
      //       email: "john.doe@example.com",
      //       role: "Student",
      //       photo: "/img/user-default.png",
      //       token: "sample-token-123"
      //    };
      //    setUserData(sampleUser);
      //    window.currentUser = sampleUser;
      //    console.log('✅ Sample user created for testing');
      // }

      updateUserUI();
      setupLoginForm();
   } catch (error) {
      console.error('❌ Error initializing user system:', error);
   }
});

function bclParseJsonSafe(value, fallback) {
   try {
      if (!value) return fallback;
      return JSON.parse(value);
   } catch (error) {
      return fallback;
   }
}

function bclToNonNegativeInt(value, fallback = 0) {
   const number = Number(value);
   if (!Number.isFinite(number) || number < 0) return fallback;
   return Math.floor(number);
}

function bclCollectProgressSnapshot() {
   const userData = bclParseJsonSafe(localStorage.getItem("userData"), {});
   const userProgress = userData && typeof userData.progress === "object" ? userData.progress : {};
   const practiceHistory = Array.isArray(userData.practiceHistory) ? userData.practiceHistory : [];
   const gamificationProgress = bclParseJsonSafe(localStorage.getItem("gamification_userProgress"), {});

   const coursesCompleted = Math.max(
      bclToNonNegativeInt(userProgress.coursesCompleted, 0),
      bclToNonNegativeInt(userData.coursesCompleted, 0),
      bclToNonNegativeInt(gamificationProgress.coursesCompleted, 0)
   );

   const practiceAttempts = Math.max(
      bclToNonNegativeInt(userProgress.practiceAttempts, 0),
      bclToNonNegativeInt(userData.practiceAttempts, 0),
      practiceHistory.length
   );

   const examsPassed = Math.max(
      bclToNonNegativeInt(userProgress.examsPassed, 0),
      bclToNonNegativeInt(userData.examsPassed, 0),
      bclToNonNegativeInt(gamificationProgress.examsPassed, 0)
   );

   const certificatesEarned = Math.max(
      bclToNonNegativeInt(userProgress.certificatesEarned, 0),
      bclToNonNegativeInt(userData.certificatesEarned, 0),
      bclToNonNegativeInt(gamificationProgress.certificatesEarned, 0)
   );

   const currentLevel = String(
      userProgress.currentLevel ||
      userData.level ||
      localStorage.getItem("level") ||
      "BIM Modeller"
   ).trim();

   const toNextLevel = bclToNonNegativeInt(
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

function bclHasAnyProgress(snapshot) {
   if (!snapshot || typeof snapshot !== "object") return false;
   return (
      bclToNonNegativeInt(snapshot.coursesCompleted, 0) > 0 ||
      bclToNonNegativeInt(snapshot.practiceAttempts, 0) > 0 ||
      bclToNonNegativeInt(snapshot.examsPassed, 0) > 0 ||
      bclToNonNegativeInt(snapshot.certificatesEarned, 0) > 0
   );
}

function bclGetProgressSyncToken() {
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

async function bclSyncProgressToServer(force = false) {
   try {
      const token = bclGetProgressSyncToken();
      if (!token) return;

      const snapshot = bclCollectProgressSnapshot();
      if (!bclHasAnyProgress(snapshot) && !force) return;

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
            updateUserUI();
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

function bclInitializeProgressSync() {
   const token = bclGetProgressSyncToken();
   if (!token) return;

   setTimeout(() => {
      bclSyncProgressToServer(true);
   }, 1500);

   setInterval(() => {
      bclSyncProgressToServer(false);
   }, 60000);

   document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
         bclSyncProgressToServer(true);
      }
   });

   window.addEventListener("beforeunload", () => {
      bclSyncProgressToServer(true);
   });
}

document.addEventListener("DOMContentLoaded", () => {
   bclInitializeProgressSync();
});
