import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const app = initializeApp(firebaseConfig);

export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const provider = googleProvider; // Exported alias for compatibility