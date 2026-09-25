// src/utils/agendamentoNotify.js

/**
 * Notifica a esteticista sobre um agendamento (novo/cancelado).
 * Chama a Netlify Function que faz o push + e-mail.
 */
export async function notificarAgendamento({
  tipoEvento,          // 'novo' | 'cancelado_paciente' | 'cancelado_esteticista' | 'confirmado'
  uidEsteticista,
  agendamento,         // objeto completo
}) {
  try {
    const res = await fetch('/.netlify/functions/notificar-agendamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoEvento, uidEsteticista, agendamento }),
    });
    if (!res.ok) {
      console.warn('Falha ao notificar agendamento:', await res.text());
    }
  } catch (e) {
    console.warn('Erro de rede ao notificar agendamento:', e);
  }
}