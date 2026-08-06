import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

window.toggleModal = () => document.getElementById("profile-modal")?.classList.toggle("hidden");

const firebaseConfig = {
  apiKey: "AIzaSyAj1gX4dmw8uNEG0yyYL3t6wE0i9BShpBQ",
  authDomain: "biogram-3a908.firebaseapp.com",
  databaseURL: "https://biogram-3a908-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "biogram-3a908",
  storageBucket: "biogram-3a908.firebasestorage.app",
  messagingSenderId: "524800153997",
  appId: "1:524800153997:web:86e6d9657004d33cf345c4",
  measurementId: "G-CK02ETD77Z"
};

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
let currentUser = null;
const GMAIL_SVG = `<svg class="link-icon" viewBox="0 0 24 24" width="20" height="20" fill="#ea4335"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`;

document.addEventListener("DOMContentLoaded", () => {
  const u = new URLSearchParams(window.location.search).get("u") || new URLSearchParams(window.location.search).get("username");
  u ? loadPublicProfile(u) : initEditorPage();
});

function showNotification(msg, isError = false) {
  const statusMsg = document.getElementById("status-msg");
  if (statusMsg) {
    statusMsg.innerText = msg; statusMsg.style.color = isError ? "#ef4444" : "#10b981";
    setTimeout(() => statusMsg.innerText = "", 3000); return;
  }
  let toast = document.getElementById("biogram-toast") || document.createElement("div");
  toast.id = "biogram-toast";
  toast.style.cssText = `position:fixed;bottom:20px;right:20px;background:${isError?"#ef4444":"linear-gradient(135deg,#6366f1,#8b5cf6)"};color:#fff;padding:12px 24px;border-radius:12px;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.3);z-index:10000;transition:opacity 0.3s;`;
  if (!toast.parentElement) document.body.appendChild(toast);
  toast.innerText = msg; toast.style.opacity = "1";
  setTimeout(() => toast.style.opacity = "0", 3000);
}

function initEditorPage() {
  const authForm = document.getElementById("auth-form"), googleBtn = document.getElementById("google-login-btn"), logoutBtn = document.getElementById("logout-btn"), editorForm = document.getElementById("editor-form"), addLinkBtn = document.getElementById("add-link-btn"), copyLinkBtn = document.getElementById("copy-link-btn");

  onAuthStateChanged(auth, async (user) => {
    const authContainer = document.getElementById("auth-container"), navUserAvatar = document.getElementById("nav-user-avatar"), navAvatarImg = document.getElementById("nav-avatar-img"), navLoginBtn = document.getElementById("nav-login-btn");
    currentUser = user;
    if (user) {
      authContainer?.classList.add("hidden"); editorForm?.classList.remove("hidden"); navLoginBtn?.classList.add("hidden"); navUserAvatar?.classList.remove("hidden");
      if (navAvatarImg) navAvatarImg.src = user.photoURL || "https://api.iconify.design/lucide:user.svg";
      await loadUserDataIntoForm(user.uid);
    } else {
      authContainer?.classList.remove("hidden"); editorForm?.classList.add("hidden"); navLoginBtn?.classList.remove("hidden"); navUserAvatar?.classList.add("hidden");
    }
  });

  authForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value, password = document.getElementById("password").value;
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (err) {
      if (["auth/user-not-found", "auth/invalid-credential"].includes(err.code)) {
        try { await createUserWithEmailAndPassword(auth, email, password); } catch (cErr) { showNotification(cErr.message, true); }
      } else showNotification(err.message, true);
    }
  });

  googleBtn?.addEventListener("click", async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { showNotification(e.message, true); } });
  logoutBtn?.addEventListener("click", () => signOut(auth));
  addLinkBtn?.addEventListener("click", () => renderLinkInputRow());
  copyLinkBtn?.addEventListener("click", () => {
    const link = document.getElementById("view-profile-link")?.href;
    if (link) { navigator.clipboard.writeText(link); showNotification("Profile URL copied!"); }
  });

  editorForm?.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!currentUser) return;
    const username = document.getElementById("username").value.trim().toLowerCase(), links = [];
    document.querySelectorAll(".social-link-row").forEach(r => {
      const title = r.querySelector(".link-title")?.value, url = r.querySelector(".link-url")?.value, iconUrl = r.querySelector(".link-icon-url")?.value || "";
      if (title && url) links.push({ title, url, iconUrl });
    });

    const profileData = {
      uid: currentUser.uid, username,
      displayName: document.getElementById("displayName").value,
      bio: document.getElementById("bio").value,
      avatarUrl: document.getElementById("avatarUrl").value,
      accentColor: document.getElementById("accentColor").value || "#6366f1",
      cardBgColor: document.getElementById("cardBgColor").value || "rgba(15, 23, 42, 0.65)",
      textColor: document.getElementById("textColor").value || "#ffffff",
      bgGifUrl: document.getElementById("bgGifUrl").value,
      bgBlur: document.getElementById("bgBlur").value || "8",
      bgOpacity: document.getElementById("bgOpacity").value || "0.4",
      showClock: document.getElementById("showClock").value === "true",
      clockFormat: document.getElementById("clockFormat").value,
      clockGlow: document.getElementById("clockGlow").value,
      musicUrl: document.getElementById("musicUrl").value,
      discordId: document.getElementById("discordId").value, links
    };

    try {
      await setDoc(doc(db, "profiles", currentUser.uid), profileData);
      await setDoc(doc(db, "usernames", username), { uid: currentUser.uid });
      localStorage.setItem(`biogram_user_${username}`, JSON.stringify(profileData));
      const viewProfileLink = document.getElementById("view-profile-link");
      if (viewProfileLink) viewProfileLink.href = `${window.location.origin}/profile.html?u=${username}`;
      showNotification("Settings saved successfully!");
    } catch (err) { showNotification("Failed to save: " + err.message, true); }
  });
}

