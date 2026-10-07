// src/components/agendamento/PainelAgendamentosEsteticista.jsx
import React, { useState, useEffect, useMemo } from 'react';
import GerenciarServicos from './GerenciarServicos';
import ModalAgendarParaPaciente from './ModalAgendarParaPaciente';
import {
  collection, query, where, onSnapshot, doc,
  updateDoc, orderBy, getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import ModalEscolherServico from './ModalEscolherServico';
import { formatPhoneNumberIntl } from 'react-phone-number-input';
import {
  MdCheckCircle, MdCancel, MdWarning, MdSearch,
  MdCalendarMonth, MdSettings, MdPhone, MdBadge,
  MdEmail, MdChatBubbleOutline, MdClear, MdHourglassEmpty,
  MdContentCopy, MdCheck, MdDelete, MdAssignment, MdEvent,
  MdPersonOff, MdRefresh,
} from 'react-icons/md';
import ConfiguradorAgenda from './ConfiguradorAgenda';

// ============================================================
// Quantos dias manter na lista de histórico
// ============================================================
const DIAS_HISTORICO = 30;

/* ============================================================
   Formatação de telefone por país
   ============================================================ */
function formatarTelefoneInternacional(tel) {
  if (!tel) return '—';
  try {
    const f = formatPhoneNumberIntl(String(tel));
    return f || String(tel);
  } catch {
    return String(tel);
  }
}

/* ============================================================
   Botão "copiar" — pequeno, reutilizável
   ============================================================ */
function BotaoCopiar({ valor, rotulo, title }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async (e) => {
    e?.stopPropagation?.();
    const texto = String(valor || '');
    if (!texto) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
      } else {
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch (err) {
      console.warn('Falha ao copiar:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={copiar}
      title={copiado ? 'Copiado!' : (title || `Copiar ${rotulo || ''}`)}
      aria-label={copiado ? 'Copiado' : `Copiar ${rotulo || ''}`}
      style={{
        background: copiado ? '#f0fdf4' : '#faf5ff',
        border: copiado ? '1px solid #86efac' : '1px solid #d8b4fe',
        color: copiado ? '#166534' : '#7e22ce',
        width: 22,
        height: 22,
        borderRadius: 6,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        flexShrink: 0,
        transition: 'all 0.18s ease',
        marginLeft: 4,
        verticalAlign: 'middle',
      }}
    >
      {copiado ? <MdCheck size={12} /> : <MdContentCopy size={11} />}
    </button>
  );
}

/* ============================================================
   MODAL DE CONFIRMAÇÃO DE CANCELAMENTO
   ============================================================ */
function ModalConfirmarCancelamento({
  agendamento,
  carregando,
  onConfirmar,
  onFechar,
}) {
  return (
    <div
      onClick={carregando ? undefined : onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
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
          padding: '28px 24px 24px 24px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
          border: '1.5px solid #e2d2f5',
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
            background: 'linear-gradient(135deg, #ffebee 0%, #fde8e8 100%)',
            border: '2px solid #ef9a9a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(198, 40, 40, 0.18)',
          }}
        >
          <MdCancel size={32} color="#c62828" />
        </div>

        <h3
          style={{
            fontFamily: "'Cinzel', serif",
            color: '#c62828',
            fontSize: 17,
            fontWeight: 700,
            margin: '0 0 10px 0',
            letterSpacing: '0.4px',
          }}
        >
          Cancelar agendamento?
        </h3>

        <p
          style={{
            fontSize: 13,
            color: '#2c163a',
            margin: '0 0 6px 0',
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          {agendamento?.nome || 'Paciente'}
        </p>

        <p
          style={{
            fontSize: 12,
            color: '#555',
            margin: '0 0 18px 0',
            lineHeight: 1.6,
          }}
        >
          {formatarDataBR(agendamento?.data)} às {agendamento?.horaInicio}
          <br />
          <span
            style={{
              fontSize: 11,
              color: '#888',
              display: 'block',
              marginTop: 6,
            }}
          >
            O paciente será notificado. Esta ação não pode ser desfeita.
          </span>
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={onFechar}
            disabled={carregando}
            style={{
              flex: 1,
              background: '#f0f0f0',
              color: '#333',
              border: 'none',
              padding: '12px 16px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: carregando ? 'not-allowed' : 'pointer',
              fontFamily: "'Cinzel', serif",
              opacity: carregando ? 0.6 : 1,
              minHeight: 44,
            }}
          >
            VOLTAR
          </button>

          <button
            type="button"
            onClick={onConfirmar}
            disabled={carregando}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
              color: '#fff',
              border: 'none',
              padding: '12px 16px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: carregando ? 'wait' : 'pointer',
              fontFamily: "'Cinzel', serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(198, 40, 40, 0.35)',
              opacity: carregando ? 0.7 : 1,
              minHeight: 44,
            }}
          >
            {carregando ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: 13,
                    height: 13,
                    border: '2px solid #fff',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spinCancel 0.8s linear infinite',
                  }}
                />
                CANCELANDO…
              </>
            ) : (
              <>
                <MdDelete size={14} />
                CANCELAR
              </>
            )}
          </button>
        </div>

        <style>{`
          @keyframes spinCancel { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}

/* ============================================================
   MODAL DE CONTATO — agendamento público sem pasta
   ============================================================ */
function ModalContatoPaciente({ agendamento, onFechar }) {
  if (!agendamento) return null;

  const primeiroNome = (agendamento.nome || '').split(' ')[0] || '';
  const msgWhatsApp =
    `Olá ${primeiroNome}! Vi que você não conseguiu comparecer ao seu horário. ` +
    `Vamos marcar um novo? Me diga qual dia/horário fica melhor pra você.`;

  const telefoneLimpo = String(agendamento.telefone || '').replace(/\D/g, '');

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
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
          padding: '28px 24px 24px 24px',
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
          border: '1.5px solid #0891b2',
          fontFamily: "'Montserrat', sans-serif",
          textAlign: 'center',
        }}
      >
        {/* Ícone */}
        <div
          style={{
            width: 68,
            height: 68,
            margin: '0 auto 16px auto',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #e0f2fe 0%, #cffafe 100%)',
            border: '2px solid #67e8f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(8, 145, 178, 0.18)',
          }}
        >
          <MdPhone size={32} color="#0891b2" />
        </div>

        <h3
          style={{
            fontFamily: "'Cinzel', serif",
            color: '#0891b2',
            fontSize: 17,
            fontWeight: 700,
            margin: '0 0 12px 0',
            letterSpacing: '0.4px',
          }}
        >
          Entre em contato com o paciente
        </h3>

        <p
          style={{
            fontSize: 13,
            color: '#2c163a',
            margin: '0 0 10px 0',
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          {agendamento.nome || 'Paciente'}
        </p>

        <p
          style={{
            fontSize: 12,
            color: '#555',
            margin: '0 0 18px 0',
            lineHeight: 1.6,
          }}
        >
          Este agendamento foi feito <strong>pelo site</strong> e ainda
          não tem pasta no sistema.
          <br />
          <br />
          Para reagendar, entre em contato direto com o paciente e combine
          um novo horário.
        </p>

        {/* Dados de contato */}
        <div
          style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 12,
            padding: '12px 14px',
            textAlign: 'left',
            marginBottom: 18,
          }}
        >
          {agendamento.telefone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: agendamento.email ? 8 : 0 }}>
              <MdPhone size={16} color="#0891b2" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: '#666', fontWeight: 700, letterSpacing: '0.5px' }}>
                  TELEFONE
                </div>
                <div style={{ fontSize: 13, color: '#2c163a', fontWeight: 600 }}>
                  {formatarTelefoneInternacional(agendamento.telefone)}
                </div>
              </div>
              <BotaoCopiar
                valor={agendamento.telefone}
                rotulo="telefone"
                title="Copiar telefone"
              />
            </div>
          )}

          {agendamento.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MdEmail size={16} color="#0891b2" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: '#666', fontWeight: 700, letterSpacing: '0.5px' }}>
                  E-MAIL
                </div>
                <div style={{ fontSize: 12, color: '#2c163a', fontWeight: 600, wordBreak: 'break-all' }}>
                  {agendamento.email}
                </div>
              </div>
              <BotaoCopiar
                valor={agendamento.email}
                rotulo="e-mail"
                title="Copiar e-mail"
              />
            </div>
          )}

          {!agendamento.telefone && !agendamento.email && (
            <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic', textAlign: 'center' }}>
              Nenhum contato registrado.
            </div>
          )}
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: 10 }}>
          {telefoneLimpo && (
            <a
              href={`https://wa.me/${telefoneLimpo}?text=${encodeURIComponent(msgWhatsApp)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                background: '#25D366',
                color: '#fff',
                border: 'none',
                padding: '12px 16px',
                borderRadius: 22,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Cinzel', serif",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
                textDecoration: 'none',
              }}
            >
              WhatsApp
            </a>
          )}

          <button
            type="button"
            onClick={onFechar}
            style={{
              flex: 1,
              background: '#f0f0f0',
              color: '#333',
              border: 'none',
              padding: '12px 16px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Cinzel', serif",
            }}
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PainelAgendamentosEsteticista({ uidEsteticista }) {
  const [aba, setAba] = useState('agenda'); // 'agenda' | 'config' | 'servicos'
  const [agendamentos, setAgendamentos] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  // Modal de escolher serviço (pendente → confirmado)
  const [agendamentoParaConfirmar, setAgendamentoParaConfirmar] = useState(null);

  // Modal de cancelamento
  const [agendamentoParaCancelar, setAgendamentoParaCancelar] = useState(null);
  const [cancelando, setCancelando] = useState(false);

  // Modal de reagendamento (faltou → novo horário)
  const [agendamentoParaReagendar, setAgendamentoParaReagendar] = useState(null);
  const [pacienteReagendar, setPacienteReagendar] = useState(null);
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);

  // ✅ Aviso de contato para card "faltou" SEM pasta (público)
  const [avisoContatoPaciente, setAvisoContatoPaciente] = useState(null);

  // ============================================================
  // Listener em tempo real (só observa — sem auto-conclusão)
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;

    const q = query(
      collection(db, 'agendamentos'),
      where('uidEsteticista', '==', uidEsteticista),
      orderBy('data', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgendamentos(lista);
      setCarregando(false);
    }, (err) => {
      console.error('Erro agendamentos:', err);
      setCarregando(false);
    });

    return () => unsub();
  }, [uidEsteticista]);

  // ============================================================
  // Abre modal de escolher serviço (pendente → confirmado)
  // ============================================================
  const solicitarEscolhaServico = (ag) => {
    setAgendamentoParaConfirmar(ag);
  };

  // ============================================================
  // Abre modal de cancelamento
  // ============================================================
  const solicitarCancelamento = (ag) => {
    setAgendamentoParaCancelar(ag);
  };

  // ============================================================
  // Executa o cancelamento
  // ============================================================
  const confirmarCancelamento = async () => {
    if (!agendamentoParaCancelar) return;
    const ag = agendamentoParaCancelar;
    setCancelando(true);
    try {
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        status: 'cancelado',
        canceladoPor: 'esteticista',
        atualizadoEm: new Date().toISOString(),
      });

      fetch('/.netlify/functions/notificar-paciente-agendamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pacienteId: ag.pacienteId,
          agendamento: ag,
          tipoEvento: 'cancelado',
        }),
      }).catch((e) => console.warn('Falha ao notificar paciente (cancelado):', e));

      setAgendamentoParaCancelar(null);
    } catch (e) {
      alert('Erro ao cancelar: ' + e.message);
    } finally {
      setCancelando(false);
    }
  };

  // ============================================================
  // ✅ CONCLUIR manualmente (paciente veio e foi atendido)
  // ============================================================
  const concluirManual = async (ag) => {
    try {
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        status: 'concluido',
        concluidoPor: 'esteticista',
        concluidoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });
    } catch (e) {
      alert('Erro ao concluir: ' + e.message);
    }
  };

  // ============================================================
  // ✅ MARCAR COMO FALTOU (paciente não compareceu)
  // ============================================================
  const marcarFaltou = async (ag) => {
    try {
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        status: 'faltou',
        faltouPor: 'paciente',
        faltouEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });
    } catch (e) {
      alert('Erro ao marcar falta: ' + e.message);
    }
  };

  // ============================================================
  // ✅ REAGENDAR (faltou COM pasta)
  // 1. Busca a pasta do paciente no Firestore
  // 2. Abre o ModalAgendarParaPaciente com o paciente pré-preenchido
  // 3. Ao sucesso, marca o novo agendamento com `reagendamentoDe`
  // ============================================================
  const abrirReagendamento = async (ag) => {
    if (!ag.pacienteId) {
      // Rede de segurança — botão deveria estar escondido
      setAvisoContatoPaciente(ag);
      return;
    }

    setBuscandoPaciente(true);
    try {
      const snap = await getDoc(
        doc(db, `usuarios/${uidEsteticista}/pacientes`, String(ag.pacienteId))
      );

      if (!snap.exists()) {
        alert(
          'Paciente não encontrado no sistema. A pasta pode ter sido excluída.\n\n' +
          'Crie uma nova pasta antes de reagendar.'
        );
        setBuscandoPaciente(false);
        return;
      }

      setPacienteReagendar({ id: snap.id, ...snap.data() });
      setAgendamentoParaReagendar(ag);
    } catch (e) {
      console.error('Erro ao buscar paciente:', e);
      alert('Erro ao carregar paciente. Tente novamente.');
    } finally {
      setBuscandoPaciente(false);
    }
  };

  // Fecha o modal de reagendamento
  const fecharReagendamento = () => {
    setPacienteReagendar(null);
    setAgendamentoParaReagendar(null);
  };

  // ============================================================
  // Contagem por status (com corte de 30 dias para histórico)
  // ============================================================
  const contagens = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() - DIAS_HISTORICO);

    const cont = {
      pendente: 0,
      confirmado: 0,
      cancelado: 0,
      concluido: 0,
      faltou: 0,
    };
    for (const a of agendamentos) {
      if (!(a.status in cont)) continue;
      if (
        a.status === 'cancelado' ||
        a.status === 'concluido' ||
        a.status === 'faltou'
      ) {
        const d = new Date((a.data || '') + 'T12:00:00');
        if (d < limite) continue;
      }
      cont[a.status]++;
    }
    return cont;
  }, [agendamentos]);

  // ============================================================
  // Lista filtrada
  // ============================================================
  const filtrados = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() - DIAS_HISTORICO);

    const termo = busca.toLowerCase().trim();

    return agendamentos.filter((a) => {
      if (a.status !== filtroStatus) return false;

      if (
        a.status === 'cancelado' ||
        a.status === 'concluido' ||
        a.status === 'faltou'
      ) {
        const d = new Date((a.data || '') + 'T12:00:00');
        if (d < limite) return false;
      }

      if (!termo) return true;
      const nome = (a.nome || '').toLowerCase();
      const doc_ = (a.documento || a.cpf || '').toLowerCase();
      const dataBR = formatarDataBR(a.data);
      const email = (a.email || '').toLowerCase();

      return (
        nome.includes(termo) ||
        doc_.includes(termo) ||
        dataBR.includes(termo) ||
        email.includes(termo)
      );
    });
  }, [agendamentos, filtroStatus, busca]);

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Abas */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setAba('agenda')} style={abaBtn(aba === 'agenda')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MdCalendarMonth size={14} /> Agendamentos
          </span>
        </button>
        <button type="button" onClick={() => setAba('config')} style={abaBtn(aba === 'config')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MdSettings size={14} /> Configurar horários
          </span>
        </button>
        <button type="button" onClick={() => setAba('servicos')} style={abaBtn(aba === 'servicos')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MdAssignment size={14} /> Meus Serviços
          </span>
        </button>
      </div>

      {aba === 'servicos' && (
        <GerenciarServicos uidEsteticista={uidEsteticista} />
      )}

      {aba === 'config' && <ConfiguradorAgenda uidEsteticista={uidEsteticista} />}

      {aba === 'agenda' && (
        <>
          {/* Busca */}
          <div style={{
                          background: 'rgba(255, 255, 255, 0.15)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          padding: '8px 16px',
                          marginTop: '-4px',
                          marginBottom: '20px',
                          boxShadow: '0 4px 16px rgba(44, 22, 58, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}>
                          <MdSearch size={18} color="#C8A24A" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Buscar por nome, documento ou data (DD/MM/AAAA)…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 12,
                color: '#2c163a',
                fontFamily: "'Montserrat', sans-serif",
                minWidth: 0,
              }}
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: 0,
                  fontWeight: 600,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <MdClear size={14} /> Limpar
              </button>
            )}
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { key: 'pendente',   label: 'Pendente'   },
              { key: 'confirmado', label: 'Confirmado' },
              { key: 'concluido',  label: 'Concluído'  },
              { key: 'faltou',     label: 'Faltou'     },
              { key: 'cancelado',  label: 'Cancelado'  },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFiltroStatus(key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 16,
                  border: '1.5px solid #C8A24A',
                  background: filtroStatus === key ? '#C8A24A' : 'transparent',
                  color: filtroStatus === key ? '#fff' : '#C8A24A',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', serif",
                }}
              >
                {label} ({contagens[key] || 0})
              </button>
            ))}
          </div>

          {(filtroStatus === 'cancelado' || filtroStatus === 'concluido' || filtroStatus === 'faltou') && (
            <div style={{
              fontSize: 10.5,
              color: '#888',
              marginBottom: 10,
              fontStyle: 'italic',
            }}>
              Exibindo apenas os últimos {DIAS_HISTORICO} dias.
            </div>
          )}

          {/* Lista */}
          {carregando ? (
            <p style={{ color: '#666' }}>Carregando…</p>
          ) : filtrados.length === 0 ? (
            <div style={vazio}>
              {busca
                ? `Nenhum resultado para "${busca}".`
                : `Nenhum agendamento ${labelDe(filtroStatus)}.`}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtrados.map((ag) => (
                <div key={ag.id} style={cardAg}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h4 style={{
                        fontFamily: "'Cinzel', serif",
                        margin: '0 0 4px 0',
                        color: '#2c163a',
                        fontSize: 15,
                      }}>
                        {ag.nome}
                      </h4>

                      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.9 }}>
                        {/* Data e hora */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <MdCalendarMonth size={13} color="#C8A24A" style={{ flexShrink: 0 }} />
                          <span>
                            {formatarDataBR(ag.data)} às {ag.horaInicio}
                            {ag.horaFim ? `–${ag.horaFim}` : ''}
                            {ag.duracaoMin ? ` (${ag.duracaoMin}min)` : ''}
                          </span>
                          {ag.servicoNome && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#7e22ce',
                              background: '#faf5ff',
                              border: '1px solid #d8b4fe',
                              borderRadius: 10,
                              padding: '1px 8px',
                              marginLeft: 2,
                            }}>
                              <MdEvent size={11} /> {ag.servicoNome}
                            </span>
                          )}
                        </div>

                        {/* Telefone + copiar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MdPhone size={13} color="#C8A24A" style={{ flexShrink: 0 }} />
                          <span>{formatarTelefoneInternacional(ag.telefone)}</span>
                          {ag.telefone && (
                            <BotaoCopiar
                              valor={ag.telefone}
                              rotulo="telefone"
                              title="Copiar telefone"
                            />
                          )}
                        </div>

                        {/* Documento + copiar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MdBadge size={13} color="#C8A24A" style={{ flexShrink: 0 }} />
                          <span>{ag.documento || ag.cpf || '—'}</span>
                          {(ag.documento || ag.cpf) && (
                            <BotaoCopiar
                              valor={ag.documento || ag.cpf}
                              rotulo="documento"
                              title="Copiar documento"
                            />
                          )}
                        </div>

                        {/* E-mail + copiar */}
                        {ag.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MdEmail size={13} color="#C8A24A" style={{ flexShrink: 0 }} />
                            <span style={{ wordBreak: 'break-all' }}>{ag.email}</span>
                            <BotaoCopiar
                              valor={ag.email}
                              rotulo="e-mail"
                              title="Copiar e-mail"
                            />
                          </div>
                        )}

                        {/* Observações */}
                        {ag.observacoes && (
                          <div style={{
                            marginTop: 6,
                            fontStyle: 'italic',
                            color: '#7e22ce',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 6,
                          }}>
                            <MdChatBubbleOutline size={13} style={{ marginTop: 3, flexShrink: 0 }} />
                            {ag.observacoes}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {ag.aguardandoConsentimento && (
                          <span style={badgeAguardando}>
                            <MdHourglassEmpty
                              size={11}
                              style={{ verticalAlign: 'middle', marginRight: 4 }}
                            />
                            Aguardando consentimento do paciente
                          </span>
                        )}
                        {ag.consentimentoLGPD?.aceito ? (
                          <span style={badgeOk}>
                            <MdCheckCircle
                              size={11}
                              style={{ verticalAlign: 'middle', marginRight: 4 }}
                            />
                            LGPD aceito
                          </span>
                        ) : (
                          <span style={badgeWarn}>
                            <MdWarning
                              size={11}
                              style={{ verticalAlign: 'middle', marginRight: 4 }}
                            />
                            Sem LGPD
                          </span>
                        )}
                        {ag.status === 'faltou' && (
                          <span style={badgeFaltou}>
                            <MdPersonOff
                              size={11}
                              style={{ verticalAlign: 'middle', marginRight: 4 }}
                            />
                            Paciente não compareceu
                          </span>
                        )}
                        {ag.status === 'faltou' && !ag.pacienteId && (
                          <span style={badgeAviso}>
                            <MdWarning
                              size={11}
                              style={{ verticalAlign: 'middle', marginRight: 4 }}
                            />
                            Sem pasta — contatar direto
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ============ AÇÕES ============ */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {/* PENDENTE → Escolher serviço + Cancelar */}
                      {ag.status === 'pendente' && (
                        <>
                          <button
                            type="button"
                            onClick={() => solicitarEscolhaServico(ag)}
                            style={btnOk}
                          >
                            <MdCheckCircle size={14} /> Escolher serviço
                          </button>
                          <button
                            type="button"
                            onClick={() => solicitarCancelamento(ag)}
                            style={btnDanger}
                          >
                            <MdCancel size={14} /> Cancelar
                          </button>
                        </>
                      )}

                      {/* CONFIRMADO → Concluir + Faltou + Cancelar */}
                      {ag.status === 'confirmado' && (
                        <>
                          <button
                            type="button"
                            onClick={() => concluirManual(ag)}
                            style={btnOk}
                            title="Paciente veio e foi atendido"
                          >
                            <MdCheckCircle size={14} /> Concluir
                          </button>
                          <button
                            type="button"
                            onClick={() => marcarFaltou(ag)}
                            style={btnFaltou}
                            title="Paciente não compareceu"
                          >
                            <MdPersonOff size={14} /> Faltou
                          </button>
                          <button
                            type="button"
                            onClick={() => solicitarCancelamento(ag)}
                            style={btnDanger}
                          >
                            <MdCancel size={14} /> Cancelar
                          </button>
                        </>
                      )}

                      {/* FALTOU → Reagendar (com pasta) OU Contatar (sem pasta) + Cancelar */}
                      {ag.status === 'faltou' && (
                        <>
                          {ag.pacienteId && (
                            <button
                              type="button"
                              onClick={() => abrirReagendamento(ag)}
                              disabled={buscandoPaciente}
                              style={{
                                ...btnReagendar,
                                opacity: buscandoPaciente ? 0.6 : 1,
                                cursor: buscandoPaciente ? 'wait' : 'pointer',
                              }}
                              title="Criar novo agendamento para este paciente"
                            >
                              <MdRefresh size={14} />
                              {buscandoPaciente ? 'Carregando…' : 'Reagendar'}
                            </button>
                          )}

                          {!ag.pacienteId && (
                            <button
                              type="button"
                              onClick={() => setAvisoContatoPaciente(ag)}
                              style={btnContato}
                              title="Paciente agendou pelo site — não tem pasta no sistema"
                            >
                              <MdPhone size={14} />
                              Contatar paciente
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => solicitarCancelamento(ag)}
                            style={btnDanger}
                          >
                            <MdCancel size={14} /> Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ✅ Modal de confirmação de cancelamento */}
      {agendamentoParaCancelar && (
        <ModalConfirmarCancelamento
          agendamento={agendamentoParaCancelar}
          carregando={cancelando}
          onConfirmar={confirmarCancelamento}
          onFechar={() => {
            if (!cancelando) setAgendamentoParaCancelar(null);
          }}
        />
      )}

      {/* ✅ Modal de escolher serviço (pendente → confirmado) */}
      {agendamentoParaConfirmar && (
        <ModalEscolherServico
          agendamento={agendamentoParaConfirmar}
          uidEsteticista={uidEsteticista}
          onFechar={() => setAgendamentoParaConfirmar(null)}
          onConfirmado={() => setAgendamentoParaConfirmar(null)}
        />
      )}

      {/* ✅ Modal de reagendamento (faltou COM pasta) */}
      {pacienteReagendar && agendamentoParaReagendar && (
        <ModalAgendarParaPaciente
          paciente={pacienteReagendar}
          uidEsteticista={uidEsteticista}
          origem="esteticista"
          onFechar={fecharReagendamento}
          onSucesso={async (novoAg) => {
            try {
              await updateDoc(doc(db, 'agendamentos', novoAg.id), {
                reagendamentoDe: agendamentoParaReagendar.id,
                reagendamentoDeData: agendamentoParaReagendar.data,
                reagendamentoDeHora: agendamentoParaReagendar.horaInicio,
              });
            } catch (e) {
              console.warn('Falha ao marcar reagendamento:', e);
            }
            fecharReagendamento();
          }}
        />
      )}

      {/* ✅ Modal de contato (faltou SEM pasta — público) */}
      {avisoContatoPaciente && (
        <ModalContatoPaciente
          agendamento={avisoContatoPaciente}
          onFechar={() => setAvisoContatoPaciente(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
   Helpers
   ============================================================ */
function formatarDataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function labelDe(status) {
  return {
    pendente: 'pendente',
    confirmado: 'confirmado',
    cancelado: 'cancelado',
    concluido: 'concluído',
    faltou: 'com falta',
  }[status] || status;
}

/* ============================================================
   Estilos
   ============================================================ */
const abaBtn = (ativo) => ({
  padding: '10px 18px',
  borderRadius: 20,
  border: 'none',
  background: ativo ? 'linear-gradient(135deg, #C8A24A, #e2be64)' : '#f0e8fa',
  color: ativo ? '#fff' : '#2c163a',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "'Cinzel', serif",
  cursor: 'pointer',
});

const cardAg = {
  background: '#fff',
  border: '1.5px solid #e2d2f5',
  borderRadius: 12,
  padding: 16,
};

const vazio = {
  textAlign: 'center',
  padding: 40,
  color: '#888',
  background: '#fff',
  borderRadius: 12,
  border: '1px dashed #ddd',
};

const btnOk = {
  background: '#16a34a',
  color: '#fff',
  border: 'none',
  padding: '8px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const btnFaltou = {
  background: '#f97316',
  color: '#fff',
  border: 'none',
  padding: '8px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const btnReagendar = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '8px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const btnContato = {
  background: '#0891b2',
  color: '#fff',
  border: 'none',
  padding: '8px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const btnDanger = {
  background: '#c62828',
  color: '#fff',
  border: 'none',
  padding: '8px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const badgeOk = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#f0fdf4',
  color: '#16a34a',
  border: '1px solid #86efac',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
};

const badgeWarn = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#fff8e1',
  color: '#92400e',
  border: '1px solid #fcd34d',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
};

const badgeAguardando = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#fff8e1',
  color: '#92400e',
  border: '1px solid #fcd34d',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
};

const badgeFaltou = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#fff7ed',
  color: '#c2410c',
  border: '1px solid #fdba74',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
};

const badgeAviso = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#ecfeff',
  color: '#0891b2',
  border: '1px solid #67e8f9',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
};