// netlify/functions/checar-lembretes.js
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const MS = {
  segundos: 1000,
  minutos: 60 * 1000,
  horas: 60 * 60 * 1000,
  dias: 24 * 60 * 60 * 1000,
};

exports.handler = async (event) => {
  const secret = event.queryStringParameters?.secret
              || JSON.parse(event.body || '{}')?.secret;

  if (secret !== process.env.CRON_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
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
      console.log('Nenhum lembrete pendente');
      return { statusCode: 200, body: JSON.stringify({ ok: true, enviados: 0 }) };
    }

    const prontos = snap.docs.filter(d => {
      const s = d.data().sendAt;
      return typeof s === 'number' && s <= agora;
    });

    if (prontos.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, enviados: 0 }) };
    }

    console.log(`📤 ${prontos.length} lembrete(s) para enviar`);

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
        url: 'https://samira-anamnese.netlify.app',
      });

      let envioOk = false;
      let erroMsg = null;

      try {
        await webpush.sendNotification(subscription, payload);
        envioOk = true;
        console.log('✅ Enviado:', data.titulo);
      } catch (e) {
        erroMsg = e.message;
        console.error('❌ Falha no envio:', data.titulo, '-', e.message);
      }

      // ✅ DIFERENÇA PRINCIPAL: reagendar se for recorrente
      if (data.tipo === 'intervalo' && envioOk) {
        const num = parseInt(data.intervaloNumero, 10) || 1;
        const unidade = data.intervaloUnidade || 'horas';
        const intervaloMs = num * (MS[unidade] || MS.horas);

        // Calcula o próximo horário que está no FUTURO
        let proximo = data.sendAt + intervaloMs;
        while (proximo <= agora) {
          proximo += intervaloMs;
        }

        await doc.ref.update({
          sendAt: proximo,
          ultimoEnvio: new Date().toISOString(),
          tentativas: (data.tentativas || 0) + 1,
        });

        console.log(`🔄 Reagendado "${data.titulo}" para ${new Date(proximo).toISOString()}`);
        resultados.push({ id: doc.id, ok: true, reagendado: true });
      } else {
        // Uma vez só (data_hora) ou falha
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