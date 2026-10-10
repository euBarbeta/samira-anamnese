// src/components/agendamento/ConsultaAgendamento.jsx
import React, { useState } from 'react';


import { formatPhoneNumberIntl } from 'react-phone-number-input';
import {
  MdSearch, MdWarning, MdCheckCircle, MdCancel, MdHourglassEmpty,
  MdCalendarMonth, MdPhone, MdBadge, MdPerson, MdInfoOutline, MdRefresh,
  MdDelete, MdEmail,
} from 'react-icons/md';
import { AbasPublicas, EstilosTAP, BotaoWhatsApp, Rodape } from './TelaAgendamentoPublico';
import ModalAgendarParaPaciente from './ModalAgendarParaPaciente';
import TelaSemInternet from '../TelaSemInternet';

/* ============================================================
   Mapa visual dos status
   ============================================================ */
const STATUS_CFG = {
  pendente: {
    texto: 'Aguardando confirmação',
    cor: '#92400e',
    bg: '#fff8e1',
    bd: '#fcd34d',
    Icone: MdHourglassEmpty,
  },
  confirmado: {
    texto: 'Confirmado pela profissional',
    cor: '#166534',
    bg: '#f0fdf4',
    bd: '#86efac',
    Icone: MdCheckCircle,
  },
  cancelado: {
    texto: 'Cancelado',
    cor: '#991b1b',
    bg: '#fef2f2',
    bd: '#fca5a5',
    Icone: MdCancel,
  },
  concluido: {
    texto: 'Concluído',
    cor: '#374151',
    bg: '#f3f4f6',
    bd: '#d1d5db',
    Icone: MdCheckCircle,
  },
  faltou: {
    texto: 'Paciente não compareceu',
    cor: '#c2410c',
    bg: '#fff7ed',
    bd: '#fdba74',
    Icone: MdWarning,
  },
  reagendado: {
    texto: 'Reagendado',
    cor: '#7e22ce',
    bg: '#faf5ff',
    bd: '#d8b4fe',
    Icone: MdRefresh,
  },
};

/* ============================================================
   Formatação de telefone correta por país (libphonenumber-js)
   ============================================================ */
function formatarTelefoneBonito(tel) {
  if (!tel) return '—';
  try {
    const f = formatPhoneNumberIntl(String(tel));
    return f || String(tel);
  } catch {
    return String(tel);
  }
}

/* ============================================================
   Modal de confirmação (estética do sistema)
   ============================================================ */
