// src/utils/agenda.js

/**
 * Converte Date → 'YYYY-MM-DD' USANDO TIMEZONE LOCAL
 * (o toISOString() puro usa UTC e quebra no Brasil à noite)
 */
function toISODateLocal(d) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Gera slots disponíveis. Agora respeita:
 *   - blocosSemanais    → padrão recorrente (dia da semana)
 *   - datasEspecificas  → override por data exata
 *                        { 'YYYY-MM-DD': { bloqueado: bool, blocos: [...] } }
 *   - bloqueios         → lista de folgas { data, motivo }
 *   - liberacoesAvulsas → horários extras { data, inicio, fim }
 *   - antecedenciaMinimaHoras
 */
export function gerarSlotsDisponiveis(
  config,
  agendamentosOcupados = [],
  dataInicioISO,
  dataFimISO
) {
  if (!config?.blocosSemanais?.length && !config?.datasEspecificas) {
    return [];
  }

  const bloqueiosSet = new Set(
    (config.bloqueios || []).map((b) => b.data)
  );

  const ocupadosSet = new Set(
    agendamentosOcupados
      .filter((a) => a.status === 'pendente' || a.status === 'confirmado')
      .map((a) => `${a.data}|${a.horaInicio}`)
  );

  const agora = new Date();
  const minAntecedencia = new Date(
    agora.getTime() + (config.antecedenciaMinimaHoras || 4) * 3600 * 1000
  );

  const slots = [];
  const inicio = new Date(dataInicioISO + 'T00:00:00');
  const fim = new Date(dataFimISO + 'T23:59:59');

  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    // ✅ Data LOCAL
    const iso = toISODateLocal(d);

    // Folga global (lista de bloqueios)
    if (bloqueiosSet.has(iso)) continue;

    const diaSemana = d.getDay(); // 0..6 (local)

    // ✅ Prioridade 1: override por data específica
    const override = config.datasEspecificas?.[iso];
    let blocos;

    if (override) {
      if (override.bloqueado) continue; // folga só desse dia
      blocos = override.blocos || [];
    } else {
      // ✅ Prioridade 2: padrão semanal
      blocos = (config.blocosSemanais || []).filter(
        (b) => b.diaSemana === diaSemana
      );
    }

    // Liberações avulsas (extras)
    const avulsos = (config.liberacoesAvulsas || [])
      .filter((l) => l.data === iso)
      .map((l) => ({ inicio: l.inicio, fim: l.fim, duracaoMin: 60 }));

    for (const bloco of [...blocos, ...avulsos]) {
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

        const horaInicio = `${pad(cursor.getHours())}:${pad(cursor.getMinutes())}`;
        const horaFim = `${pad(proximo.getHours())}:${pad(proximo.getMinutes())}`;

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

/**
 * Exporta utilitário pra quem precisar (usado no Configurador)
 */
export { toISODateLocal };