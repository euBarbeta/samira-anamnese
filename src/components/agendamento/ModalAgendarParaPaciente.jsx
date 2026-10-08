// src/components/agendamento/ModalAgendarParaPaciente.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { notificarAgendamento } from '../../utils/agendamentoNotify';
import {
  collection, query, where, getDocs, addDoc, doc, getDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  gerarSlotsDisponiveis, gerarCodigoAutenticidade, toISODateLocal,
} from '../../utils/agenda';
import {
  MdClose, MdCheckCircle, MdWarning, MdCalendarMonth,
} from 'react-icons/md';
import CalendarioAgenda, { LegendaCalendario } from './CalendarioAgenda';

export default function ModalAgendarParaPaciente({
  paciente,
  uidEsteticista,
  origem = 'esteticista',
   tipoNotificacao = 'criado',
  onFechar,
  onSucesso,
}) {
  const isPaciente = origem === 'paciente';

  const [slots, setSlots] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mesRef, setMesRef] = useState(() => new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [slotSelecionado, setSlotSelecionado] = useState(null);
  const [observacoes, setObservacoes] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  // ✅ Ref sempre atualizado pro onFechar (evita closure obsoleto)
  const onFecharRef = useRef(onFechar);
  useEffect(() => { onFecharRef.current = onFechar; }, [onFechar]);

  // ============================================================
  // ✅ BOTÃO VOLTAR (nativo/navegador) → fecha o modal
  // ============================================================
  useEffect(() => {
    window.history.pushState(
      { ...(window.history.state || {}), modalAgendarAberto: true },
      '',
      window.location.pathname + window.location.search + window.location.hash
    );

    const onPop = () => {
      onFecharRef.current?.();
    };

    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);

      if (window.history.state?.modalAgendarAberto) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bloqueia scroll do body enquanto o modal estiver aberto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ============================================================
  // Estado separado: config da agenda + agendamentos ocupados
  // ============================================================
  const [configAgenda, setConfigAgenda] = useState(null);
  const [agendamentosOcupados, setAgendamentosOcupados] = useState([]);

  // ============================================================
  // Listener 1 — CONFIG da agenda (tempo real)
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;

    let cancelado = false;

    const unsub = onSnapshot(
      doc(db, `usuarios/${uidEsteticista}/agenda_config`, 'principal'),
      (snap) => {
        if (cancelado) return;

        if (!snap.exists()) {
          setErro(
            isPaciente
              ? 'A agenda da profissional ainda não está configurada.'
              : 'Você ainda não configurou sua agenda.'
          );
          setConfigAgenda(null);
          setSlots([]);
          setCarregando(false);
          return;
        }

        setConfigAgenda(snap.data());
        setErro('');
      },
      (err) => {
        console.error('Erro listener config:', err);
        setCarregando(false);
      }
    );

    return () => {
      cancelado = true;
      unsub();
    };
  }, [uidEsteticista, isPaciente]);

  // ============================================================
  // Listener 2 — AGENDAMENTOS do período (tempo real)
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista || !configAgenda) return;

    let cancelado = false;

    const hoje = toISODateLocal(new Date());
    const max = new Date();
    max.setDate(max.getDate() + (configAgenda.diasFuturosMaximo || 60));
    const dataFim = toISODateLocal(max);

    const unsub = onSnapshot(
      query(
        collection(db, 'agendamentos'),
        where('uidEsteticista', '==', uidEsteticista),
        where('data', '>=', hoje),
        where('data', '<=', dataFim)
      ),
      (snap) => {
        if (cancelado) return;
        const ocupados = snap.docs
          .map((d) => d.data())
          .filter((a) => a.status === 'pendente' || a.status === 'confirmado');
        setAgendamentosOcupados(ocupados);
        setCarregando(false);
      },
      (err) => {
        console.error('Erro listener agendamentos:', err);
        setCarregando(false);
      }
    );

    return () => {
      cancelado = true;
      unsub();
    };
  }, [uidEsteticista, configAgenda]);

  // ============================================================
  // Recalcula slots sempre que config ou agendamentos mudarem
  // ============================================================
  useEffect(() => {
    if (!configAgenda) return;

    const hoje = toISODateLocal(new Date());
    const max = new Date();
    max.setDate(max.getDate() + (configAgenda.diasFuturosMaximo || 60));
    const dataFim = toISODateLocal(max);

    const lista = gerarSlotsDisponiveis(
      configAgenda,
      agendamentosOcupados,
      hoje,
      dataFim
    );

    setSlots(lista);
  }, [configAgenda, agendamentosOcupados]);

  // Agrupa slots por dia
  const slotsPorDia = useMemo(() => {
    const map = {};
    for (const s of slots) {
      if (!map[s.data]) map[s.data] = [];
      map[s.data].push(s);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    }
    return map;
  }, [slots]);

  // ✅ Fechar via histórico
  const fecharViaHistorico = useCallback(() => {
    if (window.history.state?.modalAgendarAberto) {
      window.history.back();
    } else {
      onFecharRef.current?.();
    }
  }, []);

  const confirmar = async () => {
    if (!slotSelecionado) return;
    setErro('');
    setEnviando(true);

    try {
      const codigo = gerarCodigoAutenticidade();

      const consentimentoPaciente = paciente?.consentimentoLGPD?.aceito
        ? paciente.consentimentoLGPD
        : {
            aceito: true,
            dataAceite: new Date().toISOString(),
            versaoTermo: '1.0',
            plataforma: isPaciente ? 'paciente-app' : 'esteticista-app',
            userAgent: isPaciente
              ? 'agendamento-feito-pelo-paciente'
              : 'agendamento-feito-pela-profissional',
          };

      const novoStatus = isPaciente
        ? 'pendente'
        : (paciente?.consentimentoLGPD?.aceito ? 'confirmado' : 'pendente');

      // ============================================================
      // ✅ pacienteId só é gravado se o paciente EXISTE no sistema
      //    (reagendamento público sem pasta → null)
      // ============================================================
      const temPacienteNoSistema = Boolean(paciente?.id);

      const docRef = await addDoc(collection(db, 'agendamentos'), {
        uidEsteticista,
        profissionalId: uidEsteticista,
        pacienteId: temPacienteNoSistema ? String(paciente.id) : null,

        data: slotSelecionado.data,
        horaInicio: slotSelecionado.horaInicio,
        horaFim: slotSelecionado.horaFim,
        duracaoMin: calcularDuracao(slotSelecionado),

        servicoId: null,
        servicoNome: null,

        nome: paciente?.nome || 'Paciente',
        documento: paciente?.documento || '',
        telefone: paciente?.telefone || '',
        email: (paciente?.email || paciente?.emailAcesso || '').toLowerCase(),
        observacoes: observacoes.trim(),

        status: novoStatus,
        criadoPor: isPaciente ? 'paciente' : 'esteticista',
        aguardandoConsentimento: isPaciente
          ? false
          : !paciente?.consentimentoLGPD?.aceito,
        aguardandoConfirmacao: isPaciente,

        canceladoPor: null,
        consentimentoLGPD: consentimentoPaciente,
        codigoAutenticidade: codigo,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });

      // ============================================================
      // ✅ Notificações:
      //    - Paciente agendou (origem = 'paciente')  → notifica ESTETA
      //    - Esteta agendou COM app (pacienteId)     → notifica PACIENTE
      //    - Esteta agendou SEM app (público)        → NÃO notifica
      // ============================================================
      if (isPaciente) {
        // Paciente agendou → notifica a esteticista
        notificarAgendamento({
          tipoEvento: 'novo',
          uidEsteticista,
          agendamento: {
            id: docRef.id,
            data: slotSelecionado.data,
            horaInicio: slotSelecionado.horaInicio,
            nome: paciente?.nome,
          },
        });
      } else if (temPacienteNoSistema) {
        // Esteta agendou pra paciente que TEM app → notifica o paciente
        fetch('/.netlify/functions/notificar-paciente-agendamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pacienteId: paciente.id,
             tipoEvento: tipoNotificacao, 
            agendamento: {
              id: docRef.id,
              data: slotSelecionado.data,
              horaInicio: slotSelecionado.horaInicio,
              nome: paciente.nome,
            },
          }),
        }).catch((e) => console.warn('Falha ao notificar paciente:', e));
      }
      // else: reagendamento público → nada a notificar (não tem app)

      onSucesso?.({
        id: docRef.id,
        data: slotSelecionado.data,
        horaInicio: slotSelecionado.horaInicio,
      });
    } catch (e) {
      console.error('Erro ao criar agendamento:', e);
      setErro(
        isPaciente
          ? 'Não foi possível enviar sua solicitação. Tente novamente.'
          : 'Erro ao agendar. Tente novamente.'
      );
      setEnviando(false);
    }
  };

  return (
    <div
      className="map-overlay"
      onClick={enviando ? undefined : fecharViaHistorico}
    >
      <style>{`
        .map-overlay {
          position: fixed;
          inset: 0;
          background: rgba(44, 22, 58, 0.65);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 99999;
          padding: 20px;
          box-sizing: border-box;
        }

        .map-modal {
          background: #fff;
          border-radius: 20px;
          width: 100%;
          max-width: 560px;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 25px 70px rgba(44, 22, 58, 0.45);
          border: 1.5px solid #C8A24A;
          font-family: 'Montserrat', sans-serif;
        }

        .map-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 22px;
          border-bottom: 1.5px solid #e2d2f5;
          background: linear-gradient(135deg, rgba(200, 162, 74, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%);
          flex-shrink: 0;
          gap: 10px;
        }

        .map-header h3 {
          font-family: 'Cinzel', serif;
          color: #2c163a;
          font-size: 16px;
          margin: 0;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .map-btn-fechar {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s ease;
          flex-shrink: 0;
          min-width: 40px;
          min-height: 40px;
        }
        .map-btn-fechar:hover { background: rgba(44, 22, 58, 0.06); }

        .map-body {
          padding: 18px 22px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          flex: 1 1 auto;
          min-height: 0;
        }

        .map-footer {
          display: flex;
          gap: 10px;
          padding: 14px 22px;
          border-top: 1.5px solid #e2d2f5;
          background: #fafafc;
          justify-content: flex-end;
          flex-shrink: 0;
        }

        .map-btn-cancelar {
          font-family: 'Cinzel', serif;
          background: #f0f0f0;
          color: #333;
          border: none;
          padding: 12px 20px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          min-height: 42px;
          transition: background 0.2s ease;
        }
        .map-btn-cancelar:hover { background: #e6e6e6; }

        .map-btn-confirmar {
          font-family: 'Cinzel', serif;
          background: linear-gradient(135deg, #C8A24A 0%, #e2be64 100%);
          color: #fff;
          border: 1.5px solid #9c7826;
          padding: 12px 24px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 3px 10px rgba(200, 162, 74, 0.35);
          min-height: 42px;
          letter-spacing: 0.3px;
        }

        .map-slots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 8px;
        }

        .map-slot-btn {
          padding: 10px 6px;
          border-radius: 10px;
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          background: #fff;
          border: 1.5px solid #d8b4fe;
          color: #2c163a;
          min-height: 42px;
          transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
          font-family: 'Montserrat', sans-serif;
        }
        .map-slot-btn:hover {
          border-color: #a855f7;
          background: #faf5ff;
        }
        .map-slot-btn.ativo {
          border: 2px solid #7e22ce;
          background: #faf5ff;
          color: #7e22ce;
          font-weight: 700;
        }

        .map-textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1.5px solid #d8b4fe;
          border-radius: 10px;
          font-size: 13px;
          font-family: 'Montserrat', sans-serif;
          color: #2c163a;
          outline: none;
          resize: vertical;
          box-sizing: border-box;
          min-height: 60px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .map-textarea:focus {
          border-color: #a855f7;
          box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15);
        }

        @media (max-width: 640px) {
          .map-overlay { padding: 10px; }
          .map-modal { max-height: 94vh; border-radius: 18px; }
          .map-header { padding: 12px 16px; }
          .map-header h3 { font-size: 14px; }
          .map-header svg { width: 18px; height: 18px; }
          .map-body { padding: 14px 16px; }
          .map-footer { padding: 12px 16px; gap: 8px; }
          .map-btn-cancelar { padding: 12px 16px; font-size: 10.5px; flex: 1; }
          .map-btn-confirmar { padding: 12px 16px; font-size: 10.5px; flex: 1.4; }
          .map-slots-grid {
            grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
            gap: 6px;
          }
          .map-slot-btn { font-size: 12.5px; padding: 10px 4px; }
        }

        @media (max-width: 380px) {
          .map-overlay { padding: 0; align-items: stretch; }
          .map-modal {
            max-height: 100vh;
            height: 100%;
            border-radius: 0;
            border-left: none;
            border-right: none;
            border-top: none;
            border-bottom: none;
          }
          .map-header {
            padding: 12px 14px;
            padding-top: max(12px, env(safe-area-inset-top));
          }
          .map-header h3 { font-size: 13px; }
          .map-body { padding: 12px 14px; }
          .map-footer {
            padding: 10px 14px;
            padding-bottom: max(10px, env(safe-area-inset-bottom));
            flex-direction: column-reverse;
          }
          .map-btn-cancelar,
          .map-btn-confirmar { width: 100%; flex: none; }
          .map-slots-grid { grid-template-columns: repeat(4, 1fr); gap: 6px; }
          .map-slot-btn { font-size: 12px; padding: 10px 2px; }
        }

        @media (min-width: 768px) {
          .map-header h3 { font-size: 17px; }
          .map-body { padding: 20px 26px; }
          .map-slots-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
        }

        @keyframes mapFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mapSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .map-overlay { animation: mapFadeIn 0.2s ease; }
        .map-modal   { animation: mapSlideUp 0.25s ease; }
      `}</style>

      <div className="map-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="map-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <MdCalendarMonth size={20} color="#7e22ce" style={{ flexShrink: 0 }} />
            <h3>
              {isPaciente
                ? 'Escolher data e horário'
                : `Agendar para ${paciente?.nome || 'paciente'}`}
            </h3>
          </div>
          <button
            type="button"
            className="map-btn-fechar"
            onClick={fecharViaHistorico}
            disabled={enviando}
            aria-label="Fechar"
          >
            <MdClose size={20} color="#2c163a" />
          </button>
        </div>

        {/* Body */}
        <div className="map-body">
          {carregando ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#666', fontSize: 13 }}>
              {isPaciente ? 'Carregando agenda…' : 'Carregando sua agenda…'}
            </div>
          ) : erro && slots.length === 0 ? (
            <div style={blocoAviso}>
              <MdWarning size={22} color="#92400e" style={{ flexShrink: 0 }} />
              <span>{erro}</span>
            </div>
          ) : slots.length === 0 ? (
            <div style={blocoAviso}>
              <MdWarning size={22} color="#92400e" style={{ flexShrink: 0 }} />
              <span>
                {isPaciente
                  ? 'Nenhum horário disponível no momento. Tente novamente mais tarde.'
                  : 'Sua agenda está vazia. Configure horários primeiro.'}
              </span>
            </div>
          ) : (
            <>
              <CalendarioAgenda
                mesRef={mesRef}
                onMudarMes={(delta) => {
                  const nova = new Date(mesRef);
                  nova.setMonth(nova.getMonth() + delta);
                  setMesRef(nova);
                  setDiaSelecionado(null);
                  setSlotSelecionado(null);
                }}
                irHoje={() => {
                  setMesRef(new Date());
                  setDiaSelecionado(null);
                  setSlotSelecionado(null);
                }}
                diaSelecionado={diaSelecionado}
                compacto
                renderDia={(data) => {
                  const iso = toISODateLocal(data);
                  const slotsDoDia = slotsPorDia[iso] || [];
                  const temSlot = slotsDoDia.length > 0;
                  return {
                    status: temSlot ? 'aberto' : 'vazio',
                    times: temSlot ? slotsDoDia.map((s) => s.horaInicio) : [],
                    disabled: !temSlot,
                    title: temSlot
                      ? `${slotsDoDia.length} horário(s) livre(s)`
                      : 'Sem vagas',
                    onClick: (d) => {
                      setDiaSelecionado(toISODateLocal(d));
                      setSlotSelecionado(null);
                    },
                  };
                }}
              />
              <LegendaCalendario />

              {diaSelecionado && (
                <div style={{ marginTop: 16 }}>
                  <div style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 12,
                    color: '#2c163a',
                    marginBottom: 10,
                    lineHeight: 1.4,
                  }}>
                    Horários livres em {formatarDataLonga(diaSelecionado)}
                  </div>
                  <div className="map-slots-grid">
                    {slotsPorDia[diaSelecionado]?.map((s, i) => {
                      const ativo =
                        slotSelecionado?.data === s.data &&
                        slotSelecionado?.horaInicio === s.horaInicio;
                      return (
                       <button
  key={i}
  type="button"
  onClick={() => setSlotSelecionado(s)}
  className={`map-slot-btn${ativo ? ' ativo' : ''}`}
>
  {s.horaInicio}
</button>
                      );
                    })}
                  </div>
                </div>
              )}

              {slotSelecionado && (
                <div style={{ marginTop: 16 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#2c163a',
                    marginBottom: 6,
                    letterSpacing: '0.2px',
                  }}>
                    Observações (opcional)
                  </label>
                  <textarea
                    className="map-textarea"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={3}
                    placeholder={
                      isPaciente
                        ? 'Ex: primeira vez, dúvidas, preferência de horário…'
                        : 'Ex: retorno, limpeza de pele…'
                    }
                  />
                </div>
              )}

              {erro && (
                <div style={{
                  background: '#fde8e8',
                  border: '1px solid #f98080',
                  color: '#c81e1e',
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  marginTop: 12,
                  lineHeight: 1.5,
                }}>
                  {erro}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="map-footer">
          <button
            type="button"
            onClick={fecharViaHistorico}
            disabled={enviando}
            className="map-btn-cancelar"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!slotSelecionado || enviando}
            className="map-btn-confirmar"
            style={{
              opacity: (!slotSelecionado || enviando) ? 0.5 : 1,
              cursor: (!slotSelecionado || enviando) ? 'not-allowed' : 'pointer',
            }}
          >
            <MdCheckCircle size={16} />
            {enviando
              ? (isPaciente ? 'ENVIANDO…' : 'AGENDANDO…')
              : (isPaciente ? 'SOLICITAR' : 'CONFIRMAR')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ Helpers ============ */
function calcularDuracao(slot) {
  const [h1, m1] = slot.horaInicio.split(':').map(Number);
  const [h2, m2] = slot.horaFim.split(':').map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

function formatarDataLonga(iso) {
  const [ano, mes, dia] = iso.split('-');
  const d = new Date(iso + 'T12:00:00');
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return `${dias[d.getDay()]}, ${dia}/${mes}/${ano}`;
}

/* ============ Estilos ============ */
const blocoAviso = {
  background: '#fff8e1',
  border: '1px solid #fcd34d',
  borderRadius: 10,
  padding: 14,
  fontSize: 12,
  color: '#92400e',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 600,
  lineHeight: 1.5,
};