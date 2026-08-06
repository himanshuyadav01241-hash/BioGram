import { db } from "./firebase-config.js"; // Ensure path points to your firebase config
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Read username parameter from URL (e.g. profile.html?u=himanshu)
  const urlParams = new URLSearchParams(window.location.search);
  const usernameParam = urlParams.get("u") || urlParams.get("username");

  if (!usernameParam) {
    document.getElementById("profile-display-name").textContent = "User Not Found";
    document.getElementById("profile-username").textContent = "@unknown";
    return;
  }

  // 2. Fetch User Profile Data
  let userData = await fetchUserProfile(usernameParam.toLowerCase());

  // Fallback to local storage or demo data if database call fails or user is local
  if (!userData) {
    const localData = localStorage.getItem(`biogram_user_${usernameParam.toLowerCase()}`);
    if (localData) {
      userData = JSON.parse(localData);
    } else {
      // Demo Fallback
      userData = {
        displayName: usernameParam,
        username: usernameParam,
        bio: "Welcome to my BioGram page!",
        avatarUrl: "https://api.iconify.design/lucide:user.svg?color=%23ffffff",
        accentColor: "#6366f1",
        cardBgColor: "rgba(15, 23, 42, 0.85)",
        textColor: "#ffffff",
        showClock: "true",
        clockFormat: "12",
        clockGlow: "cyan",
        socialLinks: [
          { title: "🌐 Website", url: "https://example.com" },
          { title: "💬 Contact Me", url: "#" }
        ]
      };
    }
  }

  // 3. Render Profile Data into Page
  renderProfile(userData);
});

// Fetch Profile from Firestore Database
async function fetchUserProfile(username) {
  try {
    if (!db) return null;
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }
  } catch (err) {
    console.warn("Firestore fetch fallback triggered:", err);
  }
  return null;
}

// Populate UI Elements
function renderProfile(data) {
  // Update Title & Text
  document.title = `${data.displayName || data.username} — BioGram`;
  document.getElementById("profile-display-name").textContent = data.displayName || data.username;
  document.getElementById("profile-username").textContent = `@${data.username}`;
  
  const bioEl = document.getElementById("profile-bio");
  if (data.bio) {
    bioEl.textContent = data.bio;
  } else {
    bioEl.classList.add("hidden");
  }

  // Update Avatar Image
  const avatarEl = document.getElementById("profile-avatar");
  if (data.avatarUrl) {
    avatarEl.src = data.avatarUrl;
  }

  // Apply Custom Theme Colors
  if (data.accentColor) {
    document.documentElement.style.setProperty("--primary-accent", data.accentColor);
    avatarEl.style.borderColor = data.accentColor;
  }

  const cardEl = document.getElementById("profile-card");
  if (data.cardBgColor) {
    cardEl.style.backgroundColor = data.cardBgColor;
  }

  if (data.textColor) {
    cardEl.style.color = data.textColor;
  }

  // Background Image/GIF & Overlay Opacity
  if (data.bgGifUrl) {
    const bgLayer = document.getElementById("profile-bg-layer");
    bgLayer.style.backgroundImage = `url('${data.bgGifUrl}')`;
    if (data.bgBlur) bgLayer.style.filter = `blur(${data.bgBlur}px)`;
  }

  if (data.bgOpacity !== undefined) {
    document.getElementById("profile-overlay-layer").style.opacity = data.bgOpacity;
  }

  // Setup Clock Widget
  if (data.showClock === "true" || data.showClock === true) {
    setupLiveClock(data.clockFormat || "12", data.clockGlow || "cyan");
  }

  // Setup Audio Music Player
  if (data.musicUrl) {
    setupMusicPlayer(data.musicUrl);
  }

  // Render Social / Custom Links
  renderLinks(data.socialLinks || []);
}

// Live Clock Logic
function setupLiveClock(format, glowPreset) {
  const clockContainer = document.getElementById("profile-clock-widget");
  const timeEl = document.getElementById("clock-time");
  const dateEl = document.getElementById("clock-date");

  clockContainer.classList.remove("hidden");
  clockContainer.className = `profile-clock-box glow-${glowPreset}`;

  function updateTime() {
    const now = new Date();
    
    // Format Time
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    let ampm = "";

    if (format === "12") {
      ampm = hours >= 12 ? " PM" : " AM";
      hours = hours % 12 || 12;
    }
    
    timeEl.textContent = `${String(hours).padStart(2, "0")}:${minutes}:${seconds}${ampm}`;

    // Format Date
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString("en-US", options);
  }

  updateTime();
  setInterval(updateTime, 1000);
}

// Audio Player Control
function setupMusicPlayer(musicUrl) {
  const container = document.getElementById("music-player-container");
  const btn = document.getElementById("play-music-btn");
  const btnText = document.getElementById("music-btn-text");
  const audio = document.getElementById("bg-audio-player");

  container.classList.remove("hidden");
  audio.src = musicUrl;

  btn.addEventListener("click", () => {
    if (audio.paused) {
      audio.play().then(() => {
        btnText.textContent = "Pause Music";
      }).catch(err => console.error("Audio playback error:", err));
    } else {
      audio.pause();
      btnText.textContent = "Play Background Music";
    }
  });
}

// Link Stack Rendering
function renderLinks(links) {
  const listEl = document.getElementById("profile-links-list");
  listEl.innerHTML = "";

  if (!links || links.length === 0) return;

  links.forEach(link => {
    if (!link.url || !link.title) return;

    const anchor = document.createElement("a");
    anchor.href = link.url.startsWith("http") ? link.url : `https://${link.url}`;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.className = "custom-profile-link";
    anchor.textContent = link.title;

    listEl.appendChild(anchor);
  });
}