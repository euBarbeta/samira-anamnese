// src/push-notifications-native.js
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Verifica se está rodando como app nativo (Capacitor/APK)
 */
export function isNativo() {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  return Capacitor.isNativePlatform();
  return isNative;
}
export async function inscreverPushNativo(pacienteId) {
  if (!isNativo()) {
    console.warn('⚠️ Não está rodando em plataforma nativa');
    return null;
  }

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

    // 2. Registra listeners (só uma vez)
    await PushNotifications.removeAllListeners();

    PushNotifications.addListener('registration', async (token) => {
      console.log('✅ Token FCM recebido:', token.value);

      // Salva no Firestore associado ao paciente
      try {
        await setDoc(
          doc(db, 'push_subscriptions', String(pacienteId)),
          {
            pacienteId: String(pacienteId),
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

    PushNotifications.addListener('registrationError', (error) => {
      console.error('❌ Erro no registro do push:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('📬 Notificação recebida (app aberto):', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('👆 Notificação clicada:', action);
      // Ação opcional: navegar para determinada tela
    });

    // 3. Registra
    await PushNotifications.register();

    return true;
  } catch (err) {
    console.error('❌ Erro ao inscrever push nativo:', err);
    return null;
  }
}