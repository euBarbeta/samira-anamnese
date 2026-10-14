// netlify/functions/agendar-lembretes.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const MS = {
  segundos: 1000,
  minutos: 60 * 1000,
  horas: 60 * 60 * 1000,
  dias: 24 * 60 * 60 * 1000,
};

const STAGGER_MS = 250;
const TOLERANCIA_FUTURO_MS = 5000;
const TOLERANCIA_PASSADO_MS = 30 * 1000;

// ============================================================
// ✅ Offset PADRÃO (Brasil, UTC-3) — usado quando o cliente
//    não envia o offset dele. Mantém compatibilidade retroativa.
// ============================================================
const OFFSET_PADRAO_MIN = -180;

// ============================================================
// ✅ Converte string "YYYY-MM-DDTHH:MM" (datetime-local) para
//    timestamp UTC, respeitando o fuso do cliente.
//
//    O navegador envia a string SEM timezone (ex: "2026-10-14T14:30")
//    interpretada como hora LOCAL do dispositivo.
//
//    Para converter para UTC:
//      UTC = local - offset
//    Se offsetMin = -180 (BRT), então:
//      UTC = 14:30 - (-180min) = 14:30 + 3h = 17:30 UTC ✅
//
//    Se offsetMin = 0 (Lisboa):
//      UTC = 14:30 - 0 = 14:30 UTC
//
//    Se offsetMin = -540 (Tóquio, UTC+9):
//      UTC = 14:30 - (-540min) = 14:30 + 9h = 23:30 UTC
// ============================================================
function parseDataHoraLocalParaUTC(valor, offsetMin) {
  if (!valor) return NaN;

  // Espera formato "YYYY-MM-DDTHH:MM" ou "YYYY-MM-DD HH:MM"
  const match = String(valor).match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/
  );
  if (!match) return NaN;

  const [, ano, mes, dia, hora, min] = match.map(Number);

  // Timestamp UTC do horário "local"
  const utcDoLocal = Date.UTC(ano, mes - 1, dia, hora, min);

  // Offset em ms (ex: -180 * 60000 = -10800000)
  // UTC = local - offset
  const offsetMs = offsetMin * 60 * 1000;
  const utcReal = utcDoLocal - offsetMs;

  return utcReal;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
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

    const body = JSON.parse(event.body || '{}');
    const { pacienteId, lembretes } = body;

    // ============================================================
    // ✅ Lê o offset do cliente (novo) ou usa o padrão BRT (legado)
    // ============================================================
    const offsetMin =
      typeof body.offsetMin === 'number' ? body.offsetMin : OFFSET_PADRAO_MIN;

    if (!pacienteId || !Array.isArray(lembretes)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Dados incompletos' }) };
    }

    // ✅ PASSO 1: Apaga TODOS os lembretes pendentes desse paciente
    const pendentesAntigos = await db.collection('lembretes_pendentes')
      .where('pacienteId', '==', String(pacienteId))
      .where('enviado', '==', false)
      .get();

    if (!pendentesAntigos.empty) {
      const batch = db.batch();
      pendentesAntigos.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      console.log(`🗑️ ${pendentesAntigos.size} lembrete(s) antigo(s) removido(s)`);
    }

    // ✅ PASSO 2: Cria os novos lembretes
    const resultados = [];
    const agora = Date.now();
    let idxImediato = 0;

    for (const lembrete of lembretes) {
      if (!lembrete.titulo || !lembrete.titulo.trim()) continue;

      let sendAt;
      const isDataHora = lembrete.tipo === 'data_hora';

      // ============================================================
      // ✅ Offset específico deste lembrete (permite override por lembrete)
      //    Se não vier, usa o do payload ou o padrão BRT.
      // ============================================================
      const offsetDesteLembrete =
        typeof lembrete.offsetMin === 'number'
          ? lembrete.offsetMin
          : offsetMin;

      if (isDataHora) {
        if (!lembrete.valor) continue;
        sendAt = parseDataHoraLocalParaUTC(lembrete.valor, offsetDesteLembrete);
      } else {
        const num = parseInt(lembrete.intervaloNumero, 10) || 1;
        const unidade = lembrete.intervaloUnidade || 'horas';
        sendAt = Date.now() + (num * (MS[unidade] || MS.horas));
      }

      if (isNaN(sendAt)) continue;

      // Se é data_hora e já passou há mais de 30s → ignora
      if (isDataHora && sendAt < agora - TOLERANCIA_PASSADO_MS) {
        console.log(`⏭️ Ignorado (data passada): "${lembrete.titulo}" → ${new Date(sendAt).toISOString()}`);
        resultados.push({
          titulo: lembrete.titulo,
          tipo: 'ignorado',
          motivo: 'data_hora já passou há mais de 30s',
          sendAt: new Date(sendAt).toISOString(),
        });
        continue;
      }

      // Envio imediato: sendAt entre (agora - 30s) e (agora + 5s)
      const deveEnviarAgora =
        sendAt <= agora + TOLERANCIA_FUTURO_MS &&
        sendAt >= agora - TOLERANCIA_PASSADO_MS;

      if (deveEnviarAgora) {
        const subDoc = await db.collection('push_subscriptions').doc(String(pacienteId)).get();

        if (!subDoc.exists) {
          resultados.push({
            titulo: lembrete.titulo,
            tipo: 'imediato',
            ok: false,
            erro: 'sem inscrição — paciente precisa abrir o app',
          });
          continue;
        }

        if (idxImediato > 0) {
          await new Promise((r) => setTimeout(r, idxImediato * STAGGER_MS));
        }
        idxImediato++;

        const subData = subDoc.data();
        const tagUnica = `lembrete-${pacienteId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const corpo = 'Você tem um lembrete da Samira Estética';

        const resultadosCanal = {
          fcm: { ok: false, erro: null },
          webpush: { ok: false, erro: null },
        };

        if (subData.fcmToken) {
          try {
            await getMessaging().send({
              token: subData.fcmToken,
              notification: { title: lembrete.titulo, body: corpo },
              data: {
                lembreteId: `imediato-${Date.now()}`,
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
            resultadosCanal.fcm.ok = true;
          } catch (e) {
            resultadosCanal.fcm.erro = e.message;
            console.error('❌ FCM imediato falhou:', e.message);
          }
        }

        if (subData.subscription) {
          try {
            const payloadWeb = JSON.stringify({
              title: lembrete.titulo,
              body: corpo,
              tag: tagUnica,
              lembreteId: `imediato-${Date.now()}`,
              url: '/',
            });
            await webpush.sendNotification(subData.subscription, payloadWeb);
            resultadosCanal.webpush.ok = true;
          } catch (e) {
            resultadosCanal.webpush.erro = e.message;
            console.error('❌ Web-push imediato falhou:', e.message);
          }
        }

        const envioOk = resultadosCanal.fcm.ok || resultadosCanal.webpush.ok;
        const canais = [];
        if (resultadosCanal.fcm.ok) canais.push('fcm');
        if (resultadosCanal.webpush.ok) canais.push('webpush');

        resultados.push({
          titulo: lembrete.titulo,
          tipo: 'imediato',
          ok: envioOk,
          canais,
          erro: envioOk
            ? null
            : (resultadosCanal.fcm.erro || resultadosCanal.webpush.erro),
        });
      } else {
        // Agendado (futuro) → vai pra lembretes_pendentes
        const docRef = await db.collection('lembretes_pendentes').add({
          pacienteId: String(pacienteId),
          titulo: lembrete.titulo,
          sendAt,
          tipo: lembrete.tipo,
          intervaloNumero: lembrete.intervaloNumero || null,
          intervaloUnidade: lembrete.intervaloUnidade || null,
          offsetMin: offsetDesteLembrete, // ✅ guarda pra debug
          enviado: false,
          tentativas: 0,
          criadoEm: new Date().toISOString(),
        });
        resultados.push({
          titulo: lembrete.titulo,
          tipo: 'agendado',
          sendAt: new Date(sendAt).toISOString(),
          docId: docRef.id,
        });
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, resultados }) };
  } catch (err) {
    console.error('❌ Erro:', err.stack);
    return { statusCode: 500, body: JSON.stringify({ error: err.message, stack: err.stack }) };
  }
};