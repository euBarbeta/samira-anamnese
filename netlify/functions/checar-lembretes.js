// netlify/functions/checar-lembretes.js
const { initFirebase, initWebpush, enviarPush } = require('./_shared');

exports.handler = async () => {
  try {
    const db = initFirebase();
    const webpush = initWebpush();
    const agora = Date.now();

    // Busca todos os pendentes (sem índice composto — filtro por sendAt no JS)
    const snap = await db.collection('lembretes_pendentes')
      .where('enviado', '==', false)
      .get();

    if (snap.empty) {
      console.log('Nenhum lembrete pendente');
      return { statusCode: 200, body: JSON.stringify({ ok: true, enviados: 0 }) };
    }

    // Filtra os que já passaram da hora
    const prontos = snap.docs.filter(d => {
      const s = d.data().sendAt;
      return typeof s === 'number' && s <= agora;
    });

    if (prontos.length === 0) {
      console.log(`${snap.size} pendente(s), nenhum para agora`);
      return { statusCode: 200, body: JSON.stringify({ ok: true, enviados: 0 }) };
    }

    console.log(`📤 ${prontos.length} lembrete(s) para enviar`);

    const resultados = [];
    for (const doc of prontos) {
      const data = doc.data();
      const res = await enviarPush(db, webpush, data.pacienteId, data.titulo);

      await doc.ref.update({
        enviado: res.ok,
        enviadoEm: new Date().toISOString(),
        erro: res.ok ? null : res.erro,
      });

      resultados.push({ id: doc.id, titulo: data.titulo, ok: res.ok });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, enviados: resultados.length, resultados }) };

  } catch (err) {
    console.error('❌ Erro:', err.stack);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};