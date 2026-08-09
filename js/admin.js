// ==========================================================================
// 1. FIREBASE IMPORTS
// ==========================================================================
import { db } from "./firebase.js"; 
import { 
  collection, 
  doc, 
  getDoc,
  setDoc,
  updateDoc, 
  deleteDoc,
  Timestamp,
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { isUserPremium } from "./membership.js";

// ==========================================================================
// 2. GLOBAL STATE & DOM ELEMENTS
// ==========================================================================
let allUsers = [];
let systemConfig = {};
let currentEditingUserId = null;
let currentReassignUserId = null;
let currentOldHandle = "";

// Table & Search
const tbody = document.getElementById("admin-users-tbody");
const searchInput = document.getElementById("admin-search-input");

// Stats Elements
const totalUsersEl = document.getElementById("stat-total-users");
const totalViewsEl = document.getElementById("stat-total-views");
const bannedUsersEl = document.getElementById("stat-banned-users");
const signupsTodayEl = document.getElementById("stat-signups-today");
const signupsWeekEl = document.getElementById("stat-signups-week");
const activeSpacesEl = document.getElementById("stat-active-spaces");
const premiumUsersEl = document.getElementById("stat-premium-users");
const totalRevenueEl = document.getElementById("stat-total-revenue");

// Platform Controls
const maintenanceToggle = document.getElementById("toggle-maintenance-mode");
const globalBlurToggle = document.getElementById("global-blur-toggle");
const forceOwnerToggle = document.getElementById("force-owner-top-toggle");
const announcementInput = document.getElementById("global-announcement-input");
const saveAnnouncementBtn = document.getElementById("btn-save-announcement");
const clearAnnouncementBtn = document.getElementById("btn-clear-announcement");
const exportUsersBtn = document.getElementById("btn-export-users");

// Membership & Monetization Controls
const membershipPriceInput = document.getElementById("membership-price-input");
const razorpayKeyInput = document.getElementById("razorpay-key-input");
const paymentsEnabledToggle = document.getElementById("payments-enabled-toggle");
const saveMembershipSettingsBtn = document.getElementById("btn-save-membership-settings");
const freeMediaLimitInput = document.getElementById("free-media-limit-input");
const freeWidgetLimitInput = document.getElementById("free-widget-limit-input");

// Edit Views Modal
const viewsModal = document.getElementById("edit-views-modal");
const editViewsInput = document.getElementById("edit-views-input");
const editViewsLabel = document.getElementById("edit-views-user-label");
const cancelViewsHeader = document.getElementById("cancel-edit-views-btn");
const cancelViewsFooter = document.getElementById("modal-cancel-btn");
const saveViewsBtn = document.getElementById("save-views-btn");

// Reassign Handle Modal
const handleModal = document.getElementById("reassign-handle-modal");
const reassignHandleInput = document.getElementById("reassign-handle-input");
const reassignHandleLabel = document.getElementById("reassign-handle-user-label");
const cancelHandleHeader = document.getElementById("cancel-reassign-handle-btn");
const cancelHandleFooter = document.getElementById("modal-cancel-handle-btn");
const saveHandleBtn = document.getElementById("save-handle-btn");

// ==========================================================================
// 3. REALTIME LISTENERS & INITIALIZATION
// ==========================================================================
function initAdminPanel() {
  listenToSystemConfig();
  listenToUsers();
}

/**
 * Realtime Listener for System Settings (maintenanceMode, globalBlur, forceOwnerTop, announcementBanner)
 */
function listenToSystemConfig() {
  const configRef = doc(db, "system", "config");
  
  onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      systemConfig = docSnap.data();

      // Sync Toggles and Announcements UI without firing extra change events
      if (maintenanceToggle) maintenanceToggle.checked = !!systemConfig.maintenanceMode;
      if (globalBlurToggle) globalBlurToggle.checked = !!systemConfig.globalBlur;
      if (forceOwnerToggle) forceOwnerToggle.checked = systemConfig.forceOwnerTop !== false;
      if (announcementInput && document.activeElement !== announcementInput) {
        announcementInput.value = systemConfig.announcementBanner || "";
      }

      // Sync Membership & Monetization controls (skip fields the admin is actively typing in)
      if (membershipPriceInput && document.activeElement !== membershipPriceInput) {
        membershipPriceInput.value = systemConfig.membershipPriceINR ?? 499;
      }
      if (razorpayKeyInput && document.activeElement !== razorpayKeyInput) {
        razorpayKeyInput.value = systemConfig.razorpayKeyId || "";
      }
      if (paymentsEnabledToggle) paymentsEnabledToggle.checked = !!systemConfig.paymentsEnabled;
      if (freeMediaLimitInput && document.activeElement !== freeMediaLimitInput) {
        freeMediaLimitInput.value = systemConfig.freeMediaLimit ?? 3;
      }
      if (freeWidgetLimitInput && document.activeElement !== freeWidgetLimitInput) {
        freeWidgetLimitInput.value = systemConfig.freeCustomWidgetLimit ?? 1;
      }
      if (totalRevenueEl) {
        const paise = Number(systemConfig.totalRevenuePaise) || 0;
        totalRevenueEl.textContent = `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
      }

      // Re-render user table with new config rules
      if (allUsers.length > 0) {
        sortAndRenderUsers();
      }
    }
  }, (error) => {
    console.error("Error subscribing to system config:", error);
  });
}

/**
 * Realtime Listener for Users Collection
 */
function listenToUsers() {
  if (!tbody) return;

  const usersRef = collection(db, "users");

  onSnapshot(usersRef, (querySnapshot) => {
    allUsers = [];
    querySnapshot.forEach((docSnap) => {
      allUsers.push({ id: docSnap.id, ...docSnap.data() });
    });

    sortAndRenderUsers();
    updateStats(allUsers);
  }, (error) => {
    console.error("Error subscribing to users collection:", error);
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-danger py-4">
          <i class="fa-solid fa-triangle-exclamation"></i> Realtime connection failed: ${error.message}
        </td>
      </tr>`;
  });
}

