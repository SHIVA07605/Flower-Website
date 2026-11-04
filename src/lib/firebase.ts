import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
} from "firebase/auth";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCa_AATzuZQ3-paO0OXyZjp0vRUGGPHkrs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "flower-website-81679.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "flower-website-81679",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "flower-website-81679.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "666411999408",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:666411999408:web:4bae84dccd5bbee4f99b75",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-V3JF0TY4NM",
};

// Initialize Firebase safely (avoid duplicate app init during SSR or HMR)
export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

let analyticsInstance: Analytics | null = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((yes) => {
      if (yes) {
        analyticsInstance = getAnalytics(app);
      }
    })
    .catch(() => {});
}

export {
  analyticsInstance as analytics,
  signInWithPopup,
  firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
};
export type { FirebaseUser };

