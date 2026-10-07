// netlify/functions/checar-lembretes-esteticista.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

// ============================================================
// Janelas de tempo (em minutos) para disparar cada lembrete
// ============================================================
const JANELA_24H = {
  min: 23 * 60 + 30,  // 23h30
  max: 24 * 60 + 30,  // 24h30
};
const JANELA_1H = {
  min: 50,   // 50min
  max: 70,   // 1h10
};

// Timezone do Brasil (UTC-3)
const TZ_OFFSET_MIN = -3 * 60;

function agoraEmMinutosDesdeMeiaNoite(data) {
  return data.getHours() * 60 + data.getMinutes();
}

exports.handler = async (event) => {
  // Só aceita POST do próprio agendador
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

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

    // ============================================================
    // 1. Descobre o range de datas a checar (hoje + amanhã)
    //    (em horário de Brasília)
    // ============================================================
    const agoraUTC = new Date();
    const agoraBR = new Date(agoraUTC.getTime() + TZ_OFFSET_MIN * 60 * 1000);
    const hojeBR = agoraBR.toISOString().split('T')[0];

    const amanha = new Date(agoraBR);
    amanha.setDate(amanha.getDate() + 1);
    const amanhaBR = amanha.toISOString().split('T')[0];

    // ============================================================
    // 2. Busca agendamentos confirmados de hoje e amanhã
    // ============================================================
    const snap = await db
      .collection('agendamentos')
      .where('data', 'in', [hojeBR, amanhaBR])
      .get();

    if (snap.empty) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, checados: 0 }),
      };
    }

    let enviados24h = 0;
    let enviados1h = 0;
    const resultados = [];

    for (const doc of snap.docs) {
      const ag = doc.data();

      // Só confirmados
      if (ag.status !== 'confirmado') continue;
      // Só se tem uidEsteticista
      if (!ag.uidEsteticista) continue;

      // ============================================================
      // 3. Calcula minutos até o início do agendamento
      // ============================================================
      if (!ag.data || !ag.horaInicio) continue;
      const [ano, mes, dia] = ag.data.split('-').map(Number);
      const [hora, minuto] = ag.horaInicio.split(':').map(Number);
      const dataAgendamentoUTC = new Date(
        Date.UTC(ano, mes - 1, dia, hora, minuto - TZ_OFFSET_MIN)
      );
      const diffMin = (dataAgendamentoUTC.getTime() - agoraUTC.getTime()) / 60000;

      // Ignora se já passou
      if (diffMin < 0) continue;

      // ============================================================
      // 4. Verifica se precisa enviar lembrete de 24h
      // ============================================================
      const precisa24h =
        !ag.lembrete24hEnviado &&
        diffMin >= JANELA_24H.min &&
        diffMin <= JANELA_24H.max;

      // ============================================================
      // 5. Verifica se precisa enviar lembrete de 1h
      // ============================================================
      const precisa1h =
        !ag.lembrete1hEnviado &&
        diffMin >= JANELA_1H.min &&
        diffMin <= JANELA_1H.max;

      if (!precisa24h && !precisa1h) continue;

      // ============================================================
      // 6. Busca a sub do esteticista
      // ============================================================
      const subDoc = await db
        .collection('push_subscriptions_esteticistas')
        .doc(String(ag.uidEsteticista))
        .get();

      if (!subDoc.exists) {
        // Sem sub — marca como "não enviado" para tentar de novo
        // no próximo ciclo (mas sem bloquear o processo)
        continue;
      }

      const subData = subDoc.data();

      // ============================================================
      // 7. Monta o push (24h ou 1h)
      // ============================================================
      let titulo, corpo;
      if (precisa24h) {
        titulo = '📅 Lembrete: consulta amanhã';
        corpo = `${ag.nome || 'Paciente'} — ${ag.horaInicio}${ag.servicoNome ? ` · ${ag.servicoNome}` : ''}`;
      } else {
        titulo = '⏰ Consulta em 1 hora';
        corpo = `${ag.nome || 'Paciente'} às ${ag.horaInicio}${ag.servicoNome ? ` · ${ag.servicoNome}` : ''}`;
      }

      const tagUnica = `lembrete-${precisa24h ? '24h' : '1h'}-${doc.id}`;
      const resultadosCanal = { fcm: false, webpush: false };

      // FCM (APK)
      if (subData.fcmToken) {
        try {
          await getMessaging().send({
            token: subData.fcmToken,
            notification: { title: titulo, body: corpo },
            data: {
              tipo: 'lembrete_agendamento',
              agendamentoId: String(doc.id),
              url: '/',
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
          resultadosCanal.fcm = true;
        } catch (e) {
          console.error('FCM falhou:', e.message);
        }
      }

      // Web-push (PWA)
      if (subData.subscription) {
        try {
          await webpush.sendNotification(
            subData.subscription,
            JSON.stringify({
              title: titulo,
              body: corpo,
              tag: tagUnica,
              url: '/',
              tipo: 'lembrete_agendamento',
              agendamentoId: String(doc.id),
            })
          );
          resultadosCanal.webpush = true;
        } catch (e) {
          console.error('Web-push falhou:', e.message);
        }
      }

      const envioOk = resultadosCanal.fcm || resultadosCanal.webpush;

      // ============================================================
      // 8. Marca a flag apenas se o envio foi bem-sucedido
      // ============================================================
      if (envioOk) {
        const update = { atualizadoEm: new Date().toISOString() };
        if (precisa24h) update.lembrete24hEnviado = true;
        if (precisa1h) update.lembrete1hEnviado = true;
        await doc.ref.update(update);

        if (precisa24h) enviados24h++;
        if (precisa1h) enviados1h++;
      }

      resultados.push({
        id: doc.id,
        nome: ag.nome,
        tipo: precisa24h ? '24h' : '1h',
        ok: envioOk,
        canais: Object.entries(resultadosCanal)
          .filter(([, v]) => v)
          .map(([k]) => k),
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        checados: snap.size,
        enviados24h,
        enviados1h,
        resultados,
      }),
    };
  } catch (err) {
    console.error('❌ Erro:', err.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};