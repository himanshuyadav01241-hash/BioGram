// ==========================================================================
// 1. FIREBASE IMPORTS
// ==========================================================================
import { auth, db, googleProvider } from "./firebase.js";
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  getDoc, 
  setDoc, 
  increment,
  collection,
  runTransaction,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { renderPremiumCrown } from "./membership.js";

// ==========================================================================
// 2. HELPER UTILITIES
// ==========================================================================

const escapeHtml = (str) => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const getProfileUrl = (handle) => {
  const origin = window.location.origin;
  const pathParts = window.location.pathname.split('/');
  pathParts.pop();
  const basePath = pathParts.join('/');
  const cleanBase = basePath.endsWith('/') ? basePath : basePath + '/';
  return `${origin}${cleanBase}profile.html?u=${encodeURIComponent(handle)}`;
};

document.addEventListener("DOMContentLoaded", () => {

  // ==========================================================================
  // 3. GLOBAL STATE & SYSTEM CONFIG
  // ==========================================================================
  let currentAvatarSeed = "biogram";
  let avatarCustomized = false;
  let currentHandle = "";
  let systemConfig = {
    globalBlur: false,
    forceOwnerTop: true,
    maintenanceMode: false,
    announcementBanner: ""
  };
  let cachedUsers = [];
  let unsubscribeLeaderboard = null;
  let isCurrentUserAdmin = false;

  // Realtime System Config Listener
  const listenToSystemConfig = () => {
    try {
      const configRef = doc(db, "system", "config");
      onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) {
          systemConfig = docSnap.data();

          // Banner Handler
          const bannerEl = document.getElementById("global-announcement-banner") || document.getElementById("announcement-banner");
          if (bannerEl) {
            if (systemConfig.announcementBanner) {
              bannerEl.textContent = systemConfig.announcementBanner;
              bannerEl.classList.remove("hidden");
              bannerEl.style.display = "block";
            } else {
              bannerEl.classList.add("hidden");
              bannerEl.style.display = "none";
            }
          }

          // Re-render leaderboard if loaded
          if (cachedUsers.length > 0) {
            renderLeaderboard(cachedUsers);
          }
        }
      }, (err) => console.warn("System config listener warning:", err));
    } catch (e) {
      console.warn("Could not bind system config listener:", e);
    }
  };

  listenToSystemConfig();

  // ==========================================================================
  // 4. THEME ENGINE & AVATAR PICKER
  // ==========================================================================
  const initThemeEngine = () => {
    const themeBtns = document.querySelectorAll('.theme-btn');
    
    const applyTheme = (mode) => {
      let targetTheme = mode;
      if (mode === 'auto') {
        const currentHour = new Date().getHours();
        targetTheme = (currentHour >= 6 && currentHour < 18) ? 'light' : 'dark';
      }

      document.documentElement.setAttribute('data-theme', targetTheme);
      localStorage.setItem('biogram_theme_mode', mode);

      themeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeMode === mode);
      });
    };

    const savedMode = localStorage.getItem('biogram_theme_mode') || 'auto';
    applyTheme(savedMode);

    themeBtns.forEach(btn => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.themeMode));
    });
  };

  const initAvatarPicker = () => {
    const avatarImg = document.getElementById('acc-avatar-preview');
    const randomizeBtn = document.getElementById('randomize-avatar-btn');

    randomizeBtn?.addEventListener('click', () => {
      currentAvatarSeed = Math.random().toString(36).substring(7);
      avatarCustomized = true;
      if (avatarImg) {
        avatarImg.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentAvatarSeed}`;
      }
    });
  };

  initThemeEngine();
  initAvatarPicker();

  // ==========================================================================
  // 5. TAB SWITCHER & MODAL HANDLERS
  // ==========================================================================
  const tabBtns = document.querySelectorAll('.tab-btn, [data-tab]');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      if (!targetTab) return;

      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      tabContents.forEach(c => {
        c.classList.remove('active');
        c.classList.add('hidden');
      });

      const activeContent = document.getElementById(targetTab);
      if (activeContent) {
        activeContent.classList.remove('hidden');
        activeContent.classList.add('active');
      }
    });
  });

  const leaderboardModal = document.getElementById("leaderboard-modal");
  const openLeaderboardBtn = document.getElementById("open-leaderboard-btn");
  const closeLeaderboardBtn = document.getElementById("close-leaderboard-btn");

  if (openLeaderboardBtn) {
    openLeaderboardBtn.addEventListener("click", () => {
      leaderboardModal?.classList.remove("hidden");
      startLeaderboardListener();
    });
  }

  if (closeLeaderboardBtn) {
    closeLeaderboardBtn.addEventListener("click", () => {
      leaderboardModal?.classList.add("hidden");
      stopLeaderboardListener();
    });
  }

  leaderboardModal?.addEventListener("click", (e) => {
    if (e.target === leaderboardModal) {
      leaderboardModal.classList.add("hidden");
      stopLeaderboardListener();
    }
  });

  // ==========================================================================
  // 6. CORE DOM RESOLVERS
  // ==========================================================================
  const claimInput = document.getElementById("claim-input") || document.getElementById("username-input");
  const claimBtn = document.getElementById("claim-btn") || document.getElementById("btn-claim-hero");

  const authModal = document.getElementById("auth-modal");
  const googleLoginBtn = document.getElementById("google-login-btn") || document.getElementById("sign-in-btn");
  const navUserContainer = document.getElementById("nav-user-container") || document.getElementById("user-menu-logged-in");

  const accountModal = document.getElementById("account-modal");
  const closeAccountBtn = document.getElementById("close-account-btn") || document.getElementById("cancel-modal-btn");
  const saveAccountBtn = document.getElementById("save-account-btn") || document.getElementById("save-modal-btn");
  const checkAvailBtn = document.getElementById("check-avail-btn") || document.getElementById("btn-check-avail");
  const deleteProfileBtn = document.getElementById("delete-profile-btn");
  const accStatusMsg = document.getElementById("acc-status-msg") || document.getElementById("availability-status");

  const openAuthModal = () => authModal?.classList.remove("hidden");
  const closeAuthModal = () => authModal?.classList.add("hidden");

  const getHandleInput = () => document.getElementById("acc-handle-input") || document.getElementById("modal-username-handle");
  const getNameInput = () => document.getElementById("acc-name-input") || document.getElementById("modal-display-name");
  const getBioInput = () => document.getElementById("acc-bio-input") || document.getElementById("modal-tagline");

  const notifyStatus = (msg, isError = false) => {
    if (accStatusMsg) {
      accStatusMsg.textContent = msg;
      accStatusMsg.style.color = isError ? "#ef4444" : "#16a34a";
    }
  };

  // ==========================================================================
  // 7. NAVBAR RENDERING
  // ==========================================================================
  const renderNavbar = async (user) => {
    const loggedOutNav = document.getElementById("user-menu-logged-out");

    if (!user) {
      isCurrentUserAdmin = false;
      if (loggedOutNav) loggedOutNav.classList.remove("hidden");
      if (navUserContainer) navUserContainer.classList.add("hidden");

      if (claimInput) {
        claimInput.disabled = false;
        claimInput.value = "";
      }
      if (claimBtn) {
        claimBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Claim Username`;
      }
      return;
    }

    if (loggedOutNav) loggedOutNav.classList.add("hidden");
    if (navUserContainer) navUserContainer.classList.remove("hidden");

    let handle = "";
    let displayName = user.displayName || "";
    let finalPhotoURL = user.photoURL || "";
    let isAdmin = false;

    try {
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        handle = data.handle || "";
        isAdmin = !!data.isAdmin || data.role === "owner";
        isCurrentUserAdmin = isAdmin;
        if (data.displayName || data.name) {
          displayName = data.displayName || data.name;
        }
        if (data.photoURL) {
          finalPhotoURL = data.photoURL;
        }
      }
    } catch (err) {
      console.error("Error fetching Firestore user info:", err);
    }

    if (!finalPhotoURL) {
      finalPhotoURL = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
    }

    currentHandle = handle;

    const navAvatarImg = document.getElementById("nav-avatar-img");
    if (navAvatarImg) {
      navAvatarImg.src = finalPhotoURL;
      navAvatarImg.alt = displayName || "User Avatar";
      navAvatarImg.setAttribute("referrerpolicy", "no-referrer");
    }

    const staticAdminBtn = document.getElementById("admin-nav-link");
    if (staticAdminBtn) {
      staticAdminBtn.classList.toggle("hidden", !isAdmin);
    }

    const openAccountBtn = document.getElementById("open-account-btn");
    if (openAccountBtn) {
      openAccountBtn.innerHTML = `<i class="fa-solid fa-gear"></i> Account`;
    }

    if (handle) {
      if (claimInput) {
        claimInput.value = handle;
        claimInput.disabled = true; 
      }
      if (claimBtn) {
        claimBtn.innerHTML = `<i class="fa-solid fa-copy"></i> Copy Link`;
      }
    } else {
      if (claimInput) claimInput.disabled = false;
      if (claimBtn) claimBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Claim Username`;
    }
  };

  // ==========================================================================
  // 8. ACCOUNT MODAL HANDLERS
  // ==========================================================================
  const openAccountModal = async () => {
    const user = auth.currentUser;
    if (!user) {
      openAuthModal();
      return;
    }

    notifyStatus("Loading account details...", false);
    accountModal?.classList.remove("hidden");

    try {
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      const handleInput = getHandleInput();
      const nameInput = getNameInput();
      const bioInput = getBioInput();
      const emailInput = document.getElementById("modal-user-email");
      const avatarImg = document.getElementById("acc-avatar-preview");

      if (emailInput) emailInput.value = user.email || "";

      if (handleInput) {
        handleInput.disabled = false;
        handleInput.readOnly = false;
      }
      if (checkAvailBtn) {
        checkAvailBtn.style.display = "block";
      }

      const activePhoto = user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;

      if (userSnap.exists()) {
        const data = userSnap.data();
        currentHandle = data.handle || "";
        currentAvatarSeed = data.avatarSeed || user.uid;

        if (handleInput) handleInput.value = currentHandle;
        if (nameInput) nameInput.value = data.displayName || data.name || user.displayName || "";
        if (bioInput) bioInput.value = data.bio || data.tagline || "";
        if (avatarImg) {
          avatarImg.src = data.photoURL || activePhoto;
          avatarImg.setAttribute("referrerpolicy", "no-referrer");
        }
      } else {
        if (nameInput) nameInput.value = user.displayName || "";
        if (handleInput) handleInput.value = "";
        if (avatarImg) {
          avatarImg.src = activePhoto;
          avatarImg.setAttribute("referrerpolicy", "no-referrer");
        }
      }

      notifyStatus("", false);
    } catch (err) {
      console.error("Error loading settings:", err);
      notifyStatus(`❌ Error: ${err.message}`, true);
    }
  };

  const closeAccountModal = () => {
    accountModal?.classList.add("hidden");
    notifyStatus("", false);
  };

  document.getElementById("open-account-btn")?.addEventListener("click", openAccountModal);
  document.getElementById("open-auth-btn")?.addEventListener("click", openAuthModal);
  document.getElementById("close-auth-btn")?.addEventListener("click", closeAuthModal);
  document.getElementById("cancel-modal-btn")?.addEventListener("click", closeAccountModal);
  closeAccountBtn?.addEventListener("click", closeAccountModal);

  const handleCheckAvailability = async () => {
    const handleInput = getHandleInput();
    const handle = handleInput?.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (!handle || handle.length < 3) {
      notifyStatus("⚠️ Handle must be at least 3 characters.", true);
      return;
    }

    if (handle === currentHandle) {
      notifyStatus(`ℹ️ '${handle}' is currently your active handle.`, false);
      return;
    }

    try {
      notifyStatus("Checking availability...", false);

      const handleRef = doc(db, "handles", handle);
      const handleSnap = await getDoc(handleRef);
      const user = auth.currentUser;

      if (handleSnap.exists() && handleSnap.data().uid !== user?.uid) {
        notifyStatus(`❌ Handle '${handle}' is already taken!`, true);
      } else {
        notifyStatus(`✓ Handle '${handle}' is available!`, false);
      }
    } catch (err) {
      notifyStatus(`❌ Error checking availability: ${err.message}`, true);
    }
  };

  checkAvailBtn?.addEventListener("click", handleCheckAvailability);

  saveAccountBtn?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (systemConfig.maintenanceMode && !isCurrentUserAdmin) {
      notifyStatus("🛠️ Profile edits are temporarily locked for maintenance.", true);
      return;
    }

    const name = getNameInput()?.value.trim();
    const handleInput = getHandleInput();
    const newHandle = handleInput?.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const bio = getBioInput()?.value.trim();

    try {
      saveAccountBtn.disabled = true;
      notifyStatus("Saving changes...", false);

      let updatedPhotoURL = user.photoURL || "";
      if (avatarCustomized) {
        updatedPhotoURL = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentAvatarSeed}`;
      }

      await runTransaction(db, async (transaction) => {
        if (newHandle && newHandle !== currentHandle) {
          if (newHandle.length < 3) {
            throw new Error("Handle must be at least 3 characters long.");
          }

          const newHandleRef = doc(db, "handles", newHandle);
          const handleSnap = await transaction.get(newHandleRef);

          if (handleSnap.exists() && handleSnap.data().uid !== user.uid) {
            throw new Error(`Handle '${newHandle}' is already taken!`);
          }

          if (currentHandle && currentHandle.trim() !== "") {
            transaction.delete(doc(db, "handles", currentHandle));
          }

          transaction.set(newHandleRef, { 
            uid: user.uid, 
            createdAt: new Date().toISOString() 
          });
        }

        const userRef = doc(db, "users", user.uid);
        transaction.set(userRef, {
          displayName: name || user.displayName || newHandle,
          handle: newHandle || currentHandle,
          bio: bio || "",
          photoURL: updatedPhotoURL,
          avatarSeed: currentAvatarSeed,
          views: increment(0),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });

      currentHandle = newHandle || currentHandle;
      notifyStatus("✅ Profile and username updated successfully!", false);

      await renderNavbar(user);
      setTimeout(() => closeAccountModal(), 1000);
    } catch (err) {
      notifyStatus(`❌ Failed to save: ${err.message}`, true);
    } finally {
      if (saveAccountBtn) saveAccountBtn.disabled = false;
    }
  });

  deleteProfileBtn?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!confirm("Are you sure you want to reset your account profile?")) return;

    try {
      deleteProfileBtn.disabled = true;
      await runTransaction(db, async (transaction) => {
        if (currentHandle && currentHandle.trim() !== "") {
          transaction.delete(doc(db, "handles", currentHandle));
        }
        transaction.delete(doc(db, "users", user.uid));
      });

      notifyStatus("🗑️ Profile reset completed!", false);
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      notifyStatus(`❌ Reset failed: ${err.message}`, true);
    } finally {
      if (deleteProfileBtn) deleteProfileBtn.disabled = false;
    }
  });

  claimBtn?.addEventListener("click", async () => {
    if (currentHandle) {
      const fullUrl = getProfileUrl(currentHandle);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(fullUrl);
        } else {
          throw new Error("Clipboard API unavailable");
        }
        const originalText = claimBtn.innerHTML;
        claimBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
        claimBtn.style.background = '#10b981';

        setTimeout(() => {
          claimBtn.innerHTML = originalText;
          claimBtn.style.background = '';
        }, 2000);
      } catch (e) {
        prompt("📋 Copy your profile link:", fullUrl);
      }
      return;
    }

    if (systemConfig.maintenanceMode && !isCurrentUserAdmin) {
      alert("🛠️ Profile edits are temporarily locked for maintenance. Please check back soon.");
      return;
    }

    const handle = claimInput?.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    
    if (!handle || handle.length < 3) {
      alert("⚠️ Username must be at least 3 characters long.");
      return;
    }

    let user = auth.currentUser;
    if (!user) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        user = result.user;
      } catch (e) {
        return;
      }
    }

    try {
      claimBtn.disabled = true;
      await runTransaction(db, async (transaction) => {
        const handleRef = doc(db, "handles", handle);
        const handleSnap = await transaction.get(handleRef);

        if (handleSnap.exists() && handleSnap.data().uid !== user.uid) {
          throw new Error(`Handle '${handle}' is already taken!`);
        }

        transaction.set(handleRef, { 
          uid: user.uid, 
          createdAt: new Date().toISOString() 
        });

        transaction.set(doc(db, "users", user.uid), {
          handle: handle,
          displayName: user.displayName || handle,
          email: user.email,
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          views: 0,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      });

      currentHandle = handle;
      await renderNavbar(user);

      alert(`🎉 Success! Your handle '${handle}' is claimed!`);
      
    } catch (err) {
      console.error("Claim Handle Error:", err);
      alert(`❌ Failed to claim username: ${err.message}`);
    } finally {
      if (claimBtn) claimBtn.disabled = false;
    }
  });

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const existingDoc = await getDoc(userRef);

      if (!existingDoc.exists()) {
        await setDoc(userRef, {
          displayName: user.displayName || "",
          email: user.email,
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          views: 0,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      closeAuthModal();
      await renderNavbar(user);
    } catch (err) {
      alert(`Sign in failed: ${err.message}`);
    }
  };

  googleLoginBtn?.addEventListener("click", handleGoogleLogin);
  document.getElementById("sign-out-btn")?.addEventListener("click", () => signOut(auth));

  // ==========================================================================
  // 9. LEADERBOARD WITH REALTIME & ADMIN CONFIG
  // ==========================================================================
  
  const startLeaderboardListener = () => {
    const leaderboardContainer = document.getElementById("leaderboard-list");
    if (!leaderboardContainer) return;

    leaderboardContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading rankings...</div>`;

    if (unsubscribeLeaderboard) unsubscribeLeaderboard();

    unsubscribeLeaderboard = onSnapshot(collection(db, "users"), (snapshot) => {
      cachedUsers = [];
      snapshot.forEach((docSnap) => {
        cachedUsers.push({ id: docSnap.id, ...docSnap.data() });
      });

      renderLeaderboard(cachedUsers);
    }, (err) => {
      console.error("Leaderboard realtime error:", err);
      leaderboardContainer.innerHTML = `<p class="error" style="color: #ef4444; text-align: center;">Failed to load rankings.</p>`;
    });
  };

  const stopLeaderboardListener = () => {
    if (unsubscribeLeaderboard) {
      unsubscribeLeaderboard();
      unsubscribeLeaderboard = null;
    }
  };

  const renderLeaderboard = (users) => {
    const leaderboardContainer = document.getElementById("leaderboard-list");
    if (!leaderboardContainer) return;

    // Get currently authenticated user
    const currentUser = auth.currentUser;

    // Filter Banned and Hidden Profiles
    let displayUsers = users.filter((u) => !u.isBanned && !u.excludeFromLeaderboard);

    // Sort by Views Descending
    displayUsers.sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0));

    // Cap at top 100 creators
    displayUsers = displayUsers.slice(0, 100);

    // Force Owner to Top if configured
    if (systemConfig.forceOwnerTop !== false) {
      const ownerIndex = displayUsers.findIndex(
        (u) => u.role === "owner" || u.handle === "admin"
      );
      if (ownerIndex > 0) {
        const [owner] = displayUsers.splice(ownerIndex, 1);
        displayUsers.unshift(owner);
      }
    }

    leaderboardContainer.innerHTML = "";
    if (displayUsers.length === 0) {
      leaderboardContainer.innerHTML = `<p style="text-align:center; color: var(--text-muted); margin: 12px 0;">No users on the leaderboard yet.</p>`;
      return;
    }

    displayUsers.forEach((user, index) => {
      const rank = index + 1;
      
      // Check if entry belongs to currently logged-in user
      const isSelf = currentUser && (user.id === currentUser.uid || user.uid === currentUser.uid);
      
      const isBlurred = systemConfig.globalBlur || user.isBlurred || user.isBlurredByAdmin || false;
      const isVerified = user.isVerified || false;
      const isOwner = user.role === "owner" || user.handle === "admin";

      const item = document.createElement("div");
      item.className = `leaderboard-item ${rank <= 3 ? `top-${rank}` : ''} ${isSelf ? 'is-self' : ''} ${isBlurred ? 'blurred-text' : ''}`;

      const avatar = user.photoURL || user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.handle || user.id}`;
      const handle = user.handle ? `@${user.handle}` : "@anonymous";
      
      // Accurately read individual user name from document fields
      const name = escapeHtml(user.displayName || user.name || user.username || "User");
      const views = Number(user.views) || 0;

      // Render "You" badge for yourself instead of the "Visit" link (Opens in same tab without target="_blank")
      const actionButton = isSelf
        ? `<span class="you-badge"><i class="fa-solid fa-user"></i> You</span>`
        : `<a href="${getProfileUrl(user.handle || "")}" class="btn-visit-profile"><i class="fa-solid fa-arrow-up-right-from-square"></i> Visit</a>`;

      item.innerHTML = `
        <div class="leaderboard-user-info">
          <span class="rank-badge">#${rank}</span>
          <img src="${escapeHtml(avatar)}" class="leaderboard-avatar ${isBlurred ? 'blurred-avatar' : ''}" alt="Avatar" referrerpolicy="no-referrer">
          <div class="leaderboard-details">
            <div class="user-name">
              ${name}
              ${isVerified ? '<i class="fa-solid fa-circle-check verified-badge" style="color:#1d9bf0; margin-left:4px;" title="Verified"></i>' : ''}
              ${renderPremiumCrown(user)}
              ${isOwner ? '<span class="badge owner-badge" style="background:#e11d48; color:#fff; font-size:0.65rem; padding:2px 6px; border-radius:4px; margin-left:4px;">OWNER</span>' : ''}
            </div>
            <div class="user-handle">${escapeHtml(handle)}</div>
          </div>
        </div>
        <div class="leaderboard-actions">
          <span class="leaderboard-views"><i class="fa-solid fa-eye"></i> ${views.toLocaleString()}</span>
          ${actionButton}
        </div>
      `;
      leaderboardContainer.appendChild(item);
    });
  };

  // ==========================================================================
  // 10. AUTH STATE OBSERVER
  // ==========================================================================
  onAuthStateChanged(auth, async (user) => {
    await renderNavbar(user);
  });

});