// ==========================================================================
// 4. RENDER TABLE & METRICS
// ==========================================================================
function sortAndRenderUsers() {
  let displayUsers = [...allUsers];

  // Apply search filter if active
  if (searchInput && searchInput.value.trim() !== "") {
    const term = searchInput.value.toLowerCase().trim();
    displayUsers = displayUsers.filter((u) => 
      (u.handle && u.handle.toLowerCase().includes(term)) ||
      (u.displayName && u.displayName.toLowerCase().includes(term)) ||
      (u.id && u.id.toLowerCase().includes(term))
    );
  }

  // Sort by views descending
  displayUsers.sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0));

  // Force Owner to #1 Rank if enabled
  const isForceOwner = forceOwnerToggle ? forceOwnerToggle.checked : false;
  if (isForceOwner) {
    const ownerIndex = displayUsers.findIndex(
      (u) => u.role === "owner" || u.handle === "admin"
    );
    if (ownerIndex > 0) {
      const [owner] = displayUsers.splice(ownerIndex, 1);
      displayUsers.unshift(owner);
    }
  }

  renderTable(displayUsers);
}

function renderTable(users) {
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4">No registered profiles found.</td></tr>`;
    return;
  }

  const isGlobalBlurred = globalBlurToggle ? globalBlurToggle.checked : false;
  tbody.innerHTML = "";

  users.forEach((user, index) => {
    const isOwner = user.role === "owner" || user.handle === "admin";
    const isBanned = user.isBanned || false;
    const isBlurred = isGlobalBlurred || user.isBlurred || false;
    const isVerified = user.isVerified || false;
    const isPremium = isUserPremium(user);
    const isExcludedFromLeaderboard = user.excludeFromLeaderboard || false;

    let statusBadge = `<span class="status-badge status-active">Active</span>`;
    if (isBanned) {
      statusBadge = `<span class="status-badge status-banned">Banned</span>`;
    } else if (isBlurred) {
      statusBadge = `<span class="status-badge status-blurred">Blurred</span>`;
    }

    // FIX: user avatars are stored under `photoURL` (see js/app.js / js/profile.js),
    // not `avatar`. via.placeholder.com is also defunct, so fall back to Dicebear.
    const avatarSrc = user.photoURL || user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.handle || user.id)}`;

    const tr = document.createElement("tr");
    if (isBanned) tr.classList.add("row-banned");

    tr.innerHTML = `
      <td><strong>#${index + 1}</strong></td>
      <td>
        <div class="user-cell">
          <img src="${avatarSrc}" class="table-avatar" alt="avatar" referrerpolicy="no-referrer">
          <span class="${isBlurred ? 'blurred-text' : ''}">${user.displayName || user.username || 'Unnamed User'}</span>
          ${isPremium ? '<i class="fa-solid fa-crown" style="color:#f59e0b;" title="Pro Member"></i>' : ''}
          ${isOwner ? '<span class="badge owner-badge">OWNER</span>' : ''}
        </div>
      </td>
      <td><span class="${isBlurred ? 'blurred-text' : ''}">@${user.handle || 'handle'}</span></td>
      <td>
        <span class="views-badge">
          <i class="fa-solid fa-eye"></i> ${(Number(user.views) || 0).toLocaleString()}
        </span>
      </td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn-action badge-verified-toggle ${isVerified ? 'active' : ''} verify-btn" data-id="${user.id}" data-verified="${isVerified}">
          <i class="fa-solid fa-circle-check"></i> ${isVerified ? 'Verified' : 'Verify'}
        </button>
      </td>
      <td>
        <button class="btn-action btn-secondary exclude-lb-btn" data-id="${user.id}" data-excluded="${isExcludedFromLeaderboard}">
          <i class="fa-solid ${isExcludedFromLeaderboard ? 'fa-eye-slash' : 'fa-eye'}"></i> ${isExcludedFromLeaderboard ? 'Hidden' : 'Visible'}
        </button>
      </td>
      <td>
        <button class="btn-action ${isPremium ? 'btn-warn' : 'btn-secondary'} premium-toggle-btn" data-id="${user.id}" data-premium="${isPremium}">
          <i class="fa-solid fa-crown"></i> ${isPremium ? 'Revoke Pro' : 'Grant Pro'}
        </button>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-action btn-primary edit-views-btn" data-id="${user.id}">
            <i class="fa-solid fa-pen"></i> Views
          </button>
          <button class="btn-action btn-secondary reassign-handle-btn" data-id="${user.id}" data-handle="${user.handle || ''}">
            <i class="fa-solid fa-at"></i>
          </button>
          <button class="btn-action ${isBanned ? 'btn-success' : 'btn-warn'} ban-btn" data-id="${user.id}" data-banned="${isBanned}">
            <i class="fa-solid ${isBanned ? 'fa-user-check' : 'fa-ban'}"></i> ${isBanned ? 'Unban' : 'Ban'}
          </button>
          <button class="btn-action btn-secondary blur-btn" data-id="${user.id}" data-blurred="${user.isBlurred || false}">
            <i class="fa-solid ${user.isBlurred ? 'fa-eye' : 'fa-eye-slash'}"></i>
          </button>
          <button class="btn-action btn-danger delete-btn" data-id="${user.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  attachEventListeners();
}

