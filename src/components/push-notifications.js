// src/components/push-notifications.js
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { isNativo as isNativoCheck, inscreverPushEsteticista } from './push-notifications-native';


const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;


function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registra push escolhendo automaticamente entre:
 *   - Nativo (APK/Android) → FCM via Capacitor
 *   - Navegador (PWA)      → web-push via Service Worker
 */
export async function inscreverPush(pacienteId) {
  // ✅ Se estiver rodando como app nativo (APK), usa FCM
  if (isNativo()) {
    return inscreverPushNativo(pacienteId);
  }

  // ❌ Se estiver no navegador (PWA), usa web-push (lógica antiga)
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('❌ Push não suportado.');
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('❌ VAPID key não configurada.');
    return null;
  }

  try {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;
    } else if (Notification.permission === 'denied') {
      console.warn('❌ Permissão negada pelo usuário.');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;

    if (registration.active) {
      registration.active.postMessage({
        tipo: 'SALVAR_PACIENTE_ID',
        pacienteId: String(pacienteId),
      });
    }

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const subJson = subscription.toJSON();
    await setDoc(
      doc(db, 'push_subscriptions', String(pacienteId)),
      {
        pacienteId: String(pacienteId),
        subscription: subJson,
        plataforma: 'web',
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );

    return subscription;
  } catch (err) {
    console.error('❌ Erro ao inscrever push:', err);
    return null;
  }
}

export async function inscreverPushEsteticistaWeb(uidEsteticista) {
  // 1) Nativo → FCM
  if (isNativoCheck()) {
    return inscreverPushEsteticista(uidEsteticista);
  }

  // 2) Web → web-push (mesma lógica do paciente, coleção separada)
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('❌ Push não suportado no navegador.');
    return null;
  }
  if (!VAPID_PUBLIC_KEY) {
    console.error('❌ VAPID key não configurada.');
    return null;
  }

  try {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;
    } else if (Notification.permission === 'denied') {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    await setDoc(
      doc(db, 'push_subscriptions_esteticistas', String(uidEsteticista)),
      {
        uidEsteticista: String(uidEsteticista),
        subscription: subscription.toJSON(),
        plataforma: 'web',
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );

    return subscription;
  } catch (err) {
    console.error('❌ Erro inscrever push esteticista (web):', err);
    return null;
  }
}