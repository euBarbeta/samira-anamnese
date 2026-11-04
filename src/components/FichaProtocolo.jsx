import React, { useState, useEffect, useRef } from 'react';
import {
  MdSave, MdArrowBack, MdDownload,
  MdEdit, MdCheckCircle, MdAdd, MdDelete
} from 'react-icons/md';
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
  const dadosOrigem = pacienteSelecionado?.anamnese || pacienteSelecionado || initialData?.anamnese || initialData || {};

  // 📱 RESPONSIVO
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth <= 768
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [nomeCliente, setNomeCliente] = useState('');
  const [dataNasc, setDataNasc] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numDocumento, setNumDocumento] = useState('');
  const [dataRealizacao, setDataRealizacao] = useState('');
  const [textoLivre, setTextoLivre] = useState('');
  const [lembretes, setLembretes] = useState([]);

  const [salvando, setSalvando] = useState(false);
  const [salvoSucesso, setSalvoSucesso] = useState(false);
  const [pdfDesktopRenderizando, setPdfDesktopRenderizando] = useState(false);

  const textareaRef = useRef(null);
  const isView = mode === 'view';

  const ajustarAlturaTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(isMobile ? 180 : 400, textarea.scrollHeight)}px`;
    }
  };

  useEffect(() => {
    ajustarAlturaTextarea();
  }, [textoLivre]);

  useEffect(() => {
    const nomeFinal =
      dadosOrigem.nome || dadosOrigem.nomeCliente || pacienteSelecionado?.nome ||
      pacienteNomeProp || initialData?.nomeCliente || initialData?.paciente || '';

    const nascFinal =
      dadosOrigem.dataNasc || dadosOrigem.dataNascimento || dadosOrigem.nascimento ||
      initialData?.dataNasc || initialData?.dataNascimento || '';

    const telFinal =
      dadosOrigem.telefone || dadosOrigem.celular || dadosOrigem.fone ||
      initialData?.telefone || initialData?.celular || '';

    const endFinal = dadosOrigem.endereco || dadosOrigem.end || initialData?.endereco || '';

    const docFinal =
      dadosOrigem.documento || dadosOrigem.nDocumento || dadosOrigem.numeroDocumento ||
      dadosOrigem.cpf || dadosOrigem.rg || initialData?.numDocumento ||
      initialData?.documento || initialData?.nDocumento || '';

    const realizacaoFinal = initialData?.dataRealizacao || new Date().toLocaleDateString('pt-BR');

    setNomeCliente(nomeFinal);
    setDataNasc(nascFinal);
    setTelefone(telFinal);
    setEndereco(endFinal);
    setNumDocumento(docFinal);
    setDataRealizacao(realizacaoFinal);
    setTextoLivre(initialData?.textoLivre || '');
    setLembretes(Array.isArray(initialData?.lembretes) ? initialData.lembretes : []);
  }, [initialData, pacienteSelecionado, pacienteNomeProp]);

  useEffect(() => {
    if (!pdfDesktopRenderizando) return;
    const timer = setTimeout(async () => {
      try {
        await exportarParaPDF('protocolo-container', nomeCliente, { compartilhar: true });
      } catch (err) {
        console.error('Erro ao gerar PDF:', err);
      } finally {
        setPdfDesktopRenderizando(false);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [pdfDesktopRenderizando, nomeCliente]);

  const handleSubmit = async () => {
    if (isView || salvando || salvoSucesso) return;

    const dadosProtocolo = {
      id: initialData?.id || Date.now(),
      nomeCliente,
      dataNasc,
      dataRealizacao,
      telefone,
      endereco,
      numDocumento,
      textoLivre,
      lembretes,
      dataCriacao:
        initialData?.dataCriacao ||
        new Date().toLocaleDateString('pt-BR') + ' às ' +
          new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
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

  const adicionarLembrete = () => {
    if (isView) return;
    setLembretes([...lembretes, {
      titulo: '', tipo: 'intervalo', valor: '',
      intervaloNumero: '8', intervaloUnidade: 'horas',
    }]);
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
      // 📱 No mobile o container pai é o mesmo do FichaEvoMobile
      position: isMobile ? 'relative' : 'fixed',
      top: isMobile ? 'auto' : 0,
      left: isMobile ? 'auto' : 0,
      width: '100%',
      minHeight: isMobile ? '100vh' : undefined,
      height: isMobile ? 'auto' : '100%',
      backgroundColor: isMobile ? '#f3eef8' : '#dfc6fc',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', margin: 0,
      padding: isMobile ? 0 : '20px 10px',
      fontFamily: "'Montserrat', sans-serif", boxSizing: 'border-box',
      overflowY: isMobile ? 'visible' : 'auto',
      overflowX: 'hidden',
      zIndex: 9999,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600;700&display=swap');

        .input-line {
          width: 100%; border: none; background: transparent;
          border-bottom: ${isMobile ? '1.5px solid #D4AF37' : '1px solid #C8A24A'};
          outline: none;
          height: ${isMobile ? '24px' : '18px'};
          font-size: ${isMobile ? '13px' : '13px'};
          font-weight: ${isMobile ? 500 : 400};
          color: #1A1A1A;
          margin-top: ${isMobile ? '2px' : 0};
          -webkit-text-fill-color: #1A1A1A;
        }

        input, select, textarea {
          color: #1A1A1A !important;
          -webkit-text-fill-color: #1A1A1A !important;
        }

        .modulo-bloco {
          background: ${isMobile ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.45)'};
          border: 1.5px solid ${isMobile ? '#D4AF37' : '#a855f7'};
          border-radius: ${isMobile ? '10px' : '8px'};
          padding: ${isMobile ? '12px' : '10px 14px'};
          display: flex;
          flex-direction: column;
          gap: ${isMobile ? '8px' : '6px'};
          box-shadow: 0 2px 6px rgba(0,0,0,0.03);
          box-sizing: border-box;
          width: 100%;
        }

        .btn-acao-ficha {
          font-family: 'Cinzel', serif;
          background: linear-gradient(135deg, #C8A24A 0%, #e2be64 100%);
          color: #ffffff; border: 1.5px solid #9c7826;
          padding: 12px 32px; font-size: 14px; font-weight: 700;
          letter-spacing: 1.5px; border-radius: 30px; cursor: pointer;
          display: flex; align-items: center; gap: 10px;
          box-shadow: 0 4px 15px rgba(200, 162, 74, 0.4);
          transition: all 0.3s ease; outline: none;
          width: 100%; max-width: 340px; justify-content: center;
        }

        .btn-acao-ficha:hover {
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 6px 22px rgba(200, 162, 74, 0.6);
          background: linear-gradient(135deg, #d8b052 0%, #eccb74 100%);
        }
      `}</style>

      {/* ============================================================
          CONTAINER PRINCIPAL
         ============================================================ */}
      <div
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : '1175px',
          boxShadow: isMobile ? 'none' : '0 4px 20px rgba(0,0,0,0.15)',
          position: 'relative', display: 'flex', flexDirection: 'column',
          boxSizing: 'border-box', zIndex: 1,
          backgroundColor: isMobile ? '#f3eef8' : '#fff',
          borderRadius: isMobile ? '0' : undefined,
        }}
      >
        {/* ============================================================
            1. TOPO
            Mobile: igual FichaEvoMobile (140px + cover)
            Desktop: mantém 420px + center bottom
           ============================================================ */}
        <div style={{
          width: '100%',
          height: isMobile ? '140px' : '420px',
          backgroundImage: 'url("/imagens/moldura-topo-protocolo.jpeg")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: isMobile ? 'top center' : 'center bottom',
          backgroundSize: isMobile ? 'cover' : '100% 100%',
          flexShrink: 0,
          marginBottom: isMobile ? 0 : '-130px',
          zIndex: 3, position: 'relative', boxSizing: 'border-box',
          padding: isMobile ? 0 : '330px 95px 0 95px',
          pointerEvents: 'auto',
        }} />

        {/* ============================================================
            2. MEIO
            Mobile: igual FichaEvoMobile (10px 16px, marginTop -10px)
            Desktop: mantém 135px 95px 140px 95px
           ============================================================ */}
        <div style={{
          width: '100%',
          backgroundImage: 'url("/imagens/moldura-meio.jpeg")',
          backgroundRepeat: 'repeat-y',
          backgroundPosition: 'center top',
          backgroundSize: '100% auto',
          display: 'flex', flexDirection: 'column',
          boxSizing: 'border-box',
          padding: isMobile ? '10px 16px 40px 16px' : '135px 95px 140px 95px',
          position: 'relative', zIndex: 2,
          marginTop: isMobile ? '-10px' : 0,
        }}>
          {/* Marca d'água */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: isMobile ? '280px' : '480px',
            height: isMobile ? '280px' : '480px',
            backgroundImage: 'url("/imagens/logo-samiramarcadagua.jpeg")',
            backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
            backgroundSize: 'contain',
            opacity: isMobile ? 0.35 : 0.45,
            pointerEvents: 'none', zIndex: 1,
          }} />

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '15px', width: '100%' }}>

            {/* ============ DADOS DO PACIENTE (mesmo padrão do FichaEvoMobile) ============ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '2px' }}>
                <div style={{ flex: 1, height: '1.5px', background: 'rgba(212, 175, 55, 0.5)' }} />
                <div style={{ fontFamily: "'Cinzel', serif", color: '#1A1A1A', background: 'rgba(244, 239, 252, 0.9)', padding: '3px 10px', fontSize: '11px', fontWeight: 700, border: '1.5px solid #D4AF37', borderRadius: '12px', textAlign: 'center' }}>
                  {isMobile ? 'DADOS DO PACIENTE' : 'DADOS DO PACIENTE'}
                </div>
                <div style={{ flex: 1, height: '1.5px', background: 'rgba(212, 175, 55, 0.5)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>
                  <label htmlFor="prot-nome" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: isMobile ? '11px' : '12px', display: 'block' }}>NOME:</label>
                  <input id="prot-nome" type="text" value={nomeCliente} readOnly className="input-line" />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="prot-datanasc" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: isMobile ? '10px' : '11px', display: 'block' }}>DATA DE NASC.:</label>
                    <input id="prot-datanasc" type="text" value={dataNasc} readOnly className="input-line" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="prot-datarealizacao" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: isMobile ? '10px' : '11px', display: 'block' }}>DATA DE REALIZAÇÃO:</label>
                    <input id="prot-datarealizacao" type="text" value={dataRealizacao} readOnly className="input-line" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="prot-telefone" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: isMobile ? '11px' : '12px', display: 'block' }}>TELEFONE:</label>
                    <input id="prot-telefone" type="text" value={telefone} readOnly className="input-line" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="prot-documento" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: isMobile ? '11px' : '12px', display: 'block' }}>Nº DOCUMENTO:</label>
                    <input id="prot-documento" type="text" value={numDocumento} readOnly className="input-line" />
                  </div>
                </div>

                <div>
                  <label htmlFor="prot-endereco" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: isMobile ? '11px' : '12px', display: 'block' }}>ENDEREÇO:</label>
                  <input id="prot-endereco" type="text" value={endereco} readOnly className="input-line" />
                </div>
              </div>
            </div>

            {/* ============ MÓDULO: PROTOCOLO ============ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '2px' }}>
                <div style={{ flex: 1, height: '1.5px', background: 'rgba(212, 175, 55, 0.5)' }} />
                <div style={{ fontFamily: "'Cinzel', serif", color: '#1A1A1A', background: 'rgba(244, 239, 252, 0.9)', padding: '3px 10px', fontSize: '11px', fontWeight: 700, border: '1.5px solid #D4AF37', borderRadius: '12px', textAlign: 'center' }}>
                  DESCRIÇÃO DO PROTOCOLO
                </div>
                <div style={{ flex: 1, height: '1.5px', background: 'rgba(212, 175, 55, 0.5)' }} />
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
                  width: '100%',
                  minHeight: isMobile ? '180px' : '400px',
                  height: 'auto',
                  border: '1px solid rgba(212, 175, 55, 0.5)',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.85)',
                  padding: isMobile ? '12px' : '15px',
                  fontSize: isMobile ? '12px' : '14px',
                  outline: 'none',
                  resize: isMobile ? 'vertical' : 'none',
                  overflow: 'hidden',
                  fontFamily: "'Montserrat', sans-serif",
                  boxSizing: 'border-box',
                  lineHeight: isMobile ? '1.5' : '1.6',
                  color: '#1A1A1A',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                }}
              />
            </div>

            {/* ============ MÓDULO: LEMBRETES ============ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  <div style={{ flex: 1, height: '1.5px', background: 'rgba(212, 175, 55, 0.5)', minWidth: '10px' }} />
                  <span style={{ fontFamily: "'Cinzel', serif", color: '#1A1A1A', fontSize: '11px', fontWeight: 700, border: '1.5px solid #D4AF37', padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                    LEMBRETES
                  </span>
                  <div style={{ flex: 1, height: '1.5px', background: 'rgba(212, 175, 55, 0.5)', minWidth: '10px' }} />
                </div>
                {!isView && (
                  <button
                    type="button"
                    onClick={adicionarLembrete}
                    style={{ background: '#D4AF37', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '14px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontFamily: "'Cinzel', serif", whiteSpace: 'nowrap' }}
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
                    <div key={index} style={{ background: 'rgba(255, 255, 255, 0.85)', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px' }}>
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
                        <div style={{ flex: 1, minWidth: isMobile ? '100%' : '120px' }}>
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

                        <div style={{ flex: 1, minWidth: isMobile ? '100%' : '160px' }}>
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

        {/* ============================================================
            3. BASE COM BOTÕES
            Mobile: igual FichaEvoMobile (320px, marginTop -25px, padding 40px 16px 20px)
            Desktop: 600px, marginTop -140px, padding 90px 16px 20px
           ============================================================ */}
        <div style={{
          width: '100%',
          height: isMobile ? '320px' : '600px',
          backgroundImage: 'url("/imagens/moldura-base.jpeg")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: isMobile ? 'top center' : 'center top',
          backgroundSize: '100% 100%',
          flexShrink: 0,
          marginTop: isMobile ? '-25px' : '-140px',
          zIndex: 3, position: 'relative', pointerEvents: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'flex-start',
          padding: isMobile ? '40px 16px 20px 16px' : '90px 16px 20px 16px',
          gap: '12px',
          boxSizing: 'border-box',
        }}>
          <div className="botoes-acao-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>

            {isView ? (
              <>
                <button
                  type="button"
                  onClick={() => setPdfDesktopRenderizando(true)}
                  disabled={pdfDesktopRenderizando}
                  style={{
                    // 📱 Mobile igual FichaEvoMobile; Desktop igual ao atual
                    backgroundColor: isMobile ? '#D4AF37' : undefined,
                    background: isMobile ? '#D4AF37' : 'linear-gradient(135deg, #b8a3c9 0%, #d7cee0 100%)',
                    color: isMobile ? '#FFFFFF' : '#2c163a',
                    border: isMobile ? 'none' : '1.5px solid #8a6fa8',
                    borderRadius: isMobile ? '6px' : '30px',
                    padding: isMobile ? '12px 20px' : '12px 32px',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: 700,
                    letterSpacing: isMobile ? 0 : '1.5px',
                    cursor: pdfDesktopRenderizando ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '6px',
                    boxShadow: isMobile ? '0 2px 8px rgba(0,0,0,0.2)' : '0 4px 14px rgba(138, 111, 168, 0.25)',
                    width: '100%', maxWidth: isMobile ? '240px' : '340px',
                    opacity: pdfDesktopRenderizando ? 0.7 : 1,
                    fontFamily: "'Cinzel', serif",
                  }}
                >
                  {pdfDesktopRenderizando ? (
                    <><span className="spinner-pdf" /> GERANDO PDF...</>
                  ) : (
                    <><MdDownload size={isMobile ? 18 : 20} /> BAIXAR PDF</>
                  )}
                </button>

                {onIrParaEdicao && (
                  <button
                    type="button"
                    onClick={onIrParaEdicao}
                    style={{
                      backgroundColor: '#D4AF37',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: isMobile ? '6px' : '30px',
                      padding: isMobile ? '12px 20px' : '12px 32px',
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: 700,
                      letterSpacing: isMobile ? 0 : '1.5px',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      width: '100%', maxWidth: isMobile ? '240px' : '340px',
                      fontFamily: "'Cinzel', serif",
                    }}
                  >
                    <MdEdit size={isMobile ? 18 : 20} /> EDITAR PROTOCOLO
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={salvando || salvoSucesso}
                style={{
                  backgroundColor: salvoSucesso ? '#16a34a' : '#D4AF37',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: isMobile ? '6px' : '30px',
                  padding: isMobile ? '12px 20px' : '12px 32px',
                  fontSize: isMobile ? '13px' : '14px',
                  fontWeight: 700,
                  letterSpacing: isMobile ? 0 : '1.5px',
                  cursor: (salvando || salvoSucesso) ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  width: '100%', maxWidth: isMobile ? '240px' : '340px',
                  fontFamily: "'Cinzel', serif",
                }}
              >
                {salvando ? (
                  <><span className="spinner-salvar" /> SALVANDO...</>
                ) : salvoSucesso ? (
                  <><MdCheckCircle size={isMobile ? 18 : 20} /> SALVO!</>
                ) : (
                  <><MdSave size={isMobile ? 18 : 20} /> SALVAR PROTOCOLO</>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onVoltar}
              style={{
                backgroundColor: '#D4AF37',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: isMobile ? '6px' : '30px',
                padding: isMobile ? '12px 20px' : '12px 32px',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: 700,
                letterSpacing: isMobile ? 0 : '1.5px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                width: '100%', maxWidth: isMobile ? '240px' : '340px',
                fontFamily: "'Cinzel', serif",
              }}
            >
              <MdArrowBack size={isMobile ? 18 : 20} /> VOLTAR
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================
          VERSÃO OCULTA DO PROTOCOLO — SEMPRE DESKTOP (PDF)
          ⚠️ Este bloco NUNCA muda com isMobile.
         ============================================================ */}
      {pdfDesktopRenderizando && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-99999px',
            top: 0,
            width: '1175px',
            zIndex: -1,
            pointerEvents: 'none',
            opacity: 0.01
          }}
        >
          <div
            id="protocolo-container"
            style={{
              width: '100%', maxWidth: '1175px',
              position: 'relative', display: 'flex', flexDirection: 'column',
              boxSizing: 'border-box', backgroundColor: '#fff'
            }}
          >
            {/* TOPO (sem labels interativos) */}
            <div style={{
              width: '100%', height: '420px',
              backgroundImage: 'url("/imagens/moldura-topo-protocolo.jpeg")',
              backgroundRepeat: 'no-repeat', backgroundPosition: 'center bottom',
              backgroundSize: '100% 100%', flexShrink: 0, marginBottom: '-130px',
              zIndex: 3, position: 'relative', boxSizing: 'border-box',
              padding: '330px 95px 0 95px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px', minWidth: '220px' }}>
                    <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>Nome:</span>
                    <div style={{ flexGrow: 1, minWidth: 0, display: 'flex' }}>
                      <input type="text" value={nomeCliente} readOnly className="input-line" />
                    </div>
                  </div>
                  <div style={{ width: '250px', flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px' }}>
                    <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>DATA DE NASC.:</span>
                    <div style={{ width: '120px', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input type="text" value={dataNasc} readOnly className="input-line" />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px', minWidth: '220px' }}>
                    <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>Telefone:</span>
                    <div style={{ flexGrow: 1, minWidth: 0, display: 'flex' }}>
                      <input type="text" value={telefone} readOnly className="input-line" />
                    </div>
                  </div>
                  <div style={{ width: '310px', flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px' }}>
                    <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>DATA DE REALIZAÇÃO:</span>
                    <div style={{ width: '120px', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input type="text" value={dataRealizacao} readOnly className="input-line" />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px', minWidth: '220px' }}>
                    <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>Endereço:</span>
                    <div style={{ flexGrow: 1, minWidth: 0, display: 'flex' }}>
                      <input type="text" value={endereco} readOnly className="input-line" />
                    </div>
                  </div>
                  <div style={{ width: '250px', flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px' }}>
                    <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>Nº Documento:</span>
                    <div style={{ flexGrow: 1, display: 'flex' }}>
                      <input type="text" value={numDocumento} readOnly className="input-line" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MEIO */}
            <div style={{
              width: '100%',
              backgroundImage: 'url("/imagens/moldura-meio.jpeg")',
              backgroundRepeat: 'repeat-y', backgroundPosition: 'center top',
              backgroundSize: '100% auto', display: 'flex', flexDirection: 'column',
              boxSizing: 'border-box', padding: '135px 95px 140px 95px',
              position: 'relative', zIndex: 2
            }}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '480px', height: '480px',
                backgroundImage: 'url("/imagens/logo-samiramarcadagua.jpeg")',
                backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
                backgroundSize: 'contain', opacity: 0.45,
                pointerEvents: 'none', zIndex: 1
              }} />
              <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>

                <div className="modulo-bloco" style={{ padding: '12px 14px', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '5px' }}>
                    <div style={{ flex: 1, height: '1.5px', background: 'rgba(200, 162, 74, 0.5)' }} />
                    <div style={{ fontFamily: "'Cinzel', serif", color: '#1A1A1A', background: 'rgba(255, 255, 255, 0.9)', padding: '4px 14px', fontSize: '12px', fontWeight: 700, border: '1.5px solid #C8A24A', borderRadius: '12px', textAlign: 'center', letterSpacing: '1.5px' }}>
                      DESCRIÇÃO DO PROTOCOLO
                    </div>
                    <div style={{ flex: 1, height: '1.5px', background: 'rgba(200, 162, 74, 0.5)' }} />
                  </div>
                  <div style={{
                    width: '100%', minHeight: '400px',
                    border: '1px solid rgba(200, 162, 74, 0.4)', borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.65)', padding: '15px',
                    fontSize: '14px', fontFamily: "'Montserrat', sans-serif",
                    boxSizing: 'border-box', lineHeight: '1.6', color: '#1A1A1A',
                    whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word'
                  }}>
                    {textoLivre || '—'}
                  </div>
                </div>

                <div className="modulo-bloco" style={{ padding: '12px 14px', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <div style={{ flex: 1, height: '1.5px', background: 'rgba(200, 162, 74, 0.3)' }} />
                    <span style={{ fontFamily: "'Cinzel', serif", color: '#1A1A1A', fontSize: '11px', fontWeight: 700, border: '1px solid #C8A24A', padding: '2px 10px', borderRadius: '12px' }}>
                      LEMBRETES PARA O PACIENTE
                    </span>
                    <div style={{ flex: 1, height: '1.5px', background: 'rgba(200, 162, 74, 0.3)' }} />
                  </div>

                  {lembretes.length === 0 ? (
                    <p style={{ fontSize: '11px', color: '#92400e', fontStyle: 'italic', textAlign: 'center', margin: '10px 0' }}>
                      Nenhum lembrete registrado.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {lembretes.map((l, i) => (
                        <div key={i} style={{ background: 'rgba(255, 255, 255, 0.8)', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#C8A24A', marginBottom: '6px' }}>
                            Lembrete #{i + 1}
                          </div>
                          <div style={{ fontSize: '12px', color: '#1A1A1A', marginBottom: '4px' }}>
                            <strong>Título:</strong> {l.titulo || '—'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#1A1A1A' }}>
                            <strong>{l.tipo === 'intervalo' ? 'A cada' : 'Data/Hora'}:</strong>{' '}
                            {l.tipo === 'intervalo'
                              ? `${l.intervaloNumero} ${l.intervaloUnidade}`
                              : formatarDataHoraBR(l.valor)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div style={{
              width: '100%', height: '600px',
              backgroundImage: 'url("/imagens/moldura-base.jpeg")',
              backgroundRepeat: 'no-repeat', backgroundPosition: 'center top',
              backgroundSize: '100% 100%', flexShrink: 0, marginTop: '-140px',
              zIndex: 3, position: 'relative',
              boxSizing: 'border-box'
            }} />
          </div>
        </div>
      )}
    </div>
  );
}