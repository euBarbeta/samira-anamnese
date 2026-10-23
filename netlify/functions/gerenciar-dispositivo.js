// netlify/functions/gerenciar-dispositivo.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const UIDS_ESTETICISTAS = [
  'MZ5j3NpjlxY67yLRiEfg13TbPE32', // Samira
  'ZvzIxDhsh7WMZqvG5hcFQS0yd9I2', // MbTech
];

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

    // 🔒 Exige token de esteta
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (!token) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'sem token' }) };
    }

    const { getAuth } = require('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(token);

    if (!UIDS_ESTETICISTAS.includes(decoded.uid)) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'não autorizado' }) };
    }

    const { pacienteId, fingerprint, acao, motivo = '' } = JSON.parse(event.body || '{}');

    // ✅ Adicionado 'dispensar' na lista de ações permitidas
    if (!pacienteId || !fingerprint || !['autorizar', 'bloquear', 'dispensar'].includes(acao)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'dados inválidos' }) };
    }

    const chave = `${String(pacienteId)}__${fingerprint}`;
    const ref = db.collection('dispositivos_autorizados').doc(chave);
    const snap = await ref.get();

    if (!snap.exists) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'dispositivo não encontrado' }) };
    }

    const agora = new Date().toISOString();

    if (acao === 'autorizar') {
      await ref.set(
        {
          autorizado: true,
          aguardandoAprovacao: false,
          bloqueadoPor: null,
          bloqueadoEm: null,
          motivoBloqueio: null,
          autorizadoPor: decoded.uid,
          autorizadoEm: agora,
        },
        { merge: true }
      );
    } else if (acao === 'bloquear') {
      await ref.set(
        {
          autorizado: false,
          aguardandoAprovacao: false,
          bloqueadoPor: decoded.uid,
          bloqueadoEm: agora,
          motivoBloqueio: motivo.slice(0, 200) || 'Bloqueado pela profissional',
        },
        { merge: true }
      );
    } else if (acao === 'dispensar') {
      // ✅ Apenas remove o alerta da tela, mas NÃO muda a autorização
      // do dispositivo (se estava bloqueado, continua bloqueado).
      await ref.set(
        {
          aguardandoAprovacao: false,
        },
        { merge: true }
      );
    }

    // Fecha o alerta (se existir) mudando o status
    try {
      const alertasSnap = await db
        .collection('alertas_dispositivo')
        .where('pacienteId', '==', String(pacienteId))
        .where('fingerprint', '==', fingerprint)
        .where('status', '==', 'pendente')
        .get();

      const batch = db.batch();
      alertasSnap.docs.forEach((d) => {
        batch.update(d.ref, {
          status: acao === 'autorizar' ? 'autorizado' : acao === 'bloquear' ? 'bloqueado' : 'dispensado',
          resolvidoPor: decoded.uid,
          resolvidoEm: agora,
        });
      });
      await batch.commit();
    } catch (e) {
      console.warn('Falha ao fechar alertas:', e);
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, acao }),
    };
  } catch (err) {
    console.error('❌ Erro gerenciar-dispositivo:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};