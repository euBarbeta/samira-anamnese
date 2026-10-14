// src/components/agendamento/ModalEditarSobra.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  MdClose, MdEventAvailable, MdLock, MdWarning, MdCheckCircle,
  MdAccessTime, MdPhone, MdBadge, MdEmail, MdChatBubbleOutline,
} from 'react-icons/md';

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

/**
 * Modal que permite à esteta LIBERAR ou BARRAR a sobra de um
 * agendamento confirmado. Se houver pacientes já agendados
 * dentro da sobra e ela quiser barrar, avisa que eles serão
 * cancelados.
 */
export default function ModalEditarSobra({
  agendamento,
  uidEsteticista,
  onFechar,
  onSucesso,
}) {
  const [agendamentosDoDia, setAgendamentosDoDia] = useState([]);
  const [config, setConfig] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [erro, setErro] = useState('');

  // Carrega agendamentos do dia
  useEffect(() => {
    if (!uidEsteticista || !agendamento?.data) return;
    const q = query(
      collection(db, 'agendamentos'),
      where('uidEsteticista', '==', uidEsteticista),
      where('data', '==', agendamento.data)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAgendamentosDoDia(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    });
    return () => unsub();
  }, [uidEsteticista, agendamento?.data]);

  // Carrega config da agenda
  useEffect(() => {
    if (!uidEsteticista) return;
    import('firebase/firestore').then(({ doc: dRef, getDoc }) => {
      getDoc(dRef(db, `usuarios/${uidEsteticista}/agenda_config`, 'principal'))
        .then((snap) => {
          if (snap.exists()) setConfig(snap.data());
          setCarregando(false);
        })
        .catch(() => setCarregando(false));
    });
  }, [uidEsteticista]);

  // ============================================================
  // ✅ Calcula o intervalo da sobra
  //    Início = horaFim do atendimento
  //    Fim    = próximo agendamento do dia OU fim do bloco
  // ============================================================
  const infoSobra = useMemo(() => {
    if (!agendamento) return null;

    const fimAtendimento = agendamento.horaFim || agendamento.horaInicio;
    const fimAtMin = toMin(fimAtendimento);

    const bloco = acharBlocoDoDia(config, agendamento.data, agendamento.horaInicio);
    const fimBlocoMin = bloco ? toMin(bloco.fim) : fimAtMin + 60;

    // Encontra o próximo agendamento após o fim deste
    const proximo = agendamentosDoDia
      .filter((a) => a.id !== agendamento.id)
      .filter((a) => a.status === 'pendente' || a.status === 'confirmado')
      .map((a) => toMin(a.horaInicio))
      .filter((min) => min >= fimAtMin)
      .sort((a, b) => a - b)[0];

    const limiteFimMin = proximo != null ? Math.min(proximo, fimBlocoMin) : fimBlocoMin;

    const inicioSobra = toHHMM(fimAtMin);
    const fimSobra = toHHMM(limiteFimMin);
    const duracaoMin = limiteFimMin - fimAtMin;

    // Agendamentos que estão DENTRO dessa sobra
    const dentroDaSobra = agendamentosDoDia
      .filter((a) => a.id !== agendamento.id)
      .filter((a) => a.status === 'pendente' || a.status === 'confirmado')
      .filter((a) => {
        const iM = toMin(a.horaInicio);
        return iM >= fimAtMin && iM < limiteFimMin;
      });

    return {
      inicio: inicioSobra,
      fim: fimSobra,
      duracaoMin,
      dentroDaSobra,
    };
  }, [agendamento, config, agendamentosDoDia]);

  // ============================================================
  // ✅ Estado atual: a sobra está LIBERADA?
  // ============================================================
  const sobraLiberada = useMemo(() => {
    if (!agendamento?.liberacoesExtras) return false;
    if (!Array.isArray(agendamento.liberacoesExtras)) return false;
    return agendamento.liberacoesExtras.length > 0;
  }, [agendamento]);

  const executarSalvar = async (barrar) => {
    if (!uidEsteticista) return;
    setSalvando(true);
    setErro('');

    try {
      const { doc: dRef, updateDoc } = await import('firebase/firestore');

      // ============================================================
      // 1) Atualiza `liberacoesExtras` do agendamento
      // ============================================================
      const patch = barrar
        ? { liberacoesExtras: [], atualizadoEm: new Date().toISOString() }
        : {
            liberacoesExtras: [{
              inicio: infoSobra.inicio,
              fim: infoSobra.fim,
              duracaoMin: infoSobra.duracaoMin,
              criadoEm: new Date().toISOString(),
            }],
            atualizadoEm: new Date().toISOString(),
          };

      await updateDoc(dRef(db, 'agendamentos', agendamento.id), patch);

      // ============================================================
      // 2) Se está BARRANDO e tem gente na sobra, cancela cada um
      // ============================================================
      if (barrar && infoSobra.dentroDaSobra.length > 0) {
        for (const ag of infoSobra.dentroDaSobra) {
          try {
            await updateDoc(dRef(db, 'agendamentos', ag.id), {
              status: 'cancelado',
              canceladoPor: 'esteticista',
              canceladoPorEncaixe: true,
              canceladoEm: new Date().toISOString(),
              atualizadoEm: new Date().toISOString(),
            });

            // Sincroniza slot público do cancelado
            await fetch('/.netlify/functions/sincronizar-slot-publico', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ agendamentoId: ag.id }),
            });

            // Notifica o paciente
            if (ag.pacienteId) {
              fetch('/.netlify/functions/notificar-paciente-agendamento', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  pacienteId: ag.pacienteId,
                  tipoEvento: 'cancelado',
                  agendamento: ag,
                }),
              }).catch(() => {});
            }
          } catch (e) {
            console.warn('Falha ao cancelar agendamento da sobra:', ag.id, e);
          }
        }
      }

      // ============================================================
      // 3) Sincroniza o slot público do agendamento PRINCIPAL
      // ============================================================
      await fetch('/.netlify/functions/sincronizar-slot-publico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamentoId: agendamento.id }),
      });

      onSucesso?.();
    } catch (e) {
      console.error('Erro ao salvar sobra:', e);
      setErro('Erro ao salvar. Tente novamente.');
      setSalvando(false);
    }
  };

  const handleLiberar = () => {
    executarSalvar(false);
  };

  const handleBarrarClique = () => {
    if (infoSobra.dentroDaSobra.length > 0) {
      setMostrarConfirmacao(true);
    } else {
      executarSalvar(true);
    }
  };

  if (carregando || !infoSobra) {
    return (
      <div style={overlay}>
        <div style={card}>
          <div style={{ textAlign: 'center', padding: 30, color: '#666' }}>
            Carregando…
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // TELA DE CONFIRMAÇÃO — quando barra e tem gente na sobra
  // ============================================================
  if (mostrarConfirmacao) {
    const total = infoSobra.dentroDaSobra.length;
    return (
      <div style={overlay}>
        <div style={{ ...card, border: '1.5px solid #fca5a5' }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 14px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ffebee 0%, #fde8e8 100%)',
            border: '2px solid #ef9a9a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MdWarning size={32} color="#c62828" />
          </div>

          <h3 style={{
            fontFamily: "'Cinzel', serif",
            color: '#c62828',
            fontSize: 17, fontWeight: 700,
            margin: '0 0 10px 0',
            textAlign: 'center',
          }}>
            {total} paciente{total > 1 ? 's' : ''} neste horário
          </h3>

          <p style={{
            fontSize: 13, color: '#2c163a',
            margin: '0 0 16px 0',
            lineHeight: 1.6, textAlign: 'center',
          }}>
            Est{total > 1 ? 'es pacientes estão' : 'e paciente está'} agendado{total > 1 ? 's' : ''} dentro
            da sobra que você quer barrar.
            <br /><br />
            {total > 1 ? 'Eles serão' : 'Ele será'}{' '}
            <strong>cancelado{total > 1 ? 's' : ''}</strong> automaticamente.
            Use os dados abaixo para <strong>entrar em contato</strong> e reagendar.
          </p>

          {/* ✅ Lista de pacientes agendados na sobra — com dados completos */}
          <div style={{
            background: '#fff8e1',
            border: '1.5px solid #fcd34d',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 18,
            maxHeight: '40vh',
            overflowY: 'auto',
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#92400e',
              marginBottom: 8,
              letterSpacing: '0.3px',
              textTransform: 'uppercase',
            }}>
              Pacientes que serão cancelados
            </div>

            {infoSobra.dentroDaSobra.map((ag) => (
              <div
                key={ag.id}
                style={{
                  background: '#fff',
                  border: '1px solid #fcd34d',
                  borderRadius: 8,
                  padding: '10px 12px',
                  marginBottom: 8,
                  fontSize: 11.5,
                  color: '#2c163a',
                  lineHeight: 1.7,
                }}
              >
                {/* Nome */}
                <div style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#2c163a',
                  marginBottom: 4,
                }}>
                  {ag.nome}
                </div>

                {/* Horário */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: '#666',
                }}>
                  <MdAccessTime size={12} color="#666" />
                  <span>
                    <strong>{ag.horaInicio}</strong>
                    {ag.horaFim ? `–${ag.horaFim}` : ''}
                    {ag.servicoNome ? ` · ${ag.servicoNome}` : ''}
                  </span>
                </div>

                {/* Telefone */}
                {ag.telefone && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: '#666',
                    marginTop: 3,
                  }}>
                    <MdPhone size={12} color="#666" />
                    <strong>{ag.telefone}</strong>
                  </div>
                )}

                {/* Documento */}
                {ag.documento && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: '#666',
                    marginTop: 3,
                  }}>
                    <MdBadge size={12} color="#666" />
                    <strong>{ag.documento}</strong>
                  </div>
                )}

                {/* E-mail (só se for real, não o @sistema.local) */}
                {ag.email && !ag.email.endsWith('@sistema.local') && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: '#666',
                    marginTop: 3,
                  }}>
                    <MdEmail size={12} color="#666" style={{ flexShrink: 0 }} />
                    <strong style={{ wordBreak: 'break-all' }}>{ag.email}</strong>
                  </div>
                )}

                {/* Observações */}
                {ag.observacoes && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    fontSize: 10.5,
                    color: '#7e22ce',
                    marginTop: 5,
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                  }}>
                    <MdChatBubbleOutline size={12} color="#7e22ce" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{ag.observacoes}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {erro && (
            <div style={erroBox}>{erro}</div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setMostrarConfirmacao(false)}
              disabled={salvando}
              style={btnSecundario}
            >
              VOLTAR
            </button>
            <button
              type="button"
              onClick={() => executarSalvar(true)}
              disabled={salvando}
              style={btnPerigo}
            >
              {salvando ? 'CANCELANDO…' : 'CANCELAR E BARRAR'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // TELA PRINCIPAL — Liberar ou Barrar
  // ============================================================
  return (
    <div style={overlay} onClick={salvando ? undefined : onFechar}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 14,
        }}>
          <div>
            <h3 style={{
              fontFamily: "'Cinzel', serif",
              color: '#2c163a',
              fontSize: 16, margin: 0,
            }}>
              Editar sobra
            </h3>
            <span style={{ fontSize: 11, color: '#666' }}>
              {agendamento?.nome} — {formatarDataBR(agendamento?.data)} às {agendamento?.horaInicio}
            </span>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            style={{
              background: 'transparent', border: 'none',
              cursor: 'pointer', padding: 4,
            }}
            aria-label="Fechar"
          >
            <MdClose size={22} color="#2c163a" />
          </button>
        </div>

        {/* Card do intervalo */}
        <div style={{
          background: '#faf5ff',
          border: '1px solid #e2d2f5',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#7e22ce',
            textTransform: 'uppercase', letterSpacing: '0.3px',
            marginBottom: 6,
          }}>
            Intervalo disponível
          </div>
          <div style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 16, fontWeight: 700,
            color: '#2c163a',
            marginBottom: 4,
          }}>
            {infoSobra.inicio} → {infoSobra.fim}
          </div>
          <div style={{ fontSize: 11.5, color: '#666' }}>
            Duração: {infoSobra.duracaoMin} min
          </div>
        </div>

        {/* Estado atual */}
        <div style={{
          background: sobraLiberada ? '#f0fdf4' : '#fafafa',
          border: `1.5px solid ${sobraLiberada ? '#86efac' : '#e0e0e0'}`,
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {sobraLiberada ? (
            <MdCheckCircle size={20} color="#16a34a" />
          ) : (
            <MdLock size={20} color="#666" />
          )}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: sobraLiberada ? '#166534' : '#555',
            }}>
              {sobraLiberada ? 'Sobra LIBERADA' : 'Sobra BLOQUEADA'}
            </div>
            <div style={{
              fontSize: 10.5,
              color: sobraLiberada ? '#4b7a5a' : '#888',
              marginTop: 2,
              lineHeight: 1.5,
            }}>
              {sobraLiberada
                ? 'A sobra aparece na agenda pública para outros pacientes.'
                : 'A sobra não aparece para ninguém.'}
            </div>
          </div>
        </div>

        {/* Alerta de pacientes agendados */}
        {infoSobra.dentroDaSobra.length > 0 && (
          <div style={{
            background: '#fff8e1',
            border: '1.5px solid #fcd34d',
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 16,
            fontSize: 11.5,
            color: '#92400e',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
          }}>
            <MdWarning size={14} color="#92400e" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong>
                {infoSobra.dentroDaSobra.length} paciente{infoSobra.dentroDaSobra.length > 1 ? 's' : ''}
              </strong>{' '}
              agendado{infoSobra.dentroDaSobra.length > 1 ? 's' : ''} neste intervalo.
              Se você barrar a sobra, {infoSobra.dentroDaSobra.length > 1 ? 'eles serão' : 'ele será'}{' '}
              cancelado{infoSobra.dentroDaSobra.length > 1 ? 's' : ''}.
            </span>
          </div>
        )}

        {erro && <div style={erroBox}>{erro}</div>}

        {/* Botões */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sobraLiberada ? (
            <button
              type="button"
              onClick={handleBarrarClique}
              disabled={salvando}
              style={btnPerigo}
            >
              <MdLock size={16} />
              {salvando ? 'SALVANDO…' : 'BARRAR ESSA SOBRA'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLiberar}
              disabled={salvando}
              style={btnPrimario}
            >
              <MdEventAvailable size={16} />
              {salvando ? 'SALVANDO…' : 'LIBERAR ESSA SOBRA'}
            </button>
          )}

          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            style={{
              ...btnSecundario,
              width: '100%',
            }}
          >
            CANCELAR
          </button>
        </div>
      </div>
    </div>
  );
}

function formatarDataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/* ============ Estilos ============ */
const overlay = {
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
};

const card = {
  background: '#fff',
  borderRadius: 20,
  padding: '22px 22px 20px',
  maxWidth: 480,
  width: '100%',
  maxHeight: '92vh',
  overflowY: 'auto',
  boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
  border: '1.5px solid #C8A24A',
  fontFamily: "'Montserrat', sans-serif",
};

const btnPrimario = {
  width: '100%',
  background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
  color: '#fff',
  border: '1.5px solid #15803d',
  padding: '14px 20px',
  borderRadius: 22,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: "'Cinzel', serif",
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
};

const btnPerigo = {
  flex: 1,
  background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
  color: '#fff',
  border: '1.5px solid #9c1c1c',
  padding: '14px 20px',
  borderRadius: 22,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: "'Cinzel', serif",
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  boxShadow: '0 4px 14px rgba(198, 40, 40, 0.35)',
};

const btnSecundario = {
  flex: 1,
  background: '#f0f0f0',
  color: '#333',
  border: 'none',
  padding: '14px 20px',
  borderRadius: 22,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: "'Cinzel', serif",
};

const erroBox = {
  background: '#fde8e8',
  border: '1px solid #f98080',
  color: '#c81e1e',
  padding: '9px 12px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 12,
};