function renderLinkInputRow(title = "", url = "", iconUrl = "") {
  const container = document.getElementById("social-links-builder");
  if (!container) return;
  const row = document.createElement("div");
  row.className = "social-link-row";
  row.style.cssText = "display:flex;gap:0.5rem;margin-bottom:0.5rem;";
  row.innerHTML = `<input type="text" class="link-title" placeholder="Title" value="${title}" required style="flex:1;" /><input type="url" class="link-url" placeholder="URL Address" value="${url}" required style="flex:2;" /><input type="url" class="link-icon-url" placeholder="Logo URL (Optional)" value="${iconUrl}" style="flex:1.5;" /><button type="button" class="secondary-btn" onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(row);
}

async function loadUserDataIntoForm(uid) {
  try {
    const docSnap = await getDoc(doc(db, "profiles", uid));
    if (docSnap.exists()) {
      const data = docSnap.data();
      ["username", "displayName", "bio", "avatarUrl", "accentColor", "cardBgColor", "textColor", "bgGifUrl", "bgBlur", "bgOpacity", "clockFormat", "clockGlow", "musicUrl", "discordId"].forEach(f => {
        const el = document.getElementById(f); if (el && data[f] !== undefined) el.value = data[f];
      });
      if (document.getElementById("showClock")) document.getElementById("showClock").value = data.showClock ? "true" : "false";
      const linksContainer = document.getElementById("social-links-builder");
      if (linksContainer) { linksContainer.innerHTML = ""; (data.links || []).forEach(l => renderLinkInputRow(l.title, l.url, l.iconUrl)); }
      const viewLink = document.getElementById("view-profile-link");
      if (data.username && viewLink) viewLink.href = `${window.location.origin}/profile.html?u=${data.username}`;
    }
  } catch (err) { console.error("Error loading profile:", err); }
}

async function loadPublicProfile(username) {
  try {
    let data = null, u = username.toLowerCase();
    const usernameSnap = await getDoc(doc(db, "usernames", u));
    if (usernameSnap.exists()) {
      const profileSnap = await getDoc(doc(db, "profiles", usernameSnap.data().uid));
      if (profileSnap.exists()) data = profileSnap.data();
    }
    if (!data) { const local = localStorage.getItem(`biogram_user_${u}`); if (local) data = JSON.parse(local); }
    if (!data) return;

    document.title = `${data.displayName || data.username} — BioGram`;
    const card = document.getElementById("profile-card"), bgLayer = document.getElementById("profile-bg-layer"), avatarEl = document.getElementById("profile-avatar"), nameEl = document.getElementById("profile-display-name"), handleEl = document.getElementById("profile-username"), bioEl = document.getElementById("profile-bio");

    if (avatarEl && data.avatarUrl) avatarEl.src = data.avatarUrl;
    if (nameEl) nameEl.innerText = data.displayName || data.username;
    if (handleEl) handleEl.innerText = `@${data.username}`;
    if (bioEl) bioEl.innerText = data.bio || "";

    if (card) {
      card.style.backgroundColor = data.cardBgColor || "rgba(15, 23, 42, 0.65)";
      card.style.borderColor = data.accentColor || "rgba(255, 255, 255, 0.12)";
      card.style.color = data.textColor || "#ffffff";
    }
    if (bgLayer && data.bgGifUrl) {
      bgLayer.style.backgroundImage = `url("${data.bgGifUrl.trim()}")`;
      if (data.bgBlur) bgLayer.style.filter = `blur(${data.bgBlur}px) brightness(0.6)`;
      if (data.bgOpacity) bgLayer.style.opacity = data.bgOpacity;
    }

    renderPublicLinks(data.links || []);
    if (data.showClock) { document.getElementById("profile-clock-widget")?.classList.remove("hidden"); startClockWidget(data.clockFormat === "24"); }
    if (data.discordId) loadDiscordPresence(data.discordId);
    if (data.musicUrl) setupTapToOpenAndPlay(data.musicUrl);
  } catch (err) { console.error("Public profile error:", err); }
}

function renderPublicLinks(links) {
  const container = document.getElementById("profile-links-list");
  if (!container) return;
  container.innerHTML = "";
  links.forEach(l => {
    const a = document.createElement("a");
    a.className = "custom-profile-link"; a.href = l.url.startsWith("http") ? l.url : `https://${l.url}`; a.target = "_blank"; a.rel = "noopener noreferrer";
    let icon = (l.iconUrl && l.iconUrl.trim()) ? `<img src="${l.iconUrl}" alt="logo" class="link-custom-icon" onerror="this.outerHTML='${GMAIL_SVG.replace(/'/g, "\\'")}'" />` : GMAIL_SVG;
    a.innerHTML = `<span class="link-icon-wrapper">${icon}</span><span class="link-title-text">${l.title}</span>`;
    container.appendChild(a);
  });
}

