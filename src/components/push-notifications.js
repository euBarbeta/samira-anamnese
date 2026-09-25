// src/components/push-notifications.js
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  isNativo,
  inscreverPushNativo,
  inscreverPushEsteticista,
} from './push-notifications-native';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/* ============================================================
   Chave para persistir qual paciente foi o ÚLTIMO a registrar
   push neste navegador. Serve para evitar que o paciente A
   continue recebendo notificações depois que o paciente B
   logar no mesmo dispositivo.
   ============================================================ */
const STORAGE_KEY_LAST_PACIENTE = 'push_last_paciente_id';

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
  const pacienteIdStr = String(pacienteId);

  // ✅ 1) App nativo (APK) → FCM
  if (isNativo()) {
    return inscreverPushNativo(pacienteId);
  }

  // ✅ 2) Navegador (PWA) → web-push
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('❌ Push não suportado no navegador.');
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('❌ VAPID key não configurada (.env → VITE_VAPID_PUBLIC_KEY).');
    return null;
  }

  // ✅ Detalhe sutil para WEB: se outro paciente registrou neste navegador
  //    antes, remove a entrada antiga para ele não continuar recebendo push.
  //    (No nativo isso é resolvido por closures; aqui é via localStorage.)
  try {
    const ultimoPaciente = localStorage.getItem(STORAGE_KEY_LAST_PACIENTE);

    if (ultimoPaciente && ultimoPaciente !== pacienteIdStr) {
      console.log(`🗑️ Removendo subscription antiga do paciente ${ultimoPaciente}`);
      try {
        await deleteDoc(doc(db, 'push_subscriptions', ultimoPaciente));
      } catch (e) {
        console.warn('Falha ao remover subscription antiga (pode não existir):', e);
      }
    }

    localStorage.setItem(STORAGE_KEY_LAST_PACIENTE, pacienteIdStr);
  } catch (e) {
    console.warn('localStorage indisponível:', e);
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
        pacienteId: pacienteIdStr,
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
      doc(db, 'push_subscriptions', pacienteIdStr),
      {
        pacienteId: pacienteIdStr,
        subscription: subJson,
        plataforma: 'web',
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );

    return subscription;
  } catch (err) {
    console.error('❌ Erro ao inscrever push (paciente web):', err);
    return null;
  }
}

/**
 * Registra push da ESTETICISTA — coleção separada.
 *   - Nativo (APK) → FCM
 *   - Navegador (PWA) → web-push
 */
export async function inscreverPushEsteticistaWeb(uidEsteticista) {
  // ✅ 1) Nativo (APK) → FCM
  if (isNativo()) {
    return inscreverPushEsteticista(uidEsteticista);
  }

  // ✅ 2) Navegador (PWA) → web-push
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('❌ Push não suportado no navegador.');
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('❌ VAPID key não configurada (.env → VITE_VAPID_PUBLIC_KEY).');
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