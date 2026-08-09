// ==========================================================================
// FIREBASE IMPORTS
// ==========================================================================
import { auth, db } from "./firebase.js?v=20260810a";
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
  orderBy,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { isUserPremium, getSystemConfig, openMembershipModal } from "./membership.js?v=20260810a";

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
  const toggleReorderBtn = document.getElementById("toggle-reorder-btn");

  const mediaPrevBtn = document.getElementById("media-prev-btn");
  const mediaNextBtn = document.getElementById("media-next-btn");
  const spaceBrandingFooter = document.getElementById("space-branding-footer");

  const urlParams = new URLSearchParams(window.location.search);
  const handleParam = urlParams.get("u")?.toLowerCase().trim() || urlParams.get("handle")?.toLowerCase().trim();

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
  let countdownInterval = null;
  let isReorderModeActive = false;
  let isViewerPremium = false;
  let siteConfig = { freeMediaLimit: 3, freeCustomWidgetLimit: 1 };

  const isMobile = () => window.innerWidth <= 600;
  const getLocalStorageKey = () => targetUserId ? `biogram_space_layout_cache_${targetUserId}` : 'biogram_space_layout_cache_guest';
  const getOrderStorageKey = () => targetUserId ? `biogram_widget_order_cache_${targetUserId}` : 'biogram_widget_order_cache_guest';

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
    if (toggleReorderBtn) toggleReorderBtn.style.display = (canEdit && isMobile()) ? "inline-flex" : "none";
  };

  // ==========================================================================
  // VIEW TRACKING (PREVENTS SELF-VIEWS & REFRESH SPAM)
  // ==========================================================================
  const trackProfileView = async (targetUid, authUser) => {
    if (!targetUid) return;

    // 1. Do NOT count view if user is viewing their own profile
    if (authUser && authUser.uid === targetUid) return;

    // 2. Prevent duplicate view count in the same browser session
    const sessionKey = `biogram_viewed_${targetUid}`;
    if (sessionStorage.getItem(sessionKey)) return;

    try {
      sessionStorage.setItem(sessionKey, 'true');
      const userRef = doc(db, "users", targetUid);
      await updateDoc(userRef, {
        views: increment(1)
      });
      
      // Update local state views visually
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

    if (toggleReorderBtn) {
      toggleReorderBtn.style.display = (isMobile() && canEditCurrentProfile(auth.currentUser)) ? "inline-flex" : "none";
      if (!isMobile() && isReorderModeActive) {
        isReorderModeActive = false;
        document.body.classList.remove('reorder-mode-active');
        toggleReorderBtn.innerHTML = `<i class="fa-solid fa-arrow-up-down"></i> <span>Reorder</span>`;
        toggleReorderBtn.classList.remove('active-unlock');
      }
    }

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

      if (targetUserId && Object.keys(positions).length > 0) {
        try {
          await setDoc(doc(db, "users_spaces", targetUserId), { widgetPositions: positions }, { merge: true });
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

  // ==========================================================================
  // MOBILE WIDGET REORDER (up/down controls instead of free-drag on mobile)
  // ==========================================================================
  const getOrderedVisibleCards = () => {
    return Array.from(document.querySelectorAll('.glass-widget-card:not(.hidden)'));
  };

  const getWidgetOrderArray = () => {
    ensureWidgetCardIds();
    return getOrderedVisibleCards()
      .sort((a, b) => (parseInt(a.style.order, 10) || 0) - (parseInt(b.style.order, 10) || 0))
      .map(c => c.id);
  };

  const applyWidgetOrder = (orderArray) => {
    ensureWidgetCardIds();
    if (!Array.isArray(orderArray) || orderArray.length === 0) return;
    orderArray.forEach((id, index) => {
      const card = document.getElementById(id);
      if (card) card.style.order = index;
    });
  };

  const saveWidgetOrderToLocalStorage = () => {
    const order = getWidgetOrderArray();
    localStorage.setItem(getOrderStorageKey(), JSON.stringify(order));
  };

  const buildReorderControls = (card) => {
    if (card.querySelector('.widget-reorder-controls')) return;
    const controls = document.createElement('div');
    controls.className = 'widget-reorder-controls no-drag';
    controls.innerHTML = `
      <button type="button" class="reorder-move-btn reorder-up-btn" aria-label="Move up"><i class="fa-solid fa-chevron-up"></i></button>
      <button type="button" class="reorder-move-btn reorder-down-btn" aria-label="Move down"><i class="fa-solid fa-chevron-down"></i></button>
    `;
    card.style.position = card.style.position || 'relative';
    card.appendChild(controls);

    controls.querySelector('.reorder-up-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      moveWidgetInOrder(card, -1);
    });
    controls.querySelector('.reorder-down-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      moveWidgetInOrder(card, 1);
    });
  };

  const moveWidgetInOrder = (card, direction) => {
    const visibleCards = getOrderedVisibleCards().sort((a, b) => (parseInt(a.style.order, 10) || 0) - (parseInt(b.style.order, 10) || 0));
    const idx = visibleCards.indexOf(card);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= visibleCards.length) return;

    // Swap order values between the two cards
    const currentOrder = parseInt(card.style.order, 10) || idx;
    const otherCard = visibleCards[swapIdx];
    const otherOrder = parseInt(otherCard.style.order, 10) || swapIdx;
    card.style.order = otherOrder;
    otherCard.style.order = currentOrder;

    saveWidgetOrderToLocalStorage();
    activeSpaceConfig.widgetOrder = getWidgetOrderArray();
    persistWidgetOrderToDb();
  };

  let persistOrderTimeout = null;
  const persistWidgetOrderToDb = () => {
    if (!targetUserId || !canEditCurrentProfile(auth.currentUser)) return;
    clearTimeout(persistOrderTimeout);
    persistOrderTimeout = setTimeout(async () => {
      try {
        await setDoc(doc(db, "users_spaces", targetUserId), { widgetOrder: activeSpaceConfig.widgetOrder }, { merge: true });
      } catch (err) {
        console.warn("Could not sync widget order to database:", err);
      }
    }, 600);
  };

  const setReorderMode = (active) => {
    isReorderModeActive = active && isMobile();
    document.body.classList.toggle('reorder-mode-active', isReorderModeActive);

    if (isReorderModeActive) {
      document.querySelectorAll('.glass-widget-card:not(.hidden)').forEach(buildReorderControls);
    }

    if (toggleReorderBtn) {
      if (isReorderModeActive) {
        toggleReorderBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Done</span>`;
        toggleReorderBtn.classList.add('active-unlock');
      } else {
        toggleReorderBtn.innerHTML = `<i class="fa-solid fa-arrow-up-down"></i> <span>Reorder</span>`;
        toggleReorderBtn.classList.remove('active-unlock');
      }
    }
  };

  toggleReorderBtn?.addEventListener('click', () => {
    if (!canEditCurrentProfile(auth.currentUser)) {
      alert("You don't have permission to modify this space.");
      return;
    }
    setReorderMode(!isReorderModeActive);
  });

  // ==========================================================================
  // ACCORDION EDITOR — only the section in use expands (bound once)
  // ==========================================================================
  document.querySelectorAll('.accordion-section .accordion-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const section = trigger.closest('.accordion-section');
      if (!section) return;
      section.classList.toggle('open');
    });
  });

  // ==========================================================================
  // THEME PRESET & ACCENT COLOR PICKERS (bound once)
  // ==========================================================================
  let selectedGlassPreset = "transparent";
  let selectedAccentColor = "#6366f1";

  const themePresetGrid = document.getElementById("theme-preset-grid");
  const glassPresetHidden = document.getElementById("edit-glass-preset");
  const accentSwatchRow = document.getElementById("accent-swatch-row");
  const accentColorInput = document.getElementById("edit-accent-color");
  const editorUpgradeBtn = document.getElementById("editor-upgrade-btn");
  const editorProBanner = document.getElementById("editor-pro-banner");
  const accentProChip = document.getElementById("accent-pro-chip");

  const syncThemeGridUI = () => {
    themePresetGrid?.querySelectorAll('.theme-option-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.preset === selectedGlassPreset);
    });
  };

  const syncAccentSwatchUI = () => {
    accentSwatchRow?.querySelectorAll('.accent-swatch').forEach(sw => {
      sw.classList.toggle('selected', sw.dataset.color?.toLowerCase() === selectedAccentColor.toLowerCase());
    });
    if (accentColorInput) accentColorInput.value = selectedAccentColor;
  };

  themePresetGrid?.querySelectorAll('.theme-option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const isProPreset = btn.dataset.pro === "true";
      if (isProPreset && !isViewerPremium) {
        openMembershipModal();
        return;
      }
      selectedGlassPreset = btn.dataset.preset;
      if (glassPresetHidden) glassPresetHidden.value = selectedGlassPreset;
      syncThemeGridUI();
    });
  });

  accentSwatchRow?.querySelectorAll('.accent-swatch').forEach((sw) => {
    sw.addEventListener('click', () => {
      if (!isViewerPremium) {
        openMembershipModal();
        return;
      }
      selectedAccentColor = sw.dataset.color;
      syncAccentSwatchUI();
    });
  });

  accentColorInput?.addEventListener('input', (e) => {
    if (!isViewerPremium) {
      openMembershipModal();
      e.target.value = selectedAccentColor;
      return;
    }
    selectedAccentColor = e.target.value;
    syncAccentSwatchUI();
  });

  editorUpgradeBtn?.addEventListener('click', () => openMembershipModal());

  document.getElementById("edit-bg-particles")?.addEventListener('change', (e) => {
    if (!isViewerPremium && e.target.checked) {
      e.target.checked = false;
      openMembershipModal();
    }
  });

  window.addEventListener('resize', () => {
    if (activeSpaceConfig) {
      applySavedPositions(activeSpaceConfig.widgetPositions);
      updateLockStateUI();
    }
  });

  resetPositionsBtn?.addEventListener('click', async () => {
    if (!canEditCurrentProfile(auth.currentUser)) {
      alert("Permission denied.");
      return;
    }

    if (!confirm("Are you sure you want to reset all widget positions and order to default?")) return;

    resetToFlexLayout();
    activeSpaceConfig.widgetPositions = {};
    activeSpaceConfig.widgetOrder = [];

    // Clear order styling on all cards + local caches
    document.querySelectorAll('.glass-widget-card').forEach(card => { card.style.order = ''; });
    localStorage.removeItem(getOrderStorageKey());

    if (targetUserId) {
      try {
        await setDoc(doc(db, "users_spaces", targetUserId), { widgetPositions: {}, widgetOrder: [] }, { merge: true });
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

  const applyCustomSpaceStyles = (config = {}, viewerIsPremium = false) => {
    // Accent color & premium-only presets are gated behind Pro; silently fall back for non-premium.
    if (config.accentColor && viewerIsPremium) {
      document.documentElement.style.setProperty('--primary-color', config.accentColor);
    } else {
      document.documentElement.style.setProperty('--primary-color', '#6366f1');
    }

    let glassStyleMode = config.glassDesignPreset || "transparent";
    const proOnlyPresets = ["gradient", "neon"];
    if (proOnlyPresets.includes(glassStyleMode) && !viewerIsPremium) {
      glassStyleMode = "transparent";
    }

    const cards = document.querySelectorAll('.glass-widget-card');

    cards.forEach(card => {
      card.classList.remove('preset-glass-standard', 'preset-glass-dark', 'preset-glass-transparent', 'preset-glass-gradient', 'preset-glass-neon');

      if (glassStyleMode === "dark") {
        card.classList.add('preset-glass-dark');
      } else if (glassStyleMode === "standard") {
        card.classList.add('preset-glass-standard');
      } else if (glassStyleMode === "gradient") {
        card.classList.add('preset-glass-gradient');
      } else if (glassStyleMode === "neon") {
        card.classList.add('preset-glass-neon');
      } else {
        card.classList.add('preset-glass-transparent');
      }

      if (config.cardBgColor) card.style.backgroundColor = config.cardBgColor;
      if (config.cardTextColor) card.style.color = config.cardTextColor;
    });

    // Premium: ambient animated background particles
    if (config.bgParticles && viewerIsPremium) {
      startBgParticles();
    } else {
      stopBgParticles();
    }
  };

  // ==========================================================================
  // PREMIUM: AMBIENT BACKGROUND PARTICLES
  // ==========================================================================
  let particlesContainer = null;
  const startBgParticles = () => {
    if (particlesContainer || !bgLayer) return;
    particlesContainer = document.createElement('div');
    particlesContainer.id = 'bg-particles-layer';
    particlesContainer.style.cssText = 'position:absolute; inset:0; overflow:hidden; pointer-events:none;';
    for (let i = 0; i < 24; i++) {
      const dot = document.createElement('span');
      const size = 2 + Math.random() * 4;
      dot.style.cssText = `
        position:absolute; left:${Math.random() * 100}%; top:${Math.random() * 100}%;
        width:${size}px; height:${size}px; border-radius:50%;
        background: rgba(255,255,255,${0.25 + Math.random() * 0.35});
        animation: biogramFloatParticle ${8 + Math.random() * 10}s ease-in-out infinite;
        animation-delay: -${Math.random() * 10}s;
      `;
      particlesContainer.appendChild(dot);
    }
    bgLayer.appendChild(particlesContainer);

    if (!document.getElementById('biogram-particle-keyframes')) {
      const styleTag = document.createElement('style');
      styleTag.id = 'biogram-particle-keyframes';
      styleTag.textContent = `@keyframes biogramFloatParticle { 0%,100% { transform: translateY(0px); opacity:0.6; } 50% { transform: translateY(-40px); opacity:1; } }`;
      document.head.appendChild(styleTag);
    }
  };
  const stopBgParticles = () => {
    if (particlesContainer) {
      particlesContainer.remove();
      particlesContainer = null;
    }
  };

  // ==========================================================================
  // NEW WIDGET: QR CODE
  // ==========================================================================
  const renderQrWidget = (showQr) => {
    const widget = document.getElementById("qr-card-widget");
    const img = document.getElementById("qr-code-img");
    if (!showQr) {
      widget?.classList.add("hidden");
      return;
    }
    widget?.classList.remove("hidden");
    if (img) {
      const handleForQr = handleParam || currentLoadedUserData?.handle || targetUserId || "";
      const profileUrl = window.location.href.split('?')[0] + `?u=${encodeURIComponent(handleForQr)}`;
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=6&data=${encodeURIComponent(profileUrl)}`;
      img.alt = `QR code for ${profileUrl}`;
    }
  };

  // ==========================================================================
  // NEW WIDGET: COUNTDOWN TIMER
  // ==========================================================================
  const renderCountdownWidget = (showCountdown, title, targetIso) => {
    const widget = document.getElementById("countdown-card-widget");
    const titleEl = document.getElementById("countdown-title-text");
    const dEl = document.getElementById("cd-days");
    const hEl = document.getElementById("cd-hours");
    const mEl = document.getElementById("cd-mins");
    const sEl = document.getElementById("cd-secs");

    if (countdownInterval) clearInterval(countdownInterval);

    if (!showCountdown || !targetIso) {
      widget?.classList.add("hidden");
      return;
    }

    const targetDate = new Date(targetIso);
    if (isNaN(targetDate.getTime())) {
      widget?.classList.add("hidden");
      return;
    }

    widget?.classList.remove("hidden");
    if (titleEl) titleEl.textContent = title && title.trim() ? title.trim() : "Countdown";

    const tick = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        if (dEl) dEl.textContent = "00";
        if (hEl) hEl.textContent = "00";
        if (mEl) mEl.textContent = "00";
        if (sEl) sEl.textContent = "00";
        if (titleEl) titleEl.textContent = "It's here! 🎉";
        clearInterval(countdownInterval);
        return;
      }
      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;
      if (dEl) dEl.textContent = String(days).padStart(2, '0');
      if (hEl) hEl.textContent = String(hours).padStart(2, '0');
      if (mEl) mEl.textContent = String(mins).padStart(2, '0');
      if (sEl) sEl.textContent = String(secs).padStart(2, '0');
    };

    tick();
    countdownInterval = setInterval(tick, 1000);
  };

  // ==========================================================================
  // NEW WIDGET: CUSTOM LINK/IMAGE WIDGETS (dynamic, replaces the old broken field)
  // ==========================================================================
  const renderCustomWidgets = (customWidgetsArray, showCustomWidgets) => {
    document.querySelectorAll('.custom-widget-dynamic').forEach(el => el.remove());

    const anchor = document.getElementById("custom-widgets-anchor");
    if (!anchor || !showCustomWidgets) return;

    const validItems = Array.isArray(customWidgetsArray)
      ? customWidgetsArray.filter(item => item && item.title)
      : [];

    validItems.forEach((item, index) => {
      const card = document.createElement('div');
      card.id = `custom_widget_${index + 1}`;
      card.className = 'glass-widget-card custom-widget-card preset-glass-transparent custom-widget-dynamic';

      const imgHtml = item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy">`
        : "";

      const linkHtml = item.linkUrl
        ? `<a class="cw-link no-drag" href="${escapeHtml(item.linkUrl)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Visit Link</a>`
        : "";

      card.innerHTML = `
        ${imgHtml}
        <div class="cw-body">
          <div class="cw-title">${escapeHtml(item.title)}</div>
          ${linkHtml}
        </div>
      `;
      anchor.appendChild(card);
    });
  };

  // ==========================================================================
  // MAIN RENDER FUNCTION
  // ==========================================================================
  const renderProfileSpace = async (userData, spaceData, authUser) => {
    if (!userData) {
      renderNotFoundUI(handleParam);
      return;
    }

    activeSpaceConfig = spaceData || {};
    currentLoadedUserData = userData;
    isViewerPremium = isUserPremium(userData);

    try {
      siteConfig = await getSystemConfig();
    } catch (e) {
      console.warn("Could not load site config, using defaults:", e);
    }

    updateEditorPermissionUI(authUser);

    // Branding footer only shows for non-Pro members
    if (spaceBrandingFooter) {
      spaceBrandingFooter.classList.toggle("hidden", isViewerPremium);
    }

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
    renderQrWidget(spaceData?.showQr === true);
    renderCountdownWidget(spaceData?.showCountdown === true, spaceData?.countdownTitle, spaceData?.countdownTarget);
    renderCustomWidgets(spaceData?.customWidgets, spaceData?.showCustomWidgets !== false);

    applyCustomSpaceStyles(spaceData, isViewerPremium);

    // Attach drag handlers only to freshly-created custom widget cards (they are
    // rebuilt from scratch every render). Re-running init on existing static cards
    // here would stack duplicate mousedown listeners on every save/re-render.
    ensureWidgetCardIds();
    document.querySelectorAll('.custom-widget-dynamic').forEach((card, i) => makeCardDraggable(card, i));

    // Layout order: prefer saved config, fall back to local cache
    let orderToApply = spaceData?.widgetOrder;
    if (!orderToApply || orderToApply.length === 0) {
      try {
        const cachedOrder = localStorage.getItem(getOrderStorageKey());
        if (cachedOrder) orderToApply = JSON.parse(cachedOrder);
      } catch (e) { /* ignore */ }
    }
    applyWidgetOrder(orderToApply);

    applySavedPositions(spaceData?.widgetPositions);
    updateLockStateUI();
    setReorderMode(false);

    if (spaceContainer) {
      spaceContainer.classList.remove("hidden");
      spaceContainer.style.opacity = "1";
      spaceContainer.style.pointerEvents = "auto";
    }

    // Trigger view count update for non-self visits
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
    setInputValue("edit-countdown-title", null, activeSpaceConfig.countdownTitle || "");

    const countdownTargetInput = document.getElementById("edit-countdown-target");
    if (countdownTargetInput) {
      if (activeSpaceConfig.countdownTarget) {
        // datetime-local expects "YYYY-MM-DDTHH:mm" in local time, no timezone suffix
        const d = new Date(activeSpaceConfig.countdownTarget);
        if (!isNaN(d.getTime())) {
          const pad = (n) => String(n).padStart(2, '0');
          countdownTargetInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
      } else {
        countdownTargetInput.value = "";
      }
    }

    // Theme preset & accent color
    selectedGlassPreset = activeSpaceConfig.glassDesignPreset || "transparent";
    if (["gradient", "neon"].includes(selectedGlassPreset) && !isViewerPremium) selectedGlassPreset = "transparent";
    if (glassPresetHidden) glassPresetHidden.value = selectedGlassPreset;
    selectedAccentColor = activeSpaceConfig.accentColor || "#6366f1";
    syncThemeGridUI();
    syncAccentSwatchUI();

    // Pro lock UI state
    themePresetGrid?.querySelectorAll('.theme-option-btn[data-pro="true"]').forEach(btn => {
      btn.classList.toggle('locked', !isViewerPremium);
    });
    if (accentProChip) accentProChip.style.display = isViewerPremium ? "none" : "inline-flex";
    if (editorProBanner) editorProBanner.style.display = isViewerPremium ? "none" : "flex";
    setCheckboxValue("edit-bg-particles", null, !!activeSpaceConfig.bgParticles && isViewerPremium);

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
    setCheckboxValue("edit-show-qr", null, activeSpaceConfig.showQr === true);
    setCheckboxValue("edit-show-countdown", null, activeSpaceConfig.showCountdown === true);
    setCheckboxValue("edit-show-custom-widgets", null, activeSpaceConfig.showCustomWidgets !== false);

    // Free-tier limit notes
    const mediaLimitNote = document.getElementById("media-limit-note");
    if (mediaLimitNote) mediaLimitNote.textContent = isViewerPremium ? "unlimited with Pro" : `up to ${siteConfig.freeMediaLimit ?? 3} free`;
    const widgetLimitNote = document.getElementById("widget-limit-note");
    if (widgetLimitNote) widgetLimitNote.textContent = isViewerPremium ? "unlimited with Pro" : `up to ${siteConfig.freeCustomWidgetLimit ?? 1} free`;

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

    const customWidgetsInput = document.getElementById("edit-custom-widgets-data");
    if (customWidgetsInput) {
      customWidgetsInput.value = Array.isArray(activeSpaceConfig.customWidgets)
        ? activeSpaceConfig.customWidgets.map(w => `${w.title || ''} | ${w.imageUrl || ''} | ${w.linkUrl || ''}`).join("\n")
        : "";
    }

    if (editorModal) editorModal.classList.remove("hidden");
  });

  closeEditorBtn?.addEventListener("click", () => {
    if (editorModal) editorModal.classList.add("hidden");
  });

  saveSpaceBtn?.addEventListener("click", async () => {
    if (!canEditCurrentProfile(auth.currentUser)) {
      alert("Permission denied.");
      return;
    }

    if (!isCurrentUserAdmin) {
      try {
        const configSnap = await getDoc(doc(db, "system", "config"));
        if (configSnap.exists() && configSnap.data().maintenanceMode) {
          alert("🛠️ Profile edits are temporarily locked for maintenance. Please check back soon.");
          return;
        }
      } catch (e) {
        console.warn("Could not check maintenance mode:", e);
      }
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

    // Parse "Title | ImageURL | LinkURL" custom widget lines
    const parsedCustomWidgets = getInputValue("edit-custom-widgets-data")
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split("|").map(p => p.trim());
        return { title: parts[0] || "", imageUrl: parts[1] || "", linkUrl: parts[2] || "" };
      })
      .filter(w => w.title);

    let mediaImagesList = getInputValue("edit-media-urls").split("\n").map(s => s.trim()).filter(Boolean);
    let customWidgetsList = parsedCustomWidgets;
    let limitNotices = [];

    if (!isViewerPremium) {
      const mediaLimit = siteConfig.freeMediaLimit ?? 3;
      const widgetLimit = siteConfig.freeCustomWidgetLimit ?? 1;
      if (mediaImagesList.length > mediaLimit) {
        mediaImagesList = mediaImagesList.slice(0, mediaLimit);
        limitNotices.push(`gallery images (kept first ${mediaLimit})`);
      }
      if (customWidgetsList.length > widgetLimit) {
        customWidgetsList = customWidgetsList.slice(0, widgetLimit);
        limitNotices.push(`custom widgets (kept first ${widgetLimit})`);
      }
    }

    const countdownTargetRaw = document.getElementById("edit-countdown-target")?.value || "";
    const countdownTargetIso = countdownTargetRaw ? new Date(countdownTargetRaw).toISOString() : "";

    const updatedConfig = {
      ...activeSpaceConfig,
      displayName: getInputValue("edit-display-name"),
      bio: getInputValue("edit-bio"),
      customAvatarUrl: getInputValue("edit-avatar-url"),
      bgUrl: getInputValue("edit-bg-url"),
      audioUrl: getInputValue("edit-audio-url"),
      spotifyUrl: getInputValue("edit-spotify-url"),
      discordId: getInputValue("edit-discord-id"),
      glassDesignPreset: selectedGlassPreset,
      accentColor: isViewerPremium ? selectedAccentColor : (activeSpaceConfig.accentColor || "#6366f1"),
      bgParticles: isViewerPremium ? getCheckboxValue("edit-bg-particles") : false,
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
      showQr: getCheckboxValue("edit-show-qr"),
      showCountdown: getCheckboxValue("edit-show-countdown"),
      showCustomWidgets: getCheckboxValue("edit-show-custom-widgets"),
      countdownTitle: getInputValue("edit-countdown-title"),
      countdownTarget: countdownTargetIso,
      socials: parsedSocials,
      customWidgets: customWidgetsList,
      mediaImages: mediaImagesList
    };

    if (targetUserId) {
      try {
        await setDoc(doc(db, "users_spaces", targetUserId), updatedConfig, { merge: true });
        activeSpaceConfig = updatedConfig;
        await renderProfileSpace(currentLoadedUserData, activeSpaceConfig, auth.currentUser);
        if (editorModal) editorModal.classList.add("hidden");
        alert(limitNotices.length
          ? `Space updated! Note: BioGram Pro limits were applied to ${limitNotices.join(" and ")}. Upgrade for unlimited.`
          : "Space updated successfully!");
      } catch (err) {
        console.error("Error saving space:", err);
        alert("Failed to save settings.");
      }
    } else {
      activeSpaceConfig = updatedConfig;
      await renderProfileSpace(currentLoadedUserData, activeSpaceConfig, auth.currentUser);
      if (editorModal) editorModal.classList.add("hidden");
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
