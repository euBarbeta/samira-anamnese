// src/components/agendamento/ModalEscolherServico.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot, query, orderBy, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  MdClose, MdCheckCircle, MdWarning, MdEvent, MdCalendarMonth, MdEventAvailable,} from 'react-icons/md';

// ============================================================
// Helpers
// ============================================================
function toMin(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Verifica se [novoInicio, novoFim] conflita com outros agendamentos
 * do mesmo dia que não estejam cancelados/concluídos.
 */
function verificarConflito({
  novoInicio,
  novoFim,
  agendamentoAtualId,
  agendamentosDoDia,
}) {
  const nI = toMin(novoInicio);
  const nF = toMin(novoFim);

  for (const a of agendamentosDoDia) {
    if (a.id === agendamentoAtualId) continue;
    if (a.status !== 'pendente' && a.status !== 'confirmado') continue;

    const aI = toMin(a.horaInicio);
    const aF = a.horaFim
      ? toMin(a.horaFim)
      : aI + (a.duracaoMin || 60);

    // Sobreposição: A.inicio < B.fim && B.inicio < A.fim
    if (nI < aF && aI < nF) {
      return { conflito: true, com: a };
    }
  }

  return { conflito: false };
}

/**
 * Encontra o bloco de disponibilidade que contém o horário do agendamento.
 */
function acharBlocoDoDia(config, dataISO, horaInicio) {
  if (!config) return null;

  const d = new Date(dataISO + 'T12:00:00');
  const dow = d.getDay();

  const override = config.datasEspecificas?.[dataISO];
  const blocos = override?.blocos?.length
    ? override.blocos
    : (config.blocosSemanais || []).filter((b) => b.diaSemana === dow);

  const hM = toMin(horaInicio);
  return blocos.find((b) => toMin(b.inicio) <= hM && hM < toMin(b.fim)) || null;
}

// ============================================================
// COMPONENTE
// ============================================================
export default function ModalEscolherServico({
  agendamento,
  uidEsteticista,
  onFechar,
  onConfirmado,
}) {
  const [servicos, setServicos] = useState([]);
  const [agendamentosDoDia, setAgendamentosDoDia] = useState([]);
  const [config, setConfig] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [passoSobrou, setPassoSobrou] = useState(null);

  const [servicoSelecionado, setServicoSelecionado] = useState(null);
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  // ============================================================
  // 1) Carrega serviços ativos
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;
    const colRef = collection(db, `usuarios/${uidEsteticista}/servicos`);
    const q = query(colRef, orderBy('ordem', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.ativo !== false);
      setServicos(lista);
    });
    return () => unsub();
  }, [uidEsteticista]);

  // ============================================================
  // 2) Carrega config da agenda
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;
    import('firebase/firestore').then(({ doc: dRef, getDoc }) => {
      getDoc(dRef(db, `usuarios/${uidEsteticista}/agenda_config`, 'principal'))
        .then((snap) => {
          if (snap.exists()) setConfig(snap.data());
        })
        .catch((e) => console.warn('Config não carregou:', e));
    });
  }, [uidEsteticista]);

  // ============================================================
  // 3) Carrega agendamentos do mesmo dia (para validar conflito)
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista || !agendamento?.data) return;
    const colRef = collection(db, 'agendamentos');
    import('firebase/firestore').then(({ query: q, where }) => {
      const queryRef = q(
        colRef,
        where('uidEsteticista', '==', uidEsteticista),
        where('data', '==', agendamento.data)
      );
      const unsub = onSnapshot(queryRef, (snap) => {
        setAgendamentosDoDia(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
        setCarregando(false);
      });
      return () => unsub();
    });
  }, [uidEsteticista, agendamento?.data]);

  // ============================================================
  // 4) Calcula preview pra cada serviço (cabe ou não)
  // ============================================================
  const previews = useMemo(() => {
    if (!agendamento) return [];

    const map = {};
    for (const s of servicos) {
      const novaFimMin = toMin(agendamento.horaInicio) + s.duracaoMin;
      const novaFim = toHHMM(novaFimMin);

      // Valida contra bloco de disponibilidade
      const bloco = acharBlocoDoDia(config, agendamento.data, agendamento.horaInicio);
      const cabeNoBloco = !bloco || novaFimMin <= toMin(bloco.fim);

      // Valida contra outros agendamentos
      const { conflito, com } = verificarConflito({
        novoInicio: agendamento.horaInicio,
        novoFim: novaFim,
        agendamentoAtualId: agendamento.id,
        agendamentosDoDia,
      });

      map[s.id] = {
        novaFim,
        cabe: cabeNoBloco && !conflito,
        motivo: !cabeNoBloco
          ? `Passa do horário de atendimento (${bloco?.fim})`
          : conflito
            ? `Bate com agendamento de ${com.nome} às ${com.horaInicio}`
            : null,
      };
    }
    return map;
  }, [servicos, agendamento, config, agendamentosDoDia]);

  // ============================================================
  // 5) Confirmar
  // ============================================================
