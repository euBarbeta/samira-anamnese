// src/push-notifications-native.js
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { log, logWarn, logError } from '../utils/log';

/**
 * Verifica se está rodando como app nativo (Capacitor/APK)
 */
export function isNativo() {
  return Capacitor.isNativePlatform();
}

/* ============================================================
   CHAVES DE RASTREIO — "quem usou este APK por último"
   ------------------------------------------------------------
   Um aparelho tem UM ÚNICO token FCM. Se dois pacientes (ou
   uma paciente e uma esteticista) usam o mesmo celular, os
   docs dos dois apontariam para o mesmo token — e a notificação
   de um chegaria no celular do outro. Estas chaves resolvem:
   ao inscrever alguém, limpamos o `fcmToken` do dono anterior.
   ============================================================ */
const PREF_KEY_LAST_PACIENTE = 'push_native_last_paciente_id';
const PREF_KEY_LAST_ESTETICISTA = 'push_native_last_esteticista_uid';

/* ============================================================
   Helpers de limpeza
   ============================================================ */
async function limparTokenPacienteAnterior(novoPacienteId) {
  try {
    const { value: anterior } = await Preferences.get({
      key: PREF_KEY_LAST_PACIENTE,
    });
    if (!anterior || anterior === novoPacienteId) return;

    await updateDoc(doc(db, 'push_subscriptions', anterior), {
      fcmToken: null,
      atualizadoEm: new Date().toISOString(),
    }).catch(() => {});
  } catch (e) {
    logWarn('Falha ao limpar token anterior (paciente):', e);
  }
}

async function limparTokenEsteticistaAnterior(novaEsteticistaUid) {
  try {
    const { value: anterior } = await Preferences.get({
      key: PREF_KEY_LAST_ESTETICISTA,
    });
    if (!anterior || anterior === novaEsteticistaUid) return;

    await updateDoc(
      doc(db, 'push_subscriptions_esteticistas', anterior),
      {
        fcmToken: null,
        atualizadoEm: new Date().toISOString(),
      }
    ).catch(() => {});
  } catch (e) {
    logWarn('Falha ao limpar token anterior (esteticista):', e);
  }
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
    logWarn('⚠️ Não está rodando em plataforma nativa');
    return null;
  }

  const pacienteIdStr = String(pacienteId);

  // ✅ Se o paciente MUDOU (logout/login com outro usuário),
  //    força re-registro dos listeners.
  if (pacienteIdAtual && pacienteIdAtual !== pacienteIdStr) {
    log('🔄 Paciente mudou — forçando re-registro de listeners');
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
      logWarn('❌ Permissão de notificação negada');
      return null;
    }

    // ============================================================
    // ✅ PASSO CRÍTICO: limpa o token FCM do PACIENTE ANTERIOR
    //    deste aparelho (se houve troca de conta neste celular).
    //    Também limpa a sub da esteticista anterior, caso o mesmo
    //    celular tenha sido usado por ela antes.
    // ============================================================
    await limparTokenPacienteAnterior(pacienteIdStr);
    await limparTokenEsteticistaAnterior(null);

    // 2. Registra listeners — SOMENTE UMA VEZ por sessão
    if (!listenerRegistrado) {
      await PushNotifications.removeAllListeners();

      await PushNotifications.addListener('registration', async (token) => {
        log('✅ Token FCM recebido:', token.value);

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

          // ✅ Marca este paciente como "último a usar o aparelho"
          //    Só depois que o token foi gravado com sucesso.
          await Preferences.set({
            key: PREF_KEY_LAST_PACIENTE,
            value: pacienteIdStr,
          });
        } catch (e) {
          console.error('❌ Erro ao salvar token FCM:', e);
        }
      });

      await PushNotifications.addListener('registrationError', (error) => {
        console.error('❌ Erro no registro do push:', error);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        log('📬 Notificação recebida (app aberto):', notification);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        log('👆 Notificação clicada:', action);
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
    log('🔄 Esteticista mudou — forçando re-registro de listeners');
    listenerRegistradoEsteticista = false;
  }
  uidEsteticistaAtual = uidStr;

  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') {
      logWarn('❌ Permissão negada (esteticista)');
      return null;
    }

    // ============================================================
    // ✅ PASSO CRÍTICO: limpa o token FCM da ESTETICISTA ANTERIOR
    //    (se houve troca de conta neste celular) e do PACIENTE
    //    anterior, caso o mesmo aparelho tenha sido usado por ele.
    // ============================================================
    await limparTokenEsteticistaAnterior(uidStr);
    await limparTokenPacienteAnterior(null);

    if (!listenerRegistradoEsteticista) {
      await PushNotifications.removeAllListeners();

      await PushNotifications.addListener('registration', async (token) => {
        log('✅ Token FCM esteticista:', token.value);

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

          // ✅ Marca esta esteticista como "última a usar o aparelho"
          await Preferences.set({
            key: PREF_KEY_LAST_ESTETICISTA,
            value: uidStr,
          });
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