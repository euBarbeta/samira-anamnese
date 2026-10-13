// netlify/functions/notificar-dispositivo-novo.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const UIDS_ESTETICISTAS = [
  'MZ5j3NpjlxY67yLRiEfg13TbPE32', // Samira
  'ZvzIxDhsh7WMZqvG5hcFQS0yd9I2', // MbTech
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  try {
    if (getApps().length === 0) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert({
          projectId: sa.project_id,
          clientEmail: sa.client_email,
          privateKey: sa.private_key,
        }),
      });
    }
    const db = getFirestore();

    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const { pacienteId, alertaId, dispositivo, cidade } = JSON.parse(event.body || '{}');
    if (!pacienteId || !alertaId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'dados incompletos' }) };
    }

    // Busca o nome do paciente pra mensagem
    let pacienteNome = 'Um paciente';
    try {
      const pacientesSnap = await db.collectionGroup('pacientes')
        .where('__name__', '==', `__null__`) // placeholder — vamos buscar direto
        .limit(1)
        .get();
      // Busca direta — tenta em cada esteta
      for (const uid of UIDS_ESTETICISTAS) {
        const s = await db.doc(`usuarios/${uid}/pacientes/${pacienteId}`).get();
        if (s.exists) {
          pacienteNome = s.data().nome || pacienteNome;
          break;
        }
      }
    } catch (e) {
      console.warn('Falha buscando nome do paciente:', e);
    }

    const titulo = '🚨 Login em dispositivo novo';
    const corpo = `${pacienteNome} entrou de ${dispositivo || 'um dispositivo novo'}${cidade ? ` em ${cidade}` : ''}.`;
    const tagUnica = `device-novo-${alertaId}`;

    const resultados = { fcm: 0, webpush: 0 };

    await Promise.all(
      UIDS_ESTETICISTAS.map(async (uidEsteta) => {
        const subDoc = await db
          .collection('push_subscriptions_esteticistas')
          .doc(uidEsteta)
          .get();

        if (!subDoc.exists) return;
        const subData = subDoc.data();

        // FCM
        if (subData.fcmToken) {
          try {
            await getMessaging().send({
              token: subData.fcmToken,
              notification: { title: titulo, body: corpo },
              data: {
                tipo: 'dispositivo_novo',
                pacienteId: String(pacienteId),
                alertaId,
                url: '/#seguranca',
                tag: tagUnica,
              },
              android: {
                priority: 'high',
                notification: {
                  channelId: 'lembretes',
                  sound: 'default',
                  tag: tagUnica,
                },
              },
            });
            resultados.fcm++;
          } catch (e) {
            console.error(`FCM falhou (${uidEsteta}):`, e.message);
          }
        }

        // Web-push
        if (subData.subscription) {
          try {
            await webpush.sendNotification(
              subData.subscription,
              JSON.stringify({
                title: titulo,
                body: corpo,
                tag: tagUnica,
                url: '/#seguranca',
                tipo: 'dispositivo_novo',
                pacienteId: String(pacienteId),
                alertaId,
              })
            );
            resultados.webpush++;
          } catch (e) {
            console.error(`Web-push falhou (${uidEsteta}):`, e.message);
            if (e.statusCode === 410 || e.statusCode === 404) {
              await subDoc.ref.update({
                subscription: null,
                atualizadoEm: new Date().toISOString(),
              });
            }
          }
        }
      })
    );

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        enviado: resultados.fcm + resultados.webpush > 0,
        resultados,
      }),
    };
  } catch (err) {
    console.error('Erro notificar-dispositivo-novo:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};