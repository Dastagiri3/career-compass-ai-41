// Firebase initialization (modular v9+)
// These are publishable client config values — safe to ship to the browser.
// Firestore security is enforced via Firebase Security Rules in the Firebase console.
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBdTs4jc11wQcm276HIkP0II9YIYznqYlE",
  authDomain: "jdbot-572c1.firebaseapp.com",
  projectId: "jdbot-572c1",
  storageBucket: "jdbot-572c1.firebasestorage.app",
  messagingSenderId: "1041126037065",
  appId: "1:1041126037065:web:c49d3d668091320dfed198",
  measurementId: "G-V4Y3ERCFZ4",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
