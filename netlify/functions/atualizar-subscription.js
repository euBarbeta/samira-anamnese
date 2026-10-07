// netlify/functions/atualizar-subscription.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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

    const body = JSON.parse(event.body || '{}');

    // ✅ Formato novo: { role, id, subscription }
    // ✅ Formato antigo: { pacienteId, subscription } → assume paciente
    let role = body.role;
    let id = body.id;

    if (!role && body.pacienteId) {
      role = 'paciente';
      id = body.pacienteId;
    }

    const { subscription } = body;

    if (!role || !id || !subscription) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Dados incompletos' }),
      };
    }

    // ✅ Escolhe coleção e campo de id conforme o role
    const colecao =
      role === 'esteticista'
        ? 'push_subscriptions_esteticistas'
        : 'push_subscriptions';

    const campoId = role === 'esteticista' ? 'uidEsteticista' : 'pacienteId';

    await db
      .collection(colecao)
      .doc(String(id))
      .set(
        {
          [campoId]: String(id),
          subscription,
          plataforma: 'web',
          subscriptionAtualizadaEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        },
        { merge: true }
      );

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, role, id }),
    };
  } catch (err) {
    console.error('❌ Erro:', err.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};