function updateStats(users) {
  let totalViews = 0;
  let bannedCount = 0;
  let todaySignups = 0;
  let weekSignups = 0;
  let activeSpacesCount = 0;
  let premiumCount = 0;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  users.forEach((u) => {
    totalViews += Number(u.views) || 0;
    if (u.isBanned) bannedCount++;
    if (isUserPremium(u)) premiumCount++;

    const createdAt = u.createdAt?.toDate ? u.createdAt.toDate() : (u.createdAt ? new Date(u.createdAt) : null);
    const updatedAt = u.updatedAt?.toDate ? u.updatedAt.toDate() : (u.updatedAt ? new Date(u.updatedAt) : null);

    if (createdAt) {
      if (createdAt >= startOfDay) todaySignups++;
      if (createdAt >= startOfWeek) weekSignups++;
    }

    if (updatedAt && updatedAt >= thirtyDaysAgo) {
      activeSpacesCount++;
    }
  });

  if (totalUsersEl) totalUsersEl.textContent = users.length;
  if (totalViewsEl) totalViewsEl.textContent = totalViews.toLocaleString();
  if (bannedUsersEl) bannedUsersEl.textContent = bannedCount;
  if (signupsTodayEl) signupsTodayEl.textContent = todaySignups;
  if (signupsWeekEl) signupsWeekEl.textContent = weekSignups;
  if (activeSpacesEl) activeSpacesEl.textContent = activeSpacesCount;
  if (premiumUsersEl) premiumUsersEl.textContent = premiumCount;
}

