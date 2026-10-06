// src/components/agendamento/ModalAgendarParaPaciente.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, getDocs, addDoc, doc, getDoc,
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
  paciente,           // { id, nome, documento, emailAcesso, consentimentoLGPD, ... }
  uidEsteticista,
  onFechar,
  onSucesso,          // callback(agendamentoCriado)
}) {
  const [slots, setSlots] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mesRef, setMesRef] = useState(() => new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [slotSelecionado, setSlotSelecionado] = useState(null);
  const [observacoes, setObservacoes] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  // ✅ Carrega config + slots disponíveis
  useEffect(() => {
    if (!uidEsteticista) return;
    (async () => {
      try {
        const cfgSnap = await getDoc(
          doc(db, `usuarios/${uidEsteticista}/agenda_config`, 'principal')
        );
        if (!cfgSnap.exists()) {
          setErro('Você ainda não configurou sua agenda.');
          setCarregando(false);
          return;
        }
        const cfg = cfgSnap.data();

        const hoje = toISODateLocal(new Date());
        const max = new Date();
        max.setDate(max.getDate() + (cfg.diasFuturosMaximo || 60));
        const dataFim = toISODateLocal(max);

        const ocupSnap = await getDocs(
          query(
            collection(db, 'agendamentos'),
            where('uidEsteticista', '==', uidEsteticista),
            where('data', '>=', hoje),
            where('data', '<=', dataFim)
          )
        );
        const ocupados = ocupSnap.docs
          .map((d) => d.data())
          .filter((a) => a.status === 'pendente' || a.status === 'confirmado');

        const lista = gerarSlotsDisponiveis(cfg, ocupados, hoje, dataFim);
        setSlots(lista);
      } catch (e) {
        console.error('Erro ao carregar agenda:', e);
        setErro('Não foi possível carregar sua agenda.');
      } finally {
        setCarregando(false);
      }
    })();
  }, [uidEsteticista]);

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
            plataforma: 'esteticista-app',
            userAgent: 'agendamento-feito-pela-profissional',
          };

      const docRef = await addDoc(collection(db, 'agendamentos'), {
        uidEsteticista,
        pacienteId: String(paciente.id),

        data: slotSelecionado.data,
        horaInicio: slotSelecionado.horaInicio,
        horaFim: slotSelecionado.horaFim,
        duracaoMin: calcularDuracao(slotSelecionado),

        nome: paciente.nome || 'Paciente',
        documento: paciente.documento || '',
        telefone: paciente.telefone || '',
        email: (paciente.email || paciente.emailAcesso || '').toLowerCase(),
        observacoes: observacoes.trim(),

        // ✅ Já nasce confirmado — foi a esteticista que marcou
        status: 'confirmado',
        criadoPor: 'esteticista',
        canceladoPor: null,
        consentimentoLGPD: consentimentoPaciente,
        codigoAutenticidade: codigo,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });

      // ✅ Notifica o paciente por push (não bloqueia UI se falhar)
      fetch('/.netlify/functions/notificar-paciente-agendamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pacienteId: paciente.id,
          agendamento: {
            id: docRef.id,
            data: slotSelecionado.data,
            horaInicio: slotSelecionado.horaInicio,
            nome: paciente.nome,
          },
        }),
      }).catch((e) => console.warn('Falha ao notificar paciente:', e));

      onSucesso?.({
        id: docRef.id,
        data: slotSelecionado.data,
        horaInicio: slotSelecionado.horaInicio,
      });
    } catch (e) {
      console.error('Erro ao criar agendamento:', e);
      setErro('Erro ao agendar. Tente novamente.');
      setEnviando(false);
    }
  };

  return (
    <div
      onClick={enviando ? undefined : onFechar}
      style={overlay}
    >
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        {/* Header */}
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdCalendarMonth size={20} color="#7e22ce" />
            <h3 style={{
              fontFamily: "'Cinzel', serif",
              color: '#2c163a',
              fontSize: 16,
              margin: 0,
            }}>
              Agendar para {paciente?.nome}
            </h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            style={btnFechar}
          >
            <MdClose size={20} color="#2c163a" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
          {carregando ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#666' }}>
              Carregando sua agenda…
            </div>
          ) : erro && slots.length === 0 ? (
            <div style={blocoAviso}>
              <MdWarning size={22} color="#92400e" />
              <span>{erro}</span>
            </div>
          ) : slots.length === 0 ? (
            <div style={blocoAviso}>
              <MdWarning size={22} color="#92400e" />
              <span>Sua agenda está vazia. Configure horários primeiro.</span>
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
                  const qtd = slotsPorDia[iso]?.length || 0;
                  const temSlot = qtd > 0;
                  return {
                    status: temSlot ? 'aberto' : 'vazio',
                    badge: temSlot ? `${qtd}×` : null,
                    disabled: !temSlot,
                    title: temSlot ? `${qtd} horário(s) livre(s)` : 'Sem vagas',
                    onClick: (d) => {
                      setDiaSelecionado(toISODateLocal(d));
                      setSlotSelecionado(null);
                    },
                  };
                }}
              />
              <LegendaCalendario />

              {/* Horários do dia escolhido */}
              {diaSelecionado && (
                <div style={{ marginTop: 16 }}>
                  <div style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 12,
                    color: '#2c163a',
                    marginBottom: 10,
                  }}>
                    Horários livres em {formatarDataLonga(diaSelecionado)}
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                    gap: 8,
                  }}>
                    {slotsPorDia[diaSelecionado]?.map((s, i) => {
                      const ativo =
                        slotSelecionado?.data === s.data &&
                        slotSelecionado?.horaInicio === s.horaInicio;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSlotSelecionado(s)}
                          style={{
                            padding: '9px 6px',
                            borderRadius: 10,
                            border: ativo
                              ? '2px solid #7e22ce'
                              : '1.5px solid #d8b4fe',
                            background: ativo ? '#faf5ff' : '#fff',
                            cursor: 'pointer',
                            textAlign: 'center',
                            fontSize: 13,
                            fontWeight: ativo ? 700 : 600,
                            color: ativo ? '#7e22ce' : '#2c163a',
                          }}
                        >
                          {s.horaInicio}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observações */}
              {slotSelecionado && (
                <div style={{ marginTop: 16 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#2c163a',
                    marginBottom: 4,
                  }}>
                    Observações (opcional)
                  </label>
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={2}
                    placeholder="Ex: retorno, limpeza de pele…"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1.5px solid #d8b4fe',
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "'Montserrat', sans-serif",
                      color: '#2c163a',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
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
                }}>
                  {erro}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={footer}>
          <button
            type="button"
            onClick={onFechar}
            disabled={enviando}
            style={btnCancelar}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!slotSelecionado || enviando}
            style={{
              ...btnConfirmar,
              opacity: (!slotSelecionado || enviando) ? 0.5 : 1,
              cursor: (!slotSelecionado || enviando) ? 'not-allowed' : 'pointer',
            }}
          >
            <MdCheckCircle size={16} />
            {enviando ? 'AGENDANDO…' : 'CONFIRMAR AGENDAMENTO'}
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
const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(44, 22, 58, 0.65)',
  backdropFilter: 'blur(4px)',
  display: 'flex', justifyContent: 'center', alignItems: 'center',
  zIndex: 99999, padding: 20, boxSizing: 'border-box',
};

const modal = {
  background: '#fff',
  borderRadius: 20,
  width: '100%',
  maxWidth: 560,
  maxHeight: '92vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 25px 70px rgba(44, 22, 58, 0.45)',
  border: '1.5px solid #C8A24A',
  fontFamily: "'Montserrat', sans-serif",
};

const header = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 22px',
  borderBottom: '1.5px solid #e2d2f5',
  background: 'linear-gradient(135deg, rgba(200, 162, 74, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
};

const btnFechar = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  padding: 4, display: 'flex', alignItems: 'center',
};

const footer = {
  display: 'flex', gap: 10,
  padding: '14px 22px',
  borderTop: '1.5px solid #e2d2f5',
  background: '#fafafc',
  justifyContent: 'flex-end',
};

const btnCancelar = {
  fontFamily: "'Cinzel', serif",
  background: '#f0f0f0', color: '#333',
  border: 'none', padding: '10px 20px', borderRadius: 20,
  fontSize: 11, fontWeight: 700, cursor: 'pointer',
};

const btnConfirmar = {
  fontFamily: "'Cinzel', serif",
  background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
  color: '#fff', border: '1.5px solid #9c7826',
  padding: '10px 24px', borderRadius: 20,
  fontSize: 11, fontWeight: 700,
  display: 'flex', alignItems: 'center', gap: 6,
  boxShadow: '0 3px 10px rgba(200, 162, 74, 0.35)',
};

const blocoAviso = {
  background: '#fff8e1', border: '1px solid #fcd34d',
  borderRadius: 10, padding: 14, fontSize: 12,
  color: '#92400e', display: 'flex',
  alignItems: 'center', gap: 8, fontWeight: 600,
};