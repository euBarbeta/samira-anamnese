// src/utils/agenda.js

/**
 * Gera lista de slots a partir da config + agendamentos já ocupados.
 * @param {Object} config - agenda_config/principal
 * @param {Array}  agendamentosOcupados - [{data, horaInicio, horaFim}]
 * @param {String} dataInicioISO - 'YYYY-MM-DD'
 * @param {String} dataFimISO    - 'YYYY-MM-DD'
 * @returns {Array<{data, horaInicio, horaFim}>}
 */
export function gerarSlotsDisponiveis(config, agendamentosOcupados = [], dataInicioISO, dataFimISO) {
  if (!config?.blocosSemanais?.length) return [];

  const bloqueiosSet = new Set((config.bloqueios || []).map((b) => b.data));
  const ocupadosSet = new Set(
    agendamentosOcupados
      .filter((a) => a.status === 'pendente' || a.status === 'confirmado')
      .map((a) => `${a.data}|${a.horaInicio}`)
  );

  const agora = new Date();
  const minAntecedencia = new Date(agora.getTime() + (config.antecedenciaMinimaHoras || 4) * 3600 * 1000);

  const slots = [];
  const inicio = new Date(dataInicioISO + 'T00:00:00');
  const fim = new Date(dataFimISO + 'T23:59:59');

  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (bloqueiosSet.has(iso)) continue;

    const diaSemana = d.getDay(); // 0..6

    // Blocos recorrentes do dia da semana
    const blocosDoDia = (config.blocosSemanais || []).filter((b) => b.diaSemana === diaSemana);

    // + liberações avulsas
    const avulsos = (config.liberacoesAvulsas || [])
      .filter((l) => l.data === iso)
      .map((l) => ({ inicio: l.inicio, fim: l.fim, duracaoMin: 60 }));

    for (const bloco of [...blocosDoDia, ...avulsos]) {
      const [hI, mI] = bloco.inicio.split(':').map(Number);
      const [hF, mF] = bloco.fim.split(':').map(Number);
      const duracao = bloco.duracaoMin || 60;

      let cursor = new Date(d);
      cursor.setHours(hI, mI, 0, 0);
      const fimBloco = new Date(d);
      fimBloco.setHours(hF, mF, 0, 0);

      while (cursor < fimBloco) {
        const proximo = new Date(cursor.getTime() + duracao * 60000);
        if (proximo > fimBloco) break;

        const horaInicio = cursor.toTimeString().slice(0, 5);
        const horaFim = proximo.toTimeString().slice(0, 5);

        const jaOcupado = ocupadosSet.has(`${iso}|${horaInicio}`);
        const dentroAntecedencia = cursor < minAntecedencia;

        if (!jaOcupado && !dentroAntecedencia) {
          slots.push({ data: iso, horaInicio, horaFim });
        }
        cursor = proximo;
      }
    }
  }

  return slots;
}

/**
 * Gera código de autenticidade para o paciente consultar/cancelar.
 */
export function gerarCodigoAutenticidade() {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const rand2 = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AG-${rand}-${rand2}`;
}

/**
 * Valida CPF (algoritmo oficial).
 */
export function validarCPF(cpf) {
  const s = String(cpf).replace(/\D/g, '');
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(s[i]) * (10 - i);
  let d1 = (soma * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(s[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(s[i]) * (11 - i);
  let d2 = (soma * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(s[10]);
}

/**
 * Formata CPF para exibição: 123.456.789-00
 */
export function formatarCPF(cpf) {
  const s = String(cpf).replace(/\D/g, '').padStart(11, '0').slice(0, 11);
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
}

/**
 * Formata telefone: +55 (11) 99999-9999
 */
export function formatarTelefone(tel) {
  const s = String(tel).replace(/\D/g, '');
  if (s.length === 13 && s.startsWith('55')) {
    return `+${s.slice(0, 2)} (${s.slice(2, 4)}) ${s.slice(4, 9)}-${s.slice(9)}`;
  }
  if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
  return tel;
}