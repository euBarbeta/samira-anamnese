// src/push-notifications-native.js
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Verifica se está rodando como app nativo (Capacitor/APK)
 */
export function isNativo() {
  return Capacitor.isNativePlatform();
}

/* ============================================================
   FLAGS GLOBAIS DE SESSÃO
   - listenerRegistrado: evita recriar listeners a cada chamada
   - pacienteIdAtual: detecta troca de paciente (logout/login)
   ============================================================ */
let listenerRegistrado = false;
let pacienteIdAtual = null;

/* ============================================================
   PACIENTE — Registra push via FCM (APK)
   ============================================================ */
export async function inscreverPushNativo(pacienteId) {
  if (!isNativo()) {
    console.warn('⚠️ Não está rodando em plataforma nativa');
    return null;
  }

  const pacienteIdStr = String(pacienteId);

  // ✅ Detalhe sutil: se o paciente MUDOU (logout/login com outro usuário),
  //    força um re-registro dos listeners, pois o closure antigo aponta
  //    para o paciente errado.
  if (pacienteIdAtual && pacienteIdAtual !== pacienteIdStr) {
    console.log('🔄 Paciente mudou — forçando re-registro de listeners');
    listenerRegistrado = false;
  }
  pacienteIdAtual = pacienteIdStr;

  try {
    // 1. Pede permissão
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('❌ Permissão de notificação negada');
      return null;
    }

    // 2. Registra listeners — SOMENTE UMA VEZ por sessão
    //    (evita race condition: removeAllListeners + addListener concorrentes)
    if (!listenerRegistrado) {
      await PushNotifications.removeAllListeners();

      await PushNotifications.addListener('registration', async (token) => {
        console.log('✅ Token FCM recebido:', token.value);

        try {
          await setDoc(
            doc(db, 'push_subscriptions', pacienteIdStr),
            {
              pacienteId: pacienteIdStr,
              fcmToken: token.value,
              plataforma: 'native',
              atualizadoEm: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (e) {
          console.error('❌ Erro ao salvar token FCM:', e);
        }
      });

      await PushNotifications.addListener('registrationError', (error) => {
        console.error('❌ Erro no registro do push:', error);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('📬 Notificação recebida (app aberto):', notification);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('👆 Notificação clicada:', action);
      });

      listenerRegistrado = true;
    }

    // 3. Solicita/atualiza token
    await PushNotifications.register();
    return true;
  } catch (err) {
    console.error('❌ Erro ao inscrever push nativo:', err);
    return null;
  }
}

/* ============================================================
   ESTETICISTA — Registra push via FCM (coleção separada)
   ============================================================ */
let listenerRegistradoEsteticista = false;
let uidEsteticistaAtual = null;

export async function inscreverPushEsteticista(uidEsteticista) {
  if (!isNativo()) return null;

  const uidStr = String(uidEsteticista);

  // ✅ Mesmo detalhe sutil para a esteticista
  if (uidEsteticistaAtual && uidEsteticistaAtual !== uidStr) {
    console.log('🔄 Esteticista mudou — forçando re-registro de listeners');
    listenerRegistradoEsteticista = false;
  }
  uidEsteticistaAtual = uidStr;

  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') {
      console.warn('❌ Permissão negada (esteticista)');
      return null;
    }

    if (!listenerRegistradoEsteticista) {
      await PushNotifications.removeAllListeners();

      await PushNotifications.addListener('registration', async (token) => {
        console.log('✅ Token FCM esteticista:', token.value);

        try {
          await setDoc(
            doc(db, 'push_subscriptions_esteticistas', uidStr),
            {
              uidEsteticista: uidStr,
              fcmToken: token.value,
              plataforma: 'native',
              atualizadoEm: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (e) {
          console.error('❌ Erro ao salvar token esteticista:', e);
        }
      });

      await PushNotifications.addListener('registrationError', (err) => {
        console.error('❌ Erro no registro (esteticista):', err);
      });

      listenerRegistradoEsteticista = true;
    }

    await PushNotifications.register();
    return true;
  } catch (err) {
    console.error('❌ Erro inscreverPushEsteticista:', err);
    return null;
  }
}