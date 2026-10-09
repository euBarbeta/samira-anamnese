// src/components/HistoricoAgendamentosPaciente.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import {
  MdExpandMore, MdExpandLess, MdPictureAsPdf, MdCalendarMonth,
  MdCheckCircle, MdCancel, MdHourglassEmpty, MdPersonOff, MdRefresh,
  MdInfoOutline, MdEvent, MdAccessTime,
} from 'react-icons/md';

// ============================================================
// Helpers
// ============================================================
function normalizarNome(str) {
  return (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizarDoc(str) {
  return (str || '').replace(/\D/g, '');
}

function formatarDataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function formatarDataLonga(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  const d = new Date(iso + 'T12:00:00');
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return `${dias[d.getDay()]}, ${dia}/${mes}/${ano}`;
}

// ============================================================
// Mapa visual dos status
// ============================================================
const STATUS_INFO = {
  pendente:   { label: 'Pendente',   cor: '#92400e', bg: '#fff8e1', bd: '#fcd34d', Icone: MdHourglassEmpty },
  confirmado: { label: 'Confirmado', cor: '#166534', bg: '#f0fdf4', bd: '#86efac', Icone: MdCheckCircle },
  concluido:  { label: 'Concluído',  cor: '#166534', bg: '#f0fdf4', bd: '#86efac', Icone: MdCheckCircle },
  cancelado:  { label: 'Cancelado',  cor: '#991b1b', bg: '#fef2f2', bd: '#fca5a5', Icone: MdCancel },
  faltou:     { label: 'Faltou',     cor: '#c2410c', bg: '#fff7ed', bd: '#fdba74', Icone: MdPersonOff },
  reagendado: { label: 'Reagendado', cor: '#7e22ce', bg: '#faf5ff', bd: '#d8b4fe', Icone: MdRefresh },
};

// Opções de período
const PERIODOS = [
  { key: 30,    label: '30 dias' },
  { key: 90,    label: '90 dias' },
  { key: 180,   label: '6 meses' },
  { key: 365,   label: '1 ano'   },
  { key: 0,     label: 'Tudo'    },
];

/* ============================================================
   COMPONENTE
   Props:
     - pacienteId        → id do paciente
     - pacienteNome      → nome (fallback de busca)
     - pacienteDocumento → documento (fallback de busca)
     - uidEsteticista    → uid da esteta (para a query)
     - modo              → 'esteticista' | 'paciente' (mantido por compatibilidade)
     - colapsavel        → true/false (padrão true)
     - abertoPorPadrao   → true/false (padrão false)
   ============================================================ */
export default function HistoricoAgendamentosPaciente({
  pacienteId,
  pacienteNome,
  pacienteDocumento,
  uidEsteticista,
  modo = 'esteticista',
  colapsavel = true,
  abertoPorPadrao = false,
}) {
  const [aberto, setAberto] = useState(!colapsavel || abertoPorPadrao);
  const [agendamentos, setAgendamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [periodoDias, setPeriodoDias] = useState(180);
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [gerandoPDF, setGerandoPDF] = useState(false);

  // ============================================================
  // Listener — carrega TODOS os agendamentos da esteta
  // e filtra localmente por pacienteId OU nome+doc
  //
  // ⚠️ IMPORTANTE: NÃO filtra por `ocultoParaEsteticista` nem
  // `ocultoParaPaciente`. O histórico deve mostrar TUDO —
  // inclusive o que foi "removido da visualização" nas listas.
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;

    let cancelado = false;

    const q = query(
      collection(db, 'agendamentos'),
      where('uidEsteticista', '==', uidEsteticista)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (cancelado) return;

        const pacIdStr = String(pacienteId || '');
        const docNorm = normalizarDoc(pacienteDocumento);
        const nomeNorm = normalizarNome(pacienteNome);

        const todos = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          // ✅ Match por pacienteId OU nome+documento (fallback)
          .filter((a) => {
            if (a.pacienteId && String(a.pacienteId) === pacIdStr) return true;
            if (
              normalizarNome(a.nome) === nomeNorm &&
              normalizarDoc(a.documento) === docNorm
            ) {
              return true;
            }
            return false;
          })
          .sort((a, b) => {
            const ka = `${a.data} ${a.horaInicio}`;
            const kb = `${b.data} ${b.horaInicio}`;
            return kb.localeCompare(ka); // mais recente primeiro
          });

        setAgendamentos(todos);
        setCarregando(false);
      },
      (err) => {
        console.error('Erro histórico de agendamentos:', err);
        setCarregando(false);
      }
    );

    return () => {
      cancelado = true;
      unsub();
    };
  }, [uidEsteticista, pacienteId, pacienteDocumento, pacienteNome, modo]);

  // ============================================================
  // Filtro por período + status
  // ============================================================
  const filtrados = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const limite =
      periodoDias > 0
        ? new Date(hoje.getTime() - periodoDias * 24 * 60 * 60 * 1000)
        : null;

    return agendamentos.filter((a) => {
      if (statusFiltro !== 'todos' && a.status !== statusFiltro) return false;

      if (limite) {
        const d = new Date((a.data || '') + 'T12:00:00');
        if (d < limite) return false;
      }

      return true;
    });
  }, [agendamentos, periodoDias, statusFiltro]);

  // ============================================================
  // Exportar PDF — funciona em web, PWA e APK via exportarParaPDF
  // ============================================================
  const exportarPDF = async () => {
    if (filtrados.length === 0) {
      alert('Nenhum agendamento no período selecionado.');
      return;
    }

    setGerandoPDF(true);

    try {
      const hoje = new Date();
      const limiteTexto =
        periodoDias > 0
          ? `Últimos ${periodoDias} dias`
          : 'Todo o histórico';

      // ── 1. Monta as linhas da tabela ──
      const linhas = filtrados
        .map((a) => {
          const info = STATUS_INFO[a.status] || STATUS_INFO.pendente;
          const horaReal = a.horaRealFim ? ` → real ${a.horaRealFim}` : '';

          return `
            <tr>
              <td>${formatarDataBR(a.data)}</td>
              <td>${a.horaInicio || ''}${a.horaFim ? '–' + a.horaFim : ''}${horaReal}</td>
              <td>${a.servicoNome || '—'}</td>
              <td>${info.label}</td>
            </tr>
          `;
        })
        .join('');

      // ── 2. Resumo por status ──
      const resumo = Object.entries(
        filtrados.reduce((acc, a) => {
          acc[a.status] = (acc[a.status] || 0) + 1;
          return acc;
        }, {})
      )
        .map(([status, qtd]) => {
          const info = STATUS_INFO[status] || { label: status };
          return `${info.label}: ${qtd}`;
        })
        .join(' · ');

      // ── 3. HTML do relatório (sem <html><body> — o gerador cuida disso) ──
      const htmlRelatorio = `
        <div style="font-family: 'Helvetica', 'Arial', sans-serif; padding: 24px; color: #2c163a;">
          <h1 style="font-size: 18px; margin: 0 0 6px;">Histórico de Agendamentos</h1>
          <div style="font-size: 11px; color: #666; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #C8A24A;">
            <strong>${pacienteNome || 'Paciente'}</strong><br/>
            Documento: ${pacienteDocumento || '—'}<br/>
            Filtro: ${limiteTexto}
          </div>

          <div style="background: #faf5ff; border: 1px solid #e2d2f5; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 11px; line-height: 1.7;">
            <strong>Total no período:</strong> ${filtrados.length}<br/>
            ${resumo}
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr>
                <th style="background: #7e22ce; color: #fff; padding: 8px 6px; text-align: left; border: 1px solid #7e22ce;">Data</th>
                <th style="background: #7e22ce; color: #fff; padding: 8px 6px; text-align: left; border: 1px solid #7e22ce;">Hora</th>
                <th style="background: #7e22ce; color: #fff; padding: 8px 6px; text-align: left; border: 1px solid #7e22ce;">Serviço</th>
                <th style="background: #7e22ce; color: #fff; padding: 8px 6px; text-align: left; border: 1px solid #7e22ce;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${linhas}
            </tbody>
          </table>

          <div style="margin-top: 24px; padding-top: 12px; border-top: 1px dashed #C8A24A; font-size: 10px; color: #888; text-align: center; line-height: 1.6;">
            Gerado em ${hoje.toLocaleString('pt-BR')}<br/>
            Samira Ferreira Estética & Cosmetologia
          </div>
        </div>
      `;

      // ── 4. Cria container oculto com o HTML ──
      const containerId = `historico-pdf-${Date.now()}`;
      const container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'fixed';
      container.style.left = '-99999px';
      container.style.top = '0';
      container.style.width = '800px';
      container.style.background = '#fff';
      container.innerHTML = htmlRelatorio;
      document.body.appendChild(container);

      // ── 5. Chama o gerador do projeto (funciona em web, PWA e APK) ──
      const { exportarParaPDF } = await import('../utils/gerarPdf');
      await exportarParaPDF(
        containerId,
        `Historico-${(pacienteNome || 'Paciente').replace(/\s+/g, '-')}`,
        { compartilhar: true }
      );

      // ── 6. Limpa ──
      document.body.removeChild(container);
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      alert('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setGerandoPDF(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1.5px solid #d8b4fe',
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 16,
      }}
    >
      {/* HEADER colapsável */}
      <button
        type="button"
        onClick={() => colapsavel && setAberto((v) => !v)}
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
          border: 'none',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: colapsavel ? 'pointer' : 'default',
          fontFamily: "'Cinzel', serif",
          color: '#2c163a',
          fontSize: 13,
          fontWeight: 700,
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <MdEvent size={18} color="#7e22ce" />
          Histórico de Agendamentos do Paciente
        </span>
        {colapsavel && (
          <span style={{ display: 'flex', alignItems: 'center', color: '#7e22ce' }}>
            {aberto ? <MdExpandLess size={22} /> : <MdExpandMore size={22} />}
          </span>
        )}
      </button>

      {/* CONTEÚDO */}
      {aberto && (
        <div style={{ padding: 16 }}>
          {/* Filtros — período */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            {PERIODOS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodoDias(p.key)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 14,
                  border: '1.5px solid #C8A24A',
                  background: periodoDias === p.key ? '#C8A24A' : 'transparent',
                  color: periodoDias === p.key ? '#fff' : '#C8A24A',
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', serif",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Filtros — status + exportar */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 14,
              paddingBottom: 12,
              borderBottom: '1px dashed #e2d2f5',
            }}
          >
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              style={{
                padding: '6px 10px',
                border: '1.5px solid #d8b4fe',
                borderRadius: 8,
                fontSize: 11,
                color: '#2c163a',
                background: '#fff',
                fontFamily: "'Montserrat', sans-serif",
                outline: 'none',
              }}
            >
              <option value="todos">Todos os status</option>
              <option value="concluido">Concluídos</option>
              <option value="confirmado">Confirmados</option>
              <option value="pendente">Pendentes</option>
              <option value="faltou">Faltas</option>
              <option value="cancelado">Cancelados</option>
              <option value="reagendado">Reagendados</option>
            </select>

            <div style={{ flex: 1 }} />

            <button
              type="button"
              onClick={exportarPDF}
              disabled={gerandoPDF || filtrados.length === 0}
              style={{
                fontFamily: "'Cinzel', serif",
                background:
                  gerandoPDF || filtrados.length === 0
                    ? '#ddd'
                    : 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
                color: gerandoPDF || filtrados.length === 0 ? '#888' : '#fff',
                border: '1.5px solid #6b21a8',
                padding: '8px 14px',
                borderRadius: 16,
                fontSize: 10.5,
                fontWeight: 700,
                cursor:
                  gerandoPDF || filtrados.length === 0
                    ? 'not-allowed'
                    : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                boxShadow:
                  gerandoPDF || filtrados.length === 0
                    ? 'none'
                    : '0 3px 10px rgba(126, 34, 206, 0.3)',
              }}
            >
              <MdPictureAsPdf size={14} />
              {gerandoPDF ? 'GERANDO…' : 'EXPORTAR PDF'}
            </button>
          </div>

          {/* Lista */}
          {carregando ? (
            <div
              style={{
                textAlign: 'center',
                padding: 20,
                color: '#888',
                fontSize: 12,
              }}
            >
              Carregando histórico…
            </div>
          ) : filtrados.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '24px 16px',
                background: '#faf5ff',
                borderRadius: 10,
                border: '1px dashed #d8b4fe',
                fontSize: 12,
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <MdInfoOutline size={16} color="#7e22ce" />
              {agendamentos.length === 0
                ? 'Nenhum agendamento registrado ainda.'
                : 'Nenhum agendamento no período selecionado.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtrados.map((a) => {
                const info = STATUS_INFO[a.status] || STATUS_INFO.pendente;
                const Icone = info.Icone;

                return (
                  <div
                    key={a.id}
                    style={{
                      background: '#fff',
                      border: `1px solid ${info.bd}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: info.bg,
                        border: `1.5px solid ${info.bd}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icone size={18} color={info.cor} />
                    </div>

                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div
                        style={{
                          fontFamily: "'Cinzel', serif",
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: '#2c163a',
                          lineHeight: 1.3,
                        }}
                      >
                        {formatarDataLonga(a.data)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#666',
                          marginTop: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* ✅ Ícone no lugar do emoji 🕒 */}
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <MdAccessTime size={12} color="#7e22ce" />
                          {a.horaInicio}
                          {a.horaFim ? `–${a.horaFim}` : ''}
                        </span>
                        {a.servicoNome && <span>· {a.servicoNome}</span>}
                        {a.horaRealFim && (
                          <span
                            style={{
                              color: '#166534',
                              fontWeight: 600,
                            }}
                          >
                            · real: {a.horaRealFim}
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: info.bg,
                        color: info.cor,
                        border: `1px solid ${info.bd}`,
                        borderRadius: 12,
                        padding: '3px 10px',
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: "'Cinzel', serif",
                        flexShrink: 0,
                      }}
                    >
                      <Icone size={11} />
                      {info.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}