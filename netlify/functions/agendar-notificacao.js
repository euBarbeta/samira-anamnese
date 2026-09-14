// netlify/functions/agendar-notificacao.js
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY;

// Mapa de conversão de unidades para milissegundos
const MS_POR_UNIDADE = {
  segundos: 1000,
  minutos: 60 * 1000,
  horas: 60 * 60 * 1000,
  dias: 24 * 60 * 60 * 1000,
};

exports.handler = async (event) => {
  // Só aceita POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { pacienteId, lembrete } = JSON.parse(event.body);

    if (!pacienteId || !lembrete) {
      return { statusCode: 400, body: 'Dados incompletos' };
    }

    // Calcula o "send_after" (quando a notificação deve sair)
    let sendAfter;

    if (lembrete.tipo === 'data_hora') {
      // Data/hora específica: vem no formato ISO do datetime-local
      if (!lembrete.valor) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Data/hora não informada' }) };
      }
      sendAfter = new Date(lembrete.valor).toISOString();
    } else {
      // Intervalo: número + unidade (segundos, minutos, horas, dias)
      const numero = parseInt(lembrete.intervaloNumero) || 1;
      const unidade = lembrete.intervaloUnidade || 'horas';
      
      // Converte para milissegundos
      const msPorUnidade = MS_POR_UNIDADE[unidade] || MS_POR_UNIDADE.horas;
      const msTotal = numero * msPorUnidade;
      
      sendAfter = new Date(Date.now() + msTotal).toISOString();
    }

    // Chama a API do OneSignal
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${ONESIGNAL_REST_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        target_channel: 'push',
        include_aliases: {
          external_id: [String(pacienteId)],
        },
        headings: { en: lembrete.titulo || 'Lembrete' },
        contents: { en: 'Você tem um lembrete da Samira Estética' },
        send_after: sendAfter,
        web_push_topic: 'lembretes',
        data: {
          targetUrl: 'https://samira-anamnese.netlify.app',
        },
      }),
    });

    const result = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, onesignal: result }),
    };
  } catch (err) {
    console.error('Erro ao agendar:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};