// netlify/functions/reativar-auth-paciente.js
//
// ⚖️ Recria (ou reabilita) a conta do Firebase Auth de um paciente
//    que foi reativado após ser arquivado.
//
// Como funciona agora?
//   - O `excluir-paciente-completo` agora apenas DESABILITA a conta.
//   - Esta function garante que a conta volte a ficar ativa (disabled: false).
//   - Se a conta tiver sido deletada por algum motivo extremo (ex: exclusão
//     pelo próprio paciente), a function recria com o mesmo UID.

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
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

    const { uid, email, password } = JSON.parse(event.body || '{}');

    if (!uid || !email || !password) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'Faltam dados: uid, email, password' }),
      };
    }

    const auth = getAuth();
    const agora = new Date().toISOString();

    // ============================================================
    // ✅ Passo 1: Tenta criar o usuário no Auth com o UID EXATO
    // ============================================================
    let criado = false;
    try {
      await auth.createUser({
        uid: String(uid),
        email: email.toLowerCase().trim(),
        password: String(password),
        emailVerified: true,
      });
      criado = true;
      console.log(`✅ [reativar-auth] Conta Auth CRIADA com UID: ${uid}`);
    } catch (err) {
      if (
        err.code === 'auth/uid-already-exists' ||
        err.code === 'auth/email-already-exists'
      ) {
        // Conta já existe — vamos reabilitar/atualizar senha
        console.log(`🔄 [reativar-auth] Conta já existe (UID: ${uid}). Reabilitando...`);

        try {
          await auth.updateUser(String(uid), {
            password: String(password),
            disabled: false, // garante que está habilitada
          });
          console.log(`✅ [reativar-auth] Senha atualizada + conta habilitada (UID: ${uid})`);
        } catch (updateErr) {
          console.warn(
            `⚠️ [reativar-auth] Falha ao atualizar conta existente:`,
            updateErr.message
          );
        }
      } else {
        // Erro real (senha fraca, e-mail inválido, etc.)
        throw err;
      }
    }

    // ============================================================
    // ✅ Passo 2: Garantia final — conta precisa estar ATIVA
    // ============================================================
    try {
      const userRecord = await auth.getUser(String(uid));
      if (userRecord.disabled) {
        await auth.updateUser(String(uid), { disabled: false });
        console.log(`✅ [reativar-auth] Conta REABILITADA (UID: ${uid})`);
      }
    } catch (e) {
      console.warn('[reativar-auth] Falha ao verificar/desbloquear:', e.message);
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        uid: String(uid),
        criado,
        reativadoEm: agora,
      }),
    };
  } catch (err) {
    console.error('❌ Erro reativar-auth-paciente:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};