// ==========================================================================
// 5. EVENT HANDLERS & ACTIONS
// ==========================================================================
function attachEventListeners() {
  // Edit Views Modal Trigger
  document.querySelectorAll(".edit-views-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = btn.dataset.id;
      const user = allUsers.find((u) => u.id === uid);
      if (user) {
        currentEditingUserId = uid;
        if (editViewsLabel) editViewsLabel.textContent = `User: @${user.handle || user.displayName || uid}`;
        if (editViewsInput) editViewsInput.value = user.views || 0;
        if (viewsModal) viewsModal.classList.remove("hidden");
      }
    });
  });

  // Reassign Handle Modal Trigger
  document.querySelectorAll(".reassign-handle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = btn.dataset.id;
      const handle = btn.dataset.handle;
      currentReassignUserId = uid;
      currentOldHandle = handle;

      if (reassignHandleLabel) reassignHandleLabel.textContent = `Reassigning handle for: @${handle || uid}`;
      if (reassignHandleInput) reassignHandleInput.value = handle || "";
      if (handleModal) handleModal.classList.remove("hidden");
    });
  });

  // Verification Toggle
  document.querySelectorAll(".verify-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.id;
      const currentVerified = btn.dataset.verified === "true";
      await updateDoc(doc(db, "users", uid), { isVerified: !currentVerified });
    });
  });

  // Exclude / Include on Leaderboard
  document.querySelectorAll(".exclude-lb-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.id;
      const currentExcluded = btn.dataset.excluded === "true";
      await updateDoc(doc(db, "users", uid), { excludeFromLeaderboard: !currentExcluded });
    });
  });

  // Ban / Unban
  document.querySelectorAll(".ban-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.id;
      const currentBanned = btn.dataset.banned === "true";
      await updateDoc(doc(db, "users", uid), { isBanned: !currentBanned });
    });
  });

  // Blur / Unblur
  document.querySelectorAll(".blur-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.id;
      const currentBlurred = btn.dataset.blurred === "true";
      await updateDoc(doc(db, "users", uid), { isBlurred: !currentBlurred });
    });
  });

  // Delete User
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.id;
      if (confirm("Are you sure you want to delete this profile permanently?")) {
        await deleteDoc(doc(db, "users", uid));
      }
    });
  });

  // Grant / Revoke Pro Membership (manual override, e.g. for offline/manual payments)
  document.querySelectorAll(".premium-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.id;
      const currentlyPremium = btn.dataset.premium === "true";
      const confirmMsg = currentlyPremium
        ? "Revoke this user's BioGram Pro access?"
        : "Grant this user lifetime BioGram Pro access?";
      if (!confirm(confirmMsg)) return;

      try {
        await updateDoc(doc(db, "users", uid), {
          isPremium: !currentlyPremium,
          membershipType: !currentlyPremium ? "lifetime" : null,
          premiumSince: !currentlyPremium ? new Date().toISOString() : null,
          grantedByAdmin: !currentlyPremium
        });
      } catch (err) {
        console.error("Error toggling premium status:", err);
        alert(`Failed to update membership: ${err.message}`);
      }
    });
  });
}

// ==========================================================================
// 6. SYSTEM CONTROLS & ANNOUNCEMENTS
// ==========================================================================

// Maintenance Toggle
if (maintenanceToggle) {
  maintenanceToggle.addEventListener("change", async (e) => {
    try {
      await setDoc(doc(db, "system", "config"), { maintenanceMode: e.target.checked }, { merge: true });
    } catch (err) {
      console.error("Error updating maintenance mode:", err);
    }
  });
}

// Save Announcement
if (saveAnnouncementBtn) {
  saveAnnouncementBtn.addEventListener("click", async () => {
    const bannerText = announcementInput ? announcementInput.value.trim() : "";
    try {
      await setDoc(doc(db, "system", "config"), { 
        announcementBanner: bannerText, 
        updatedAt: Timestamp.now() 
      }, { merge: true });
      alert("Announcement banner published successfully!");
    } catch (err) {
      console.error("Error saving announcement banner:", err);
      alert("Failed to publish announcement banner.");
    }
  });
}

// Clear Announcement
if (clearAnnouncementBtn) {
  clearAnnouncementBtn.addEventListener("click", async () => {
    if (announcementInput) announcementInput.value = "";
    try {
      await setDoc(doc(db, "system", "config"), { announcementBanner: "" }, { merge: true });
      alert("Announcement banner cleared!");
    } catch (err) {
      console.error("Error clearing announcement banner:", err);
    }
  });
}

// Global Blur Toggle
if (globalBlurToggle) {
  globalBlurToggle.addEventListener("change", async (e) => {
    try {
      await setDoc(doc(db, "system", "config"), { globalBlur: e.target.checked }, { merge: true });
    } catch (err) {
      console.error("Error updating global blur:", err);
    }
  });
}

// Force Owner #1 Rank Toggle
if (forceOwnerToggle) {
  forceOwnerToggle.addEventListener("change", async (e) => {
    try {
      await setDoc(doc(db, "system", "config"), { forceOwnerTop: e.target.checked }, { merge: true });
    } catch (err) {
      console.error("Error updating force owner rank:", err);
    }
  });
}

// Save Membership & Monetization Settings
if (saveMembershipSettingsBtn) {
  saveMembershipSettingsBtn.addEventListener("click", async () => {
    const priceVal = parseInt(membershipPriceInput?.value, 10);
    const mediaLimitVal = parseInt(freeMediaLimitInput?.value, 10);
    const widgetLimitVal = parseInt(freeWidgetLimitInput?.value, 10);

    try {
      saveMembershipSettingsBtn.disabled = true;
      await setDoc(doc(db, "system", "config"), {
        membershipPriceINR: isNaN(priceVal) ? 499 : priceVal,
        razorpayKeyId: razorpayKeyInput ? razorpayKeyInput.value.trim() : "",
        paymentsEnabled: paymentsEnabledToggle ? paymentsEnabledToggle.checked : false,
        freeMediaLimit: isNaN(mediaLimitVal) ? 3 : mediaLimitVal,
        freeCustomWidgetLimit: isNaN(widgetLimitVal) ? 1 : widgetLimitVal
      }, { merge: true });
      alert("Membership settings saved!");
    } catch (err) {
      console.error("Error saving membership settings:", err);
      alert(`Failed to save membership settings: ${err.message}`);
    } finally {
      saveMembershipSettingsBtn.disabled = false;
    }
  });
}

// Export Users as CSV
if (exportUsersBtn) {
  exportUsersBtn.addEventListener("click", () => {
    if (!allUsers.length) {
      alert("No users to export yet.");
      return;
    }

    const headers = ["uid", "handle", "displayName", "email", "views", "isVerified", "isPremium", "isBanned", "isBlurred", "excludeFromLeaderboard"];
    const escapeCsv = (val) => {
      const str = String(val ?? "");
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const rows = allUsers.map((u) => headers.map((h) => {
      if (h === "uid") return escapeCsv(u.id);
      if (h === "isPremium") return escapeCsv(isUserPremium(u));
      return escapeCsv(u[h]);
    }).join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `biogram-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ==========================================================================
// 7. MODALS LOGIC
// ==========================================================================

const closeViewsModal = () => {
  if (viewsModal) viewsModal.classList.add("hidden");
  currentEditingUserId = null;
};

const closeHandleModal = () => {
  if (handleModal) handleModal.classList.add("hidden");
  currentReassignUserId = null;
  currentOldHandle = "";
};

if (cancelViewsHeader) cancelViewsHeader.addEventListener("click", closeViewsModal);
if (cancelViewsFooter) cancelViewsFooter.addEventListener("click", closeViewsModal);

if (cancelHandleHeader) cancelHandleHeader.addEventListener("click", closeHandleModal);
if (cancelHandleFooter) cancelHandleFooter.addEventListener("click", closeHandleModal);

// Save View Count
if (saveViewsBtn) {
  saveViewsBtn.addEventListener("click", async () => {
    if (!currentEditingUserId) return;
    const newViews = parseInt(editViewsInput.value, 10);
    if (isNaN(newViews)) return alert("Please enter a valid view count.");

    try {
      await updateDoc(doc(db, "users", currentEditingUserId), { views: newViews });
      closeViewsModal();
    } catch (err) {
      console.error("Error saving view count:", err);
      alert(`Failed to update views: ${err.message}`);
    }
  });
}

// Save Handle Reassignment
if (saveHandleBtn) {
  saveHandleBtn.addEventListener("click", async () => {
    if (!currentReassignUserId) return;
    const newHandle = reassignHandleInput ? reassignHandleInput.value.toLowerCase().trim() : "";

    if (!newHandle) return alert("Please enter a valid handle.");
    if (newHandle === currentOldHandle.toLowerCase()) {
      closeHandleModal();
      return;
    }

    try {
      const newHandleRef = doc(db, "handles", newHandle);
      const handleSnap = await getDoc(newHandleRef);

      if (handleSnap.exists()) {
        return alert(`The handle @${newHandle} is already claimed by another user.`);
      }

      if (currentOldHandle) {
        await deleteDoc(doc(db, "handles", currentOldHandle.toLowerCase()));
      }

      await setDoc(newHandleRef, { uid: currentReassignUserId, createdAt: new Date().toISOString() });
      await updateDoc(doc(db, "users", currentReassignUserId), { 
        handle: newHandle,
        username: newHandle 
      });

      alert(`Handle successfully reassigned to @${newHandle}!`);
      closeHandleModal();
    } catch (error) {
      console.error("Error reassigning handle:", error);
      alert(`Failed to reassign handle: ${error.message}`);
    }
  });
}

// ==========================================================================
// 8. TABLE SEARCH FILTER
// ==========================================================================
if (searchInput) {
  searchInput.addEventListener("input", sortAndRenderUsers);
}

// Initialize Realtime Listeners on DOM Load
document.addEventListener("DOMContentLoaded", initAdminPanel);