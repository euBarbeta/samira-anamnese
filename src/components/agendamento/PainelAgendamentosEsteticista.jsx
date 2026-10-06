// src/components/agendamento/PainelAgendamentosEsteticista.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, onSnapshot, doc,
  updateDoc, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  MdCheckCircle, MdCancel, MdWarning, MdSearch,
  MdCalendarMonth, MdSettings, MdPhone, MdBadge,
  MdEmail, MdChatBubbleOutline, MdClear, MdHourglassEmpty,
} from 'react-icons/md';
import ConfiguradorAgenda from './ConfiguradorAgenda';

// ============================================================
// Quantos dias manter na lista de cancelados/concluídos
// ============================================================
const DIAS_HISTORICO = 30;

export default function PainelAgendamentosEsteticista({ uidEsteticista }) {
  const [aba, setAba] = useState('agenda'); // 'agenda' | 'config'
  const [agendamentos, setAgendamentos] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  // ============================================================
  // Listener em tempo real + auto-conclusão
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;

    const q = query(
      collection(db, 'agendamentos'),
      where('uidEsteticista', '==', uidEsteticista),
      orderBy('data', 'desc')
    );

    const unsub = onSnapshot(q, async (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgendamentos(lista);
      setCarregando(false);

      // ✅ Auto-conclusão: confirmados cuja data/hora já passou (30min de folga)
      const agora = Date.now();
      const paraConcluir = lista.filter((a) => {
        if (a.status !== 'confirmado') return false;
        const horaFim = a.horaFim || a.horaInicio || '23:59';
        const dt = new Date(`${a.data}T${horaFim}:00`);
        return dt.getTime() + 30 * 60 * 1000 < agora;
      });

      for (const a of paraConcluir) {
        try {
          await updateDoc(doc(db, 'agendamentos', a.id), {
            status: 'concluido',
            atualizadoEm: new Date().toISOString(),
          });
        } catch (e) {
          /* silencioso — se falhar, tenta no próximo tick */
        }
      }
    }, (err) => {
      console.error('Erro agendamentos:', err);
      setCarregando(false);
    });

    return () => unsub();
  }, [uidEsteticista]);

  // ============================================================
  // Confirmar manualmente (só faz sentido se status='pendente')
  // ✅ Notifica o PACIENTE (não a esteticista)
  // ============================================================
  const confirmar = async (ag) => {
    try {
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        status: 'confirmado',
        aguardandoConsentimento: false,
        atualizadoEm: new Date().toISOString(),
      });

      // Notifica o paciente dono do agendamento
      fetch('/.netlify/functions/notificar-paciente-agendamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pacienteId: ag.pacienteId,
          agendamento: ag,
          tipoEvento: 'confirmado',
        }),
      }).catch((e) => console.warn('Falha ao notificar paciente (confirmado):', e));
    } catch (e) {
      alert('Erro ao confirmar: ' + e.message);
    }
  };

  // ============================================================
  // ✅ Notifica o PACIENTE (não a esteticista)
  // ============================================================
  const cancelar = async (ag) => {
    if (!window.confirm(`Cancelar o agendamento de ${ag.nome} em ${formatarDataBR(ag.data)} às ${ag.horaInicio}?`)) return;
    try {
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        status: 'cancelado',
        canceladoPor: 'esteticista',
        atualizadoEm: new Date().toISOString(),
      });

      // Notifica o paciente dono do agendamento
      fetch('/.netlify/functions/notificar-paciente-agendamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pacienteId: ag.pacienteId,
          agendamento: ag,
          tipoEvento: 'cancelado',
        }),
      }).catch((e) => console.warn('Falha ao notificar paciente (cancelado):', e));
    } catch (e) {
      alert('Erro ao cancelar: ' + e.message);
    }
  };

  // ============================================================
  // Contagem por status (com corte de 30 dias para histórico)
  // ============================================================
  const contagens = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() - DIAS_HISTORICO);

    const cont = { pendente: 0, confirmado: 0, cancelado: 0, concluido: 0 };
    for (const a of agendamentos) {
      if (!(a.status in cont)) continue;
      if (a.status === 'cancelado' || a.status === 'concluido') {
        const d = new Date((a.data || '') + 'T12:00:00');
        if (d < limite) continue;
      }
      cont[a.status]++;
    }
    return cont;
  }, [agendamentos]);

  // ============================================================
  // Lista filtrada: status + busca + corte de histórico
  // ============================================================
  const filtrados = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() - DIAS_HISTORICO);

    const termo = busca.toLowerCase().trim();

    return agendamentos.filter((a) => {
      // 1) Filtro por status
      if (a.status !== filtroStatus) return false;

      // 2) Corte de histórico para cancelado/concluído
      if (filtroStatus === 'cancelado' || filtroStatus === 'concluido') {
        const d = new Date((a.data || '') + 'T12:00:00');
        if (d < limite) return false;
      }

      // 3) Busca textual (nome, documento, data BR)
      if (!termo) return true;
      const nome = (a.nome || '').toLowerCase();
      const doc = (a.documento || a.cpf || '').toLowerCase();
      const dataBR = formatarDataBR(a.data);
      const email = (a.email || '').toLowerCase();

      return (
        nome.includes(termo) ||
        doc.includes(termo) ||
        dataBR.includes(termo) ||
        email.includes(termo)
      );
    });
  }, [agendamentos, filtroStatus, busca]);

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Abas */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
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
      </div>

      {aba === 'config' && <ConfiguradorAgenda uidEsteticista={uidEsteticista} />}

      {aba === 'agenda' && (
        <>
          {/* ============================================================
              LUPA — busca em todas as abas
             ============================================================ */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            border: '1.5px solid #e2d2f5',
            borderRadius: 12,
            padding: '8px 12px',
            marginBottom: 12,
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

          {/* ============================================================
              Filtros por status
             ============================================================ */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { key: 'pendente',   label: 'Pendente'   },
              { key: 'confirmado', label: 'Confirmado' },
              { key: 'cancelado',  label: 'Cancelado'  },
              { key: 'concluido',  label: 'Concluído'  },
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

          {/* Aviso de corte de histórico */}
          {(filtroStatus === 'cancelado' || filtroStatus === 'concluido') && (
            <div style={{
              fontSize: 10.5,
              color: '#888',
              marginBottom: 10,
              fontStyle: 'italic',
            }}>
              Exibindo apenas os últimos {DIAS_HISTORICO} dias.
            </div>
          )}

          {/* ============================================================
              Lista
             ============================================================ */}
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

                      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MdCalendarMonth size={13} color="#C8A24A" />
                          {formatarDataBR(ag.data)} às {ag.horaInicio} ({ag.duracaoMin}min)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MdPhone size={13} color="#C8A24A" />
                          {formatarTelefoneInternacional(ag.telefone)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MdBadge size={13} color="#C8A24A" />
                          {ag.documento || ag.cpf || '—'}
                        </div>
                        {ag.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MdEmail size={13} color="#C8A24A" />
                            {ag.email}
                          </div>
                        )}
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
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {ag.status === 'pendente' && (
                        <>
                          <button type="button" onClick={() => confirmar(ag)} style={btnOk}>
                            <MdCheckCircle size={14} /> Confirmar
                          </button>
                          <button type="button" onClick={() => cancelar(ag)} style={btnDanger}>
                            <MdCancel size={14} /> Cancelar
                          </button>
                        </>
                      )}
                      {ag.status === 'confirmado' && (
                        <button type="button" onClick={() => cancelar(ag)} style={btnDanger}>
                          <MdCancel size={14} /> Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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
  }[status] || status;
}

function formatarTelefoneInternacional(e164) {
  if (!e164) return '—';
  const match = e164.match(/^\+(\d{1,3})(\d+)$/);
  if (!match) return e164;
  const [, ddi, resto] = match;

  if (ddi === '55' && resto.length === 11) {
    return `+55 (${resto.slice(0, 2)}) ${resto.slice(2, 7)}-${resto.slice(7)}`;
  }
  if (ddi === '55' && resto.length === 10) {
    return `+55 (${resto.slice(0, 2)}) ${resto.slice(2, 6)}-${resto.slice(6)}`;
  }
  const grupos = resto.match(/.{1,3}/g) || [resto];
  return `+${ddi} ${grupos.join(' ')}`;
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