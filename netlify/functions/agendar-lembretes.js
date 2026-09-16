// netlify/functions/agendar-lembretes.js
const { initFirebase, initWebpush, enviarPush } = require('./_shared');

const MS = {
  segundos: 1000,
  minutos: 60 * 1000,
  horas: 60 * 60 * 1000,
  dias: 24 * 60 * 60 * 1000,
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { pacienteId, lembretes } = JSON.parse(event.body || '{}');
    if (!pacienteId || !Array.isArray(lembretes)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Dados incompletos' }) };
    }

    const db = initFirebase();
    const webpush = initWebpush();
    const resultados = [];

    for (const lembrete of lembretes) {
      if (!lembrete.titulo || !lembrete.titulo.trim()) continue;

      // Calcula sendAt
      let sendAt;
      if (lembrete.tipo === 'data_hora') {
        if (!lembrete.valor) continue;
        sendAt = new Date(lembrete.valor).getTime();
      } else {
        const num = parseInt(lembrete.intervaloNumero, 10) || 1;
        const unidade = lembrete.intervaloUnidade || 'horas';
        sendAt = Date.now() + (num * (MS[unidade] || MS.horas));
      }

      if (isNaN(sendAt)) continue;

      // Se for para agora (ou passado), envia na hora
      if (sendAt <= Date.now() + 30000) {
        const res = await enviarPush(db, webpush, pacienteId, lembrete.titulo);
        resultados.push({ titulo: lembrete.titulo, tipo: 'imediato', ...res });
      } else {
        // Salva agendado
        const docRef = await db.collection('lembretes_pendentes').add({
          pacienteId: String(pacienteId),
          titulo: lembrete.titulo,
          sendAt,
          enviado: false,
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

    console.log('📋 Lembretes processados:', JSON.stringify(resultados));
    return { statusCode: 200, body: JSON.stringify({ ok: true, resultados }) };

  } catch (err) {
    console.error('❌ Erro:', err.stack);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};