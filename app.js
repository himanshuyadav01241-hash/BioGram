import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { 
  getDatabase, 
  ref, 
  get, 
  set, 
  child 
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAj1gX4dmw8uNEG0yyYL3t6wE0i9BShpBQ",
  authDomain: "biogram-3a908.firebaseapp.com",
  databaseURL: "https://biogram-3a908-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "biogram-3a908",
  storageBucket: "biogram-3a908.firebasestorage.app",
  messagingSenderId: "524800153997",
  appId: "1:524800153997:web:86e6d9657004d33cf345c4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;
let activeUsername = "";

// Animated Tab Title Effect
let originalTitle = document.title;
window.addEventListener('blur', () => { document.title = '✨ Come back to BioGram!'; });
window.addEventListener('focus', () => { document.title = originalTitle; });

window.toggleProfileModal = () => {
  document.getElementById('profile-modal').classList.toggle('hidden');
};

window.toggleFaq = (element) => {
  element.classList.toggle('active');
};

window.applyPreset = (preset) => {
  const card = document.getElementById('demo-card');
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));

  if (preset === 'clean') {
    card.style.backgroundColor = "#ffffff";
    card.style.borderColor = "#6366f1";
    card.style.color = "#0f172a";
    event.target.classList.add('active');
  } else if (preset === 'cyber') {
    card.style.backgroundColor = "#0f172a";
    card.style.borderColor = "#22d3ee";
    card.style.color = "#f8fafc";
    event.target.classList.add('active');
  } else if (preset === 'sunset') {
    card.style.backgroundColor = "#fff7ed";
    card.style.borderColor = "#f97316";
    card.style.color = "#431407";
    event.target.classList.add('active');
  }
};

function showStatus(text, isError = false) {
  const msg = document.getElementById('status-msg');
  if (!msg) return;
  msg.textContent = text;
  msg.className = `message-box ${isError ? 'error' : 'success'}`;
}

// Google Authentication
document.getElementById('google-login-btn')?.addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  try {
    showStatus("Connecting to Google...");
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userSnap = await get(child(ref(db), `profiles/${user.uid}`));
    if (!userSnap.exists()) {
      const defaultHandle = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      await set(ref(db, `usernames/${defaultHandle}`), user.uid);
      await set(ref(db, `profiles/${user.uid}`), {
        username: defaultHandle,
        displayName: user.displayName || defaultHandle,
        avatarUrl: user.photoURL || '',
        createdAt: Date.now()
      });
    }
    showStatus("Signed in successfully!");
  } catch (err) {
    showStatus(err.message, true);
  }
});

// Authentication Sync
onAuthStateChanged(auth, async (user) => {
  const loginTrigger = document.getElementById('nav-login-btn');
  const userAvatar = document.getElementById('nav-user-avatar');

  if (user) {
    currentUser = user;
    loginTrigger?.classList.add('hidden');
    userAvatar?.classList.remove('hidden');

    const avatarImg = document.getElementById('nav-avatar-img');
    if (avatarImg && user.photoURL) {
      avatarImg.style.backgroundImage = `url('${user.photoURL}')`;
    }

    const snapshot = await get(child(ref(db), `profiles/${user.uid}`));
    if (snapshot.exists()) {
      const data = snapshot.val();
      activeUsername = data.username;

      if (document.getElementById('displayName')) document.getElementById('displayName').value = data.displayName || '';
      if (document.getElementById('bio')) document.getElementById('bio').value = data.bio || '';
      if (document.getElementById('avatarUrl')) document.getElementById('avatarUrl').value = data.avatarUrl || user.photoURL || '';
      if (document.getElementById('bgGifUrl')) document.getElementById('bgGifUrl').value = data.bgGifUrl || '';
      if (document.getElementById('musicUrl')) document.getElementById('musicUrl').value = data.musicUrl || '';
      if (document.getElementById('discordId')) document.getElementById('discordId').value = data.discordId || '';

      const viewLink = document.getElementById('view-profile-link');
      if (viewLink) viewLink.href = `profile.html?u=${activeUsername}`;
    }

    document.getElementById('auth-form')?.classList.add('hidden');
    document.getElementById('editor-form')?.classList.remove('hidden');
  } else {
    currentUser = null;
    loginTrigger?.classList.remove('hidden');
    userAvatar?.classList.add('hidden');
    document.getElementById('auth-form')?.classList.remove('hidden');
    document.getElementById('editor-form')?.classList.add('hidden');
  }
});

// Customizer Form Submission
document.getElementById('editor-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  try {
    await set(ref(db, `profiles/${currentUser.uid}`), {
      username: activeUsername,
      displayName: document.getElementById('displayName').value,
      bio: document.getElementById('bio').value,
      avatarUrl: document.getElementById('avatarUrl').value,
      bgGifUrl: document.getElementById('bgGifUrl').value,
      musicUrl: document.getElementById('musicUrl').value,
      discordId: document.getElementById('discordId').value,
      accentColor: document.getElementById('accentColor').value,
      cardBgColor: document.getElementById('cardBgColor').value,
      textColor: document.getElementById('textColor').value,
      fontFamily: document.getElementById('fontFamily').value,
      linkTwitter: document.getElementById('linkTwitter').value,
      linkInstagram: document.getElementById('linkInstagram').value,
      linkGithub: document.getElementById('linkGithub').value,
      updatedAt: Date.now()
    });
    showStatus("Profile saved!");
  } catch (err) {
    showStatus(err.message, true);
  }
});

document.getElementById('logout-btn')?.addEventListener('click', () => signOut(auth));