const confirmar = async () => {
  if (!servicoSelecionado) {
    setErro('Escolha um serviço para confirmar.');
    return;
  }

  const info = previews[servicoSelecionado.id];
  if (!info?.cabe) {
    setErro(info?.motivo || 'Este serviço não cabe neste horário.');
    return;
  }

  // ============================================================
  // ✅ Detecta se sobrou tempo no bloco padrão
  // ============================================================
  const bloco = acharBlocoDoDia(config, agendamento.data, agendamento.horaInicio);
  const fimBloco = bloco?.fim || info.novaFim; // fallback: sem sobra

  const fimBlocoMin = toMin(fimBloco);
  const fimServicoMin = toMin(info.novaFim);

  const sobraMin = fimBlocoMin - fimServicoMin;

  // ✅ Se sobrou pelo menos 10min, pergunta antes de salvar
  if (sobraMin >= 10) {
    setPassoSobrou({
      inicio: info.novaFim,
      fim: fimBloco,
      duracaoMin: sobraMin,
    });
    setErro('');
    return; // aguarda a decisão no 2º passo
  }

  // Sem sobra → salva direto
  await salvarConfirmacao({ liberarSobra: false });
};

// ============================================================
// ✅ Salva o agendamento confirmado (com ou sem liberação da sobra)
// ============================================================
const salvarConfirmacao = async ({ liberarSobra }) => {
  if (!servicoSelecionado) return;
  const info = previews[servicoSelecionado.id];

  setEnviando(true);
  setErro('');

  try {
    const patch = {
      servicoId: servicoSelecionado.id,
      servicoNome: servicoSelecionado.nome,
      duracaoMin: servicoSelecionado.duracaoMin,
      horaFim: info.novaFim,
      status: 'confirmado',
      aguardandoConsentimento: false,
      observacoesConfirmacao: observacao.trim() || null,
      confirmadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    // ✅ Se decidiu liberar, grava as liberações no agendamento
    if (liberarSobra && passoSobrou) {
      patch.liberacoesExtras = [{
        inicio: passoSobrou.inicio,
        fim: passoSobrou.fim,
        duracaoMin: passoSobrou.duracaoMin,
        criadoEm: new Date().toISOString(),
      }];
    } else {
      patch.liberacoesExtras = [];
    }

    await updateDoc(doc(db, 'agendamentos', agendamento.id), patch);

    // Notifica o paciente
    if (agendamento.pacienteId) {
      fetch('/.netlify/functions/notificar-paciente-agendamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pacienteId: agendamento.pacienteId,
          tipoEvento: 'confirmado',
          agendamento: {
            id: agendamento.id,
            data: agendamento.data,
            horaInicio: agendamento.horaInicio,
            horaFim: info.novaFim,
            servicoNome: servicoSelecionado.nome,
            nome: agendamento.nome,
          },
        }),
      }).catch((e) => console.warn('Falha ao notificar paciente:', e));
    }

    setPassoSobrou(null);
    onConfirmado?.();
  } catch (e) {
    console.error('Erro ao confirmar:', e);
    setErro('Erro ao confirmar. Tente novamente.');
    setEnviando(false);
  }
};

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div
      onClick={enviando ? undefined : onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2147483647,
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '22px 22px 20px',
          maxWidth: 520,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
          border: '1.5px solid #C8A24A',
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          gap: 10,
        }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{
              fontFamily: "'Cinzel', serif",
              color: '#2c163a',
              fontSize: 16,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              Escolher serviço
            </h3>
            <span style={{ fontSize: 11, color: '#666' }}>
              {agendamento?.nome} — {formatarDataBR(agendamento?.data)} às {agendamento?.horaInicio}
            </span>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 4, borderRadius: '50%',
            }}
          >
            <MdClose size={22} color="#2c163a" />
          </button>
        </div>

        {/* Corpo */}
        {carregando ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#666', fontSize: 13 }}>
            Carregando…
          </div>
        ) : servicos.length === 0 ? (
          <div style={{
            background: '#fff8e1',
            border: '1px solid #fcd34d',
            borderRadius: 10,
            padding: 14,
            fontSize: 12,
            color: '#92400e',
            lineHeight: 1.5,
          }}>
            <MdWarning size={20} color="#92400e" style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Você ainda não cadastrou nenhum serviço. Vá em <strong>Agendamentos → Meus Serviços</strong>.
          </div>
        ) : (
          <>
            {/* Lista de serviços */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {servicos.map((s) => {
                const info = previews[s.id];
                const ativo = servicoSelecionado?.id === s.id;
                const cabe = info?.cabe;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (!cabe) return;
                      setServicoSelecionado(s);
                      setErro('');
                    }}
                    disabled={!cabe || enviando}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      background: ativo ? '#faf5ff' : cabe ? '#fff' : '#fafafa',
                      border: ativo
                        ? '2px solid #7e22ce'
                        : cabe
                          ? '1.5px solid #d8b4fe'
                          : '1.5px solid #eee',
                      borderRadius: 12,
                      cursor: cabe ? 'pointer' : 'not-allowed',
                      opacity: cabe ? 1 : 0.55,
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: s.cor || '#a855f7',
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Cinzel', serif",
                        color: '#2c163a',
                        fontSize: 13,
                        fontWeight: 700,
                      }}>
                        {s.nome}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: cabe ? '#666' : '#c62828',
                        marginTop: 2,
                      }}>
                        {agendamento?.horaInicio} às {info?.novaFim} ({s.duracaoMin} min)
                        {!cabe && info?.motivo && (
                          <>
                            {' · '}
                            <span style={{ fontStyle: 'italic' }}>{info.motivo}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {ativo && cabe && (
                      <MdCheckCircle size={20} color="#16a34a" style={{ flexShrink: 0 }} />
                    )}
                    {!cabe && (
                      <MdWarning size={18} color="#c62828" style={{ flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Observação opcional */}
            {servicoSelecionado && (
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#2c163a',
                  marginBottom: 6,
                }}>
                  Observação (opcional)
                </label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                  placeholder="Ex: paciente pediu pra avisar quando chegar…"
                  disabled={enviando}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1.5px solid #d8b4fe',
                    borderRadius: 10,
                    fontSize: 13,
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: "'Montserrat', sans-serif",
                    color: '#2c163a',
                    minHeight: 60,
                  }}
                />
              </div>
            )}

            {erro && (
              <div style={{
                background: '#fde8e8',
                border: '1px solid #f98080',
                color: '#c81e1e',
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 12,
              }}>
                {erro}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          marginTop: 4,
        }}>
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            style={{
              background: '#f0f0f0',
              color: '#333',
              border: 'none',
              padding: '12px 20px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              cursor: enviando ? 'not-allowed' : 'pointer',
              fontFamily: "'Cinzel', serif",
              opacity: enviando ? 0.6 : 1,
            }}
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!servicoSelecionado || enviando || servicos.length === 0}
            style={{
              background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
              color: '#fff',
              border: '1.5px solid #9c7826',
              padding: '12px 22px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              cursor:
                !servicoSelecionado || enviando ? 'not-allowed' : 'pointer',
              fontFamily: "'Cinzel', serif",
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(200, 162, 74, 0.35)',
              opacity: !servicoSelecionado || enviando ? 0.55 : 1,
            }}
          >
            <MdCheckCircle size={16} />
            {enviando ? 'CONFIRMANDO…' : 'CONFIRMAR SERVIÇO'}
          </button>
        </div>
      </div>
      {/* ============================================================ */}
{/* ✅ 2º PASSO — Pergunta se quer liberar a sobra do bloco       */}
{/* ============================================================ */}
{passoSobrou && (
  <div
    onClick={enviando ? undefined : () => setPassoSobrou(null)}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(44, 22, 58, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2147483647,
      padding: 20,
      boxSizing: 'border-box',
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: '#fff',
        borderRadius: 20,
        padding: '28px 24px 22px',
        maxWidth: 440,
        width: '100%',
        boxShadow: '0 25px 70px rgba(44, 22, 58, 0.5)',
        border: '1.5px solid #C8A24A',
        fontFamily: "'Montserrat', sans-serif",
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 68,
          height: 68,
          margin: '0 auto 16px auto',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          border: '2px solid #86efac',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MdEventAvailable size={34} color="#16a34a" />
      </div>

      <h3
        style={{
          fontFamily: "'Cinzel', serif",
          color: '#2c163a',
          fontSize: 17,
          fontWeight: 700,
          margin: '0 0 12px 0',
        }}
      >
        Sobrou {passoSobrou.duracaoMin} min livres
      </h3>

      <p
        style={{
          fontSize: 13,
          color: '#2c163a',
          margin: '0 0 6px 0',
          lineHeight: 1.6,
        }}
      >
        O bloco original ia até <strong>{passoSobrou.fim}</strong>, mas o serviço
        termina em <strong>{passoSobrou.inicio}</strong>.
      </p>

      <p
        style={{
          fontSize: 12,
          color: '#555',
          margin: '0 0 20px 0',
          lineHeight: 1.6,
        }}
      >
        Quer <strong>liberar esse tempo</strong> ({passoSobrou.inicio} – {passoSobrou.fim})
        para outro paciente agendar?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={() => salvarConfirmacao({ liberarSobra: true })}
          disabled={enviando}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
            color: '#fff',
            border: '1.5px solid #15803d',
            padding: '14px 20px',
            borderRadius: 24,
            fontSize: 12,
            fontWeight: 700,
            cursor: enviando ? 'wait' : 'pointer',
            fontFamily: "'Cinzel', serif",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
          }}
        >
          <MdCheckCircle size={16} />
          {enviando ? 'SALVANDO…' : 'SIM, LIBERAR ESSE TEMPO'}
        </button>

        <button
          type="button"
          onClick={() => salvarConfirmacao({ liberarSobra: false })}
          disabled={enviando}
          style={{
            width: '100%',
            background: '#f5f5f5',
            color: '#555',
            border: '1.5px solid #ddd',
            padding: '14px 20px',
            borderRadius: 24,
            fontSize: 12,
            fontWeight: 700,
            cursor: enviando ? 'wait' : 'pointer',
            fontFamily: "'Cinzel', serif",
          }}
        >
          NÃO, DEIXAR BLOQUEADO
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

function formatarDataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}