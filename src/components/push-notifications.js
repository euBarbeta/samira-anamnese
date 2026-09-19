import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

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

export async function inscreverPush(pacienteId) {
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

    // ✅ Avisa o Service Worker qual é o pacienteId,
    //    para que ele possa salvar a subscription sozinho se renovar
    if (registration.active) {
      registration.active.postMessage({
        tipo: 'SALVAR_PACIENTE_ID',
        pacienteId: String(pacienteId)
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