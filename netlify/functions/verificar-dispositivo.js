// netlify/functions/verificar-dispositivo.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Chamada no LOGIN do paciente.
 *
 * Body:
 *   { pacienteId, fingerprint, dispositivo, plataforma, cidade, pais, lat, lng }
 *
 * Retorna:
 *   { status: 'conhecido', autorizado: true }       → device já autorizado
 *   { status: 'novo',      autorizado: true }       → 1º device (auto-autoriza)
 *   { status: 'bloqueado', autorizado: false }      → esteta bloqueou este device
 *   { status: 'pendente',  autorizado: true }       → device novo, alerta criado
 */
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

    const body = JSON.parse(event.body || '{}');
    const {
      pacienteId,
      fingerprint,
      dispositivo,
      plataforma,
      cidade,
      pais,
      lat,
      lng,
    } = body;

    if (!pacienteId || !fingerprint) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: 'pacienteId e fingerprint obrigatórios' }),
      };
    }

    const chave = `${String(pacienteId)}__${fingerprint}`;
    const agora = new Date().toISOString();

    // 1) Verifica se o device já existe pra esse paciente
    const ref = db.collection('dispositivos_autorizados').doc(chave);
    const snap = await ref.get();

    if (snap.exists) {
      const data = snap.data();

      // Atualiza última vez visto + localização
      await ref.set(
        {
          ultimoLoginEm: agora,
          ultimaCidade: cidade || data.ultimaCidade || null,
          ultimoPais: pais || data.ultimoPais || null,
          ultimaLat: lat ?? data.ultimaLat ?? null,
          ultimaLng: lng ?? data.ultimaLng ?? null,
        },
        { merge: true }
      );

      // Se está bloqueado pela esteta → nega
      if (data.autorizado === false) {
        return {
          statusCode: 200,
          headers: CORS,
          body: JSON.stringify({
            status: 'bloqueado',
            autorizado: false,
            motivo: data.motivoBloqueio || 'Acesso suspenso pela profissional',
          }),
        };
      }

      // Autorizado → libera
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ status: 'conhecido', autorizado: true }),
      };
    }

    // 2) Device novo — verifica se é o PRIMEIRO device do paciente
    const todosDoPaciente = await db
      .collection('dispositivos_autorizados')
      .where('pacienteId', '==', String(pacienteId))
      .limit(1)
      .get();

    const ehPrimeiroDevice = todosDoPaciente.empty;

    // Cria o doc do device
    await ref.set({
      pacienteId: String(pacienteId),
      fingerprint,
      dispositivo: dispositivo || 'Desconhecido',
      plataforma: plataforma || 'web',
      primeiraCidade: cidade || null,
      primeiroPais: pais || null,
      primeiraLat: lat ?? null,
      primeiraLng: lng ?? null,
      ultimaCidade: cidade || null,
      ultimoPais: pais || null,
      ultimaLat: lat ?? null,
      ultimaLng: lng ?? null,
      primeiroLoginEm: agora,
      ultimoLoginEm: agora,
      // ✅ 1º device = automático. Outros = aguardando esteta.
      autorizado: ehPrimeiroDevice ? true : false,
      aguardandoAprovacao: !ehPrimeiroDevice,
      bloqueadoPor: null,
      bloqueadoEm: null,
      motivoBloqueio: null,
    });

    // 3) Se NÃO é o primeiro device → cria alerta + notifica esteta
    if (!ehPrimeiroDevice) {
      const alertaRef = await db.collection('alertas_dispositivo').add({
        pacienteId: String(pacienteId),
        fingerprint,
        dispositivo: dispositivo || 'Desconhecido',
        plataforma: plataforma || 'web',
        cidade: cidade || null,
        pais: pais || null,
        lat: lat ?? null,
        lng: lng ?? null,
        criadoEm: agora,
        status: 'pendente',
        resolvidoPor: null,
        resolvidoEm: null,
      });

      // Notifica a esteta (não bloqueia a resposta)
      try {
        const baseUrl =
          process.env.URL ||
          process.env.DEPLOY_PRIME_URL ||
          `https://${event.headers.host}`;

        await fetch(`${baseUrl}/.netlify/functions/notificar-dispositivo-novo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pacienteId: String(pacienteId),
            alertaId: alertaRef.id,
            dispositivo: dispositivo || 'Desconhecido',
            cidade: cidade || null,
          }),
        });
      } catch (e) {
        console.warn('Falha ao notificar dispositivo novo:', e);
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        status: ehPrimeiroDevice ? 'novo' : 'pendente',
        autorizado: ehPrimeiroDevice ? true : true, // pendente = permite entrar, mas alerta
      }),
    };
  } catch (err) {
    console.error('❌ Erro verificar-dispositivo:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};