// src/components/agendamento/ConsultaAgendamento.jsx
import React, { useState } from 'react';
import {
  collection, query, where, getDocs, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatarTelefone } from '../../utils/agenda';
import {
  MdSearch, MdWarning, MdCheckCircle, MdCancel,
  MdCalendarMonth, MdPhone, MdArrowBack, MdBadge,
} from 'react-icons/md';

const STATUS_LABEL = {
  pendente: { texto: 'Aguardando confirmação', cor: '#92400e', bg: '#fff8e1', bd: '#fcd34d' },
  confirmado: { texto: 'Confirmado', cor: '#166534', bg: '#f0fdf4', bd: '#86efac' },
  cancelado: { texto: 'Cancelado', cor: '#c62828', bg: '#fde8e8', bd: '#f98080' },
  concluido: { texto: 'Concluído', cor: '#555', bg: '#f0f0f0', bd: '#ddd' },
};

export default function ConsultaAgendamento({ onVoltar }) {
  const [codigo, setCodigo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [agendamento, setAgendamento] = useState(null);
  const [erro, setErro] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);

  const buscar = async () => {
    setErro('');
    setAgendamento(null);

    const cod = codigo.trim().toUpperCase();
    if (!cod) {
      setErro('Digite o código que você recebeu.');
      return;
    }

    setBuscando(true);
    try {
      const q = query(
        collection(db, 'agendamentos'),
        where('codigoAutenticidade', '==', cod)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setErro('Nenhum agendamento encontrado com este código. Confira se digitou certinho.');
      } else {
        const docSnap = snap.docs[0];
        setAgendamento({ id: docSnap.id, ...docSnap.data() });
      }
    } catch (e) {
      console.error('Erro ao buscar agendamento:', e);
      setErro('Erro ao buscar. Tente novamente em alguns segundos.');
    } finally {
      setBuscando(false);
    }
  };

  const cancelar = async () => {
    if (!agendamento) return;
    setCancelando(true);
    try {
      await updateDoc(doc(db, 'agendamentos', agendamento.id), {
        status: 'cancelado',
        canceladoPor: 'paciente',
        atualizadoEm: new Date().toISOString(),
      });
      setAgendamento({ ...agendamento, status: 'cancelado', canceladoPor: 'paciente' });
      setConfirmarCancelamento(false);
    } catch (e) {
      console.error('Erro ao cancelar:', e);
      setErro('Erro ao cancelar. Tente novamente.');
    } finally {
      setCancelando(false);
    }
  };

  return (
    <div style={tela}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            className="btn-voltar-lista"
            style={btnVoltar}
          >
            <MdArrowBack size={15} color="#C8A24A" />
            Voltar pro agendamento
          </button>
        )}

        <div style={card}>
          <h2 style={{
            fontFamily: "'Cinzel', serif",
            color: '#2c163a',
            margin: '0 0 8px 0',
            textAlign: 'center',
          }}>
            Consultar meu agendamento
          </h2>
          <p style={{
            fontSize: 12,
            color: '#666',
            textAlign: 'center',
            marginBottom: 22,
          }}>
            Digite o código que você recebeu ao agendar.
          </p>

          {/* Input + botão */}
          <div style={{
            display: 'flex',
            gap: 8,
            marginBottom: 12,
          }}>
            <input
              type="text"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value.toUpperCase());
                setErro('');
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
              placeholder="Ex: AG-6M5D-WP4D"
              style={{
                flex: 1,
                padding: '12px 14px',
                border: '1.5px solid #d8b4fe',
                borderRadius: 10,
                fontSize: 14,
                fontFamily: 'monospace',
                letterSpacing: 1,
                fontWeight: 700,
                color: '#2c163a',
                background: '#faf5ff',
                outline: 'none',
                textTransform: 'uppercase',
              }}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={buscar}
              disabled={buscando}
              style={{
                fontFamily: "'Cinzel', serif",
                background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                color: '#fff',
                border: '1.5px solid #9c7826',
                padding: '12px 20px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: buscando ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: buscando ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              <MdSearch size={16} />
              {buscando ? 'Buscando…' : 'Buscar'}
            </button>
          </div>

          {/* Erro */}
          {erro && (
            <div style={{
              background: '#fde8e8',
              border: '1px solid #f98080',
              color: '#c81e1e',
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <MdWarning size={16} />
              {erro}
            </div>
          )}

          {/* Resultado */}
          {agendamento && (() => {
            const st = STATUS_LABEL[agendamento.status] || STATUS_LABEL.pendente;
            const podeCancelar =
              (agendamento.status === 'pendente' || agendamento.status === 'confirmado') &&
              !agendamento.canceladoPor;

            return (
              <div style={{ marginTop: 22 }}>
                <div style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: 12,
                  padding: '12px 14px',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#166534',
                  fontWeight: 600,
                }}>
                  <MdCheckCircle size={18} />
                  Agendamento encontrado!
                </div>

                <div style={{
                  background: '#faf5ff',
                  border: '1.5px solid #d8b4fe',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 14,
                }}>
                  {/* Status */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: st.bg,
                    color: st.cor,
                    border: `1px solid ${st.bd}`,
                    padding: '4px 12px',
                    borderRadius: 14,
                    fontSize: 11,
                    fontWeight: 700,
                    marginBottom: 12,
                  }}>
                    {st.texto}
                  </div>

                  {/* Nome */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={labelMini}>Paciente</div>
                    <div style={valorMini}>{agendamento.nome}</div>
                  </div>

                  {/* Data e hora */}
                  <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MdCalendarMonth size={16} color="#C8A24A" />
                    <div>
                      <div style={labelMini}>Data e horário</div>
                      <div style={valorMini}>
                        {formatarDataLonga(agendamento.data)} às {agendamento.horaInicio}
                      </div>
                    </div>
                  </div>

                  {/* Documento */}
                  {agendamento.documento && (
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MdBadge size={16} color="#C8A24A" />
                      <div>
                        <div style={labelMini}>Documento</div>
                        <div style={valorMini}>{agendamento.documento}</div>
                      </div>
                    </div>
                  )}

                  {/* Telefone */}
                  {agendamento.telefone && (
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MdPhone size={16} color="#C8A24A" />
                      <div>
                        <div style={labelMini}>Telefone</div>
                        <div style={valorMini}>{formatarTelefone(agendamento.telefone)}</div>
                      </div>
                    </div>
                  )}

                  {/* Observações */}
                  {agendamento.observacoes && (
                    <div style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px dashed #e2d2f5',
                      fontSize: 11,
                      color: '#7e22ce',
                      fontStyle: 'italic',
                    }}>
                      "{agendamento.observacoes}"
                    </div>
                  )}
                </div>

                {/* Botão cancelar */}
                {podeCancelar && !confirmarCancelamento && (
                  <button
                    type="button"
                    onClick={() => setConfirmarCancelamento(true)}
                    style={{
                      width: '100%',
                      fontFamily: "'Cinzel', serif",
                      background: '#ffebee',
                      color: '#c62828',
                      border: '1.5px solid #ef9a9a',
                      padding: '12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <MdCancel size={16} />
                    Cancelar este agendamento
                  </button>
                )}

                {/* Confirmação */}
                {confirmarCancelamento && (
                  <div style={{
                    background: '#fde8e8',
                    border: '1.5px solid #f98080',
                    borderRadius: 12,
                    padding: 14,
                  }}>
                    <div style={{
                      fontSize: 12,
                      color: '#c81e1e',
                      fontWeight: 700,
                      marginBottom: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <MdWarning size={16} />
                      Tem certeza que deseja cancelar?
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setConfirmarCancelamento(false)}
                        disabled={cancelando}
                        style={{
                          flex: 1,
                          background: '#f0f0f0',
                          color: '#333',
                          border: 'none',
                          padding: '10px',
                          borderRadius: 16,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: cancelando ? 'wait' : 'pointer',
                          fontFamily: "'Cinzel', serif",
                        }}
                      >
                        Não, voltar
                      </button>
                      <button
                        type="button"
                        onClick={cancelar}
                        disabled={cancelando}
                        style={{
                          flex: 1,
                          background: '#c62828',
                          color: '#fff',
                          border: 'none',
                          padding: '10px',
                          borderRadius: 16,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: cancelando ? 'wait' : 'pointer',
                          fontFamily: "'Cinzel', serif",
                          opacity: cancelando ? 0.7 : 1,
                        }}
                      >
                        {cancelando ? 'Cancelando…' : 'Sim, cancelar'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Feedback se já cancelado */}
                {agendamento.status === 'cancelado' && (
                  <div style={{
                    background: '#fde8e8',
                    border: '1px solid #f98080',
                    color: '#c81e1e',
                    padding: '12px 14px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: 'center',
                  }}>
                    Este agendamento foi cancelado
                    {agendamento.canceladoPor === 'paciente' ? ' por você.' : ' pela profissional.'}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      <style>{`
        .btn-voltar-lista {
          transition: all 0.25s ease-in-out !important;
        }
        .btn-voltar-lista:hover {
          transform: translateX(-3px);
          background: linear-gradient(135deg, rgba(200, 162, 74, 0.22) 0%, rgba(168, 85, 247, 0.18) 100%) !important;
          box-shadow: 0 6px 18px rgba(200, 162, 74, 0.35) !important;
          border-color: #a8852f !important;
        }
        .btn-voltar-lista:active {
          transform: translateX(-1px) scale(0.98);
        }
      `}</style>
    </div>
  );
}

/* ============ Helpers ============ */
function formatarDataLonga(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  const d = new Date(iso + 'T12:00:00');
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return `${dias[d.getDay()]}, ${dia}/${mes}/${ano}`;
}

/* ============ Estilos ============ */
const tela = {
  minHeight: '100vh',
  background: '#f3eef8',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  padding: '30px 16px',
  fontFamily: "'Montserrat', sans-serif",
};

const card = {
  background: '#fff',
  borderRadius: 20,
  border: '1.5px solid #C8A24A',
  padding: 28,
  width: '100%',
  boxShadow: '0 15px 40px rgba(44,22,58,0.15)',
};

const btnVoltar = {
  fontFamily: "'Cinzel', serif",
  background: 'linear-gradient(135deg, rgba(200, 162, 74, 0.12) 0%, rgba(168, 85, 247, 0.10) 100%)',
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
};

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
};