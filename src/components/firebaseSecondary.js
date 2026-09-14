import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

// Mesmas configurações do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAeo_ESZP4YdX-hGQrEoUXNxevMv5Ch1H8",
  authDomain: "samiraestetica.firebaseapp.com",
  projectId: "samiraestetica",
  storageBucket: "samiraestetica.firebasestorage.app",
  messagingSenderId: "898422145244",
  appId: "1:898422145244:web:a49383dfd6be6f71d8f419"
};

// Verifica se o aplicativo secundário já existe na sessão para evitar duplicação
const secondaryApp = !getApps().some(app => app.name === 'SecondaryApp') 
  ? initializeApp(firebaseConfig, 'SecondaryApp') 
  : getApps().find(app => app.name === 'SecondaryApp');

export const secondaryAuth = getAuth(secondaryApp);