function ModalConfirmacao({
  titulo,
  mensagem,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  corBotaoConfirmar = 'vermelho',
  carregando = false,
  onConfirmar,
  onFechar,
}) {
  const fundoConfirmar =
    corBotaoConfirmar === 'vermelho'
      ? 'linear-gradient(135deg, #c62828 0%, #e53935 100%)'
      : 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)';

  return (
    <div
      onClick={carregando ? undefined : onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '26px 22px 22px 22px',
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 20px 60px rgba(44, 22, 58, 0.4)',
          border: '1.5px solid #e2d2f5',
          textAlign: 'center',
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        <h3
          style={{
            fontFamily: "'Cinzel', serif",
            color: '#2c163a',
            fontSize: 16,
            margin: '0 0 10px 0',
          }}
        >
          {titulo}
        </h3>
        <p
          style={{
            fontSize: 13,
            color: '#2c163a',
            margin: '0 0 18px 0',
            lineHeight: 1.6,
            whiteSpace: 'pre-line',
          }}
        >
          {mensagem}
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
            {textoCancelar.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={carregando}
            style={{
              flex: 1,
              background: fundoConfirmar,
              color: '#fff',
              border: 'none',
              padding: '12px 16px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: carregando ? 'wait' : 'pointer',
              fontFamily: "'Cinzel', serif",
              opacity: carregando ? 0.7 : 1,
              minHeight: 44,
            }}
          >
            {carregando ? 'AGUARDE…' : textoConfirmar.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Badge de status
   ============================================================ */
function BadgeStatus({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pendente;
  const { cor, bg, bd, Icone, texto } = cfg;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: bg,
        border: `1.5px solid ${bd}`,
        color: cor,
        padding: '5px 10px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.2px',
        fontFamily: "'Cinzel', serif",
      }}
    >
      <Icone size={14} />
      {texto}
    </span>
  );
}

/* ============================================================
   Componente principal
   ============================================================ */
export default function ConsultaAgendamento({ onVoltar }) {
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState(null);
  const [erro, setErro] = useState('');
  const [confirmacao, setConfirmacao] = useState(null);
  const [processando, setProcessando] = useState(false);

  // ✅ Novo: controla o modal de reagendamento
  const [agendamentoParaReagendar, setAgendamentoParaReagendar] = useState(null);
const buscar = async () => {
  setErro('');
  setResultados(null);

  if (!nome.trim() || nome.trim().split(/\s+/).length < 2) {
    setErro('Informe seu nome completo (nome e sobrenome).');
    return;
  }
  if (!documento.trim() || documento.trim().length < 5) {
    setErro('Informe o mesmo documento usado no agendamento.');
    return;
  }

  setBuscando(true);
  try {
    // 🔒 Busca via Netlify Function (o Firestore agora bloqueia leitura pública)
    const res = await fetch('/.netlify/functions/consultar-agendamento-publico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: nome.trim(),
        documento: documento.trim(),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha na consulta');
    }

    const data = await res.json();
    setResultados(data.agendamentos || []);
  } catch (e) {
    console.error('Erro ao consultar:', e);
    setErro('Não foi possível consultar agora. Tente novamente.');
  } finally {
    setBuscando(false);
  }
};

const cancelar = async () => {
  if (!confirmacao || confirmacao.acao !== 'cancelar') return;
  const ag = confirmacao.ag;
  setProcessando(true);
  try {
    // 🔒 Chama a Function (valida nome+doc no servidor)
    const res = await fetch('/.netlify/functions/cancelar-agendamento-publico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agendamentoId: ag.id,
        nome: ag.nome,
        documento: ag.documento,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao cancelar');
    }

    // Atualiza localmente (feedback otimista)
    setResultados((prev) =>
      prev.map((a) =>
        a.id === ag.id
          ? { ...a, status: 'cancelado', canceladoPor: 'paciente' }
          : a
      )
    );
    setConfirmacao(null);
  } catch (e) {
    console.error('Erro ao cancelar:', e);
    setErro(e.message || 'Não foi possível cancelar. Tente novamente.');
  } finally {
    setProcessando(false);
  }
};

const remover = async () => {
  if (!confirmacao || confirmacao.acao !== 'remover') return;
  const ag = confirmacao.ag;
  setProcessando(true);
  try {
    // 🔒 Chama a Function (valida nome+doc no servidor)
    const res = await fetch('/.netlify/functions/remover-agendamento-publico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agendamentoId: ag.id,
        nome: ag.nome,
        documento: ag.documento,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao remover');
    }

    setResultados((prev) => prev.filter((a) => a.id !== ag.id));
    setConfirmacao(null);
  } catch (e) {
    console.error('Erro ao remover:', e);
    setErro(e.message || 'Não foi possível remover. Tente novamente.');
  } finally {
    setProcessando(false);
  }
};
  return (
    <>
      <TelaSemInternet />

      <div className="tap-tela">
        <div className="tap-conteudo" style={{ maxWidth: 720 }}>
          
          <AbasPublicas abaAtiva="consultar" />

          <div className="tap-card">
            <h2
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#2c163a',
                margin: '0 0 8px 0',
                textAlign: 'center',
                fontSize: 22,
              }}
            >
              Consultar agendamento
            </h2>
            <p
              style={{
                fontSize: 12,
                color: '#666',
                textAlign: 'center',
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              Informe o <strong>nome completo</strong> e o{' '}
              <strong>documento</strong> usados ao agendar.
            </p>

            {/* Nome */}
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#2c163a',
                  marginBottom: 4,
                  letterSpacing: '0.2px',
                }}
              >
                Nome completo *
              </label>
              <div style={{ position: 'relative' }}>
                <MdPerson
                  size={18}
                  color="#a855f7"
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    setErro('');
                  }}
                  className="tap-input"
                  style={{ paddingLeft: 38 }}
                  placeholder="Como você informou ao agendar"
                  autoComplete="name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') buscar();
                  }}
                />
              </div>
            </div>

            {/* Documento */}
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#2c163a',
                  marginBottom: 4,
                  letterSpacing: '0.2px',
                }}
              >
                Documento * (CPF, RG, passaporte, ID…)
              </label>
              <div style={{ position: 'relative' }}>
                <MdBadge
                  size={18}
                  color="#a855f7"
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  value={documento}
                  onChange={(e) => {
                    setDocumento(e.target.value);
                    setErro('');
                  }}
                  className="tap-input"
                  style={{ paddingLeft: 38 }}
                  placeholder="O mesmo informado no agendamento"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') buscar();
                  }}
                />
              </div>
            </div>

            {erro && <div className="tap-erro">{erro}</div>}

            {/* ✅ Botão CONSULTAR com spinner INLINE */}
            <button
              type="button"
              onClick={buscar}
              disabled={buscando}
              className="tap-btn-confirmar tap-target"
              style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {buscando ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 15,
                      height: 15,
                      border: '2.5px solid rgba(255, 255, 255, 0.35)',
                      borderTopColor: '#ffffff',
                      borderRadius: '50%',
                      animation: 'girarSalvar 0.7s linear infinite',
                      flexShrink: 0,
                    }}
                  />
                  CONSULTANDO…
                </>
              ) : (
                <>
                  <MdSearch size={16} />
                  CONSULTAR
                </>
              )}
            </button>

            {/* ===== Resultados ===== */}
            {resultados !== null && (
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: '1px dashed #e2d2f5',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: 13,
                      color: '#2c163a',
                      margin: 0,
                    }}
                  >
                    {resultados.length === 0
                      ? 'Nenhum agendamento encontrado'
                      : `${resultados.length} agendamento${
                          resultados.length > 1 ? 's' : ''
                        }`}
                  </h3>
                  {resultados.length > 0 && (
                    <button
                      type="button"
                      onClick={buscar}
                      className="tap-btn-trocar-dia tap-target"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <MdRefresh size={12} />
                      Atualizar
                    </button>
                  )}
                </div>

                {resultados.length === 0 ? (
                  <div className="tap-hint-dia" style={{ textAlign: 'left' }}>
                    <MdInfoOutline
                      size={16}
                      color="#7e22ce"
                      style={{ verticalAlign: 'middle', marginRight: 6 }}
                    />
                    Não encontramos agendamento com esse <strong>nome</strong> e{' '}
                    <strong>documento</strong>. Confira se digitou igual ao que
                    usou ao agendar — maiúsculas/minúsculas não importam, mas o
                    documento precisa ser exatamente o mesmo.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {resultados.map((ag) => {
                      const podeCancelar =
                        (ag.status === 'pendente' ||
                          ag.status === 'confirmado') &&
                        !ag.canceladoPor;
                      const podeRemover = ag.status === 'cancelado';
                      const podeReagendar =
                        ag.status === 'faltou' || ag.status === 'cancelado';

                      return (
                        <div
                          key={ag.id}
                          style={{
                            background: '#faf5ff',
                            border: '1.5px solid #d8b4fe',
                            borderRadius: 14,
                            padding: 14,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              marginBottom: 10,
                              fontFamily: "'Cinzel', serif",
                              color: '#2c163a',
                              fontSize: 14,
                              fontWeight: 700,
                              lineHeight: 1.3,
                            }}
                          >
                            <MdCalendarMonth
                              size={18}
                              color="#C8A24A"
                              style={{ flexShrink: 0 }}
                            />
                            {formatarDataLonga(ag.data)} às {ag.horaInicio}
                          </div>

                          <div style={{ marginBottom: 10 }}>
                            <BadgeStatus status={ag.status} />
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              marginBottom: 8,
                            }}
                          >
                            <MdPerson size={15} color="#7e22ce" />
                            <div style={{ minWidth: 0 }}>
                              <div style={labelMini}>Paciente</div>
                              <div style={valorMini}>{ag.nome}</div>
                            </div>
                          </div>

                          {ag.documento && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 8,
                              }}
                            >
                              <MdBadge size={15} color="#7e22ce" />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={labelMini}>Documento</div>
                                <div style={valorMini}>{ag.documento}</div>
                              </div>
                            </div>
                          )}

                          {ag.telefone && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 8,
                              }}
                            >
                              <MdPhone size={15} color="#7e22ce" />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={labelMini}>Telefone</div>
                                <div style={valorMini}>
                                  {formatarTelefoneBonito(ag.telefone)}
                                </div>
                              </div>
                            </div>
                          )}

                          {ag.email && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 8,
                              }}
                            >
                              <MdEmail size={15} color="#7e22ce" />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={labelMini}>E-mail</div>
                                <div
                                  style={{
                                    ...valorMini,
                                    wordBreak: 'break-all',
                                  }}
                                >
                                  {ag.email}
                                </div>
                              </div>
                            </div>
                          )}

                          {ag.observacoes && (
                            <div
                              style={{
                                marginTop: 10,
                                paddingTop: 10,
                                borderTop: '1px dashed #e2d2f5',
                                fontSize: 11.5,
                                color: '#7e22ce',
                                fontStyle: 'italic',
                                lineHeight: 1.5,
                              }}
                            >
                              "{ag.observacoes}"
                            </div>
                          )}

                       {ag.status === 'cancelado' && (
  <div
    style={{
      marginTop: 10,
      background: '#fef2f2',
      border: '1px solid #fca5a5',
      color: '#991b1b',
      padding: '8px 10px',
      borderRadius: 10,
      fontSize: 11,
      fontWeight: 600,
    }}
  >
    {ag.canceladoPor === 'paciente'
      ? '❌ Você cancelou este agendamento.'
      : '❌ Este agendamento foi cancelado pela profissional.'}
  </div>
)}

                          {/* ✅ REAGENDAR — faltou OU cancelado */}
                          {podeReagendar && (
                            <button
                              type="button"
                              onClick={() => setAgendamentoParaReagendar(ag)}
                              style={{
                                marginTop: 12,
                                width: '100%',
                                background:
                                  'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 14px',
                                borderRadius: 16,
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily: "'Cinzel', serif",
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                minHeight: 42,
                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                              }}
                            >
                              <MdRefresh size={14} />
                              Reagendar horário
                            </button>
                          )}

                          {podeCancelar && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmacao({ ag, acao: 'cancelar' })
                              }
                              style={{
                                marginTop: 12,
                                width: '100%',
                                background: '#ffebee',
                                color: '#c62828',
                                border: '1.5px solid #ef9a9a',
                                padding: '10px 14px',
                                borderRadius: 16,
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily: "'Cinzel', serif",
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                minHeight: 42,
                              }}
                            >
                              <MdCancel size={14} />
                              Cancelar este agendamento
                            </button>
                          )}

                          {podeRemover && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmacao({ ag, acao: 'remover' })
                              }
                              style={{
                                marginTop: 12,
                                width: '100%',
                                background: '#f5f5f5',
                                color: '#555',
                                border: '1.5px solid #ddd',
                                padding: '10px 14px',
                                borderRadius: 16,
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontFamily: "'Cinzel', serif",
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                minHeight: 42,
                              }}
                            >
                              <MdDelete size={14} />
                              Remover da lista
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <Rodape />
        </div>

        <BotaoWhatsApp />
        <EstilosTAP />
      </div>

      {confirmacao && confirmacao.acao === 'cancelar' && (
        <ModalConfirmacao
          titulo="Cancelar agendamento?"
          mensagem={`Tem certeza que deseja cancelar o agendamento de ${formatarDataLonga(
            confirmacao.ag.data
          )} às ${confirmacao.ag.horaInicio}?`}
          textoConfirmar="Sim, cancelar"
          textoCancelar="Voltar"
          corBotaoConfirmar="vermelho"
          carregando={processando}
          onConfirmar={cancelar}
          onFechar={() => setConfirmacao(null)}
        />
      )}

      {confirmacao && confirmacao.acao === 'remover' && (
        <ModalConfirmacao
          titulo="Remover da lista?"
          mensagem={`Remover o agendamento de ${formatarDataLonga(
            confirmacao.ag.data
          )} às ${confirmacao.ag.horaInicio} da lista?\n\nEle já está cancelado — isso só limpa a visualização.`}
          textoConfirmar="Sim, remover"
          textoCancelar="Voltar"
          corBotaoConfirmar="dourado"
          carregando={processando}
          onConfirmar={remover}
          onFechar={() => setConfirmacao(null)}
        />
      )}

      {/* ✅ Modal de reagendamento — mesmo do painel da esteta */}
      {agendamentoParaReagendar && (
        <ModalAgendarParaPaciente
          paciente={{
            id: agendamentoParaReagendar.pacienteId || null,
            nome: agendamentoParaReagendar.nome,
            documento: agendamentoParaReagendar.documento,
            telefone: agendamentoParaReagendar.telefone,
            email: agendamentoParaReagendar.email,
            emailAcesso: agendamentoParaReagendar.email,
            consentimentoLGPD: agendamentoParaReagendar.consentimentoLGPD,
          }}
          uidEsteticista={agendamentoParaReagendar.uidEsteticista}
          origem="paciente"
          onFechar={() => setAgendamentoParaReagendar(null)}
         onSucesso={async (novoAg) => {
  const antigo = agendamentoParaReagendar;
  setAgendamentoParaReagendar(null);

  if (antigo) {
    try {
      // 🔒 Chama Function (valida nome+doc e marca como reagendado)
      const res = await fetch(
        '/.netlify/functions/marcar-agendamento-reagendado',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agendamentoId: antigo.id,
            novoAgendamentoId: novoAg.id,
            nome: antigo.nome,
            documento: antigo.documento,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('Falha ao marcar reagendamento:', err);
      }
    } catch (e) {
      console.warn('Erro de rede ao marcar reagendamento:', e);
    }

    // Atualiza local pra sumir na hora
    setResultados((prev) =>
      prev.map((a) =>
        a.id === antigo.id ? { ...a, status: 'reagendado' } : a
      )
    );
  }
}}
        />
      )}
    </>
  );
}

/* ============================================================
   Helpers
   ============================================================ */
function formatarDataLonga(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  const d = new Date(iso + 'T12:00:00');
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return `${dias[d.getDay()]}, ${dia}/${mes}/${ano}`;
}



const labelMini = {
  fontSize: 10,
  fontWeight: 700,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  marginBottom: 2,
};

const valorMini = {
  fontSize: 13,
  fontWeight: 600,
  color: '#2c163a',
  wordBreak: 'break-word',
};