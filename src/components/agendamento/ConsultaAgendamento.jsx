// src/components/agendamento/ConsultaAgendamento.jsx
import React, { useState } from 'react';
import {
  collection, query, where, getDocs, doc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatPhoneNumberIntl } from 'react-phone-number-input';
import {
  MdSearch, MdWarning, MdCheckCircle, MdCancel, MdHourglassEmpty,
  MdCalendarMonth, MdPhone, MdBadge, MdPerson, MdInfoOutline, MdRefresh,
  MdDelete, MdEmail, MdContentCopy, MdCheck, MdClose,
} from 'react-icons/md';
import { AbasPublicas, EstilosTAP, BotaoWhatsApp, Rodape } from './TelaAgendamentoPublico';

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
   Botão copiar (reutilizável) + Toast
   ============================================================ */
function BotaoCopiar({ valor, rotulo, onCopiado }) {
  const [copiado, setCopiado] = useState(false);

  const handleCopiar = async () => {
    const texto = String(valor || '');
    if (!texto) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
      } else {
        // Fallback pra navegadores antigos / http
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
      onCopiado?.(rotulo);
      setTimeout(() => setCopiado(false), 1800);
    } catch (e) {
      console.warn('Falha ao copiar:', e);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopiar}
      title={copiado ? 'Copiado!' : `Copiar ${rotulo}`}
      aria-label={copiado ? 'Copiado' : `Copiar ${rotulo}`}
      style={{
        background: copiado ? '#f0fdf4' : '#faf5ff',
        border: copiado
          ? '1.5px solid #86efac'
          : '1.5px solid #d8b4fe',
        color: copiado ? '#166534' : '#7e22ce',
        width: 30,
        height: 30,
        borderRadius: 8,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        flexShrink: 0,
        transition: 'all 0.18s ease',
        marginLeft: 6,
      }}
      onMouseEnter={(e) => {
        if (!copiado) {
          e.currentTarget.style.background = '#f3e8ff';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!copiado) {
          e.currentTarget.style.background = '#faf5ff';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {copiado ? <MdCheck size={15} /> : <MdContentCopy size={14} />}
    </button>
  );
}

function Toast({ mensagem, onFechar }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 90,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
        color: '#fff',
        padding: '10px 18px',
        borderRadius: 22,
        boxShadow: '0 8px 22px rgba(126, 34, 206, 0.45)',
        fontFamily: "'Cinzel', serif",
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: '0.4px',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        animation: 'toastIn 0.22s ease',
        maxWidth: '90vw',
      }}
    >
      <MdCheck size={16} />
      <span style={{ flex: 1 }}>{mensagem}</span>
      <button
        type="button"
        onClick={onFechar}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          padding: 0,
          opacity: 0.75,
          display: 'flex',
        }}
        aria-label="Fechar aviso"
      >
        <MdClose size={14} />
      </button>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to   { opacity: 1; transform: translate(-50%, 0);    }
        }
      `}</style>
    </div>
  );
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
  const [toast, setToast] = useState('');

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
      const docLimpo = documento.trim();
      const snap = await getDocs(
        query(
          collection(db, 'agendamentos'),
          where('documento', '==', docLimpo)
        )
      );

      const alvoNome = normalizarNome(nome);
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => normalizarNome(a.nome) === alvoNome)
        .sort((a, b) => {
          const ka = `${a.data} ${a.horaInicio}`;
          const kb = `${b.data} ${b.horaInicio}`;
          return kb.localeCompare(ka);
        });

      setResultados(lista);
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
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        nome: ag.nome,
        documento: ag.documento,
        status: 'cancelado',
        canceladoPor: 'paciente',
        atualizadoEm: new Date().toISOString(),
      });
      setResultados((prev) =>
        prev.map((a) =>
          a.id === ag.id
            ? { ...a, status: 'cancelado', canceladoPor: 'paciente' }
            : a
        )
      );
      setConfirmacao(null);
      setToast('Agendamento cancelado com sucesso');
      setTimeout(() => setToast(''), 2600);
    } catch (e) {
      console.error('Erro ao cancelar:', e);
      setErro('Não foi possível cancelar. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  const remover = async () => {
    if (!confirmacao || confirmacao.acao !== 'remover') return;
    const ag = confirmacao.ag;
    setProcessando(true);
    try {
      await deleteDoc(doc(db, 'agendamentos', ag.id));
      setResultados((prev) => prev.filter((a) => a.id !== ag.id));
      setConfirmacao(null);
      setToast('Removido da lista');
      setTimeout(() => setToast(''), 2200);
    } catch (e) {
      console.error('Erro ao remover:', e);
      setErro('Não foi possível remover. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <>
      <TelaSemInternet />

      <div className="tap-tela">
        <div className="tap-conteudo" style={{ maxWidth: 720 }}>
          {onVoltar && (
            <button
              type="button"
              onClick={onVoltar}
              className="btn-voltar-lista tap-target"
              style={{
                fontFamily: "'Cinzel', serif",
                background:
                  'linear-gradient(135deg, rgba(200, 162, 74, 0.12) 0%, rgba(168, 85, 247, 0.10) 100%)',
                color: '#2c163a',
                border: '1.5px solid #C8A24A',
                padding: '10px 20px',
                borderRadius: '25px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                boxShadow: '0 3px 10px rgba(200, 162, 74, 0.15)',
                backdropFilter: 'blur(6px)',
                minHeight: 40,
              }}
            >
              Voltar
            </button>
          )}

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

            <button
              type="button"
              onClick={buscar}
              disabled={buscando}
              className="tap-btn-confirmar tap-target"
              style={{ marginTop: 12 }}
            >
              <MdSearch size={16} style={{ marginRight: 6 }} />
              {buscando ? 'CONSULTANDO…' : 'CONSULTAR'}
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
                          {/* Data + hora */}
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

                          {/* Status */}
                          <div style={{ marginBottom: 10 }}>
                            <BadgeStatus status={ag.status} />
                          </div>

                          {/* Nome */}
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

                          {/* Documento */}
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
                              <BotaoCopiar
                                valor={ag.documento}
                                rotulo="documento"
                                onCopiado={() => {
                                  setToast('Documento copiado');
                                  setTimeout(() => setToast(''), 2000);
                                }}
                              />
                            </div>
                          )}

                          {/* Telefone */}
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
                              <BotaoCopiar
                                valor={ag.telefone}
                                rotulo="telefone"
                                onCopiado={() => {
                                  setToast('Telefone copiado');
                                  setTimeout(() => setToast(''), 2000);
                                }}
                              />
                            </div>
                          )}

                          {/* E-mail */}
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
                              <BotaoCopiar
                                valor={ag.email}
                                rotulo="e-mail"
                                onCopiado={() => {
                                  setToast('E-mail copiado');
                                  setTimeout(() => setToast(''), 2000);
                                }}
                              />
                            </div>
                          )}

                          {/* Observações */}
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

                          {/* Feedback de cancelamento */}
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
                              Cancelado por{' '}
                              {ag.canceladoPor === 'paciente'
                                ? 'você'
                                : 'você (equipe)'}
                              .
                            </div>
                          )}

                          {/* Ações */}
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

      {/* ===== Modais de confirmação ===== */}
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

      {/* Toast global */}
      {toast && <Toast mensagem={toast} onFechar={() => setToast('')} />}
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

function normalizarNome(str) {
  return (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/* ============================================================
   Estilos auxiliares
   ============================================================ */
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