
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// TODO: Set these values in your .env.local file
// See deployment_guide.md for instructions
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (import.meta.env.PROD ? 'AIzaSyDwA8YDc8OMuaAVqHec1D7qLGaSEnHhd8U' : ''),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (import.meta.env.PROD ? 'discount-hunter-ai.firebaseapp.com' : ''),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (import.meta.env.PROD ? 'discount-hunter-ai' : ''),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (import.meta.env.PROD ? 'discount-hunter-ai.firebasestorage.app' : ''),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (import.meta.env.PROD ? '897592787094' : ''),
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (import.meta.env.PROD ? '1:897592787094:web:5b21c0bcca3bf9604e42b7' : ''),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
};

// Initialize Firebase only if config is provided
let app, auth, db, analytics;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // Optional: Analytics (only works in production environment)
  if (typeof window !== 'undefined') {
    // analytics = getAnalytics(app);
  }
} else {
  // Create mock implementations when Firebase is not configured
  console.warn('Firebase not configured - using mock auth/db');
  auth = null as any;
  db = null as any;
  analytics = undefined;
}

export { auth, db, analytics };
