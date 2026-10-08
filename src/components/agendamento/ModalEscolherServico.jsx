// src/components/agendamento/ModalEscolherServico.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot, query, orderBy, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  MdClose, MdCheckCircle, MdWarning, MdEvent, MdCalendarMonth,
  MdEventAvailable, MdAccessTime, MdLock,
} from 'react-icons/md';

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

    if (nI < aF && aI < nF) {
      return { conflito: true, com: a };
    }
  }

  return { conflito: false };
}

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
        .filter((s) => s.ativo !== false)
        .map((s) => ({
          ...s,
          duracaoMin:
            typeof s.duracaoMin === 'number' && s.duracaoMin >= 5
              ? s.duracaoMin
              : 60,
        }));
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
    if (!agendamento) return {};

    const map = {};
    for (const s of servicos) {
      if (!s || typeof s.duracaoMin !== 'number') continue;

      const novaFimMin = toMin(agendamento.horaInicio) + s.duracaoMin;
      const novaFim = toHHMM(novaFimMin);

      const bloco = acharBlocoDoDia(config, agendamento.data, agendamento.horaInicio);
      const cabeNoBloco = !bloco || novaFimMin <= toMin(bloco.fim);

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
  // 5) Confirmar (primeiro passo)
  // ============================================================
  const confirmar = async () => {
    if (!servicoSelecionado || typeof servicoSelecionado.duracaoMin !== 'number') {
      setErro('Escolha um serviço para confirmar.');
      return;
    }

    const info = previews[servicoSelecionado.id];
    if (!info?.cabe) {
      setErro(info?.motivo || 'Este serviço não cabe neste horário.');
      return;
    }

    const bloco = acharBlocoDoDia(config, agendamento.data, agendamento.horaInicio);
    const fimBloco = bloco?.fim || info.novaFim;
    const duracaoPadrao = bloco?.duracaoMin || 60;
    const inicioBloco = bloco?.inicio || agendamento.horaInicio;

    const fimBlocoMin = toMin(fimBloco);
    const fimServicoMin = toMin(info.novaFim);
    const sobraMin = fimBlocoMin - fimServicoMin;

    if (sobraMin >= 10) {
      // ✅ Divide a sobra em sub-slots do tamanho padrão
      const slotsLivres = [];
      let cur = fimServicoMin;

      while (cur + duracaoPadrao <= fimBlocoMin) {
        slotsLivres.push({
          inicio: toHHMM(cur),
          fim: toHHMM(cur + duracaoPadrao),
          duracaoMin: duracaoPadrao,
        });
        cur += duracaoPadrao;
      }

      // Fração final (se sobrar)
      if (cur < fimBlocoMin) {
        slotsLivres.push({
          inicio: toHHMM(cur),
          fim: toHHMM(fimBlocoMin),
          duracaoMin: fimBlocoMin - cur,
        });
      }

      setPassoSobrou({
        inicio: info.novaFim,
        fim: fimBloco,
        duracaoMin: sobraMin,
        blocoInicio: inicioBloco,
        blocoFim: fimBloco,
        blocoDuracaoPadrao: duracaoPadrao,
        servicoNome: servicoSelecionado.nome,
        servicoDuracao: servicoSelecionado.duracaoMin,
        atendimentoInicio: agendamento.horaInicio,
        atendimentoFim: info.novaFim,
        slotsLivres,
      });
      setErro('');
      return;
    }

    await salvarConfirmacao({ liberarSobra: false });
  };

  // ============================================================
  // 6) Salva o agendamento confirmado
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

      if (
        liberarSobra &&
        passoSobrou?.slotsLivres &&
        passoSobrou.slotsLivres.length > 0
      ) {
        patch.liberacoesExtras = passoSobrou.slotsLivres.map((s) => ({
          inicio: s.inicio,
          fim: s.fim,
          duracaoMin: s.duracaoMin,
          criadoEm: new Date().toISOString(),
        }));
      } else {
        patch.liberacoesExtras = [];
      }

      await updateDoc(doc(db, 'agendamentos', agendamento.id), patch);

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
      {/* ============================================================ */}
      {/* MODAL PRINCIPAL — Escolher serviço                          */}
      {/* ============================================================ */}
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
          position: 'relative',
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
                if (!s || typeof s.duracaoMin !== 'number') return null;

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
      {/* 2º PASSO — Muito mais explícito                              */}
      {/* ============================================================ */}
      {passoSobrou && (
        <div
          onClick={enviando ? undefined : () => setPassoSobrou(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(44, 22, 58, 0.78)',
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
              padding: '26px 24px 22px',
              maxWidth: 480,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 70px rgba(44, 22, 58, 0.5)',
              border: '1.5px solid #C8A24A',
              fontFamily: "'Montserrat', sans-serif",
              position: 'relative',
            }}
          >
            {/* Botão X */}
            <button
              type="button"
              onClick={() => setPassoSobrou(null)}
              disabled={enviando}
              aria-label="Fechar"
              title="Fechar"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'transparent',
                border: 'none',
                cursor: enviando ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#888',
                transition: 'all 0.2s ease',
                opacity: enviando ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(198, 40, 40, 0.08)';
                e.currentTarget.style.color = '#c62828';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#888';
              }}
            >
              <MdClose size={20} />
            </button>

            {/* Ícone */}
            <div
              style={{
                width: 64,
                height: 64,
                margin: '0 auto 14px auto',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '2px solid #86efac',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MdEventAvailable size={32} color="#16a34a" />
            </div>

            <h3
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#2c163a',
                fontSize: 17,
                fontWeight: 700,
                margin: '0 0 4px 0',
                textAlign: 'center',
              }}
            >
              Liberar tempo livre?
            </h3>

            <p
              style={{
                fontSize: 12,
                color: '#666',
                margin: '0 0 18px 0',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              Seu atendimento foi confirmado, mas ainda tem espaço na sua agenda.
              Veja os detalhes:
            </p>

            {/* ==== INFO DETALHADA ==== */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* 1) Bloco cadastrado */}
              <div style={{
                background: '#faf5ff',
                border: '1px solid #e2d2f5',
                borderRadius: 10,
                padding: '10px 12px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                }}>
                  <MdCalendarMonth size={13} color="#7e22ce" />
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#7e22ce',
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase',
                  }}>
                    Bloco cadastrado
                  </span>
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#2c163a',
                  lineHeight: 1.5,
                }}>
                  Das <strong>{passoSobrou.blocoInicio}</strong> às{' '}
                  <strong>{passoSobrou.blocoFim}</strong>
                  {' '}com intervalo padrão de{' '}
                  <strong>{passoSobrou.blocoDuracaoPadrao} min</strong>.
                </div>
              </div>

              {/* 2) Serviço escolhido */}
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: 10,
                padding: '10px 12px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                }}>
                  <MdAccessTime size={13} color="#16a34a" />
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#16a34a',
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase',
                  }}>
                    Atendimento reservado
                  </span>
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#2c163a',
                  lineHeight: 1.5,
                }}>
                  <strong>{passoSobrou.servicoNome}</strong>
                  {' '}({passoSobrou.servicoDuracao} min){' '}
                  — das <strong>{passoSobrou.atendimentoInicio}</strong> às{' '}
                  <strong>{passoSobrou.atendimentoFim}</strong>.
                </div>
              </div>

              {/* 3) Horários livres */}
              <div style={{
                background: '#fff8e1',
                border: '1.5px solid #fcd34d',
                borderRadius: 10,
                padding: '12px 12px 10px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 8,
                }}>
                  <MdEventAvailable size={13} color="#92400e" />
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#92400e',
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase',
                  }}>
                    {passoSobrou.slotsLivres.length === 1
                      ? 'Horário livre'
                      : `${passoSobrou.slotsLivres.length} horários livres`}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                }}>
                  {passoSobrou.slotsLivres.map((s, i) => (
                    <span
                      key={`${s.inicio}-${i}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: '#fff',
                        border: '1px solid #fcd34d',
                        borderRadius: 20,
                        padding: '5px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#92400e',
                        fontFamily: "'Montserrat', sans-serif",
                      }}
                    >
                      {s.inicio} → {s.fim}
                      <span style={{
                        fontSize: 9.5,
                        fontWeight: 500,
                        color: '#a16207',
                      }}>
                        ({s.duracaoMin}min)
                      </span>
                    </span>
                  ))}
                </div>

                <div style={{
                  fontSize: 10.5,
                  color: '#78350f',
                  marginTop: 8,
                  lineHeight: 1.5,
                }}>
                  Esses horários vão aparecer pra outros pacientes agendarem na sua agenda pública.
                </div>
              </div>

              {/* 4) O que acontece se NÃO liberar */}
              <div style={{
                background: 'rgba(215, 206, 224, 0.3)',
                border: '1px dashed #c4b5d4',
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}>
                <MdLock size={13} color="#665078" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{
                  fontSize: 11,
                  color: '#55286f',
                  lineHeight: 1.5,
                }}>
                  Se escolher <strong>“Não liberar”</strong>, esses horários continuam{' '}
                  <strong>bloqueados</strong> e não vão aparecer pra ninguém.
                </div>
              </div>
            </div>

            {/* ==== PERGUNTA + BOTÕES ==== */}
            <p style={{
              fontSize: 12.5,
              color: '#2c163a',
              fontWeight: 600,
              margin: '16px 0 12px 0',
              textAlign: 'center',
            }}>
              Quer liberar {passoSobrou.slotsLivres.length === 1 ? 'esse horário' : 'esses horários'}?
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
                {enviando
                  ? 'SALVANDO…'
                  : passoSobrou.slotsLivres.length === 1
                    ? 'SIM, LIBERAR ESSE HORÁRIO'
                    : 'SIM, LIBERAR OS HORÁRIOS'}
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