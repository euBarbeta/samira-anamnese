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

function toMin(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Gera slots disponíveis. Agora respeita:
 *   - blocosSemanais    → padrão recorrente (dia da semana)
 *   - datasEspecificas  → override por data exata
 *   - bloqueios         → lista de folgas { data, motivo }
 *   - liberacoesAvulsas → horários extras { data, inicio, fim }
 *   - antecedenciaMinimaHoras
 *
 *   ✅ Colisão por SOBREPOSIÇÃO de intervalo
 *
 *   ⚖️ Regra das LIBERAÇÕES EXTRAS (sobras):
 *      - Se a sobra está LIMPA (ninguém dentro) → gera o slot
 *      - Se a sobra está POLUÍDA (qualquer agendamento dentro) →
 *        DESCARTA a sobra inteira (não fatia, não gera resto)
 *
 *      Ex: sobra 09:15→10:00 + agendamento 09:15→09:23 dentro
 *      → sobra é IGNORADA (não gera 09:15 nem 09:23)
 *
 *   ✅ Esteta pode LIBERAR/BARRAR a sobra a qualquer momento:
 *      - LIBERAR → liberacoesExtras preenchido → sobra aparece
 *      - BARRAR  → liberacoesExtras vazio      → sobra desaparece
 */
export function gerarSlotsDisponiveis(
  config,
  agendamentosOcupados = [],
  dataInicioISO,
  dataFimISO,
  duracaoMinOverride = null
) {
  if (!config?.blocosSemanais?.length && !config?.datasEspecificas) {
    return [];
  }

  const bloqueiosSet = new Set(
    (config.bloqueios || []).map((b) => b.data)
  );

  // ============================================================
  // ✅ Agrupa os agendamentos por data, guardando o INTERVALO ocupado
  // ------------------------------------------------------------
  // ⚠️ ACEITA 2 FORMATOS DE ENTRADA:
  //   1) Docs da coleção pública `slots_ocupados_publicos` (sem `status`)
  //   2) Docs de `agendamentos` (com `status`)
  // ============================================================
  const ocupadosPorData = {};
  agendamentosOcupados
    .filter((a) => {
      if (a.status == null) return true; // veio da coleção pública
      return a.status === 'pendente' || a.status === 'confirmado';
    })
    .forEach((a) => {
      if (!a.data || !a.horaInicio) return;

      const inicioMin = toMin(a.horaInicio);

      let fimMin;
      if (a.horaFim) {
        fimMin = toMin(a.horaFim);
      } else {
        fimMin = inicioMin + (a.duracaoMin || 60);
      }

      if (!ocupadosPorData[a.data]) ocupadosPorData[a.data] = [];
      ocupadosPorData[a.data].push({ inicioMin, fimMin });
    });

  const agora = new Date();
  const minAntecedencia = new Date(
    agora.getTime() + (config.antecedenciaMinimaHoras || 4) * 3600 * 1000
  );

  const slots = [];
  const inicio = new Date(dataInicioISO + 'T00:00:00');
  const fim = new Date(dataFimISO + 'T23:59:59');

  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const iso = toISODateLocal(d);

    // Folga global
    if (bloqueiosSet.has(iso)) continue;

    const diaSemana = d.getDay();

    // Override por data específica
    const override = config.datasEspecificas?.[iso];
    let blocos;

    if (override) {
      if (override.bloqueado) continue;
      blocos = override.blocos || [];
    } else {
      blocos = (config.blocosSemanais || []).filter(
        (b) => b.diaSemana === diaSemana
      );
    }

    // Liberações avulsas da config
    const avulsos = (config.liberacoesAvulsas || [])
      .filter((l) => l.data === iso)
      .map((l) => ({ inicio: l.inicio, fim: l.fim, duracaoMin: 60 }));

    // ============================================================
    // ✅ PERCORRE OS BLOCOS E GERA OS SLOTS DA GRADE
    // ============================================================
    for (const bloco of [...blocos, ...avulsos]) {
      const [hI, mI] = bloco.inicio.split(':').map(Number);
      const [hF, mF] = bloco.fim.split(':').map(Number);
      const duracao = duracaoMinOverride || bloco.duracaoMin || 60;

      let cursor = new Date(d);
      cursor.setHours(hI, mI, 0, 0);
      const fimBloco = new Date(d);
      fimBloco.setHours(hF, mF, 0, 0);

      while (cursor < fimBloco) {
        const proximo = new Date(cursor.getTime() + duracao * 60000);
        if (proximo > fimBloco) break;

        const horaInicio = `${pad(cursor.getHours())}:${pad(cursor.getMinutes())}`;
        const horaFim = `${pad(proximo.getHours())}:${pad(proximo.getMinutes())}`;

        const inicioSlotMin = cursor.getHours() * 60 + cursor.getMinutes();
        const fimSlotMin = inicioSlotMin + duracao;

        const jaOcupado = (ocupadosPorData[iso] || []).some(
          (o) => inicioSlotMin < o.fimMin && o.inicioMin < fimSlotMin
        );

        const dentroAntecedencia = cursor < minAntecedencia;

        if (!jaOcupado && !dentroAntecedencia) {
          slots.push({ data: iso, horaInicio, horaFim });
        }
        cursor = proximo;
      }
    }

    // ============================================================
    // ⚖️ LIBERAÇÕES EXTRAS (sobras) — versão 2.0
    // ------------------------------------------------------------
    // Regra:
    //   - Se a sobra está LIMPA (ninguém dentro) → gera slot
    //   - Se a sobra está POLUÍDA (qualquer agendamento dentro,
    //     exceto o próprio) → DESCARTA a sobra inteira
    //   - Sobra barrada (liberacoesExtras: []) → não faz nada
    //
    // Isso garante que:
    //   ✅ LIBERAR → slot aparece (se estiver livre)
    //   ✅ BARRAR  → slot desaparece (não aparece no agenda)
    //   ✅ Reverter a qualquer momento (esteta clica de novo)
    // ============================================================
    const agsDoDia = agendamentosOcupados.filter((a) => a.data === iso);

    for (const a of agsDoDia) {
      if (!Array.isArray(a.liberacoesExtras)) continue;

      for (const lib of a.liberacoesExtras) {
        if (!lib.inicio || !lib.fim) continue;

        const libInicioMin = toMin(lib.inicio);
        const libFimMin = toMin(lib.fim);

        // Já passou da antecedência mínima? Pula
        const cursorLib = new Date(d);
        cursorLib.setHours(
          Math.floor(libInicioMin / 60),
          libInicioMin % 60,
          0,
          0
        );
        if (cursorLib < minAntecedencia) continue;

        // ------------------------------------------------------------
        // Identifica o próprio agendamento (pra ignorá-lo na checagem)
        // ------------------------------------------------------------
        const proprioInicioMin = toMin(a.horaInicio);
        const proprioFimMin = a.horaFim
          ? toMin(a.horaFim)
          : proprioInicioMin + (a.duracaoMin || 60);

        // ------------------------------------------------------------
        // ⚖️ Verifica se a sobra está POLUÍDA
        // ------------------------------------------------------------
        const temAlguemDentro = (ocupadosPorData[iso] || []).some((o) => {
          // Ignora o próprio agendamento
          if (
            o.inicioMin === proprioInicioMin &&
            o.fimMin === proprioFimMin
          ) {
            return false;
          }
          // Colide com a sobra?
          return libInicioMin < o.fimMin && o.inicioMin < libFimMin;
        });

        // ⚠️ Se tem alguém dentro → DESCARTA a sobra inteira
        if (temAlguemDentro) continue;

        // ------------------------------------------------------------
        // ✅ Sobra limpa → gera o slot completo
        // ------------------------------------------------------------
        const horaInicio = `${pad(Math.floor(libInicioMin / 60))}:${pad(libInicioMin % 60)}`;
        const horaFim = `${pad(Math.floor(libFimMin / 60))}:${pad(libFimMin % 60)}`;

        // Evita duplicata
        const jaExiste = slots.some(
          (s) =>
            s.data === iso &&
            s.horaInicio === horaInicio &&
            s.horaFim === horaFim
        );
        if (jaExiste) continue;

        slots.push({
          data: iso,
          horaInicio,
          horaFim,
          _liberado: true,
        });
      }
    }
  }

  // ============================================================
  // ✅ Deduplicação final
  // ============================================================
  const slotsUnicos = [];
  const chavesVistas = new Set();

  for (const s of slots) {
    const chave = `${s.data}|${s.horaInicio}`;
    if (chavesVistas.has(chave)) continue;
    chavesVistas.add(chave);
    slotsUnicos.push(s);
  }

  slotsUnicos.sort((a, b) => {
    const ka = `${a.data} ${a.horaInicio}`;
    const kb = `${b.data} ${b.horaInicio}`;
    return ka.localeCompare(kb);
  });

  return slotsUnicos;
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