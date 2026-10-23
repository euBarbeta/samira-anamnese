// netlify/functions/anonimizar-conta-paciente.js
//
// ⚖️ LGPD + Lei 13.787/2018
// ------------------------------------------------------------
// Anonimiza a conta de um paciente que está excluindo a própria conta.
//
// ✅ Comportamento IDÊNTICO ao `excluir-paciente-completo` (feito
//    pela esteticista):
//      - Dados de contato anonimizados
//      - E-mail de acesso MANTIDO (só a conta é desativada)
//      - Auth DESATIVADO (disabled: true), não deletado
//      - Prontuário preservado por 20 anos
//      - Agendamentos e dispositivos anonimizados
//      - Lembretes pendentes ignorados por `checar-lembretes.js`
//
// Só pode ser chamada PELO PRÓPRIO PACIENTE (validado via Firebase Auth).

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
    const db = getFirestore();

    // ============================================================
    // 1) Valida o Firebase ID Token
    // ============================================================
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (!token) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'sem token' }) };
    }

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(token);
    } catch (e) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'token inválido' }) };
    }

    const pacienteId = String(decoded.uid);

    // ============================================================
    // 2) Body: { uidEsteticista }
    // ============================================================
    const { uidEsteticista } = JSON.parse(event.body || '{}');
    if (!uidEsteticista) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'uidEsteticista obrigatório' }) };
    }

    const agora = new Date().toISOString();

    // ============================================================
    // 3) Anonimiza o doc do paciente
    // ------------------------------------------------------------
    // ⚠️ IMPORTANTE:
    //    - `emailAcesso` e `email` NÃO são apagados (a esteta precisa ver
    //      o login do paciente na pasta arquivada).
    //    - `nome` e `documento` NÃO são apagados (são prontuário — Lei
    //      13.787/2018 exige guarda por 20 anos).
    //    - Só os dados de CONTATO e CONSENTIMENTO são limpos.
    // ============================================================
    const pacienteRef = db.doc(`usuarios/${uidEsteticista}/pacientes/${pacienteId}`);
    const pacienteSnap = await pacienteRef.get();

    if (!pacienteSnap.exists) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'paciente não encontrado' }) };
    }

    const pacienteData = pacienteSnap.data();

    await pacienteRef.update({
      // ⚠️ Só apaga CONTATO — mantém emailAcesso/email/nome/documento
      telefone: null,
      emailContato: null,
      endereco: null,
      consentimentoLGPD: null,

      'anamnese.telefone': null,
      'anamnese.emailContato': null,
      'anamnese.endereco': null,

      // ⚖️ Marcadores LGPD
      anonimizadoEm: agora,
      anonimizadoPor: 'paciente-solicitou',
      dataCriacaoOriginal: pacienteData.dataCriacao || agora,
      atualizadoEm: agora,
    });

    // ============================================================
    // 4) Anonimiza agendamentos do paciente
    // ============================================================
    const agsSnap = await db.collection('agendamentos')
      .where('pacienteId', '==', pacienteId)
      .get();

    if (!agsSnap.empty) {
      const batch = db.batch();
      agsSnap.docs.forEach((d) => {
        batch.update(d.ref, {
          telefone: null,
          email: null,
          observacoes: null,
          anonimizadoEm: agora,
          anonimizadoPor: 'paciente-solicitou',
        });
      });
      await batch.commit();
    }

    // ============================================================
    // 5) Desativa link de acesso
    // ============================================================
    try {
      const linkRef = db.doc(`links_pacientes/${pacienteId}`);
      const linkSnap = await linkRef.get();
      if (linkSnap.exists) {
        await linkRef.update({
          ativo: false,
          desativadoEm: agora,
          motivoDesativacao: 'paciente-solicitou',
        });
      }
    } catch (e) {
      console.warn('Falha ao desativar link:', e);
    }

    // ============================================================
    // 6) Apaga mapeamento de email
    // ------------------------------------------------------------
    // ⚠️ Mantemos o mapeamento APAGADO — assim o paciente não consegue
    //    logar de novo (o login precisa achar o paciente via mapeamento).
    //    O `emailAcesso` no doc permanece apenas como registro visual
    //    da esteta; o mapeamento (que permite o login) é apagado.
    // ============================================================
    const emailAntigo = pacienteData.emailAcesso || pacienteData.email;
    if (emailAntigo) {
      try {
        await db.doc(`mapeamento_emails/${emailAntigo.toLowerCase()}`).delete();
      } catch (e) {
        console.warn('Falha ao apagar mapeamento:', e);
      }
    }

    // ============================================================
    // 7) Anonimiza seguranca_estado
    // ============================================================
    try {
      const segRef = db.doc(`seguranca_estado/${pacienteId}`);
      const segSnap = await segRef.get();
      if (segSnap.exists) {
        await segRef.update({
          localizacaoStatus: 'anonimizada',
          lat: null,
          lng: null,
          cidade: null,
          pais: null,
          anonimizadoEm: agora,
        });
      }
    } catch (e) {
      console.warn('Falha ao anonimizar seguranca_estado:', e);
    }

    // ============================================================
    // 8) Anonimiza dispositivos_autorizados
    // ============================================================
    try {
      const devSnap = await db.collection('dispositivos_autorizados')
        .where('pacienteId', '==', pacienteId)
        .get();
      if (!devSnap.empty) {
        const batchDev = db.batch();
        devSnap.docs.forEach((d) => {
          batchDev.update(d.ref, { autorizado: false, anonimizadoEm: agora });
        });
        await batchDev.commit();
      }
    } catch (e) {
      console.warn('Falha ao anonimizar dispositivos:', e);
    }

    // ============================================================
    // 9) ✅ DESABILITA o usuário no Firebase Auth
    // ------------------------------------------------------------
    // Igual ao `excluir-paciente-completo`. Assim:
    //   - A conta NÃO pode mais logar
    //   - O UID permanece (prontuário fica intacto)
    //   - Se a esteta reativar depois, `reativar-auth-paciente` só
    //     faz `disabled: false` (não precisa recriar).
    // ============================================================
    try {
      await getAuth().updateUser(pacienteId, { disabled: true });
      console.log(`✅ [anonimizar-conta] Auth desabilitado (UID: ${pacienteId})`);
    } catch (authErr) {
      // Não quebra o fluxo — a anonimização no Firestore já foi feita.
      // Se a conta não existir mais, apenas loga o aviso.
      console.warn('⚠️ Falha ao desabilitar Auth:', authErr.message);
    }

    // ============================================================
    // 10) Notifica a esteta
    // ============================================================
    try {
      const baseUrl = process.env.URL || `https://${event.headers.host}`;
      await fetch(`${baseUrl}/.netlify/functions/notificar-conta-excluida`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uidEsteticista,
          pacienteId,
          pacienteNome: pacienteData.nome || 'Paciente',
        }),
      });
    } catch (e) {
      console.warn('Falha ao notificar esteta:', e);
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, pacienteId }),
    };
  } catch (err) {
    console.error('❌ Erro anonimizar-conta-paciente:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};