function startClockWidget(is24Hour) {
  const clockTime = document.getElementById("clock-time"), clockDate = document.getElementById("clock-date");
  const update = () => {
    const now = new Date();
    if (clockTime) clockTime.innerText = now.toLocaleTimeString([], { hour12: !is24Hour });
    if (clockDate) clockDate.innerText = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };
  update(); setInterval(update, 1000);
}

async function loadDiscordPresence(discordId) {
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${discordId}`), json = await res.json();
    if (json.success && json.data) {
      const widget = document.getElementById("discord-widget"), dot = document.getElementById("discord-dot"), user = document.getElementById("discord-user"), activity = document.getElementById("discord-activity");
      widget?.classList.remove("hidden");
      if (user) user.innerText = json.data.discord_user.username;
      const status = json.data.discord_status;
      if (dot) dot.className = `status-dot-badge ${status}`;
      if (activity) activity.innerText = (json.data.activities?.length) ? `${json.data.activities[0].type === 0 ? 'Playing' : 'In'} ${json.data.activities[0].name}` : status.toUpperCase();
    }
  } catch (err) { console.error("Lanyard Fetch Error:", err); }
}

function setupTapToOpenAndPlay(audioUrl) {
  let audio = document.getElementById("bg-audio") || document.createElement("audio");
  audio.id = "bg-audio"; audio.loop = true; audio.src = audioUrl;
  if (!audio.parentElement) document.body.appendChild(audio);

  let overlay = document.getElementById("tap-overlay") || document.createElement("div");
  overlay.id = "tap-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.95);backdrop-filter:blur(16px);z-index:99999;display:flex;justify-content:center;align-items:center;color:#fff;cursor:pointer;transition:opacity 0.5s;";
  overlay.innerHTML = `<div style="text-align:center;pointer-events:none;"><div style="font-size:2.5rem;margin-bottom:0.5rem;">✨</div><div style="font-weight:700;font-size:1.25rem;color:#a5b4fc;">Tap anywhere to open profile</div></div>`;
  if (!overlay.parentElement) document.body.appendChild(overlay);

  const handleTap = () => {
    audio.play().catch(e => console.warn("Audio play blocked:", e));
    overlay.style.opacity = "0"; setTimeout(() => overlay.remove(), 500);
    window.removeEventListener("click", handleTap); window.removeEventListener("touchstart", handleTap);
  };
  window.addEventListener("click", handleTap); window.removeEventListener("touchstart", handleTap);
}