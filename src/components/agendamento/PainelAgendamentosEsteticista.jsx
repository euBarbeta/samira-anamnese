// src/components/agendamento/PainelAgendamentosEsteticista.jsx
import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, doc,
  updateDoc, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatarCPF, formatarTelefone } from '../../utils/agenda';
import { notificarAgendamento } from '../../utils/agendamentoNotify';
import { MdCheckCircle, MdCancel, MdWarning, MdSearch } from 'react-icons/md';
import ConfiguradorAgenda from './ConfiguradorAgenda';

export default function PainelAgendamentosEsteticista({ uidEsteticista }) {
  const [aba, setAba] = useState('agenda'); // 'agenda' | 'config'
  const [agendamentos, setAgendamentos] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!uidEsteticista) return;
    const q = query(
      collection(db, 'agendamentos'),
      where('uidEsteticista', '==', uidEsteticista),
      orderBy('data', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setAgendamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    }, (err) => {
      console.error('Erro agendamentos:', err);
      setCarregando(false);
    });
    return () => unsub();
  }, [uidEsteticista]);

  const confirmar = async (ag) => {
    try {
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        status: 'confirmado',
        atualizadoEm: new Date().toISOString(),
      });
      notificarAgendamento({ tipoEvento: 'confirmado', uidEsteticista, agendamento: ag });
    } catch (e) {
      alert('Erro ao confirmar: ' + e.message);
    }
  };

  const cancelar = async (ag) => {
    if (!window.confirm(`Cancelar o agendamento de ${ag.nome} em ${ag.data} às ${ag.horaInicio}?`)) return;
    try {
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        status: 'cancelado',
        canceladoPor: 'esteticista',
        atualizadoEm: new Date().toISOString(),
      });
      notificarAgendamento({ tipoEvento: 'cancelado_esteticista', uidEsteticista, agendamento: ag });
    } catch (e) {
      alert('Erro ao cancelar: ' + e.message);
    }
  };

  const filtrados = agendamentos.filter((a) => a.status === filtroStatus);

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setAba('agenda')}
          style={abaBtn(aba === 'agenda')}
        >
          📅 Agendamentos
        </button>
        <button
          type="button"
          onClick={() => setAba('config')}
          style={abaBtn(aba === 'config')}
        >
          ⚙️ Configurar horários
        </button>
      </div>

      {aba === 'config' && <ConfiguradorAgenda uidEsteticista={uidEsteticista} />}

      {aba === 'agenda' && (
        <>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {['pendente', 'confirmado', 'cancelado', 'concluido'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFiltroStatus(s)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 16,
                  border: '1.5px solid #C8A24A',
                  background: filtroStatus === s ? '#C8A24A' : 'transparent',
                  color: filtroStatus === s ? '#fff' : '#C8A24A',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', serif",
                  textTransform: 'capitalize',
                }}
              >
                {s} ({agendamentos.filter((a) => a.status === s).length})
              </button>
            ))}
          </div>

          {carregando ? (
            <p style={{ color: '#666' }}>Carregando…</p>
          ) : filtrados.length === 0 ? (
            <div style={vazio}>Nenhum agendamento {filtroStatus}.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtrados.map((ag) => (
                <div key={ag.id} style={cardAg}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h4 style={{ fontFamily: "'Cinzel', serif", margin: '0 0 4px 0', color: '#2c163a' }}>
                        {ag.nome}
                      </h4>
                      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7 }}>
                        <div><strong>📅</strong> {ag.data} às {ag.horaInicio} ({ag.duracaoMin}min)</div>
                        <div><strong>📞</strong> {formatarTelefone(ag.telefone)}</div>
                        <div>
  <strong>🆔</strong> {ag.documento || ag.cpf}
  {ag.paisCodigo && ag.paisCodigo !== 'BR' && (
    <span style={{ marginLeft: 6, fontSize: 10, color: '#7e22ce' }}>
      ({ag.paisCodigo})
    </span>
  )}
</div>
<div>
  <strong>📞</strong> {formatarTelefoneInternacional(ag.telefone)}
</div>
                        {ag.email && <div><strong>✉️</strong> {ag.email}</div>}
                        {ag.observacoes && (
                          <div style={{ marginTop: 6, fontStyle: 'italic', color: '#7e22ce' }}>
                            💬 {ag.observacoes}
                          </div>
                        )}
                      </div>
                      {ag.consentimentoLGPD?.aceito ? (
                        <span style={badgeOk}>✅ LGPD aceito</span>
                      ) : (
                        <span style={badgeWarn}>⚠️ Sem LGPD</span>
                      )}
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

// Estilos
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
const cardAg = { background: '#fff', border: '1.5px solid #e2d2f5', borderRadius: 12, padding: 16 };
const vazio = { textAlign: 'center', padding: 40, color: '#888', background: '#fff', borderRadius: 12, border: '1px dashed #ddd' };
const btnOk = { background: '#16a34a', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 };
const btnDanger = { background: '#c62828', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 };
const badgeOk = { display: 'inline-block', marginTop: 8, background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700 };
const badgeWarn = { display: 'inline-block', marginTop: 8, background: '#fff8e1', color: '#92400e', border: '1px solid #fcd34d', padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700 };
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
// No painel da esteticista, botão pra abrir WhatsApp
const abrirWhatsApp = (telefoneE164) => {
  const digitos = telefoneE164.replace(/\D/g, '');
  window.open(`https://wa.me/${digitos}`, '_blank');
};