import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, type Auth } from "firebase/auth";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

// Firebase web config is public by design (it identifies the project, it isn't a secret).
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCa_AATzuZQ3-paO0OXyZjp0vRUGGPHkrs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "flower-website-81679.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "flower-website-81679",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "flower-website-81679.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "666411999408",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:666411999408:web:4bae84dccd5bbee4f99b75",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-V3JF0TY4NM",
};

// Initialize once (SSR and HMR can evaluate this module more than once).
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/** Resolves once Firebase has restored (or ruled out) a saved sign-in in this browser. */
export const firebaseReady: Promise<void> =
  typeof window === "undefined"
    ? Promise.resolve()
    : new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, () => {
          unsubscribe();
          resolve();
        });
      });

let analyticsInstance: Analytics | null = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((yes) => {
      if (yes) analyticsInstance = getAnalytics(app);
    })
    .catch(() => {});
}

export { analyticsInstance as analytics };
