// src/components/agendamento/ConfiguradorAgenda.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MdAdd, MdDelete, MdSave, MdCheckCircle } from 'react-icons/md';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function ConfiguradorAgenda({ uidEsteticista }) {
  const [blocos, setBlocos] = useState([]);
  const [bloqueios, setBloqueios] = useState([]);
  const [config, setConfig] = useState({
    diasFuturosMaximo: 60,
    antecedenciaMinimaHoras: 4,
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  // Carrega config
  useEffect(() => {
    if (!uidEsteticista) return;
    (async () => {
      try {
        const ref = doc(db, `usuarios/${uidEsteticista}/agenda_config`, 'principal');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          setBlocos(d.blocosSemanais || []);
          setBloqueios(d.bloqueios || []);
          setConfig({
            diasFuturosMaximo: d.diasFuturosMaximo ?? 60,
            antecedenciaMinimaHoras: d.antecedenciaMinimaHoras ?? 4,
          });
        }
      } catch (e) {
        console.error('Erro ao carregar config:', e);
      } finally {
        setCarregando(false);
      }
    })();
  }, [uidEsteticista]);

  const adicionarBloco = (diaSemana) => {
    setBlocos((prev) => [
      ...prev,
      { diaSemana, inicio: '09:00', fim: '12:00', duracaoMin: 60 },
    ]);
  };

  const atualizarBloco = (idx, campo, valor) => {
    setBlocos((prev) => prev.map((b, i) => (i === idx ? { ...b, [campo]: valor } : b)));
  };

  const removerBloco = (idx) => {
    setBlocos((prev) => prev.filter((_, i) => i !== idx));
  };

  const adicionarBloqueio = () => {
    setBloqueios((prev) => [...prev, { data: '', motivo: '' }]);
  };

  const atualizarBloqueio = (idx, campo, valor) => {
    setBloqueios((prev) => prev.map((b, i) => (i === idx ? { ...b, [campo]: valor } : b)));
  };

  const removerBloqueio = (idx) => {
    setBloqueios((prev) => prev.filter((_, i) => i !== idx));
  };

  const salvar = async () => {
    setSalvando(true);
    setSalvo(false);
    try {
      const ref = doc(db, `usuarios/${uidEsteticista}/agenda_config`, 'principal');
      await setDoc(
        ref,
        {
          blocosSemanais: blocos.map((b) => ({
            ...b,
            duracaoMin: parseInt(b.duracaoMin, 10) || 60,
          })),
          bloqueios: bloqueios.filter((b) => b.data),
          liberacoesAvulsas: [],
          diasFuturosMaximo: parseInt(config.diasFuturosMaximo, 10) || 60,
          antecedenciaMinimaHoras: parseInt(config.antecedenciaMinimaHoras, 10) || 4,
          atualizadoEm: new Date().toISOString(),
        },
        { merge: true }
      );
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    } catch (e) {
      console.error('Erro ao salvar config:', e);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <div style={{ padding: 24 }}>Carregando agenda…</div>;

  return (
    <div style={{ padding: '20px 0' }}>
      <h3 style={titulo}>⚙️ Configurar minha agenda</h3>
      <p style={subtitulo}>
        Defina os horários que você atende por dia da semana. Depois clique em Salvar.
      </p>

      {/* Blocos por dia da semana */}
      {DIAS.map((nomeDia, diaSemana) => {
        const blocosDoDia = blocos
          .map((b, idx) => ({ ...b, idx }))
          .filter((b) => b.diaSemana === diaSemana);

        return (
          <div key={diaSemana} style={cardDia}>
            <div style={headerDia}>
              <strong style={{ fontFamily: "'Cinzel', serif", color: '#2c163a' }}>{nomeDia}</strong>
              <button type="button" onClick={() => adicionarBloco(diaSemana)} style={btnMini}>
                <MdAdd size={14} /> Adicionar bloco
              </button>
            </div>

            {blocosDoDia.length === 0 ? (
              <span style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>
                Sem atendimento neste dia
              </span>
            ) : (
              blocosDoDia.map((b) => (
                <div key={b.idx} style={linhaBloco}>
                  <input
                    type="time"
                    value={b.inicio}
                    onChange={(e) => atualizarBloco(b.idx, 'inicio', e.target.value)}
                    style={inputTempo}
                  />
                  <span>até</span>
                  <input
                    type="time"
                    value={b.fim}
                    onChange={(e) => atualizarBloco(b.idx, 'fim', e.target.value)}
                    style={inputTempo}
                  />
                  <span style={{ fontSize: 11, color: '#666' }}>dura</span>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={b.duracaoMin}
                    onChange={(e) => atualizarBloco(b.idx, 'duracaoMin', e.target.value)}
                    style={{ ...inputTempo, width: 60 }}
                  />
                  <span style={{ fontSize: 11, color: '#666' }}>min</span>
                  <button type="button" onClick={() => removerBloco(b.idx)} style={btnIconPerigo}>
                    <MdDelete size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        );
      })}

      {/* Bloqueios */}
      <div style={{ ...cardDia, marginTop: 20, borderColor: '#fcd34d', background: '#fffbeb' }}>
        <div style={headerDia}>
          <strong style={{ fontFamily: "'Cinzel', serif", color: '#92400e' }}>
            🚫 Dias bloqueados (folgas, feriados)
          </strong>
          <button type="button" onClick={adicionarBloqueio} style={btnMini}>
            <MdAdd size={14} /> Adicionar
          </button>
        </div>
        {bloqueios.length === 0 ? (
          <span style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>
            Nenhum dia bloqueado
          </span>
        ) : (
          bloqueios.map((b, idx) => (
            <div key={idx} style={linhaBloco}>
              <input
                type="date"
                value={b.data}
                onChange={(e) => atualizarBloqueio(idx, 'data', e.target.value)}
                style={inputTempo}
              />
              <input
                type="text"
                placeholder="Motivo (opcional)"
                value={b.motivo}
                onChange={(e) => atualizarBloqueio(idx, 'motivo', e.target.value)}
                style={{ ...inputTempo, flex: 1 }}
              />
              <button type="button" onClick={() => removerBloqueio(idx)} style={btnIconPerigo}>
                <MdDelete size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Configurações gerais */}
      <div style={{ ...cardDia, marginTop: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={label}>
            Aceitar agendamentos até
            <input
              type="number"
              value={config.diasFuturosMaximo}
              onChange={(e) => setConfig((c) => ({ ...c, diasFuturosMaximo: e.target.value }))}
              style={{ ...inputTempo, marginLeft: 8, width: 70 }}
            />
            dias à frente
          </label>
          <label style={label}>
            Antecedência mínima
            <input
              type="number"
              value={config.antecedenciaMinimaHoras}
              onChange={(e) => setConfig((c) => ({ ...c, antecedenciaMinimaHoras: e.target.value }))}
              style={{ ...inputTempo, marginLeft: 8, width: 60 }}
            />
            horas
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        style={{
          ...btnSalvar,
          background: salvo ? '#16a34a' : '#C8A24A',
          cursor: salvando ? 'wait' : 'pointer',
        }}
      >
        {salvando ? 'SALVANDO…' : salvo ? <><MdCheckCircle size={16} /> SALVO!</> : <><MdSave size={16} /> SALVAR AGENDA</>}
      </button>
    </div>
  );
}

// Estilos
const titulo = { fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: 18, margin: '0 0 6px 0' };
const subtitulo = { fontSize: 12, color: '#666', marginBottom: 20 };
const cardDia = { background: '#fff', border: '1px solid #e2d2f5', borderRadius: 12, padding: 14, marginBottom: 12 };
const headerDia = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 };
const linhaBloco = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' };
const inputTempo = { padding: '6px 8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 12 };
const btnMini = { display: 'flex', alignItems: 'center', gap: 4, background: '#faf5ff', color: '#7e22ce', border: '1px solid #d8b4fe', borderRadius: 12, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' };
const btnIconPerigo = { background: 'transparent', border: 'none', color: '#c62828', cursor: 'pointer', padding: 4 };
const label = { fontSize: 12, color: '#444', display: 'flex', alignItems: 'center' };
const btnSalvar = { marginTop: 24, width: '100%', color: '#fff', border: 'none', padding: '14px', borderRadius: 20, fontFamily: "'Cinzel', serif", fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };