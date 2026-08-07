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
  orderBy,
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

  const urlParams = new URLSearchParams(window.location.search);
  const handleParam = urlParams.get("u")?.toLowerCase().trim() || urlParams.get("handle")?.toLowerCase().trim();

  let clockInterval = null;
  let activeSpaceConfig = {};
  let currentLoadedUserData = null;
  let targetUserId = null;         // ID of profile being viewed/edited
  let isCurrentUserAdmin = false; // Admin status flag
  let mediaImages = [];
  let currentMediaIndex = 0;
  let mediaInterval = null;
  let isLayoutAbsolute = false;
  let isLayoutLocked = true; 
  let discordTimerInterval = null;

  const isMobile = () => window.innerWidth <= 600;
  const getLocalStorageKey = () => targetUserId ? `biogram_space_layout_cache_${targetUserId}` : 'biogram_space_layout_cache_guest';

  // Helper functions for modal & state binding
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
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  // Check if current user has edit rights for the profile currently rendered
  const canEditCurrentProfile = (authUser) => {
    if (!targetUserId) return false;
    if (isCurrentUserAdmin) return true; // Admins can edit any space
    return authUser && authUser.uid === targetUserId; // Profile owner check
  };

  // Update UI permissions
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
  // AUDIO & TAP OVERLAY
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
  // LAYOUT PERSISTENCE ENGINE
  // ==========================================================================
  const getLayoutPositionsDict = () => {
    const cards = document.querySelectorAll('.glass-widget-card');
    const positions = {};

    cards.forEach((card, index) => {
      const cardId = card.id || `widget_card_${index}`;
      if (card.style.left && card.style.top) {
        positions[cardId] = {
          left: card.style.left,
          top: card.style.top
        };
      }
    });

    return positions;
  };

  const saveLayoutToLocalStorage = () => {
    const positions = getLayoutPositionsDict();
    const cacheKey = getLocalStorageKey();
    if (Object.keys(positions).length > 0) {
      localStorage.setItem(cacheKey, JSON.stringify(positions));
    } else {
      localStorage.removeItem(cacheKey);
    }
  };

  const applySavedPositions = (savedPositions) => {
    if (isMobile() || !spaceContainer) return;

    let positionsToApply = savedPositions;
    if (!positionsToApply || Object.keys(positionsToApply).length === 0) {
      try {
        const localCache = localStorage.getItem(getLocalStorageKey());
        if (localCache) positionsToApply = JSON.parse(localCache);
      } catch (e) {
        console.warn("Could not load local layout cache:", e);
      }
    }

    if (!positionsToApply || Object.keys(positionsToApply).length === 0) {
      resetToFlexLayout();
      return;
    }

    spaceContainer.style.position = 'relative';
    const cards = document.querySelectorAll('.glass-widget-card');
    let hasSaved = false;
    let maxBottom = 0;

    cards.forEach((card, index) => {
      const cardId = card.id || `widget_card_${index}`;
      const pos = positionsToApply[cardId];
      if (pos && pos.left && pos.top) {
        card.style.position = 'absolute';
        card.style.margin = '0';
        card.style.left = pos.left;
        card.style.top = pos.top;
        hasSaved = true;

        const topPx = parseFloat(pos.top) || 0;
        const cardHeight = card.offsetHeight || 200;
        if (topPx + cardHeight > maxBottom) {
          maxBottom = topPx + cardHeight;
        }
      }
    });

    if (hasSaved) {
      isLayoutAbsolute = true;
      if (maxBottom > 0) {
        spaceContainer.style.minHeight = `${maxBottom + 60}px`;
      }
    }
  };

  const convertAllToAbsolute = () => {
    if (isMobile() || !spaceContainer) return;

    spaceContainer.style.position = 'relative';
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

  // ==========================================================================
  // LOCK & DRAG ENGINE
  // ==========================================================================
  const updateLockStateUI = () => {
    const cards = document.querySelectorAll('.glass-widget-card');
    
    cards.forEach(card => {
      if (isLayoutLocked) {
        card.style.cursor = 'default';
        card.classList.remove('can-drag');
      } else {
        card.style.cursor = 'grab';
        card.classList.add('can-drag');
      }
    });

    if (toggleLockBtn) {
      if (isLayoutLocked) {
        toggleLockBtn.innerHTML = `<i class="fa-solid fa-lock"></i> <span>Locked</span>`;
        toggleLockBtn.classList.remove('active-unlock');
      } else {
        toggleLockBtn.innerHTML = `<i class="fa-solid fa-lock-open"></i> <span>Move Widgets</span>`;
        toggleLockBtn.classList.add('active-unlock');
      }
    }
  };

  toggleLockBtn?.addEventListener('click', async () => {
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
    if (!card.id) {
      card.id = `widget_card_${index || Date.now()}`;
    }

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    card.querySelectorAll('img').forEach(img => {
      img.ondragstart = (e) => e.preventDefault();
    });

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
      if (!isDragging || !spaceContainer) return;

      const wrapperRect = spaceContainer.getBoundingClientRect();
      let newLeft = clientX - wrapperRect.left - offsetX;
      let newTop = clientY - wrapperRect.top - offsetY;

      card.style.left = `${newLeft}px`;
      card.style.top = `${newTop}px`;
    };

    const endDrag = () => {
      if (isDragging) {
        isDragging = false;
        card.style.zIndex = '10';
        card.style.cursor = isLayoutLocked ? 'default' : 'grab';
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

    card.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startDrag(e, e.touches[0].clientX, e.touches[0].clientY, e.target);
      }
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length === 1) {
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    document.addEventListener('touchend', endDrag);
  };

  const initDragAndDrop = () => {
    const cards = document.querySelectorAll('.glass-widget-card');
    cards.forEach((card, index) => makeCardDraggable(card, index));
    updateLockStateUI();
  };

  initDragAndDrop();

  resetPositionsBtn?.addEventListener('click', async () => {
    if (!canEditCurrentProfile(auth.currentUser)) {
      alert("Permission denied.");
      return;
    }

    const confirmed = confirm("Are you sure you want to reset all widget positions to default?");
    if (!confirmed) return;

    resetToFlexLayout();
    activeSpaceConfig.widgetPositions = {};

    if (targetUserId) {
      try {
        await setDoc(doc(db, "users_spaces", targetUserId), { widgetPositions: {} }, { merge: true });
      } catch (err) {
        console.warn("Error resetting layout on database:", err);
      }
    }

    alert("Layout reset to default flow successfully!");
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
    const clockColor = clockConfig.clockColor || "";

    if (!showClock) {
      widget?.classList.add("hidden");
      if (clockInterval) clearInterval(clockInterval);
      return;
    }

    widget?.classList.remove("hidden");
    if (clockEl) clockEl.style.color = clockColor || '';

    if (dateEl) {
      dateEl.style.display = showDate ? 'block' : 'none';
      dateEl.style.color = clockColor || '';
    }

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

  const renderCustomPhotoWidgets = (customPhotosList = []) => {
    document.querySelectorAll('.custom-photo-widget-card').forEach(el => el.remove());

    if (!Array.isArray(customPhotosList) || customPhotosList.length === 0) return;

    customPhotosList.forEach((photoObj, index) => {
      if (!photoObj || !photoObj.url || !photoObj.url.trim()) return;

      const cardId = photoObj.id || `custom_photo_${index + 1}`;
      const card = document.createElement('div');
      card.className = 'glass-widget-card custom-photo-widget-card';
      card.id = cardId;
      card.style.padding = '12px';
      card.innerHTML = `
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:0.85rem; font-weight:600;"><i class="fa-solid fa-image"></i> ${escapeHtml(photoObj.title || 'Photo')}</span>
        </div>
        <div class="photo-widget-body" style="overflow:hidden; border-radius:12px;">
          <img src="${escapeHtml(photoObj.url.trim())}" alt="Photo Widget" style="width:100%; max-height: 250px; display:block; border-radius:12px; object-fit:cover;">
        </div>
      `;

      spaceContainer?.appendChild(card);
      makeCardDraggable(card);
    });
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
      const name = spaceData?.displayName || userData?.displayName || "BioGram User";
      displayNameEl.innerHTML = `${escapeHtml(name)} <i class="fa-solid fa-circle-check" style="color: var(--primary-color, #3b82f6);"></i>`;
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
      widget?.classList.add("hidden");
      if (discordTimerInterval) clearInterval(discordTimerInterval);
      return;
    }

    widget?.classList.remove("hidden");

    try {
      const res = await fetch(`https://api.lanyard.rest/v1/users/${cleanDiscordId}`);
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
          activityText = `<i class="fa-brands fa-spotify" style="color:#1db954;"></i> ${escapeHtml(spotify.song)}`;
        } else if (activities.length > 0) {
          const game = activities.find(a => a.type === 0 || a.type === 1 || a.type === 2);
          const customStatus = activities.find(a => a.type === 4);

          if (game) {
            activityText = `Playing ${escapeHtml(game.name)}`;
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
            discordDetailEl.innerHTML = `${activityText} <span style="display: block; opacity: 0.75; font-size: 0.75rem; margin-top: 2px;">elapsed ${timeStr}</span>`;
          }
        };

        updateElapsedTime();
        if (startTimeStamp) discordTimerInterval = setInterval(updateElapsedTime, 1000);
      }
    } catch (err) {
      console.warn("Discord fetch error:", err);
    }
  };

  const renderSpotifyWidget = (spotifyUrl, showSpotify) => {
    const widget = document.getElementById("spotify-card-widget");
    const iframe = document.getElementById("spotify-iframe");

    const cleanSpotifyUrl = (spotifyUrl || "").trim();

    if (!showSpotify || !cleanSpotifyUrl || !iframe) {
      widget?.classList.add("hidden");
      if (iframe) iframe.src = "";
      return;
    }

    try {
      let embedUrl = cleanSpotifyUrl;
      if (!cleanSpotifyUrl.includes("/embed/")) {
        embedUrl = cleanSpotifyUrl.replace("open.spotify.com/", "open.spotify.com/embed/");
      }
      iframe.src = embedUrl;
      widget.classList.remove("hidden");
    } catch (e) {
      widget.classList.add("hidden");
      if (iframe) iframe.src = "";
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

    const showSlide = (index) => {
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

    showSlide(0);
    if (mediaInterval) clearInterval(mediaInterval);
    if (mediaImages.length > 1) {
      mediaInterval = setInterval(() => showSlide(currentMediaIndex + 1), 4000);
    }
  };

  const renderSocialsWidget = (socialsArray, showSocials) => {
    const widget = document.getElementById("socials-card-widget");
    const container = document.getElementById("card-links-container");

    if (!showSocials || !Array.isArray(socialsArray) || socialsArray.length === 0 || !container) {
      widget?.classList.add("hidden");
      return;
    }

    widget.classList.remove("hidden");
    container.innerHTML = "";

    socialsArray.forEach(item => {
      if (!item.url || !item.url.trim()) return;

      const rawUrl = item.url.trim();
      let fullUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
      let platformName = item.platform || item.label || "Link";

      const a = document.createElement("a");
      a.href = fullUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "social-link-btn";
      a.innerHTML = `<i class="fa-solid fa-link"></i> <span>${escapeHtml(platformName)}</span>`;
      container.appendChild(a);
    });
  };

  // ==========================================================================
  // RANKINGS & LEADERBOARD WIDGET
  // ==========================================================================
  const renderRankingsWidget = async (userData, spaceData, showRankings) => {
    const widget = document.getElementById("rankings-card-widget");
    const rankEl = document.getElementById("user-rank-display");
    const viewsEl = document.getElementById("user-views-display");

    if (!showRankings) {
      widget?.classList.add("hidden");
      return;
    }

    widget?.classList.remove("hidden");

    // Display views from user document
    const viewsCount = userData?.views || 0;
    if (viewsEl) {
      viewsEl.innerHTML = `<i class="fa-solid fa-eye" style="color: var(--primary-color, #3b82f6);"></i> ${viewsCount.toLocaleString()} Views`;
    }

    // Fetch Leaderboard & Calculate Rank dynamically
    try {
      const topUsersQuery = query(collection(db, "users"), orderBy("views", "desc"), limit(10));
      const querySnap = await getDocs(topUsersQuery);

      let computedRank = "#-";
      let leaderboardListHtml = "";
      let index = 1;

      querySnap.forEach((userDoc) => {
        const uData = userDoc.data();
        const uId = userDoc.id;
        const name = uData.displayName || `@${uData.handle || 'user'}`;
        const views = uData.views || 0;

        if (uId === targetUserId) {
          computedRank = `#${index}`;
        }

        leaderboardListHtml += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 0.85rem;">
            <span><strong>#${index}</strong> ${escapeHtml(name)}</span>
            <span style="opacity: 0.8;"><i class="fa-solid fa-eye"></i> ${views.toLocaleString()}</span>
          </div>
        `;
        index++;
      });

      if (rankEl) {
        rankEl.textContent = computedRank;
      }

      // Container for Leaderboard
      let listContainer = widget.querySelector(".leaderboard-dynamic-list");
      if (!listContainer) {
        listContainer = document.createElement("div");
        listContainer.className = "leaderboard-dynamic-list";
        listContainer.style.marginTop = "12px";
        widget.appendChild(listContainer);
      }
      listContainer.innerHTML = leaderboardListHtml || `<div style="opacity:0.6; font-size:0.8rem; margin-top:8px;">No rankings available yet.</div>`;

    } catch (e) {
      console.warn("Leaderboard load failed:", e);
      if (rankEl) rankEl.textContent = "#-";
    }
  };

  const applyCustomSpaceStyles = (config = {}) => {
    if (config.accentColor) {
      document.documentElement.style.setProperty('--primary-color', config.accentColor);
    }

    const cards = document.querySelectorAll('.glass-widget-card');
    cards.forEach(card => {
      card.style.backgroundColor = config.cardBgColor || '';
      card.style.color = config.cardTextColor || '';
    });
  };

  // ==========================================================================
  // MAIN RENDER FUNCTION
  // ==========================================================================
  const renderProfileSpace = (userData, spaceData, authUser) => {
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
      clockShowDate: spaceData?.clockShowDate !== false,
      clockColor: spaceData?.clockColor || ""
    });

    renderProfileWidget(userData, spaceData, authUser, spaceData?.showProfile !== false);
    renderDiscordWidget(spaceData?.discordId, spaceData?.showDiscord !== false);
    renderMediaWidget(spaceData?.mediaImages, spaceData?.showMedia !== false);
    renderSpotifyWidget(spaceData?.spotifyUrl, spaceData?.showSpotify !== false);
    renderSocialsWidget(spaceData?.socials, spaceData?.showSocials !== false);
    renderRankingsWidget(userData, spaceData, spaceData?.showRankings !== false);
    renderCustomPhotoWidgets(spaceData?.customPhotos || []);

    applyCustomSpaceStyles(spaceData);
    applySavedPositions(spaceData?.widgetPositions);
    updateLockStateUI();
  };

  // ==========================================================================
  // EDITOR MODAL & PERSISTENCE
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

    setInputValue("edit-clock-color", "modal-clock-color", activeSpaceConfig.clockColor || "");
    setInputValue("edit-accent-color", "modal-accent-color", activeSpaceConfig.accentColor || "");
    setInputValue("edit-card-bg-color", "modal-card-bg-color", activeSpaceConfig.cardBgColor || "");
    setInputValue("edit-card-text-color", "modal-card-text-color", activeSpaceConfig.cardTextColor || "");

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

    const mediaUrlsInput = document.getElementById("edit-media-urls") || document.getElementById("modal-media-urls");
    if (mediaUrlsInput) {
      mediaUrlsInput.value = Array.isArray(activeSpaceConfig.mediaImages) 
        ? activeSpaceConfig.mediaImages.join("\n") 
        : "";
    }

    const customPhotosInput = document.getElementById("edit-custom-photos-urls") || document.getElementById("modal-custom-photos-urls");
    if (customPhotosInput) {
      if (Array.isArray(activeSpaceConfig.customPhotos)) {
        customPhotosInput.value = activeSpaceConfig.customPhotos.map(p => `${p.title || 'Photo'} | ${p.url}`).join("\n");
      } else {
        customPhotosInput.value = "";
      }
    }

    editorModal?.classList.remove("hidden");
  });

  closeEditorBtn?.addEventListener("click", () => {
    editorModal?.classList.add("hidden");
  });

  saveSpaceBtn?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please log in to save changes!");
      return;
    }

    if (!canEditCurrentProfile(user)) {
      alert("Unauthorized: You cannot edit this user's profile.");
      return;
    }

    if (!targetUserId) {
      alert("Error: No target user ID found.");
      return;
    }

    const widgetPositions = getLayoutPositionsDict();

    const mediaUrlsInput = getInputValue("edit-media-urls", "modal-media-urls");
    const mediaImagesArray = mediaUrlsInput
      .split("\n")
      .map(url => url.trim())
      .filter(url => url.length > 0);

    const customPhotosRaw = getInputValue("edit-custom-photos-urls", "modal-custom-photos-urls");
    const customPhotosArray = customPhotosRaw
      .split("\n")
      .map((line, idx) => {
        const parts = line.split("|");
        const title = parts.length > 1 ? parts[0].trim() : `Photo ${idx + 1}`;
        const url = parts.length > 1 ? parts[1].trim() : parts[0].trim();
        return url ? { id: `custom_photo_${idx + 1}`, title, url } : null;
      })
      .filter(Boolean);

    const updatedConfig = {
      displayName: getInputValue("edit-display-name", "modal-display-name"),
      bio: getInputValue("edit-bio", "modal-bio"),
      customAvatarUrl: getInputValue("edit-avatar-url", "modal-avatar-url"),
      bgUrl: getInputValue("edit-bg-url", "modal-bg-url"),
      audioUrl: getInputValue("edit-audio-url", "modal-audio-url"),
      spotifyUrl: getInputValue("edit-spotify-url", "modal-spotify-url"),
      discordId: getInputValue("edit-discord-id", "modal-discord-id"),

      clockColor: getInputValue("edit-clock-color", "modal-clock-color"),
      accentColor: getInputValue("edit-accent-color", "modal-accent-color"),
      cardBgColor: getInputValue("edit-card-bg-color", "modal-card-bg-color"),
      cardTextColor: getInputValue("edit-card-text-color", "modal-card-text-color"),

      clockFormat: getInputValue("edit-clock-format", "modal-clock-format") || "12h",
      clockShowSeconds: getCheckboxValue("edit-clock-show-seconds", "modal-clock-show-seconds", true),
      clockShowDate: getCheckboxValue("edit-clock-show-date", "modal-clock-show-date", true),

      showClock: getCheckboxValue("edit-show-clock", "modal-show-clock", true),
      showProfile: getCheckboxValue("edit-show-profile", "modal-show-profile", true),
      showDiscord: getCheckboxValue("edit-show-discord", "modal-show-discord", true),
      showSpotify: getCheckboxValue("edit-show-spotify", "modal-show-spotify", true),
      showMedia: getCheckboxValue("edit-show-media", "modal-show-media", true),
      showSocials: getCheckboxValue("edit-show-socials", "modal-show-socials", true),
      showRankings: getCheckboxValue("edit-show-rankings", "modal-show-rankings", true),

      mediaImages: mediaImagesArray,
      customPhotos: customPhotosArray,
      widgetPositions: widgetPositions,
      updatedAt: new Date().toISOString()
    };

    try {
      saveSpaceBtn.disabled = true;
      saveSpaceBtn.textContent = "Saving...";

      await setDoc(doc(db, "users_spaces", targetUserId), updatedConfig, { merge: true });

      await setDoc(doc(db, "users", targetUserId), {
        displayName: updatedConfig.displayName || "BioGram User",
        bio: updatedConfig.bio || "",
        updatedAt: new Date().toISOString()
      }, { merge: true });

      saveLayoutToLocalStorage();
      activeSpaceConfig = { ...activeSpaceConfig, ...updatedConfig };
      renderProfileSpace(currentLoadedUserData, activeSpaceConfig, user);

      editorModal?.classList.add("hidden");
      alert("Space saved successfully!");
    } catch (err) {
      alert(`Error saving space: ${err.message}`);
    } finally {
      saveSpaceBtn.disabled = false;
      saveSpaceBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Space Settings`;
    }
  });

  // ==========================================================================
  // DATA INITIALIZATION & AUTH RESOLUTION
  // ==========================================================================
  const loadProfileData = async (authUser) => {
    try {
      let userData = null;
      let spaceData = null;
      targetUserId = null;
      isCurrentUserAdmin = false;

      // 1. Check logged-in user admin privileges from Firestore
      if (authUser) {
        try {
          const authUserSnap = await getDoc(doc(db, "users", authUser.uid));
          if (authUserSnap.exists()) {
            const authUserData = authUserSnap.data();
            isCurrentUserAdmin = authUserData.role === 'admin' || authUserData.isAdmin === true;
          }
        } catch (e) {
          console.warn("Admin check failed:", e);
        }
      }

      // 2. Resolve Target User ID via URL handle query parameter first
      if (handleParam) {
        const q = query(collection(db, "users"), where("handle", "==", handleParam));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const userDoc = querySnap.docs[0];
          targetUserId = userDoc.id;
          userData = userDoc.data();
        }
      }

      // 3. Fallback to logged-in user ID if viewing home space
      if (!targetUserId && authUser) {
        targetUserId = authUser.uid;
      }

      // 4. Fetch target user profile & space documents + Auto Increment Views
      if (targetUserId) {
        // Auto-increment views for profile visit
        try {
          await updateDoc(doc(db, "users", targetUserId), { views: increment(1) });
        } catch (err) {
          await setDoc(doc(db, "users", targetUserId), { views: 1 }, { merge: true });
        }

        const userSnap = await getDoc(doc(db, "users", targetUserId));
        if (userSnap.exists()) userData = userSnap.data();

        const spaceSnap = await getDoc(doc(db, "users_spaces", targetUserId));
        if (spaceSnap.exists()) spaceData = spaceSnap.data();
      }

      renderProfileSpace(userData, spaceData, authUser);
    } catch (err) {
      console.error("Profile loading error:", err);
    }
  };

  onAuthStateChanged(auth, (user) => {
    loadProfileData(user);
  });

});
