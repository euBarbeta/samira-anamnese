// netlify/functions/excluir-paciente-completo.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  try {
    if (getApps().length === 0) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }) });
    }
    
    const db = getFirestore();
    const auth = getAuth();
    const body = JSON.parse(event.body || '{}');
    const { pacienteId, uidEsteticista, motivo = 'esteta-excluiu' } = body;

    if (!pacienteId || !uidEsteticista) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Faltam dados' }) };
    }

    const agora = new Date().toISOString();
    const pacienteRef = db.collection('usuarios').doc(uidEsteticista).collection('pacientes').doc(String(pacienteId));

    // 1. Anonimiza o paciente no Firestore (Força Bruta via Admin)
    await pacienteRef.update({
      telefone: null,
      emailContato: null,
      endereco: null,
      consentimentoLGPD: null, // Reseta o LGPD
      'anamnese.telefone': null,
      'anamnese.emailContato': null,
      'anamnese.endereco': null,
      anonimizadoEm: agora,
      anonimizadoPor: motivo,
      atualizadoEm: agora,
    }).catch(() => {});

    // 2. Anonimiza os agendamentos
    const agsSnap = await db.collection('agendamentos').where('pacienteId', '==', String(pacienteId)).get();
    const batch = db.batch();
    agsSnap.docs.forEach((d) => {
      batch.update(d.ref, { telefone: null, email: null, observacoes: null, anonimizadoEm: agora, anonimizadoPor: motivo });
    });
    await batch.commit().catch(() => {});

    // 3. Desativa o Link de Acesso
    await db.collection('links_pacientes').doc(String(pacienteId)).update({
      ativo: false,
      desativadoEm: agora,
      motivoDesativacao: motivo,
    }).catch(() => {});

    // ============================================================
    // ✅ CORREÇÃO CRÍTICA AQUI:
    // NÃO DELETA a conta do Auth. Apenas DESABILITA.
    // Assim o UID continua existindo e o prontuário fica seguro.
    // ============================================================
    await auth.updateUser(String(pacienteId), { disabled: true }).catch((e) => {
      console.warn('Aviso: Não foi possível desabilitar o Auth (pode já estar desabilitado):', e.message);
    });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('❌ Erro excluir-paciente:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};