// src/components/push-notifications.js
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  isNativo,
  inscreverPushNativo,
  inscreverPushEsteticista,
} from './push-notifications-native';
import { log, logWarn, logError } from '../utils/log';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/* ============================================================
   Chaves de rastreio: "quem usou este navegador por último".
   Um navegador tem UMA ÚNICA subscription de web-push.
   Se a esteticista e um paciente usarem o mesmo Chrome, os dois
   docs apontam para a mesma subscription — e a notificação de
   foto chegaria nos dois. Estas chaves resolvem isso: quando
   alguém se inscreve, limpamos a subscription web do tipo OPOSTO.
   ============================================================ */
const STORAGE_KEY_LAST_PATIENT = 'push_last_paciente_id';
const STORAGE_KEY_LAST_ESTHETICIAN = 'push_last_esteticista_uid';

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

/* ============================================================
   Helpers de limpeza — chamados ANTES de registrar uma nova
   subscription, sempre limpando o TIPO OPOSTO primeiro.
   ============================================================ */
async function limparSubscriptionEsteticistaAnterior() {
  try {
    const anterior = localStorage.getItem(STORAGE_KEY_LAST_ESTHETICIAN);
    if (!anterior) return;

    await updateDoc(
      doc(db, 'push_subscriptions_esteticistas', anterior),
      { subscription: null, subscriptionLimpaEm: new Date().toISOString() }
    ).catch(() => {});
    localStorage.removeItem(STORAGE_KEY_LAST_ESTHETICIAN);
  } catch (e) {
    logWarn('localStorage indisponível:', e);
  }
}

async function limparSubscriptionPacienteAnterior() {
  try {
    const anterior = localStorage.getItem(STORAGE_KEY_LAST_PATIENT);
    if (!anterior) return;

    await updateDoc(
      doc(db, 'push_subscriptions', anterior),
      { subscription: null, subscriptionLimpaEm: new Date().toISOString() }
    ).catch(() => {});
    localStorage.removeItem(STORAGE_KEY_LAST_PATIENT);
  } catch (e) {
    logWarn('localStorage indisponível:', e);
  }
}

/* ============================================================
   PACIENTE — web-push (PWA/navegador)
   ============================================================ */
export async function inscreverPush(pacienteId) {
  const pacienteIdStr = String(pacienteId);

  // 1) App nativo (APK) → FCM
  if (isNativo()) {
    return inscreverPushNativo(pacienteId);
  }

  // 2) Navegador (PWA) → web-push
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    logWarn('❌ Push não suportado no navegador.');
    return null;
  }
  if (!VAPID_PUBLIC_KEY) {
    console.error('❌ VAPID key não configurada (.env → VITE_VAPID_PUBLIC_KEY).');
    return null;
  }

  // ✅ PASSO CRÍTICO: antes de registrar o paciente, limpa a subscription
  //    web da esteticista (se ela usou este navegador antes) E do paciente
  //    anterior (se foi outro). Só o atual fica com subscription ativa.
  await limparSubscriptionEsteticistaAnterior();
  await limparSubscriptionPacienteAnterior();

  try {
    localStorage.setItem(STORAGE_KEY_LAST_PATIENT, pacienteIdStr);
  } catch {}

  try {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;
    } else if (Notification.permission === 'denied') {
      logWarn('❌ Permissão negada pelo usuário.');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;

    // ✅ Avisa o SW quem é o dono deste navegador (usado no
    //    pushsubscriptionchange pra saber em qual coleção escrever)
    if (registration.active) {
      registration.active.postMessage({
        tipo: 'SALVAR_CONTEXTO_PUSH',
        role: 'paciente',
        id: pacienteIdStr,
      });
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    await setDoc(
      doc(db, 'push_subscriptions', pacienteIdStr),
      {
        pacienteId: pacienteIdStr,
        subscription: subscription.toJSON(),
        plataforma: 'web',
        subscriptionAtualizadaEm: new Date().toISOString(),
      },
      { merge: true } // preserva fcmToken (APK) se existir
    );

    return subscription;
  } catch (err) {
    console.error('❌ Erro ao inscrever push (paciente web):', err);
    return null;
  }
}

/* ============================================================
   ESTETICISTA — web-push (PWA/navegador) — coleção separada
   ============================================================ */
export async function inscreverPushEsteticistaWeb(uidEsteticista) {
  const uidStr = String(uidEsteticista);

  // 1) Nativo (APK) → FCM
  if (isNativo()) {
    return inscreverPushEsteticista(uidEsteticista);
  }

  // 2) Navegador (PWA) → web-push
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    logWarn('❌ Push não suportado no navegador.');
    return null;
  }
  if (!VAPID_PUBLIC_KEY) {
    console.error('❌ VAPID key não configurada (.env → VITE_VAPID_PUBLIC_KEY).');
    return null;
  }

  // ✅ PASSO CRÍTICO: antes de registrar a esteticista, limpa a subscription
  //    web de QUALQUER paciente que usou este navegador antes. Assim a
  //    notificação de foto só chega nela.
  await limparSubscriptionPacienteAnterior();
  await limparSubscriptionEsteticistaAnterior();

  try {
    localStorage.setItem(STORAGE_KEY_LAST_ESTHETICIAN, uidStr);
  } catch {}

  try {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;
    } else if (Notification.permission === 'denied') {
      logWarn('❌ Permissão negada pelo usuário.');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;

    // ✅ Avisa o SW quem é o dono deste navegador (usado no
    //    pushsubscriptionchange pra saber em qual coleção escrever)
    if (registration.active) {
      registration.active.postMessage({
        tipo: 'SALVAR_CONTEXTO_PUSH',
        role: 'esteticista',
        id: uidStr,
      });
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    await setDoc(
      doc(db, 'push_subscriptions_esteticistas', uidStr),
      {
        uidEsteticista: uidStr,
        subscription: subscription.toJSON(),
        plataforma: 'web',
        subscriptionAtualizadaEm: new Date().toISOString(),
      },
      { merge: true }
    );

    return subscription;
  } catch (err) {
    console.error('❌ Erro inscrever push esteticista (web):', err);
    return null;
  }
}
/* ============================================================
   Listener global — o SW avisa quando a subscription mudou
   (`pushsubscriptionchange`). Se uma aba estiver aberta,
   aproveitamos o token do usuário para regravar com auth.
   ============================================================ */
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', async (event) => {
    const msg = event.data || {};
    if (msg.tipo !== 'RESUBSCRIBE_PUSH') return;
    if (!msg.subscription || !msg.role || !msg.id) return;

    try {
      const { auth } = await import('./firebase');
      const user = auth.currentUser;
      if (!user || user.uid !== String(msg.id)) return;

      const token = await user.getIdToken();

      await fetch('/.netlify/functions/atualizar-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: msg.role,
          id: msg.id,
          subscription: msg.subscription,
        }),
      });
    } catch (e) {
      logWarn('Falha ao ressincronizar subscription via mensagem do SW:', e);
    }
  });
}