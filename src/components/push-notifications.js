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
  console.log('🚀 Iniciando inscrição de push para:', pacienteId);

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('❌ Push não suportado neste navegador.');
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('❌ VITE_VAPID_PUBLIC_KEY não configurada no .env.local.');
    return null;
  }

  try {
    // 1) Permissão
    const permission = await Notification.requestPermission();
    console.log('📋 Permissão:', permission);
    if (permission !== 'granted') return null;

    // 2) Service Worker pronto
    const registration = await navigator.serviceWorker.ready;
    console.log('✅ SW pronto:', registration.scope);

    // 3) Verifica se já existe inscrição
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log('➕ Criando nova inscrição...');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log('✅ Inscrição criada:', subscription.endpoint);
    } else {
      console.log('ℹ️ Reutilizando inscrição existente.');
    }

    // 4) Salva no Firestore
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

    console.log('✅ Inscrição salva no Firestore!');
    return subscription;
  } catch (err) {
    console.error('❌ Erro ao inscrever push:', err);
    return null;
  }
}