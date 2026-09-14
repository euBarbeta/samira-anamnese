// netlify/functions/agendar-notificacao.js
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY;

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
      // Data/hora específica: já vem no formato ISO do datetime-local
      sendAfter = new Date(lembrete.valor).toISOString();
    } else {
      // Intervalo: por enquanto, vamos agendar pro próximo horário cheio
      // Ex: "8 em 8 horas" → não é parseável, precisa de UI estruturada (falo disso abaixo)
      const agora = new Date();
      const intervaloHoras = parseInt(lembrete.intervaloHoras) || 1;
      const proximo = new Date(agora.getTime() + intervaloHoras * 60 * 60 * 1000);
      sendAfter = proximo.toISOString();
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