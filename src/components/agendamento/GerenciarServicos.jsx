// src/components/agendamento/GerenciarServicos.jsx
import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  MdAdd, MdDelete, MdEdit, MdSave, MdClose, MdCheckCircle,
  MdWarning, MdContentCopy,
} from 'react-icons/md';

// Paleta pra escolher cor
const PALETA = [
  '#a855f7', // roxo
  '#C8A24A', // dourado
  '#16a34a', // verde
  '#dc2626', // vermelho
  '#2563eb', // azul
  '#db2777', // rosa
  '#ea580c', // laranja
  '#0d9488', // teal
];

const DURACOES_RAPIDAS = [15, 30, 45, 60, 90, 120, 180];

export default function GerenciarServicos({ uidEsteticista }) {
  const [servicos, setServicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null); // serviço em edição
  const [form, setForm] = useState({
    nome: '',
    duracaoMin: 60,
    cor: PALETA[0],
    ativo: true,
  });
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);

  // ============================================================
  // Listener em tempo real
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;

    const colRef = collection(db, `usuarios/${uidEsteticista}/servicos`);
    const q = query(colRef, orderBy('ordem', 'asc'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setServicos(lista);
        setCarregando(false);
      },
      (err) => {
        console.error('Erro listener serviços:', err);
        setCarregando(false);
      }
    );

    return () => unsub();
  }, [uidEsteticista]);

  // ============================================================
  // Abrir modal (novo ou edição)
  // ============================================================
  const abrirNovo = () => {
    setEditando(null);
    setForm({
      nome: '',
      duracaoMin: 60,
      cor: PALETA[0],
      ativo: true,
    });
    setErroForm('');
    setModalAberto(true);
  };

  const abrirEdicao = (servico) => {
    setEditando(servico);
    setForm({
      nome: servico.nome || '',
      duracaoMin: servico.duracaoMin || 60,
      cor: servico.cor || PALETA[0],
      ativo: servico.ativo !== false,
    });
    setErroForm('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (salvando) return;
    setModalAberto(false);
    setEditando(null);
    setErroForm('');
  };

  // ============================================================
  // Salvar (novo ou editado)
  // ============================================================
  const salvar = async () => {
    const nomeLimpo = form.nome.trim();
    if (!nomeLimpo) {
      setErroForm('Digite um nome para o serviço.');
      return;
    }
    if (nomeLimpo.length > 60) {
      setErroForm('Nome muito longo (máx 60 caracteres).');
      return;
    }
    const dur = parseInt(form.duracaoMin, 10);
    if (!dur || dur < 5 || dur > 480) {
      setErroForm('Duração precisa estar entre 5 e 480 minutos.');
      return;
    }

    setSalvando(true);
    setErroForm('');

    try {
      const dadosServico = {
        nome: nomeLimpo,
        duracaoMin: dur,
        cor: form.cor,
        ativo: form.ativo,
        profissionalId: uidEsteticista,
        atualizadoEm: serverTimestamp(),
      };

      if (editando) {
        await updateDoc(
          doc(db, `usuarios/${uidEsteticista}/servicos`, editando.id),
          dadosServico
        );
      } else {
        // Ordem = maior atual + 1
        const maiorOrdem = servicos.reduce(
          (max, s) => Math.max(max, s.ordem || 0),
          0
        );
        await addDoc(collection(db, `usuarios/${uidEsteticista}/servicos`), {
          ...dadosServico,
          ordem: maiorOrdem + 1,
          criadoEm: serverTimestamp(),
        });
      }

      fecharModal();
    } catch (e) {
      console.error('Erro ao salvar serviço:', e);
      setErroForm('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  // ============================================================
  // Toggle ativo/inativo
  // ============================================================
  const toggleAtivo = async (servico) => {
    try {
      await updateDoc(
        doc(db, `usuarios/${uidEsteticista}/servicos`, servico.id),
        {
          ativo: !servico.ativo,
          atualizadoEm: serverTimestamp(),
        }
      );
    } catch (e) {
      console.error('Erro ao alternar ativo:', e);
    }
  };

  // ============================================================
  // Excluir
  // ============================================================
  const confirmarDelete = async () => {
    if (!confirmarExclusao) return;
    try {
      await deleteDoc(
        doc(db, `usuarios/${uidEsteticista}/servicos`, confirmarExclusao.id)
      );
      setConfirmarExclusao(null);
    } catch (e) {
      console.error('Erro ao excluir:', e);
    }
  };

  // ============================================================
  // Reordenar (sobe/desce)
  // ============================================================
  const mover = async (servico, direcao) => {
    const idx = servicos.findIndex((s) => s.id === servico.id);
    const novoIdx = idx + direcao;
    if (novoIdx < 0 || novoIdx >= servicos.length) return;

    const batch = writeBatch(db);
    const atual = servicos[idx];
    const vizinho = servicos[novoIdx];

    batch.update(
      doc(db, `usuarios/${uidEsteticista}/servicos`, atual.id),
      { ordem: vizinho.ordem || novoIdx + 1 }
    );
    batch.update(
      doc(db, `usuarios/${uidEsteticista}/servicos`, vizinho.id),
      { ordem: atual.ordem || idx + 1 }
    );

    try {
      await batch.commit();
    } catch (e) {
      console.error('Erro ao reordenar:', e);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ padding: '10px 0' }}>
      {/* Cabeçalho */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div>
          <h3 style={{
            fontFamily: "'Cinzel', serif",
            color: '#2c163a',
            fontSize: 18,
            margin: 0,
          }}>
            Meus Serviços
          </h3>
          <span style={{ fontSize: 11, color: '#666' }}>
            Cada serviço tem um tempo próprio de atendimento
          </span>
        </div>

        <button
          type="button"
          onClick={abrirNovo}
          style={{
            fontFamily: "'Cinzel', serif",
            background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
            color: '#fff',
            border: 'none',
            padding: '11px 20px',
            borderRadius: 22,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 3px 12px rgba(200, 162, 74, 0.3)',
          }}
        >
          <MdAdd size={16} />
          ADICIONAR SERVIÇO
        </button>
      </div>

      {/* Lista */}
      {carregando ? (
        <div style={{
          textAlign: 'center', padding: 40,
          color: '#666', fontSize: 13,
        }}>
          Carregando serviços…
        </div>
      ) : servicos.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: 'rgba(255, 255, 255, 0.92)',
          borderRadius: 14,
          border: '1.5px dashed #d8b4fe',
        }}>
          <MdWarning size={32} color="#a855f7" />
          <p style={{
            fontSize: 13, color: '#666',
            marginTop: 10, marginBottom: 4,
          }}>
            Nenhum serviço cadastrado ainda.
          </p>
          <span style={{ fontSize: 11, color: '#999' }}>
            Adicione seus serviços (ex: Limpeza, Agulhamento) com o tempo de cada um
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {servicos.map((s, idx) => (
            <div
              key={s.id}
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                border: `1.5px solid ${s.ativo ? s.cor || '#a855f7' : '#ccc'}`,
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                opacity: s.ativo ? 1 : 0.55,
                boxShadow: '0 3px 10px rgba(44, 22, 58, 0.04)',
              }}
            >
              {/* Ponto colorido */}
              <span style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: s.cor || '#a855f7',
                border: '2px solid #fff',
                boxShadow: `0 0 0 1.5px ${s.cor || '#a855f7'}`,
                flexShrink: 0,
              }} />

              {/* Nome + duração */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Cinzel', serif",
                  color: '#2c163a',
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}>
                  {s.nome}
                  {!s.ativo && (
                    <span style={{
                      fontSize: 9,
                      color: '#888',
                      border: '1px solid #ccc',
                      borderRadius: 8,
                      padding: '1px 6px',
                      fontWeight: 600,
                    }}>
                      INATIVO
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 11,
                  color: '#666',
                  marginTop: 2,
                }}>
                  ⏱️ {s.duracaoMin} min
                </div>
              </div>

              {/* Reordenar */}
              <div style={{
                display: 'flex', flexDirection: 'column',
                gap: 1, flexShrink: 0,
              }}>
                <button
                  type="button"
                  onClick={() => mover(s, -1)}
                  disabled={idx === 0}
                  style={btnSeta}
                  title="Mover para cima"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => mover(s, 1)}
                  disabled={idx === servicos.length - 1}
                  style={btnSeta}
                  title="Mover para baixo"
                >
                  ▼
                </button>
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => toggleAtivo(s)}
                  title={s.ativo ? 'Desativar' : 'Ativar'}
                  style={btnAcao}
                >
                  {s.ativo ? '○' : '●'}
                </button>
                <button
                  type="button"
                  onClick={() => abrirEdicao(s)}
                  title="Editar"
                  style={btnAcao}
                >
                  <MdEdit size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmarExclusao(s)}
                  title="Excluir"
                  style={{ ...btnAcao, color: '#c62828' }}
                >
                  <MdDelete size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============ MODAL: NOVO / EDITAR ============ */}
      {modalAberto && (
        <div
          onClick={fecharModal}
          style={overlayEstilo}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={cardEstilo}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 18,
              gap: 10,
            }}>
              <h4 style={{
                fontFamily: "'Cinzel', serif",
                color: '#2c163a',
                fontSize: 16,
                margin: 0,
              }}>
                {editando ? 'Editar Serviço' : 'Novo Serviço'}
              </h4>
              <button
                type="button"
                onClick={fecharModal}
                disabled={salvando}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                }}
                aria-label="Fechar"
              >
                <MdClose size={22} color="#2c163a" />
              </button>
            </div>

            {/* Nome */}
            <label style={labelEstilo}>Nome do serviço *</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Agulhamento, Limpeza de pele…"
              disabled={salvando}
              maxLength={60}
              autoComplete="off"
              style={inputEstilo}
            />

            {/* Duração — input + atalhos */}
            <label style={{ ...labelEstilo, marginTop: 14 }}>
              Duração (minutos) *
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}>
              <input
                type="number"
                min="5"
                max="480"
                step="5"
                value={form.duracaoMin}
                onChange={(e) => setForm({ ...form, duracaoMin: e.target.value })}
                disabled={salvando}
                style={{ ...inputEstilo, width: 100, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: '#666' }}>minutos</span>
            </div>

            {/* Atalhos */}
            <div style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              marginBottom: 14,
            }}>
              {DURACOES_RAPIDAS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm({ ...form, duracaoMin: d })}
                  disabled={salvando}
                  style={{
                    background: Number(form.duracaoMin) === d ? '#a855f7' : '#faf5ff',
                    color: Number(form.duracaoMin) === d ? '#fff' : '#7e22ce',
                    border: '1.5px solid #d8b4fe',
                    borderRadius: 16,
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'Cinzel', serif",
                  }}
                >
                  {d}min
                </button>
              ))}
            </div>

            {/* Cor */}
            <label style={{ ...labelEstilo, marginTop: 6 }}>Cor</label>
            <div style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 14,
            }}>
              {PALETA.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, cor: c })}
                  disabled={salvando}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: c,
                    border: form.cor === c
                      ? '3px solid #2c163a'
                      : '2px solid #fff',
                    boxShadow: '0 0 0 1.5px #e2d2f5',
                    cursor: 'pointer',
                    transition: 'transform 0.15s',
                  }}
                  title={c}
                />
              ))}
            </div>

            {/* Ativo */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              background: '#faf5ff',
              border: '1.5px solid #d8b4fe',
              borderRadius: 10,
              cursor: 'pointer',
              marginBottom: 14,
            }}>
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                disabled={salvando}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 12, color: '#2c163a', fontWeight: 600 }}>
                Serviço ativo (aparece nas opções de agendamento)
              </span>
            </label>

            {/* Erro */}
            {erroForm && (
              <div style={{
                background: '#fde8e8',
                border: '1px solid #f98080',
                color: '#c81e1e',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 14,
              }}>
                {erroForm}
              </div>
            )}

            {/* Botões */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={fecharModal}
                disabled={salvando}
                style={{
                  background: '#f0f0f0',
                  color: '#333',
                  border: 'none',
                  padding: '11px 20px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: salvando ? 'not-allowed' : 'pointer',
                  fontFamily: "'Cinzel', serif",
                  opacity: salvando ? 0.6 : 1,
                }}
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                style={{
                  background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                  color: '#fff',
                  border: '1.5px solid #9c7826',
                  padding: '11px 22px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: salvando ? 'wait' : 'pointer',
                  fontFamily: "'Cinzel', serif",
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 3px 12px rgba(200, 162, 74, 0.35)',
                  opacity: salvando ? 0.7 : 1,
                }}
              >
                {salvando ? (
                  <>
                    <span style={{
                      display: 'inline-block',
                      width: 13, height: 13,
                      border: '2px solid #fff',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spinServ 0.8s linear infinite',
                    }} />
                    SALVANDO…
                  </>
                ) : (
                  <>
                    <MdSave size={16} />
                    {editando ? 'SALVAR ALTERAÇÕES' : 'CRIAR SERVIÇO'}
                  </>
                )}
              </button>
            </div>

            <style>{`
              @keyframes spinServ { to { transform: rotate(360deg); } }
            `}</style>
          </div>
        </div>
      )}

      {/* ============ MODAL: CONFIRMAR EXCLUSÃO ============ */}
      {confirmarExclusao && (
        <div onClick={() => setConfirmarExclusao(null)} style={overlayEstilo}>
          <div onClick={(e) => e.stopPropagation()} style={{
            ...cardEstilo,
            maxWidth: 380,
            textAlign: 'center',
          }}>
            <MdWarning size={40} color="#c62828" />
            <h4 style={{
              fontFamily: "'Cinzel', serif",
              color: '#c62828',
              fontSize: 16,
              margin: '12px 0 8px',
            }}>
              Excluir serviço?
            </h4>
            <p style={{
              fontSize: 13,
              color: '#2c163a',
              marginBottom: 18,
              lineHeight: 1.5,
            }}>
              <strong>{confirmarExclusao.nome}</strong>
              <br />
              <span style={{ fontSize: 11, color: '#888' }}>
                Se houver agendamentos futuros com este serviço, eles serão
                cancelados e os pacientes notificados.
              </span>
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmarExclusao(null)}
                style={{
                  flex: 1,
                  background: '#f0f0f0',
                  color: '#333',
                  border: 'none',
                  padding: '12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "'Cinzel', serif",
                  cursor: 'pointer',
                }}
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={confirmarDelete}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "'Cinzel', serif",
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(198, 40, 40, 0.35)',
                }}
              >
                EXCLUIR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Estilos reutilizáveis
   ============================================================ */
const overlayEstilo = {
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
};

const cardEstilo = {
  background: '#fff',
  borderRadius: 20,
  padding: '24px 24px 20px',
  maxWidth: 480,
  width: '100%',
  maxHeight: '92vh',
  overflowY: 'auto',
  boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
  border: '1.5px solid #C8A24A',
  fontFamily: "'Montserrat', sans-serif",
};

const labelEstilo = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#2c163a',
  marginBottom: 6,
  letterSpacing: '0.2px',
};

const inputEstilo = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #d8b4fe',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  color: '#2c163a',
  fontFamily: "'Montserrat', sans-serif",
};

const btnAcao = {
  background: 'transparent',
  border: '1px solid #e2d2f5',
  borderRadius: 8,
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: '#7e22ce',
  fontFamily: "'Montserrat', sans-serif",
};

const btnSeta = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 10,
  color: '#7e22ce',
  padding: '1px 6px',
  fontFamily: "'Montserrat', sans-serif",
};