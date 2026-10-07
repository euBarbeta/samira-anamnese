// src/components/agendamento/ConfiguradorAgenda.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  MdAdd, MdDelete, MdSave, MdCheckCircle,
  MdArrowBack, MdArrowForward, MdClose,
  MdEventBusy, MdEventAvailable, MdEditCalendar,
  MdLock, MdWarning,
} from 'react-icons/md';
import { toISODateLocal } from '../../utils/agenda';

const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function ConfiguradorAgenda({ uidEsteticista }) {
  const [blocos, setBlocos] = useState([]);         // padrão semanal
  const [bloqueios, setBloqueios] = useState([]);   // folgas globais
  const [datasEspecificas, setDatasEspecificas] = useState({}); // override
  const [config, setConfig] = useState({
    diasFuturosMaximo: 60,
    antecedenciaMinimaHoras: 4,
  });

  const [mesRef, setMesRef] = useState(() => new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(null); // ISO
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [mostrarPadrao, setMostrarPadrao] = useState(false);

  // Carrega config
useEffect(() => {
  if (!uidEsteticista) return;
  let cancelado = false;

  const unsub = onSnapshot(
    doc(db, `usuarios/${uidEsteticista}/agenda_config`, 'principal'),
    (snap) => {
      if (cancelado) return;
      if (snap.exists()) {
        const d = snap.data();
        setBlocos(d.blocosSemanais || []);
        setBloqueios(d.bloqueios || []);
        setDatasEspecificas(d.datasEspecificas || {});
        setConfig({
          diasFuturosMaximo: d.diasFuturosMaximo ?? 60,
          antecedenciaMinimaHoras: d.antecedenciaMinimaHoras ?? 4,
        });
      }
      setCarregando(false);
    },
    (err) => {
      console.error('Erro listener config:', err);
      setCarregando(false);
    }
  );

  return () => { cancelado = true; unsub(); };
}, [uidEsteticista]);

  // Monta dias do mês visível
  const diasDoMes = useMemo(() => {
    const ano = mesRef.getFullYear();
    const mes = mesRef.getMonth();
    const primeiro = new Date(ano, mes, 1);
    const ultimo = new Date(ano, mes + 1, 0);

    const diaSemanaInicial = primeiro.getDay();
    const totalDias = ultimo.getDate();

    const cells = [];

    // Preenche com vazios antes do dia 1
    for (let i = 0; i < diaSemanaInicial; i++) cells.push(null);

    for (let dia = 1; dia <= totalDias; dia++) {
      cells.push(new Date(ano, mes, dia));
    }

    // Preenche até completar 6 semanas (42 células) pra grid uniforme
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [mesRef]);

  // Info visual de cada dia
  const infoDia = (data) => {
    if (!data) return null;
    const iso = toISODateLocal(data);
    const dow = data.getDay();

    const bloqueio = bloqueios.find((b) => b.data === iso);
    const override = datasEspecificas[iso];

    if (bloqueio || override?.bloqueado) {
      return { status: 'bloqueado', motivo: bloqueio?.motivo || override?.motivo };
    }

    const temOverride = override?.blocos?.length > 0;
    const temPadrao = blocos.some((b) => b.diaSemana === dow);

    if (temOverride || temPadrao) {
      const qtd = temOverride
        ? override.blocos.length
        : blocos.filter((b) => b.diaSemana === dow).length;
      return { status: 'aberto', blocos: qtd, custom: temOverride };
    }

    return { status: 'vazio' };
  };

  const mudarMes = (delta) => {
    const nova = new Date(mesRef);
    nova.setMonth(nova.getMonth() + delta);
    setMesRef(nova);
  };

  const irHoje = () => setMesRef(new Date());

  // ============ Padrão semanal ============
  const adicionarBlocoPadrao = (diaSemana) => {
    setBlocos((prev) => [
      ...prev,
      { diaSemana, inicio: '09:00', fim: '12:00', duracaoMin: 60 },
    ]);
  };
  const atualizarBlocoPadrao = (idx, campo, valor) => {
    setBlocos((prev) => prev.map((b, i) => (i === idx ? { ...b, [campo]: valor } : b)));
  };
  const removerBlocoPadrao = (idx) => {
    setBlocos((prev) => prev.filter((_, i) => i !== idx));
  };

  // ============ Data específica (modal) ============
  const abrirDia = (data) => {
    if (!data) return;
    setDiaSelecionado(toISODateLocal(data));
  };

  const fecharModal = () => setDiaSelecionado(null);

  const getInfoOverride = (iso) => {
    return datasEspecificas[iso] || null;
  };

  const setOverride = (iso, valor) => {
    setDatasEspecificas((prev) => {
      const copia = { ...prev };
      if (valor === null) delete copia[iso];
      else copia[iso] = valor;
      return copia;
    });
  };

  // Salvar geral
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
          datasEspecificas,
          liberacoesAvulsas: [],
          diasFuturosMaximo: parseInt(config.diasFuturosMaximo, 10) || 60,
          antecedenciaMinimaHoras:
            parseInt(config.antecedenciaMinimaHoras, 10) || 4,
          atualizadoEm: new Date().toISOString(),
        },
        { merge: true }
      );
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    } catch (e) {
      console.error('Erro ao salvar:', e);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>
        Carregando agenda…
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 0 30px 0' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h3 style={{
          fontFamily: "'Cinzel', serif", color: '#2c163a',
          fontSize: 18, margin: 0,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <MdEditCalendar size={20} color="#7e22ce" />
          Configurar minha agenda
        </h3>
        <button
          type="button"
          onClick={() => setMostrarPadrao((v) => !v)}
          style={{
            fontFamily: "'Cinzel', serif",
            background: mostrarPadrao ? '#7e22ce' : '#faf5ff',
            color: mostrarPadrao ? '#fff' : '#7e22ce',
            border: '1.5px solid #d8b4fe',
            padding: '8px 14px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {mostrarPadrao ? 'Fechar padrão semanal' : 'Editar padrão semanal'}
        </button>
      </div>

      {/* Padrão semanal (colapsável) */}
      {mostrarPadrao && (
        <div style={{
          background: '#fff',
          border: '1.5px solid #e2d2f5',
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px 0' }}>
            <strong>Padrão semanal:</strong> define os horários que você atende
            normalmente em cada dia da semana. Depois você pode sobrescrever datas
            específicas clicando no calendário.
          </p>

          {DIAS_CURTO.map((nomeDia, diaSemana) => {
            const blocosDoDia = blocos
              .map((b, idx) => ({ ...b, idx }))
              .filter((b) => b.diaSemana === diaSemana);

            return (
              <div key={diaSemana} style={{
                background: '#faf5ff',
                border: '1px solid #ede4fb',
                borderRadius: 10,
                padding: 10,
                marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: 13 }}>
                    {nomeDia}
                  </strong>
                  <button
                    type="button"
                    onClick={() => adicionarBlocoPadrao(diaSemana)}
                    style={btnMini}
                  >
                    <MdAdd size={13} /> Adicionar bloco
                  </button>
                </div>

                {blocosDoDia.length === 0 ? (
                  <span style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>
                    Sem atendimento neste dia
                  </span>
                ) : (
                  blocosDoDia.map((b) => (
                    <div key={b.idx} style={linhaBloco}>
                      <input
                        id={`padrao-${b.idx}-inicio`}
                        name={`padrao-${b.idx}-inicio`}
                        type="time"
                        value={b.inicio}
                        onChange={(e) => atualizarBlocoPadrao(b.idx, 'inicio', e.target.value)}
                        style={inputTempo}
                      />
                      <span style={{ fontSize: 11, color: '#888' }}>até</span>
                      <input
                        id={`padrao-${b.idx}-fim`}
                        name={`padrao-${b.idx}-fim`}
                        type="time"
                        value={b.fim}
                        onChange={(e) => atualizarBlocoPadrao(b.idx, 'fim', e.target.value)}
                        style={inputTempo}
                      />
                      <input
                        id={`padrao-${b.idx}-duracao`}
                        name={`padrao-${b.idx}-duracao`}
                        type="number"
                        min="15"
                        step="15"
                        value={b.duracaoMin}
                        onChange={(e) => atualizarBlocoPadrao(b.idx, 'duracaoMin', e.target.value)}
                        style={{ ...inputTempo, width: 55 }}
                      />
                      <span style={{ fontSize: 11, color: '#888' }}>min</span>
                      <button
                        type="button"
                        onClick={() => removerBlocoPadrao(b.idx)}
                        style={btnIconPerigo}
                        title="Remover"
                      >
                        <MdDelete size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Calendário */}
      <div style={{
        background: '#fff',
        border: '1.5px solid #e2d2f5',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
      }}>
        {/* Navegação de mês */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          gap: 8,
        }}>
          <button type="button" onClick={() => mudarMes(-1)} style={btnNav} aria-label="Mês anterior">
            <MdArrowBack size={18} color="#7e22ce" />
          </button>

          <button
            type="button"
            onClick={irHoje}
            style={{
              fontFamily: "'Cinzel', serif",
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#2c163a',
              fontSize: 14,
              fontWeight: 700,
              padding: '4px 12px',
            }}
          >
            {MESES[mesRef.getMonth()]} {mesRef.getFullYear()}
          </button>

          <button type="button" onClick={() => mudarMes(1)} style={btnNav} aria-label="Próximo mês">
            <MdArrowForward size={18} color="#7e22ce" />
          </button>
        </div>

        {/* Cabeçalho dias da semana */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
          marginBottom: 6,
        }}>
          {DIAS_CURTO.map((d) => (
            <div key={d} style={{
              textAlign: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: '#7e22ce',
              fontFamily: "'Cinzel', serif",
              padding: '4px 0',
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Grid de dias */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
        }}>
          {diasDoMes.map((data, i) => {
            if (!data) {
              return <div key={`empty-${i}`} style={{ aspectRatio: '1 / 1' }} />;
            }

            const iso = toISODateLocal(data);
            const ehHoje = iso === toISODateLocal(new Date());
            const info = infoDia(data);
            const dia = data.getDate();

            const bg =
              info.status === 'bloqueado' ? '#ffebee' :
              info.status === 'aberto'    ? '#f0fdf4' :
                                            '#f5f5f5';
            const border =
              info.status === 'bloqueado' ? '#ef9a9a' :
              info.status === 'aberto'    ? '#86efac' :
                                            '#e0e0e0';
            const corTexto =
              info.status === 'bloqueado' ? '#c62828' :
              info.status === 'aberto'    ? '#166534' :
                                            '#999';

            return (
              <button
                key={i}
                type="button"
                onClick={() => abrirDia(data)}
                title={
                  info.status === 'aberto'
                    ? `${info.blocos} bloco(s)${info.custom ? ' (customizado)' : ''}`
                    : info.status === 'bloqueado'
                      ? `Bloqueado${info.motivo ? ': ' + info.motivo : ''}`
                      : 'Sem agenda'
                }
                style={{
                  aspectRatio: '1 / 1',
                  background: bg,
                  border: `1.5px solid ${ehHoje ? '#7e22ce' : border}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 4,
                  position: 'relative',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  fontSize: 13,
                  fontWeight: ehHoje ? 800 : 600,
                  color: ehHoje ? '#7e22ce' : corTexto,
                }}>
                  {dia}
                </span>
                {info.status === 'aberto' && (
                  <span style={{
                    fontSize: 8,
                    color: corTexto,
                    marginTop: 2,
                    fontWeight: 700,
                  }}>
                    {info.blocos}×
                  </span>
                )}
                {info.status === 'bloqueado' && (
                  <MdEventBusy size={10} color="#c62828" style={{ marginTop: 2 }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Legenda */}
        <div style={{
          display: 'flex',
          gap: 14,
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px dashed #e2d2f5',
          fontSize: 10,
          color: '#666',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          <Legenda cor="#f0fdf4" borda="#86efac" texto="Com agenda" />
          <Legenda cor="#ffebee" borda="#ef9a9a" texto="Bloqueado" />
          <Legenda cor="#f5f5f5" borda="#e0e0e0" texto="Sem agenda" />
          <Legenda cor="#fff" borda="#7e22ce" texto="Hoje" />
        </div>
      </div>

      {/* Configurações gerais */}
      <div style={{
        background: '#fff',
        border: '1.5px solid #e2d2f5',
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <label htmlFor="cfg-dias-futuros" style={labelStyle}>
          Aceitar agendamentos até
          <input
            id="cfg-dias-futuros"
            name="diasFuturosMaximo"
            type="number"
            value={config.diasFuturosMaximo}
            onChange={(e) => setConfig((c) => ({ ...c, diasFuturosMaximo: e.target.value }))}
            style={{ ...inputTempo, marginLeft: 8, width: 70 }}
          />
          dias à frente
        </label>
        <label htmlFor="cfg-antecedencia" style={labelStyle}>
          Antecedência mínima
          <input
            id="cfg-antecedencia"
            name="antecedenciaMinimaHoras"
            type="number"
            value={config.antecedenciaMinimaHoras}
            onChange={(e) => setConfig((c) => ({ ...c, antecedenciaMinimaHoras: e.target.value }))}
            style={{ ...inputTempo, marginLeft: 8, width: 60 }}
          />
          horas
        </label>
      </div>

      {/* Botão salvar */}
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        style={{
          width: '100%',
          color: '#fff',
          border: 'none',
          padding: '14px',
          borderRadius: 20,
          fontFamily: "'Cinzel', serif",
          fontSize: 13,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: salvo ? '#16a34a' : '#C8A24A',
          cursor: salvando ? 'wait' : 'pointer',
          boxShadow: '0 4px 14px rgba(200, 162, 74, 0.35)',
        }}
      >
        {salvando ? 'SALVANDO…' :
         salvo ? <><MdCheckCircle size={16} /> SALVO!</> :
                 <><MdSave size={16} /> SALVAR AGENDA</>}
      </button>

      {/* Modal do dia */}
      {diaSelecionado && (
        <ModalDia
          iso={diaSelecionado}
          onFechar={fecharModal}
          getOverride={() => getInfoOverride(diaSelecionado)}
          setOverride={(v) => setOverride(diaSelecionado, v)}
          padraoDoDia={(() => {
            const d = new Date(diaSelecionado + 'T12:00:00');
            return blocos.filter((b) => b.diaSemana === d.getDay());
          })()}
        />
      )}
    </div>
  );
}

/* ============ Modal de editar um dia específico ============ */
function ModalDia({ iso, onFechar, getOverride, setOverride, padraoDoDia }) {
  const override = getOverride();
  const [bloqueado, setBloqueado] = useState(override?.bloqueado || false);
  const [motivo, setMotivo] = useState(override?.motivo || '');
  const [blocosDia, setBlocosDia] = useState(
    override?.blocos?.length ? override.blocos : padraoDoDia.map((b) => ({
      inicio: b.inicio, fim: b.fim, duracaoMin: b.duracaoMin,
    }))
  );
  const [usaPadrao, setUsaPadrao] = useState(!override?.blocos?.length);

  const dataFormatada = (() => {
    const d = new Date(iso + 'T12:00:00');
    const dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    return `${dias[d.getDay()]}, ${d.getDate()}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  })();

  const adicionarBloco = () => {
    setUsaPadrao(false);
    setBlocosDia((prev) => [...prev, { inicio: '09:00', fim: '12:00', duracaoMin: 60 }]);
  };
  const atualizarBloco = (i, campo, valor) => {
    setBlocosDia((prev) => prev.map((b, idx) => (idx === i ? { ...b, [campo]: valor } : b)));
  };
  const removerBloco = (i) => {
    setBlocosDia((prev) => prev.filter((_, idx) => idx !== i));
  };

  const aplicar = () => {
    if (bloqueado) {
      setOverride({ bloqueado: true, motivo: motivo.trim(), blocos: [] });
    } else if (usaPadrao) {
      // Volta ao padrão → remove override
      setOverride(null);
    } else {
      setOverride({
        bloqueado: false,
        blocos: blocosDia.map((b) => ({
          inicio: b.inicio,
          fim: b.fim,
          duracaoMin: parseInt(b.duracaoMin, 10) || 60,
        })),
      });
    }
    onFechar();
  };

  const limparOverride = () => {
    setOverride(null);
    onFechar();
  };

  return (
    <div
      onClick={onFechar}
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
          padding: 24,
          maxWidth: 520,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(44, 22, 58, 0.35)',
          border: '1.5px solid #C8A24A',
        }}
      >
        {/* Header do modal */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <h3 style={{
            fontFamily: "'Cinzel', serif",
            color: '#2c163a',
            fontSize: 16,
            margin: 0,
          }}>
            {dataFormatada}
          </h3>
          <button
            type="button"
            onClick={onFechar}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Fechar"
          >
            <MdClose size={20} color="#2c163a" />
          </button>
        </div>

        {/* Toggle bloquear */}
        <label
          htmlFor="modal-bloquear"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            background: bloqueado ? '#ffebee' : '#fafafa',
            border: `1.5px solid ${bloqueado ? '#ef9a9a' : '#e0e0e0'}`,
            borderRadius: 10,
            cursor: 'pointer',
            marginBottom: 14,
          }}
        >
          <input
            id="modal-bloquear"
            name="bloquearDia"
            type="checkbox"
            checked={bloqueado}
            onChange={(e) => setBloqueado(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Cinzel', serif",
              color: bloqueado ? '#c62828' : '#2c163a',
              fontSize: 12,
              fontWeight: 700,
            }}>
              Bloquear este dia (folga)
            </div>
            <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
              Nenhum agendamento será possível nesta data.
            </div>
          </div>
          <MdEventBusy size={20} color={bloqueado ? '#c62828' : '#bbb'} />
        </label>

        {/* Motivo se bloqueado */}
        {bloqueado && (
          <input
            id="modal-motivo"
            name="motivo"
            type="text"
            placeholder="Motivo (opcional, ex: feriado)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            style={{ ...inputTempo, width: '100%', marginBottom: 14, boxSizing: 'border-box' }}
          />
        )}

        {/* Blocos quando NÃO está bloqueado */}
        {!bloqueado && (
          <>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}>
              <strong style={{
                fontFamily: "'Cinzel', serif",
                color: '#2c163a',
                fontSize: 12,
              }}>
                Horários deste dia
              </strong>
              <label
                htmlFor="modal-usa-padrao"
                style={{
                  fontSize: 10,
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
              >
                <input
                  id="modal-usa-padrao"
                  name="usaPadrao"
                  type="checkbox"
                  checked={usaPadrao}
                  onChange={(e) => setUsaPadrao(e.target.checked)}
                />
                Usar padrão semanal
              </label>
            </div>

            {usaPadrao ? (
              <div style={{
                background: '#faf5ff',
                border: '1px dashed #d8b4fe',
                borderRadius: 8,
                padding: 12,
                fontSize: 11,
                color: '#666',
                marginBottom: 14,
                textAlign: 'center',
              }}>
                {padraoDoDia.length === 0 ? (
                  'Este dia não tem atendimento no padrão semanal.'
                ) : (
                  <>
                    Segue o padrão semanal:{' '}
                    {padraoDoDia
                      .map((b) => `${b.inicio}–${b.fim}`)
                      .join(', ')}
                  </>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                {blocosDia.length === 0 ? (
                  <div style={{
                    background: '#fff8e1',
                    border: '1px solid #fcd34d',
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 11,
                    color: '#92400e',
                  }}>
                    Nenhum bloco. Adicione ou marque "usar padrão semanal".
                  </div>
                ) : (
                  blocosDia.map((b, i) => (
                    <div key={i} style={linhaBloco}>
                      <input
                        id={`modal-bloco-${i}-inicio`}
                        name={`modal-bloco-${i}-inicio`}
                        type="time"
                        value={b.inicio}
                        onChange={(e) => atualizarBloco(i, 'inicio', e.target.value)}
                        style={inputTempo}
                      />
                      <span style={{ fontSize: 11, color: '#888' }}>até</span>
                      <input
                        id={`modal-bloco-${i}-fim`}
                        name={`modal-bloco-${i}-fim`}
                        type="time"
                        value={b.fim}
                        onChange={(e) => atualizarBloco(i, 'fim', e.target.value)}
                        style={inputTempo}
                      />
                      <input
                        id={`modal-bloco-${i}-duracao`}
                        name={`modal-bloco-${i}-duracao`}
                        type="number"
                        min="15"
                        step="15"
                        value={b.duracaoMin}
                        onChange={(e) => atualizarBloco(i, 'duracaoMin', e.target.value)}
                        style={{ ...inputTempo, width: 55 }}
                      />
                      <span style={{ fontSize: 11, color: '#888' }}>min</span>
                      <button
                        type="button"
                        onClick={() => removerBloco(i)}
                        style={btnIconPerigo}
                        aria-label="Remover bloco"
                      >
                        <MdDelete size={14} />
                      </button>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={adicionarBloco}
                  style={{ ...btnMini, marginTop: 8 }}
                >
                  <MdAdd size={13} /> Adicionar bloco específico
                </button>
              </div>
            )}
          </>
        )}

        {/* Rodapé */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginTop: 16,
          paddingTop: 14,
          borderTop: '1px solid #eee',
          flexWrap: 'wrap',
        }}>
          {override && (
            <button
              type="button"
              onClick={limparOverride}
              style={{
                fontFamily: "'Cinzel', serif",
                background: '#f0f0f0',
                color: '#666',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 16,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Remover customização
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onFechar}
            style={{
              fontFamily: "'Cinzel', serif",
              background: 'transparent',
              color: '#666',
              border: '1.5px solid #ddd',
              padding: '10px 16px',
              borderRadius: 16,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aplicar}
            style={{
              fontFamily: "'Cinzel', serif",
              background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 16,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(200, 162, 74, 0.35)',
            }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ Auxiliares ============ */
function Legenda({ cor, borda, texto }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        background: cor,
        border: `1.5px solid ${borda}`,
        borderRadius: 3,
      }} />
      {texto}
    </span>
  );
}

const btnNav = {
  background: '#faf5ff',
  border: '1.5px solid #d8b4fe',
  borderRadius: 10,
  padding: '6px 10px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};

const btnMini = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: '#faf5ff',
  color: '#7e22ce',
  border: '1px solid #d8b4fe',
  borderRadius: 12,
  padding: '4px 10px',
  fontSize: 10,
  fontWeight: 700,
  cursor: 'pointer',
};

const btnIconPerigo = {
  background: 'transparent',
  border: 'none',
  color: '#c62828',
  cursor: 'pointer',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
};

const linhaBloco = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginTop: 6,
  flexWrap: 'wrap',
};

const inputTempo = {
  padding: '6px 8px',
  border: '1.5px solid #d8b4fe',
  borderRadius: 6,
  fontSize: 12,
  background: '#fff',
  color: '#2c163a',
  outline: 'none',
};

const labelStyle = {
  fontSize: 12,
  color: '#444',
  display: 'flex',
  alignItems: 'center',
};