// src/components/FichaProtocolo.jsx
import React, { useState, useEffect, useRef } from 'react';
import { MdSave, MdArrowBack, MdDownload, MdAdd, MdDelete, MdEdit, MdCheckCircle } from 'react-icons/md';
import { exportarParaPDF } from '../utils/gerarPdf';

export default function FichaProtocolo({
  mode = 'create',
  initialData,
  onSave,
  onVoltar,
  onIrParaEdicao,
  pacienteSelecionado,
  pacienteNomeProp,
}) {
  const [nomeCliente, setNomeCliente] = useState('');
  const [dataRealizacao, setDataRealizacao] = useState('');
  const [textoLivre, setTextoLivre] = useState('');
  const [lembretes, setLembretes] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [salvoSucesso, setSalvoSucesso] = useState(false);

  const textareaRef = useRef(null);
  const isView = mode === 'view';

  const ajustarAlturaTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(300, textarea.scrollHeight)}px`;
    }
  };

  useEffect(() => {
    ajustarAlturaTextarea();
  }, [textoLivre]);

  useEffect(() => {
    const nomeFinal =
      pacienteSelecionado?.nome ||
      pacienteNomeProp ||
      initialData?.nomeCliente ||
      initialData?.paciente ||
      '';

    const realizacaoFinal =
      initialData?.dataRealizacao || new Date().toLocaleDateString('pt-BR');

    setNomeCliente(nomeFinal);
    setDataRealizacao(realizacaoFinal);
    setTextoLivre(initialData?.textoLivre || '');
    setLembretes(Array.isArray(initialData?.lembretes) ? initialData.lembretes : []);
  }, [initialData, pacienteSelecionado, pacienteNomeProp]);

  const handleSubmit = async () => {
    if (isView || salvando || salvoSucesso) return;

    const dadosProtocolo = {
      id: initialData?.id || Date.now(),
      nomeCliente,
      dataRealizacao,
      textoLivre,
      lembretes,
      dataCriacao:
        initialData?.dataCriacao ||
        new Date().toLocaleDateString('pt-BR') +
          ' às ' +
          new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
    };

    setSalvando(true);
    try {
      if (onSave) await onSave(dadosProtocolo);
      setSalvando(false);
      setSalvoSucesso(true);
      setTimeout(() => {
        setSalvoSucesso(false);
        if (onVoltar) onVoltar();
      }, 1400);
    } catch (err) {
      console.error('Erro ao salvar protocolo:', err);
      setSalvando(false);
      alert('Erro ao salvar protocolo. Tente novamente.');
    }
  };

  // ============================================================
  // LEMBRETES
  // ============================================================
  const adicionarLembrete = () => {
    if (isView) return;
    setLembretes([
      ...lembretes,
      {
        titulo: '',
        tipo: 'intervalo',
        valor: '',
        intervaloNumero: '8',
        intervaloUnidade: 'horas',
      },
    ]);
  };

  const removerLembrete = (index) => {
    if (isView) return;
    setLembretes(lembretes.filter((_, i) => i !== index));
  };

  const atualizarLembrete = (index, campo, valor) => {
    if (isView) return;
    const novos = [...lembretes];
    novos[index][campo] = valor;
    setLembretes(novos);
  };

  const formatarDataHoraBR = (valorISO) => {
    if (!valorISO) return '';
    if (valorISO.includes('/')) return valorISO;
    try {
      const [data, hora] = valorISO.split('T');
      if (!data) return valorISO;
      const [ano, mes, dia] = data.split('-');
      const horaFinal = hora ? hora.slice(0, 5) : '';
      return `${dia}/${mes}/${ano}${horaFinal ? ' ' + horaFinal : ''}`;
    } catch (e) {
      return valorISO;
    }
  };

  return (
    <div style={{
      backgroundColor: '#dfc6fc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      minHeight: '100vh',
      margin: 0,
      padding: '20px 10px',
      fontFamily: "'Montserrat', sans-serif",
      boxSizing: 'border-box',
      overflowX: 'hidden',
      position: 'relative'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600&display=swap');

        .input-line {
          width: 100%; border: none; background: transparent;
          border-bottom: 1px solid #C8A24A; outline: none;
          height: 18px; font-size: 13px; color: #1A1A1A;
        }
        .modulo-bloco {
          background: rgba(255, 255, 255, 0.45);
          border: 1.5px solid #a855f7;
          border-radius: 8px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.03);
          box-sizing: border-box;
          width: 100%;
        }
        
        .btn-acao-padrao {
          font-family: 'Cinzel', serif;
          background: linear-gradient(135deg, #C8A24A 0%, #e2be64 100%);
          color: #ffffff;
          border: 1.5px solid #9c7826;
          padding: 12px 32px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 1.5px;
          border-radius: 30px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 15px rgba(200, 162, 74, 0.4);
          transition: all 0.3s ease;
          outline: none;
          justify-content: center;
          width: 100%;
          max-width: 340px;
        }
        .btn-acao-padrao:hover {
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 6px 22px rgba(200, 162, 74, 0.6);
          background: linear-gradient(135deg, #d8b052 0%, #eccb74 100%);
        }

        .btn-voltar-padrao {
          font-family: 'Cinzel', serif;
          background: transparent;
          color: #2c163a;
          border: 1.5px solid #C8A24A;
          padding: 12px 32px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.5px;
          border-radius: 30px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.3s ease;
          outline: none;
          justify-content: center;
          width: 100%;
          max-width: 340px;
        }
        .btn-voltar-padrao:hover {
          background: rgba(200, 162, 74, 0.1);
        }
      `}</style>

      <div
        id="protocolo-container"
        style={{
          width: '100%',
          maxWidth: '1175px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          zIndex: 1,
          backgroundColor: '#ffffff'
        }}
      >
        {/* 1. TOPO DA MOLDURA */}
        <div style={{
          width: '100%',
          height: '420px',
          backgroundImage: 'url("/imagens/moldura-topo-protocolo.jpeg")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center bottom',
          backgroundSize: '100% 100%',
          flexShrink: 0,
          marginBottom: '-130px',
          zIndex: 3,
          position: 'relative',
          boxSizing: 'border-box',
          padding: '290px 95px 0 95px',
          pointerEvents: 'auto'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px', minWidth: '220px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>Nome:</span>
                <div style={{ flexGrow: 1, minWidth: 0, display: 'flex' }}>
                  <input type="text" value={nomeCliente} readOnly className="input-line" />
                </div>
              </div>
              <div style={{ width: '250px', flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>DATA DE REALIZAÇÃO:</span>
                <div style={{ width: '100px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <input type="text" value={dataRealizacao} readOnly className="input-line" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. CORPO DA MOLDURA */}
        <div style={{
          width: '100%',
          backgroundImage: 'url("/imagens/moldura-meio.jpeg")',
          backgroundRepeat: 'repeat-y',
          backgroundPosition: 'center top',
          backgroundSize: '100% auto',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: '150px 95px 160px 95px',
          position: 'relative',
          zIndex: 2
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '480px', height: '480px', backgroundImage: 'url("/imagens/logo-samiramarcadagua.jpeg")',
            backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'contain',
            opacity: 0.45, pointerEvents: 'none', zIndex: 1
          }} />

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* MÓDULO: PROTOCOLO */}
            <div className="modulo-bloco">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '5px' }}>
                <div style={{ flex: 1, height: '1.5px', background: 'rgba(200, 162, 74, 0.5)' }} />
                <div style={{ fontFamily: "'Cinzel', serif", color: '#1A1A1A', background: 'rgba(255, 255, 255, 0.9)', padding: '4px 14px', fontSize: '12px', fontWeight: 700, border: '1.5px solid #C8A24A', borderRadius: '12px', textAlign: 'center', letterSpacing: '1.5px' }}>
                  DESCRIÇÃO DO PROTOCOLO
                </div>
                <div style={{ flex: 1, height: '1.5px', background: 'rgba(200, 162, 74, 0.5)' }} />
              </div>

              <textarea
                ref={textareaRef}
                value={textoLivre}
                onChange={(e) => {
                  setTextoLivre(e.target.value);
                  ajustarAlturaTextarea();
                }}
                readOnly={isView}
                placeholder="Digite aqui o protocolo do tratamento, recomendações, produtos utilizados..."
                style={{
                  width: '100%', minHeight: '300px', height: 'auto',
                  border: '1px solid rgba(200, 162, 74, 0.4)', borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.65)', padding: '15px',
                  fontSize: '14px', outline: 'none', resize: 'none',
                  overflow: 'hidden', fontFamily: "'Montserrat', sans-serif",
                  boxSizing: 'border-box', lineHeight: '1.6', color: '#1A1A1A',
                  wordWrap: 'break-word', overflowWrap: 'break-word'
                }}
              />
            </div>

            {/* MÓDULO: LEMBRETES */}
            <div className="modulo-bloco" style={{ padding: '12px 14px', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '1.5px', background: 'rgba(200, 162, 74, 0.3)', width: '20px' }} />
                  <span style={{ fontFamily: "'Cinzel', serif", color: '#1A1A1A', fontSize: '11px', fontWeight: 700, border: '1px solid #C8A24A', padding: '2px 10px', borderRadius: '12px' }}>
                    LEMBRETES PARA O PACIENTE
                  </span>
                  <div style={{ flex: 1, height: '1.5px', background: 'rgba(200, 162, 74, 0.3)', width: '20px' }} />
                </div>
                {!isView && (
                  <button
                    type="button"
                    onClick={adicionarLembrete}
                    style={{ background: '#C8A24A', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '14px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontFamily: "'Cinzel', serif" }}
                  >
                    <MdAdd size={14} /> Adicionar
                  </button>
                )}
              </div>

              {lembretes.length === 0 ? (
                <p style={{ fontSize: '11px', color: '#92400e', fontStyle: 'italic', textAlign: 'center', margin: '10px 0' }}>
                  Nenhum lembrete registrado.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lembretes.map((lembrete, index) => (
                    <div key={index} style={{ background: 'rgba(255, 255, 255, 0.8)', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#C8A24A' }}>Lembrete #{index + 1}</span>
                        {!isView && (
                          <button type="button" onClick={() => removerLembrete(index)} style={{ background: 'transparent', border: 'none', color: '#c62828', cursor: 'pointer', padding: 0 }}>
                            <MdDelete size={14} />
                          </button>
                        )}
                      </div>
                      
                      <div style={{ marginBottom: '8px' }}>
                        <label style={{ fontSize: '9px', color: '#666', display: 'block', marginBottom: '2px', fontWeight: 600 }}>Título:</label>
                        <input
                          type="text"
                          value={lembrete.titulo}
                          onChange={(e) => atualizarLembrete(index, 'titulo', e.target.value)}
                          readOnly={isView}
                          placeholder="Ex: Retorno em 30 dias"
                          style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '11px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.9)' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '120px' }}>
                          <label style={{ fontSize: '9px', color: '#666', display: 'block', marginBottom: '2px', fontWeight: 600 }}>Tipo:</label>
                          <select
                            value={lembrete.tipo}
                            onChange={(e) => atualizarLembrete(index, 'tipo', e.target.value)}
                            disabled={isView}
                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '11px', background: 'rgba(255,255,255,0.9)' }}
                          >
                            <option value="intervalo">Intervalo</option>
                            <option value="data_hora">Data e Hora</option>
                          </select>
                        </div>
                        
                        <div style={{ flex: 1, minWidth: '160px' }}>
                          <label style={{ fontSize: '9px', color: '#666', display: 'block', marginBottom: '2px', fontWeight: 600 }}>
                            {lembrete.tipo === 'intervalo' ? 'A cada:' : 'Data e Hora:'}
                          </label>
                          {lembrete.tipo === 'intervalo' ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <input type="number" value={lembrete.intervaloNumero} onChange={(e) => atualizarLembrete(index, 'intervaloNumero', e.target.value)} readOnly={isView} min="1" style={{ width: '50px', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '11px', background: 'rgba(255,255,255,0.9)' }} />
                              <select value={lembrete.intervaloUnidade} onChange={(e) => atualizarLembrete(index, 'intervaloUnidade', e.target.value)} disabled={isView} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '11px', background: 'rgba(255,255,255,0.9)' }}>
                                <option value="horas">Horas</option>
                                <option value="dias">Dias</option>
                                <option value="minutos">Minutos</option>
                              </select>
                            </div>
                          ) : (
                            <input
                              type={isView ? "text" : "datetime-local"}
                              value={isView ? formatarDataHoraBR(lembrete.valor) : lembrete.valor}
                              onChange={(e) => atualizarLembrete(index, 'valor', e.target.value)}
                              readOnly={isView}
                              style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '11px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.9)' }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. BASE DA MOLDURA COM BOTÕES */}
        <div style={{
          width: '100%',
          height: '600px',
          backgroundImage: 'url("/imagens/moldura-base.jpeg")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center top',
          backgroundSize: '100% 100%',
          flexShrink: 0,
          marginTop: '-140px',
          zIndex: 3,
          position: 'relative',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          paddingTop: '90px',
          boxSizing: 'border-box',
          gap: '15px'
        }}>
          <div className="botoes-acao-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', width: '100%' }}>
            {isView ? (
              <>
                <button
                  type="button"
                  className="btn-acao-padrao"
                  onClick={() => exportarParaPDF('protocolo-container', nomeCliente)}
                  style={{ background: 'linear-gradient(135deg, #b8a3c9 0%, #d7cee0 100%)', color: '#2c163a', borderColor: '#8a6fa8' }}
                >
                  <MdDownload size={20} /> BAIXAR PDF
                </button>
                {onIrParaEdicao && (
                  <button
                    type="button"
                    className="btn-acao-padrao"
                    onClick={onIrParaEdicao}
                  >
                    <MdEdit size={20} /> EDITAR PROTOCOLO
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                className="btn-acao-padrao"
                onClick={handleSubmit}
                disabled={salvando || salvoSucesso}
                style={{
                  background: salvoSucesso ? 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)' : 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                  borderColor: salvoSucesso ? '#16a34a' : '#9c7826',
                  cursor: (salvando || salvoSucesso) ? 'default' : 'pointer',
                }}
              >
                {salvando ? (
                  <><span className="spinner-salvar" /> SALVANDO...</>
                ) : salvoSucesso ? (
                  <><MdCheckCircle size={20} /> SALVO COM SUCESSO!</>
                ) : (
                  <><MdSave size={20} /> SALVAR PROTOCOLO</>
                )}
              </button>
            )}
            
            <button
              type="button"
              className="btn-voltar-padrao"
              onClick={onVoltar}
            >
              <MdArrowBack size={20} /> VOLTAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}