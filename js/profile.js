// ==========================================================================
// FIREBASE IMPORTS
// ==========================================================================
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  getDoc, 
  setDoc,
  updateDoc,
  increment,
  collection,
  query,
  where,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // DOM REFERENCES & STATE
  // ==========================================================================
  const overlay = document.getElementById('tap-to-open-overlay');
  const spaceContainer = document.getElementById('custom-space-container');
  const bgAudio = document.getElementById('bg-audio-player');
  const btnToggleAudio = document.getElementById('btn-toggle-audio');
  const audioIcon = document.getElementById('audio-icon');
  const volumeSlider = document.getElementById('bg-audio-volume');
  const bgLayer = document.getElementById('space-bg-layer');

  const openEditorBtn = document.getElementById("open-editor-btn");
  const closeEditorBtn = document.getElementById("close-editor-btn");
  const editorModal = document.getElementById("space-editor-modal") || document.getElementById("customize-space-modal");
  const saveSpaceBtn = document.getElementById("save-space-btn");
  const resetPositionsBtn = document.getElementById("reset-positions-btn");
  const toggleLockBtn = document.getElementById("toggle-lock-btn");
  const mobileOrderListContainer = document.getElementById("mobile-order-list");
  const toggleMobileOrderBtn = document.getElementById("toggle-mobile-order-header") || document.getElementById("toggle-mobile-order-btn");
  const mobileOrderChevron = document.getElementById("mobile-order-chevron");

  const mediaPrevBtn = document.getElementById("media-prev-btn");
  const mediaNextBtn = document.getElementById("media-next-btn");

  const urlParams = new URLSearchParams(window.location.search);
  const handleParam = urlParams.get("u")?.toLowerCase().trim() || urlParams.get("handle")?.toLowerCase().trim();

  const DEFAULT_WIDGET_ORDER = ['clock', 'profile', 'discord', 'media', 'spotify', 'socials', 'rankings'];
  const WIDGET_LABELS = {
    clock: "Clock Widget",
    profile: "Profile Widget",
    discord: "Discord Activity",
    media: "Media Gallery",
    spotify: "Spotify Player",
    socials: "Social Links",
    rankings: "Rank & Views"
  };

  const WIDGET_ELEMENT_IDS = {
    clock: "clock-card-widget",
    profile: "profile-card-widget",
    discord: "discord-card-widget",
    media: "media-card-widget",
    spotify: "spotify-card-widget",
    socials: "socials-card-widget",
    rankings: "rankings-card-widget"
  };

  let clockInterval = null;
  let activeSpaceConfig = {};
  let currentLoadedUserData = null;
  let targetUserId = null;
  let isCurrentUserAdmin = false;
  let mediaImages = [];
  let currentMediaIndex = 0;
  let mediaInterval = null;
  let isLayoutAbsolute = false;
  let isLayoutLocked = true; 
  let discordTimerInterval = null;
  let tempMobileOrder = [...DEFAULT_WIDGET_ORDER];

  const isMobile = () => window.innerWidth <= 600;
  const getLocalStorageKey = () => targetUserId ? `biogram_space_layout_cache_${targetUserId}` : 'biogram_space_layout_cache_guest';

  // Helper functions
  const getInputValue = (id1, id2) => {
    const el = document.getElementById(id1) || document.getElementById(id2);
    return el ? el.value.trim() : "";
  };

  const getCheckboxValue = (id1, id2, defaultVal = true) => {
    const el = document.getElementById(id1) || document.getElementById(id2);
    return el ? el.checked : defaultVal;
  };

  const setInputValue = (id1, id2, value) => {
    const el = document.getElementById(id1) || document.getElementById(id2);
    if (el) el.value = value || "";
  };

  const setCheckboxValue = (id1, id2, value) => {
    const el = document.getElementById(id1) || document.getElementById(id2);
    if (el) el.checked = !!value;
  };

  const escapeHtml = (str) => {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Smart URL Platform Detector
  const detectPlatformFromUrl = (urlStr = "") => {
    const u = urlStr.toLowerCase().trim();
    if (u.includes("instagram.com") || u.includes("instagr.am")) return "Instagram";
    if (u.includes("github.com")) return "GitHub";
    if (u.includes("twitter.com") || u.includes("x.com")) return "X / Twitter";
    if (u.includes("discord.gg") || u.includes("discord.com")) return "Discord";
    if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
    if (u.includes("spotify.com")) return "Spotify";
    if (u.includes("twitch.tv")) return "Twitch";
    if (u.includes("linkedin.com")) return "LinkedIn";
    if (u.includes("tiktok.com")) return "TikTok";
    return "Link";
  };

  // Dynamic Social Icon Resolver
  const getSocialIconClass = (platformStr = "") => {
    const p = platformStr.toLowerCase().trim();
    if (p.includes("instagram") || p.includes("insta")) return "fa-brands fa-instagram";
    if (p.includes("github")) return "fa-brands fa-github";
    if (p.includes("twitter") || p.includes("x.com") || p.includes("x/")) return "fa-brands fa-x-twitter";
    if (p.includes("discord")) return "fa-brands fa-discord";
    if (p.includes("youtube") || p.includes("youtu.be")) return "fa-brands fa-youtube";
    if (p.includes("spotify")) return "fa-brands fa-spotify";
    if (p.includes("twitch")) return "fa-brands fa-twitch";
    if (p.includes("linkedin")) return "fa-brands fa-linkedin";
    if (p.includes("tiktok")) return "fa-brands fa-tiktok";
    return "fa-solid fa-link";
  };

  const ensureWidgetCardIds = () => {
    const cards = document.querySelectorAll('.glass-widget-card');
    cards.forEach((card, index) => {
      if (!card.id) card.id = `widget_card_${index + 1}`;
    });
  };

  const canEditCurrentProfile = (authUser) => {
    if (!targetUserId) return false;
    if (isCurrentUserAdmin) return true; 
    return authUser && authUser.uid === targetUserId; 
  };

  const updateEditorPermissionUI = (authUser) => {
    const canEdit = canEditCurrentProfile(authUser);
    const actionsBar = document.querySelector(".floating-actions-bar");

    if (actionsBar) {
      if (canEdit) actionsBar.classList.remove("hidden");
      else actionsBar.classList.add("hidden");
    }

    if (openEditorBtn) openEditorBtn.style.display = canEdit ? "inline-flex" : "none";
    if (toggleLockBtn) toggleLockBtn.style.display = canEdit ? "inline-flex" : "none";
    if (resetPositionsBtn) resetPositionsBtn.style.display = canEdit ? "inline-flex" : "none";
  };

  // ==========================================================================
  // VIEW TRACKING
  // ==========================================================================
  const trackProfileView = async (targetUid, authUser) => {
    if (!targetUid) return;
    if (authUser && authUser.uid === targetUid) return;

    const sessionKey = `biogram_viewed_${targetUid}`;
    if (sessionStorage.getItem(sessionKey)) return;

    try {
      sessionStorage.setItem(sessionKey, 'true');
      const userRef = doc(db, "users", targetUid);
      await updateDoc(userRef, {
        views: increment(1)
      });
      
      if (currentLoadedUserData) {
        currentLoadedUserData.views = (currentLoadedUserData.views || 0) + 1;
        const viewsEl = document.getElementById("views-count");
        if (viewsEl) {
          viewsEl.textContent = Number(currentLoadedUserData.views).toLocaleString();
        }
      }
    } catch (e) {
      console.warn("Could not track profile view:", e);
    }
  };

  // ==========================================================================
  // NOT FOUND STATE
  // ==========================================================================
  const renderNotFoundUI = (handle) => {
    if (overlay) overlay.classList.add('hidden');
    if (bgAudio) {
      bgAudio.pause();
      bgAudio.src = "";
    }
    if (btnToggleAudio) btnToggleAudio.style.display = "none";
    const actionsBar = document.querySelector(".floating-actions-bar");
    if (actionsBar) actionsBar.classList.add("hidden");

    if (spaceContainer) {
      spaceContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 65vh; text-align: center; color: #ffffff; padding: 2rem; margin: 0 auto;">
          <i class="fa-solid fa-user-slash" style="font-size: 3.5rem; color: #ef4444; margin-bottom: 1.25rem;"></i>
          <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem;">Profile Not Found</h2>
          <p style="opacity: 0.75; max-width: 420px; margin-bottom: 1.5rem; font-size: 0.95rem; line-height: 1.5;">
            ${handle ? `The profile <b>@${escapeHtml(handle)}</b> does not exist or has been removed.` : 'No user handle specified or you are not logged in.'}
          </p>
          <a href="/" style="padding: 10px 22px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-house"></i> Return Home
          </a>
        </div>
      `;
      spaceContainer.style.opacity = "1";
      spaceContainer.style.pointerEvents = "auto";
      spaceContainer.classList.remove('hidden');
    }
  };

  // ==========================================================================
  // AUDIO & OVERLAY
  // ==========================================================================
  if (overlay) {
    overlay.addEventListener('click', () => {
      if (bgAudio && bgAudio.src) {
        bgAudio.play().then(() => {
          if (audioIcon) audioIcon.className = "fa-solid fa-pause";
        }).catch(err => console.warn('Autoplay prevented:', err));
      }

      overlay.style.transition = "opacity 0.4s ease, visibility 0.4s ease";
      overlay.style.opacity = "0";
      overlay.style.visibility = "hidden";

      setTimeout(() => {
        overlay.classList.add('hidden');
        if (spaceContainer) spaceContainer.classList.remove('hidden');
      }, 400);
    });
  }

  if (btnToggleAudio && bgAudio) {
    btnToggleAudio.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!bgAudio.src) return;
      if (bgAudio.paused) {
        bgAudio.play();
        if (audioIcon) audioIcon.className = "fa-solid fa-pause";
      } else {
        bgAudio.pause();
        if (audioIcon) audioIcon.className = "fa-solid fa-play";
      }
    });
  }

  if (volumeSlider && bgAudio) {
    bgAudio.volume = volumeSlider.value / 100;
    volumeSlider.addEventListener('input', (e) => {
      bgAudio.volume = e.target.value / 100;
    });
  }

  // ==========================================================================
  // MOBILE ORDER UI & EXPANDABLE ACCORDION
  // ==========================================================================
  toggleMobileOrderBtn?.addEventListener("click", () => {
    if (!mobileOrderListContainer) return;
    const isHidden = mobileOrderListContainer.classList.contains("hidden");
    if (isHidden) {
      mobileOrderListContainer.classList.remove("hidden");
      if (mobileOrderChevron) mobileOrderChevron.style.transform = "rotate(180deg)";
    } else {
      mobileOrderListContainer.classList.add("hidden");
      if (mobileOrderChevron) mobileOrderChevron.style.transform = "rotate(0deg)";
    }
  });

  const renderMobileOrderList = () => {
    if (!mobileOrderListContainer) return;
    mobileOrderListContainer.innerHTML = "";

    tempMobileOrder.forEach((key, index) => {
      const itemRow = document.createElement("div");
      itemRow.className = "mobile-order-item";

      const label = document.createElement("span");
      label.textContent = WIDGET_LABELS[key] || key;

      const btnsGroup = document.createElement("div");
      btnsGroup.className = "mobile-order-btns";

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "mobile-order-btn";
      upBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
      upBtn.disabled = index === 0;
      upBtn.addEventListener("click", () => moveMobileOrderItem(index, index - 1));

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "mobile-order-btn";
      downBtn.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
      downBtn.disabled = index === tempMobileOrder.length - 1;
      downBtn.addEventListener("click", () => moveMobileOrderItem(index, index + 1));

      btnsGroup.appendChild(upBtn);
      btnsGroup.appendChild(downBtn);

      itemRow.appendChild(label);
      itemRow.appendChild(btnsGroup);
      mobileOrderListContainer.appendChild(itemRow);
    });
  };

  const moveMobileOrderItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= tempMobileOrder.length) return;
    const item = tempMobileOrder.splice(fromIndex, 1)[0];
    tempMobileOrder.splice(toIndex, 0, item);
    renderMobileOrderList();
  };

  const applyMobileLayoutOrder = (orderArray) => {
    if (!spaceContainer) return;

    const currentOrder = (Array.isArray(orderArray) && orderArray.length > 0)
      ? orderArray
      : DEFAULT_WIDGET_ORDER;

    currentOrder.forEach(key => {
      const elId = WIDGET_ELEMENT_IDS[key];
      const widgetEl = elId ? document.getElementById(elId) : null;
      if (widgetEl && widgetEl.parentElement === spaceContainer) {
        spaceContainer.appendChild(widgetEl);
      }
    });
  };

  // ==========================================================================
  // LAYOUT PERSISTENCE & LOCK/DRAG
  // ==========================================================================
  const getLayoutPositionsDict = () => {
    ensureWidgetCardIds();
    const cards = document.querySelectorAll('.glass-widget-card');
    const positions = {};

    cards.forEach((card) => {
      if (card.style.left && card.style.top) {
        positions[card.id] = {
          left: card.style.left,
          top: card.style.top
        };
      }
    });

    return positions;
  };

  const saveLayoutToLocalStorage = () => {
    if (isMobile()) return;
    const positions = getLayoutPositionsDict();
    const cacheKey = getLocalStorageKey();
    if (Object.keys(positions).length > 0) {
      localStorage.setItem(cacheKey, JSON.stringify(positions));
    } else {
      localStorage.removeItem(cacheKey);
    }
  };

  const applySavedPositions = (savedPositions) => {
    ensureWidgetCardIds();
    const cards = document.querySelectorAll('.glass-widget-card');

    if (isMobile()) {
      cards.forEach(card => {
        card.style.position = '';
        card.style.left = '';
        card.style.top = '';
        card.style.margin = '';
      });
      if (spaceContainer) spaceContainer.style.minHeight = '';
      isLayoutAbsolute = false;
      applyMobileLayoutOrder(activeSpaceConfig.mobileWidgetOrder);
      return;
    }

    let positionsToApply = savedPositions;
    if (!positionsToApply || Object.keys(positionsToApply).length === 0) {
      try {
        const localCache = localStorage.getItem(getLocalStorageKey());
        if (localCache) positionsToApply = JSON.parse(localCache);
      } catch (e) {
        console.warn("Could not load local layout cache:", e);
      }
    }

    if (!positionsToApply || Object.keys(positionsToApply).length === 0) return;

    let hasSaved = false;

    cards.forEach((card) => {
      const pos = positionsToApply[card.id];
      if (pos && pos.left && pos.top) {
        card.style.position = 'absolute';
        card.style.margin = '0';
        card.style.left = pos.left;
        card.style.top = pos.top;
        hasSaved = true;
      }
    });

    if (hasSaved) isLayoutAbsolute = true;
  };

  const convertAllToAbsolute = () => {
    if (isMobile() || !spaceContainer) return;
    ensureWidgetCardIds();

    const currentContainerHeight = spaceContainer.offsetHeight;
    if (currentContainerHeight > 0) {
      spaceContainer.style.minHeight = `${currentContainerHeight}px`;
    }

    const wrapperRect = spaceContainer.getBoundingClientRect();
    const visibleCards = Array.from(document.querySelectorAll('.glass-widget-card:not(.hidden)'));

    const calculatedPositions = visibleCards.map(card => {
      if (card.style.position === 'absolute' && card.style.left) {
        return { card, left: card.style.left, top: card.style.top };
      }
      const rect = card.getBoundingClientRect();
      return {
        card,
        left: `${rect.left - wrapperRect.left}px`,
        top: `${rect.top - wrapperRect.top}px`
      };
    });

    calculatedPositions.forEach(({ card, left, top }) => {
      card.style.position = 'absolute';
      card.style.margin = '0';
      card.style.left = left;
      card.style.top = top;
    });

    isLayoutAbsolute = true;
  };

  const resetToFlexLayout = () => {
    const cards = document.querySelectorAll('.glass-widget-card');
    cards.forEach(card => {
      card.style.position = '';
      card.style.left = '';
      card.style.top = '';
      card.style.margin = '';
      card.style.zIndex = '';
    });
    if (spaceContainer) spaceContainer.style.minHeight = '';
    isLayoutAbsolute = false;
    localStorage.removeItem(getLocalStorageKey());
  };

  const updateLockStateUI = () => {
    const cards = document.querySelectorAll('.glass-widget-card');
    
    cards.forEach(card => {
      if (isLayoutLocked || isMobile()) {
        card.style.cursor = 'default';
        card.classList.remove('can-drag');
      } else {
        card.style.cursor = 'grab';
        card.classList.add('can-drag');
      }
    });

    if (toggleLockBtn) {
      if (isMobile()) {
        toggleLockBtn.style.display = "none";
      } else {
        toggleLockBtn.style.display = canEditCurrentProfile(auth.currentUser) ? "inline-flex" : "none";
        if (isLayoutLocked) {
          toggleLockBtn.innerHTML = `<i class="fa-solid fa-lock"></i> <span>Locked</span>`;
          toggleLockBtn.classList.remove('active-unlock');
        } else {
          toggleLockBtn.innerHTML = `<i class="fa-solid fa-lock-open"></i> <span>Move Widgets</span>`;
          toggleLockBtn.classList.add('active-unlock');
        }
      }
    }
  };

  toggleLockBtn?.addEventListener('click', async () => {
    if (isMobile()) return;
    if (!canEditCurrentProfile(auth.currentUser)) {
      alert("You don't have permission to modify this space.");
      return;
    }

    isLayoutLocked = !isLayoutLocked;

    if (!isLayoutLocked) {
      convertAllToAbsolute();
    } else {
      saveLayoutToLocalStorage();
      const positions = getLayoutPositionsDict();
      activeSpaceConfig.widgetPositions = positions;

      const currentUid = auth.currentUser?.uid;
      if (currentUid && Object.keys(positions).length > 0) {
        try {
          await setDoc(doc(db, "users_spaces", currentUid), { widgetPositions: positions }, { merge: true });
        } catch (err) {
          console.warn("Could not sync layout to database:", err);
        }
      }
    }

    updateLockStateUI();
  });

  const makeCardDraggable = (card, index = 0) => {
    if (!card.id) card.id = `widget_card_${index || Date.now()}`;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    card.querySelectorAll('img').forEach(img => img.ondragstart = (e) => e.preventDefault());

    const startDrag = (e, clientX, clientY, target) => {
      if (isLayoutLocked || isMobile() || !canEditCurrentProfile(auth.currentUser)) return;
      if (target.closest('button, input, textarea, a, i, iframe, select, .no-drag')) return;

      if (e && e.preventDefault) e.preventDefault();
      if (!isLayoutAbsolute) convertAllToAbsolute();

      isDragging = true;
      card.style.zIndex = '1000';
      card.style.cursor = 'grabbing';

      const cardRect = card.getBoundingClientRect();
      offsetX = clientX - cardRect.left;
      offsetY = clientY - cardRect.top;
    };

    const moveDrag = (clientX, clientY) => {
      if (!isDragging || isMobile() || !spaceContainer) return;
      const wrapperRect = spaceContainer.getBoundingClientRect();
      card.style.left = `${clientX - wrapperRect.left - offsetX}px`;
      card.style.top = `${clientY - wrapperRect.top - offsetY}px`;
    };

    const endDrag = () => {
      if (isDragging) {
        isDragging = false;
        card.style.zIndex = '10';
        card.style.cursor = (isLayoutLocked || isMobile()) ? 'default' : 'grab';
        saveLayoutToLocalStorage();
      }
    };

    card.addEventListener('mousedown', (e) => startDrag(e, e.clientX, e.clientY, e.target));
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault();
        moveDrag(e.clientX, e.clientY);
      }
    });
    document.addEventListener('mouseup', endDrag);
  };

  const initDragAndDrop = () => {
    ensureWidgetCardIds();
    document.querySelectorAll('.glass-widget-card').forEach((card, index) => makeCardDraggable(card, index));
    updateLockStateUI();
  };

  initDragAndDrop();

  window.addEventListener('resize', () => {
    if (activeSpaceConfig) {
      applySavedPositions(activeSpaceConfig.widgetPositions);
      applyMobileLayoutOrder(activeSpaceConfig.mobileWidgetOrder);
      updateLockStateUI();
    }
  });

  resetPositionsBtn?.addEventListener('click', async () => {
    if (!canEditCurrentProfile(auth.currentUser)) {
      alert("Permission denied.");
      return;
    }

    if (!confirm("Are you sure you want to reset all widget positions to default?")) return;

    resetToFlexLayout();
    activeSpaceConfig.widgetPositions = {};
    activeSpaceConfig.mobileWidgetOrder = [...DEFAULT_WIDGET_ORDER];

    const currentUid = auth.currentUser?.uid;
    if (currentUid) {
      try {
        await setDoc(doc(db, "users_spaces", currentUid), { 
          widgetPositions: {}, 
          mobileWidgetOrder: [...DEFAULT_WIDGET_ORDER] 
        }, { merge: true });
      } catch (err) {
        console.warn("Error resetting layout on database:", err);
      }
    }

    alert("Layout reset successfully!");
  });

  // ==========================================================================
  // WIDGET RENDERERS
  // ==========================================================================
  const renderClockWidget = (clockConfig = {}) => {
    const widget = document.getElementById("clock-card-widget");
    const clockEl = document.getElementById("clock-time");
    const dateEl = document.getElementById("clock-date");

    const showClock = clockConfig.showClock !== false;
    const is24Hour = clockConfig.clockFormat === '24h';
    const showSeconds = clockConfig.clockShowSeconds !== false;
    const showDate = clockConfig.clockShowDate !== false;

    if (!showClock) {
      widget?.classList.add("hidden");
      if (clockInterval) clearInterval(clockInterval);
      return;
    }

    widget?.classList.remove("hidden");

    if (dateEl) dateEl.style.display = showDate ? 'block' : 'none';

    const updateTime = () => {
      const now = new Date();
      if (clockEl) {
        const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: !is24Hour };
        if (showSeconds) timeOptions.second = '2-digit';
        clockEl.textContent = now.toLocaleTimeString('en-US', timeOptions);
      }
      if (dateEl && showDate) {
        dateEl.textContent = now.toLocaleDateString('en-US', {
          weekday: 'long', month: 'short', day: 'numeric'
        });
      }
    };

    updateTime();
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(updateTime, 1000);
  };

  const renderProfileWidget = (userData, spaceData, authUser, showProfile) => {
    const widget = document.getElementById("profile-card-widget");
    const avatarImg = document.getElementById("space-avatar-img");
    const displayNameEl = document.getElementById("space-display-name");
    const handleEl = document.getElementById("space-handle-text");
    const bioEl = document.getElementById("space-bio-text");

    if (!showProfile) {
      widget?.classList.add("hidden");
      return;
    }

    widget?.classList.remove("hidden");

    if (avatarImg) {
      let photoUrl = spaceData?.customAvatarUrl || userData?.photoURL;
      if (!photoUrl || !photoUrl.trim()) {
        const seed = spaceData?.handle || userData?.handle || handleParam || "biogram";
        photoUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
      }
      avatarImg.src = photoUrl;
    }

    if (displayNameEl) {
      const name = spaceData?.displayName || userData?.displayName || "User";
      displayNameEl.innerHTML = `${escapeHtml(name)} <i class="fa-solid fa-circle-check verified-icon" style="color: var(--primary-color, #3b82f6);"></i>`;
    }

    if (handleEl) {
      const handle = spaceData?.handle || userData?.handle || handleParam || "user";
      handleEl.textContent = `@${handle}`;
    }

    if (bioEl) {
      const bioText = spaceData?.bio !== undefined ? spaceData.bio : (userData?.bio || "");
      if (bioText && bioText.trim() !== "") {
        bioEl.textContent = bioText;
        bioEl.style.display = "block";
      } else {
        bioEl.textContent = "";
        bioEl.style.display = "none";
      }
    }
  };

  const renderDiscordWidget = async (discordId, showDiscord) => {
    const widget = document.getElementById("discord-card-widget");
    const discordStatusEl = document.getElementById("discord-status-text");
    const discordDetailEl = document.getElementById("discord-detail-text");
    const statusDot = document.getElementById("discord-status-dot");

    const cleanDiscordId = (discordId || "").trim();

    if (!showDiscord || !cleanDiscordId) {
      if (!cleanDiscordId && discordStatusEl) {
        discordStatusEl.textContent = "Discord Not Linked";
        if (discordDetailEl) discordDetailEl.textContent = "Add Discord ID in settings";
        if (statusDot) statusDot.style.background = "#64748b";
      }
      if (!showDiscord) widget?.classList.add("hidden");
      if (discordTimerInterval) clearInterval(discordTimerInterval);
      return;
    }

    widget?.classList.remove("hidden");

    try {
      const res = await fetch(`https://api.lanyard.rest/v1/users/${cleanDiscordId}`);
      if (!res.ok) throw new Error("Discord status request failed");
      const data = await res.json();

      if (data.success && data.data) {
        const dUser = data.data.discord_user;
        const status = data.data.discord_status || "offline";
        const activities = data.data.activities || [];
        const spotify = data.data.spotify;

        const statusColors = { online: '#22c55e', idle: '#eab308', dnd: '#ef4444', offline: '#64748b' };
        if (statusDot) statusDot.style.background = statusColors[status] || '#64748b';

        if (discordStatusEl) {
          discordStatusEl.textContent = `${dUser.global_name || dUser.username}`;
        }

        if (discordTimerInterval) clearInterval(discordTimerInterval);

        let activityText = "";
        let startTimeStamp = null;

        if (spotify) {
          activityText = `<i class="fa-brands fa-spotify" style="color:#1db954;"></i> Listening to <b>${escapeHtml(spotify.song)}</b>`;
        } else if (activities.length > 0) {
          const game = activities.find(a => a.type === 0 || a.type === 1 || a.type === 2);
          const customStatus = activities.find(a => a.type === 4);

          if (game) {
            activityText = `Playing <b>${escapeHtml(game.name)}</b>`;
            if (game.timestamps && game.timestamps.start) startTimeStamp = game.timestamps.start;
          } else if (customStatus && customStatus.state) {
            activityText = escapeHtml(customStatus.state);
          }
        }

        const updateElapsedTime = () => {
          if (!startTimeStamp) {
            if (discordDetailEl) discordDetailEl.innerHTML = activityText || status.toUpperCase();
            return;
          }

          const elapsedMs = Date.now() - startTimeStamp;
          if (elapsedMs < 0) return;

          const totalSeconds = Math.floor(elapsedMs / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;

          const formattedMins = String(minutes).padStart(2, '0');
          const formattedSecs = String(seconds).padStart(2, '0');

          let timeStr = hours > 0 ? `${hours}h ${formattedMins}m` : `${formattedMins}:${formattedSecs}`;

          if (discordDetailEl) {
            discordDetailEl.innerHTML = `${activityText} <span style="display: block; opacity: 0.85; font-size: 0.75rem; margin-top: 2px;">elapsed ${timeStr}</span>`;
          }
        };

        updateElapsedTime();
        if (startTimeStamp) discordTimerInterval = setInterval(updateElapsedTime, 1000);
      } else {
        if (discordStatusEl) discordStatusEl.textContent = "Discord Status";
        if (discordDetailEl) discordDetailEl.textContent = "Offline or User Not Found";
        if (statusDot) statusDot.style.background = "#64748b";
      }
    } catch (err) {
      console.warn("Discord fetch error:", err);
      if (discordStatusEl) discordStatusEl.textContent = "Discord Status";
      if (discordDetailEl) discordDetailEl.textContent = "Unable to load presence";
      if (statusDot) statusDot.style.background = "#64748b";
    }
  };

  const renderSpotifyWidget = (spotifyUrl, showSpotify) => {
    const widget = document.getElementById("spotify-card-widget");
    let iframe = document.getElementById("spotify-iframe");

    const cleanSpotifyUrl = (spotifyUrl || "").trim();

    if (!showSpotify) {
      widget?.classList.add("hidden");
      return;
    }

    widget?.classList.remove("hidden");

    if (!cleanSpotifyUrl) {
      if (widget) {
        widget.innerHTML = `
          <div style="padding: 16px; text-align: center; color: rgba(255,255,255,0.7); font-size: 0.85rem;">
            <i class="fa-brands fa-spotify" style="font-size: 1.5rem; margin-bottom: 6px; color: #1db954; display:block;"></i>
            <span>No Music Playlist Connected</span>
          </div>`;
      }
      return;
    }

    try {
      let embedUrl = cleanSpotifyUrl;
      if (!cleanSpotifyUrl.includes("/embed/")) {
        embedUrl = cleanSpotifyUrl.replace("open.spotify.com/", "open.spotify.com/embed/");
      }

      if (!iframe) {
        widget.innerHTML = `<iframe id="spotify-iframe" style="border-radius:12px; border:0;" src="${escapeHtml(embedUrl)}" width="100%" height="152" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
      } else {
        iframe.src = embedUrl;
      }
    } catch (e) {
      console.warn("Spotify render error:", e);
    }
  };

  const showMediaSlide = (index) => {
    const imgEl = document.getElementById("media-display-img");
    if (!mediaImages.length) return;

    if (index >= mediaImages.length) currentMediaIndex = 0;
    else if (index < 0) currentMediaIndex = mediaImages.length - 1;
    else currentMediaIndex = index;

    if (imgEl && mediaImages[currentMediaIndex]) {
      imgEl.style.opacity = '0.3';
      setTimeout(() => {
        imgEl.src = mediaImages[currentMediaIndex];
        imgEl.style.opacity = '1';
      }, 150);
    }
  };

  const renderMediaWidget = (imagesArray, showMedia) => {
    const widget = document.getElementById("media-card-widget");
    const imgEl = document.getElementById("media-display-img");

    const validImages = Array.isArray(imagesArray) 
      ? imagesArray.filter(url => typeof url === 'string' && url.trim().length > 0)
      : [];

    if (!showMedia || validImages.length === 0) {
      widget?.classList.add("hidden");
      if (imgEl) imgEl.src = ""; 
      if (mediaInterval) clearInterval(mediaInterval);
      mediaImages = [];
      return;
    }

    widget?.classList.remove("hidden");
    mediaImages = validImages;
    currentMediaIndex = 0;

    showMediaSlide(0);

    if (mediaInterval) clearInterval(mediaInterval);
    if (mediaImages.length > 1) {
      mediaInterval = setInterval(() => showMediaSlide(currentMediaIndex + 1), 4000);
    }
  };

  mediaPrevBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (mediaImages.length > 0) {
      showMediaSlide(currentMediaIndex - 1);
    }
  });

  mediaNextBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (mediaImages.length > 0) {
      showMediaSlide(currentMediaIndex + 1);
    }
  });

  const renderSocialsWidget = (socialsArray, showSocials) => {
    const widget = document.getElementById("socials-card-widget");
    const container = document.getElementById("card-links-container");

    if (!showSocials) {
      widget?.classList.add("hidden");
      return;
    }

    const defaultSocials = [
      { platform: "GitHub", url: "https://github.com" },
      { platform: "Instagram", url: "https://instagram.com" }
    ];

    const activeSocials = (Array.isArray(socialsArray) && socialsArray.length > 0) ? socialsArray : defaultSocials;

    if (!container) return;

    widget.classList.remove("hidden");
    container.innerHTML = "";

    activeSocials.forEach(item => {
      if (!item.url || !item.url.trim()) return;

      const rawUrl = item.url.trim();
      let fullUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
      
      let platformName = item.platform || item.label || "";
      if (!platformName || platformName.toLowerCase() === "https" || platformName.toLowerCase() === "http" || platformName.toLowerCase() === "link") {
        platformName = detectPlatformFromUrl(fullUrl);
      }

      const iconClass = getSocialIconClass(`${platformName} ${fullUrl}`);

      const a = document.createElement("a");
      a.href = fullUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "social-link-btn";
      a.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i><span>${escapeHtml(platformName)}</span>`;
      container.appendChild(a);
    });
  };

  const renderRankingsWidget = async (targetUid, userData, spaceData, showRankings) => {
    const widget = document.getElementById("rankings-card-widget");
    const rankEl = document.getElementById("user-rank-display");
    const viewsEl = document.getElementById("views-count");

    if (!showRankings) {
      widget?.classList.add("hidden");
      return;
    }

    widget?.classList.remove("hidden");

    const currentViews = userData?.views ?? spaceData?.views ?? 0;
    if (viewsEl) {
      viewsEl.textContent = Number(currentViews).toLocaleString();
    }

    if (rankEl) {
      rankEl.textContent = userData?.rank ? `#${userData.rank}` : "#1";
    }
  };

  const applyCustomSpaceStyles = (config = {}) => {
    if (config.accentColor) {
      document.documentElement.style.setProperty('--primary-color', config.accentColor);
    }

    const glassStyleMode = config.glassDesignPreset || "transparent";
    const cards = document.querySelectorAll('.glass-widget-card');

    cards.forEach(card => {
      card.classList.remove('preset-glass-standard', 'preset-glass-dark', 'preset-glass-transparent');

      if (glassStyleMode === "dark") {
        card.classList.add('preset-glass-dark');
      } else if (glassStyleMode === "standard") {
        card.classList.add('preset-glass-standard');
      } else {
        card.classList.add('preset-glass-transparent');
      }

      if (config.cardBgColor) card.style.backgroundColor = config.cardBgColor;
      if (config.cardTextColor) card.style.color = config.cardTextColor;
    });
  };

  // ==========================================================================
  // MAIN RENDER FUNCTION
  // ==========================================================================
  const renderProfileSpace = (userData, spaceData, authUser) => {
    if (!userData) {
      renderNotFoundUI(handleParam);
      return;
    }

    activeSpaceConfig = spaceData || {};
    currentLoadedUserData = userData;

    updateEditorPermissionUI(authUser);

    const audioUrl = spaceData?.audioUrl || spaceData?.bgAudioUrl || "";
    if (bgAudio) {
      if (audioUrl && audioUrl.trim() !== "") {
        bgAudio.src = audioUrl.trim();
        if (btnToggleAudio) btnToggleAudio.style.display = "flex";
      } else {
        bgAudio.pause();
        bgAudio.src = "";
        if (btnToggleAudio) btnToggleAudio.style.display = "none";
      }
    }

    const bgUrl = spaceData?.bgUrl || spaceData?.bgAssetUrl || "";
    if (bgLayer) {
      if (bgUrl && bgUrl.trim() !== "") {
        bgLayer.innerHTML = `<div style="width:100%;height:100%;background:url('${escapeHtml(bgUrl.trim())}') center/cover no-repeat;"></div>`;
      } else {
        bgLayer.innerHTML = "";
      }
    }

    renderClockWidget({
      showClock: spaceData?.showClock !== false,
      clockFormat: spaceData?.clockFormat || '12h',
      clockShowSeconds: spaceData?.clockShowSeconds !== false,
      clockShowDate: spaceData?.clockShowDate !== false
    });

    renderProfileWidget(userData, spaceData, authUser, spaceData?.showProfile !== false);
    renderDiscordWidget(spaceData?.discordId, spaceData?.showDiscord !== false);
    renderMediaWidget(spaceData?.mediaImages, spaceData?.showMedia !== false);
    renderSpotifyWidget(spaceData?.spotifyUrl, spaceData?.showSpotify !== false);
    renderSocialsWidget(spaceData?.socials, spaceData?.showSocials !== false);
    renderRankingsWidget(targetUserId, userData, spaceData, spaceData?.showRankings !== false);

    applyCustomSpaceStyles(spaceData);
    applySavedPositions(spaceData?.widgetPositions);
    applyMobileLayoutOrder(spaceData?.mobileWidgetOrder);
    updateLockStateUI();

    if (spaceContainer) {
      spaceContainer.classList.remove("hidden");
      spaceContainer.style.opacity = "1";
      spaceContainer.style.pointerEvents = "auto";
    }

    trackProfileView(targetUserId, authUser);
  };

  // ==========================================================================
  // EDITOR MODAL CONTROLS & SAVE HANDLER
  // ==========================================================================
  openEditorBtn?.addEventListener("click", () => {
    if (!canEditCurrentProfile(auth.currentUser)) {
      alert("You do not have permission to edit this space.");
      return;
    }

    setInputValue("edit-display-name", "modal-display-name", activeSpaceConfig.displayName || currentLoadedUserData?.displayName || "");
    setInputValue("edit-bio", "modal-bio", activeSpaceConfig.bio || currentLoadedUserData?.bio || "");
    setInputValue("edit-avatar-url", "modal-avatar-url", activeSpaceConfig.customAvatarUrl || "");
    setInputValue("edit-bg-url", "modal-bg-url", activeSpaceConfig.bgUrl || activeSpaceConfig.bgAssetUrl || "");
    setInputValue("edit-audio-url", "modal-audio-url", activeSpaceConfig.audioUrl || activeSpaceConfig.bgAudioUrl || "");
    setInputValue("edit-spotify-url", "modal-spotify-url", activeSpaceConfig.spotifyUrl || "");
    setInputValue("edit-discord-id", "modal-discord-id", activeSpaceConfig.discordId || "");

    const stylePresetSelect = document.getElementById("edit-glass-preset");
    if (stylePresetSelect) stylePresetSelect.value = activeSpaceConfig.glassDesignPreset || "transparent";

    const formatSelect = document.getElementById("edit-clock-format") || document.getElementById("modal-clock-format");
    if (formatSelect) formatSelect.value = activeSpaceConfig.clockFormat || "12h";

    setCheckboxValue("edit-clock-show-seconds", "modal-clock-show-seconds", activeSpaceConfig.clockShowSeconds !== false);
    setCheckboxValue("edit-clock-show-date", "modal-clock-show-date", activeSpaceConfig.clockShowDate !== false);
    setCheckboxValue("edit-show-clock", "modal-show-clock", activeSpaceConfig.showClock !== false);
    setCheckboxValue("edit-show-profile", "modal-show-profile", activeSpaceConfig.showProfile !== false);
    setCheckboxValue("edit-show-discord", "modal-show-discord", activeSpaceConfig.showDiscord !== false);
    setCheckboxValue("edit-show-spotify", "modal-show-spotify", activeSpaceConfig.showSpotify !== false);
    setCheckboxValue("edit-show-media", "modal-show-media", activeSpaceConfig.showMedia !== false);
    setCheckboxValue("edit-show-socials", "modal-show-socials", activeSpaceConfig.showSocials !== false);
    setCheckboxValue("edit-show-rankings", "modal-show-rankings", activeSpaceConfig.showRankings !== false);

    // Populate Mobile Order List
    tempMobileOrder = Array.isArray(activeSpaceConfig.mobileWidgetOrder) && activeSpaceConfig.mobileWidgetOrder.length > 0
      ? [...activeSpaceConfig.mobileWidgetOrder]
      : [...DEFAULT_WIDGET_ORDER];
    renderMobileOrderList();

    const mediaUrlsInput = document.getElementById("edit-media-urls");
    if (mediaUrlsInput) {
      mediaUrlsInput.value = Array.isArray(activeSpaceConfig.mediaImages) 
        ? activeSpaceConfig.mediaImages.join("\n") 
        : "";
    }

    const socialsInput = document.getElementById("edit-socials-data");
    if (socialsInput) {
      if (Array.isArray(activeSpaceConfig.socials) && activeSpaceConfig.socials.length > 0) {
        socialsInput.value = activeSpaceConfig.socials
          .map(item => {
            let plat = item.platform || "";
            if (!plat || plat.toLowerCase() === "https" || plat.toLowerCase() === "http") {
              plat = detectPlatformFromUrl(item.url || "");
            }
            return `${plat}: ${item.url || ''}`;
          })
          .join("\n");
      } else {
        socialsInput.value = "GitHub: https://github.com\nInstagram: https://instagram.com";
      }
    }

    if (editorModal) editorModal.classList.remove("hidden");
  });

  closeEditorBtn?.addEventListener("click", () => {
    if (editorModal) editorModal.classList.add("hidden");
  });

  saveSpaceBtn?.addEventListener("click", async () => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid || !canEditCurrentProfile(auth.currentUser)) {
      alert("Permission denied.");
      return;
    }

    const rawSocialsText = getInputValue("edit-socials-data");
    const parsedSocials = rawSocialsText
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        if (/^https?:\/\//i.test(line)) {
          return { platform: detectPlatformFromUrl(line), url: line };
        }
        
        const colonIdx = line.indexOf(":");
        if (colonIdx !== -1) {
          const prefix = line.substring(0, colonIdx).trim();
          const remainder = line.substring(colonIdx + 1).trim();
          
          if (prefix.toLowerCase() === "http" || prefix.toLowerCase() === "https") {
            return { platform: detectPlatformFromUrl(line), url: line };
          }
          return { platform: prefix || detectPlatformFromUrl(remainder), url: remainder };
        }
        
        return { platform: detectPlatformFromUrl(line), url: line };
      });

    const updatedConfig = {
      ...activeSpaceConfig,
      displayName: getInputValue("edit-display-name"),
      bio: getInputValue("edit-bio"),
      customAvatarUrl: getInputValue("edit-avatar-url"),
      bgUrl: getInputValue("edit-bg-url"),
      audioUrl: getInputValue("edit-audio-url"),
      spotifyUrl: getInputValue("edit-spotify-url"),
      discordId: getInputValue("edit-discord-id"),
      glassDesignPreset: document.getElementById("edit-glass-preset")?.value || "transparent",
      clockFormat: document.getElementById("edit-clock-format")?.value || "12h",
      clockShowSeconds: getCheckboxValue("edit-clock-show-seconds"),
      clockShowDate: getCheckboxValue("edit-clock-show-date"),
      showClock: getCheckboxValue("edit-show-clock"),
      showProfile: getCheckboxValue("edit-show-profile"),
      showDiscord: getCheckboxValue("edit-show-discord"),
      showSpotify: getCheckboxValue("edit-show-spotify"),
      showMedia: getCheckboxValue("edit-show-media"),
      showSocials: getCheckboxValue("edit-show-socials"),
      showRankings: getCheckboxValue("edit-show-rankings"),
      mobileWidgetOrder: [...tempMobileOrder],
      socials: parsedSocials,
      mediaImages: getInputValue("edit-media-urls").split("\n").map(s => s.trim()).filter(Boolean)
    };

    try {
      await setDoc(doc(db, "users_spaces", currentUid), updatedConfig, { merge: true });
      if (editorModal) editorModal.classList.add("hidden");

      activeSpaceConfig = updatedConfig;
      renderProfileSpace(currentLoadedUserData, activeSpaceConfig, auth.currentUser);
      applyMobileLayoutOrder(updatedConfig.mobileWidgetOrder);

      alert("Your space was updated successfully!");
    } catch (err) {
      console.error("Error saving space:", err);
      alert("Failed to save settings.");
    }
  });

  // ==========================================================================
  // INITIALIZE AUTH OBSERVER & TARGET USER RESOLUTION
  // ==========================================================================
  onAuthStateChanged(auth, async (authUser) => {
    isCurrentUserAdmin = false;

    if (authUser) {
      try {
        const adminDoc = await getDoc(doc(db, "users", authUser.uid));
        if (adminDoc.exists()) {
          const adminData = adminDoc.data();
          isCurrentUserAdmin = adminData.isAdmin === true || adminData.role === "admin";
        }
      } catch (e) {
        console.warn("Could not check admin status:", e);
      }
    }

    try {
      if (handleParam) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("handle", "==", handleParam), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          targetUserId = userDoc.id;
          const userData = userDoc.data();

          const spaceDoc = await getDoc(doc(db, "users_spaces", targetUserId));
          const spaceData = spaceDoc.exists() ? spaceDoc.data() : {};

          renderProfileSpace(userData, spaceData, authUser);
        } else {
          targetUserId = null;
          renderNotFoundUI(handleParam);
        }
      } else if (authUser) {
        targetUserId = authUser.uid;
        const userDoc = await getDoc(doc(db, "users", authUser.uid));
        const spaceDoc = await getDoc(doc(db, "users_spaces", authUser.uid));

        const userData = userDoc.exists() ? userDoc.data() : { displayName: authUser.displayName, handle: "user" };
        const spaceData = spaceDoc.exists() ? spaceDoc.data() : {};

        renderProfileSpace(userData, spaceData, authUser);
      } else {
        targetUserId = null;
        renderNotFoundUI(null);
      }
    } catch (e) {
      console.error("Error initializing space:", e);
      renderNotFoundUI(handleParam);
    }
  });

});
