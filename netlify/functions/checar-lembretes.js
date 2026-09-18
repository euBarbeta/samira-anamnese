// netlify/functions/checar-lembretes.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// ✅ AGENDAMENTO AUTOMÁTICO — roda a cada 1 minuto
// Netlify executa essa function sozinho em produção,
// mesmo com o app fechado. É ISSO que envia os pushes.


const MS = {
  segundos: 1000,
  minutos: 60 * 1000,
  horas: 60 * 60 * 1000,
  dias: 24 * 60 * 60 * 1000,
};

exports.handler = async (event) => {
  // Quando é chamada agendada, o Netlify manda event.httpMethod = 'POST'
  // e o secret vem do próprio Netlify (não precisa validar em scheduled).
  const isScheduled = event.headers?.['x-nf-event'] === 'schedule' 
                   || event.headers?.['X-Nf-Event'] === 'schedule';

  // Mantém a validação de secret apenas para chamadas manuais via HTTP
  if (!isScheduled) {
    const secret = event.queryStringParameters?.secret
                || (event.body ? JSON.parse(event.body).secret : null);
    if (secret !== process.env.CRON_SECRET) {
      return { statusCode: 401, body: 'Unauthorized' };
    }
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

    const agora = Date.now();
    const snap = await db.collection('lembretes_pendentes').where('enviado', '==', false).get();

    if (snap.empty) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, enviados: 0 }) };
    }

    const prontos = snap.docs.filter(d => {
      const s = d.data().sendAt;
      return typeof s === 'number' && s <= agora;
    });

    if (prontos.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, enviados: 0 }) };
    }

    const resultados = [];

    for (const doc of prontos) {
      const data = doc.data();
      const subDoc = await db.collection('push_subscriptions').doc(data.pacienteId).get();

      if (!subDoc.exists) {
        await doc.ref.update({
          enviado: true,
          erro: 'sem inscrição',
          enviadoEm: new Date().toISOString(),
        });
        continue;
      }

      const subscription = subDoc.data().subscription;
      const payload = JSON.stringify({
        title: data.titulo,
        body: 'Você tem um lembrete da Samira Estética',
        tag: data.tag || `lembrete-${doc.id}`,
        lembreteId: doc.id,
        url: '/'
      });

      let envioOk = false;
      let erroMsg = null;

      try {
        await webpush.sendNotification(subscription, payload);
        envioOk = true;
      } catch (e) {
        erroMsg = e.message;
        console.error('❌ Falha no envio:', data.titulo, '-', e.message);
      }

      if (data.tipo === 'intervalo' && envioOk) {
        const num = parseInt(data.intervaloNumero, 10) || 1;
        const unidade = data.intervaloUnidade || 'horas';
        const intervaloMs = num * (MS[unidade] || MS.horas);
        const proximo = Date.now() + intervaloMs;

        const novaTag = `lembrete-${data.pacienteId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        await doc.ref.update({
          sendAt: proximo,
          tag: novaTag,
          ultimoEnvio: new Date().toISOString(),
          tentativas: (data.tentativas || 0) + 1,
        });

        resultados.push({ id: doc.id, ok: true, reagendado: true });
      } else {
        await doc.ref.update({
          enviado: envioOk,
          enviadoEm: envioOk ? new Date().toISOString() : null,
          erro: erroMsg,
          tentadoEm: new Date().toISOString(),
        });
        resultados.push({ id: doc.id, ok: envioOk });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, enviados: resultados.length, resultados }),
    };

  } catch (err) {
    console.error('❌ Erro:', err.stack);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};