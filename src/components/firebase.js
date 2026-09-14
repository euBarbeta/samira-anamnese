import { initializeApp } from "firebase/app";
import { initializeAuth, browserLocalPersistence, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAeo_ESZP4YdX-hGQrEoUXNxevMv5Ch1H8",
  authDomain: "samiraestetica.firebaseapp.com",
  projectId: "samiraestetica",
  storageBucket: "samiraestetica.firebasestorage.app",
  messagingSenderId: "898422145244",
  appId: "1:898422145244:web:a49383dfd6be6f71d8f419"
};

const app = initializeApp(firebaseConfig);

// Persistência local = sessão sobrevive a fechar/reabrir o app
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence
});

export const db = getFirestore(app);