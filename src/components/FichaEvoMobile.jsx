import React, { useState, useEffect, useRef } from 'react';
import { MdSave, MdDateRange, MdArrowBack } from 'react-icons/md';

export default function FichaEvoMobile({ mode = 'create', initialData, onSave, onVoltar, pacienteSelecionado, pacienteNomeProp }) {
  const dadosOrigem = pacienteSelecionado?.anamnese || pacienteSelecionado || initialData?.anamnese || initialData || {};

  const [dataNasc, setDataNasc] = useState('');
  const [dataRealizacao, setDataRealizacao] = useState('');
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [documento, setDocumento] = useState('');
  const [textoLivre, setTextoLivre] = useState('');

  // Referência para controlar dinamicamente a altura do textarea no mobile
  const textareaRef = useRef(null);

  // Função para ajustar automaticamente a altura do textarea sem scroll interno
  const ajustarAlturaTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(180, textarea.scrollHeight)}px`;
    }
  };

  // Efeito para reajustar a altura sempre que o texto livre mudar
  useEffect(() => {
    ajustarAlturaTextarea();
  }, [textoLivre]);

  useEffect(() => {
    const nomeFinal = 
      dadosOrigem.nome || 
      dadosOrigem.nomeCliente || 
      pacienteSelecionado?.nome || 
      pacienteNomeProp || 
      initialData?.nomeCliente || 
      initialData?.paciente || 
      '';

    const nascFinal = 
      dadosOrigem.dataNasc || 
      dadosOrigem.dataNascimento || 
      dadosOrigem.nascimento || 
      initialData?.dataNasc || 
      initialData?.dataNascimento || 
      '';

    const telFinal = 
      dadosOrigem.telefone || 
      dadosOrigem.celular || 
      dadosOrigem.fone || 
      initialData?.telefone || 
      initialData?.celular || 
      '';

    const endFinal = 
      dadosOrigem.endereco || 
      dadosOrigem.end || 
      initialData?.endereco || 
      '';

    const docFinal = 
      dadosOrigem.documento || 
      dadosOrigem.nDocumento || 
      dadosOrigem.numeroDocumento || 
      dadosOrigem.cpf || 
      dadosOrigem.rg || 
      initialData?.documento || 
      initialData?.nDocumento || 
      '';
    
    const realizacaoFinal = 
      initialData?.dataRealizacao || 
      new Date().toLocaleDateString('pt-BR');

    setNomeCliente(nomeFinal);
    setDataNasc(nascFinal);
    setDataRealizacao(realizacaoFinal);
    setTelefone(telFinal);
    setEndereco(endFinal);
    setDocumento(docFinal);
    setTextoLivre(initialData?.textoLivre || initialData?.conteudo || '');
  }, [initialData, pacienteSelecionado, pacienteNomeProp]);

  const mascaraData = (valor) => {
    let v = valor.replace(/\D/g, '');
    if (v.length > 8) v = v.substring(0, 8);
    if (v.length > 4) {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}/${v.substring(4)}`;
    } else if (v.length > 2) {
      return `${v.substring(0, 2)}/${v.substring(2)}`;
    }
    return v;
  };

  const handleSubmit = () => {
    const dadosEvolucao = {
      id: initialData?.id || Date.now(),
      nomeCliente: nomeCliente || 'Paciente sem nome',
      dataNasc,
      dataRealizacao,
      telefone,
      endereco,
      documento,
      textoLivre,
      dataCriacao: initialData?.dataCriacao || (new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    };

    if (onSave) {
      onSave(dadosEvolucao);
    }
  };

  const isView = mode === 'view';

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#f3eef8',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      margin: 0,
      padding: 0,
      fontFamily: "'Montserrat', sans-serif",
      boxSizing: 'border-box',
      zIndex: 9999
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600;700&display=swap');

        .input-line {
          width: 100%;
          border: none;
          background: transparent;
          border-bottom: 1.5px solid #D4AF37;
          outline: none;
          height: 24px;
          font-size: 13px;
          font-weight: 500;
          color: #1A1A1A;
          margin-top: 2px;
          -webkit-text-fill-color: #1A1A1A;
        }

        input, select, textarea {
          color: #1A1A1A !important;
          -webkit-text-fill-color: #1A1A1A !important;
        }
      `}</style>

      <div style={{
        width: '100%',
        maxWidth: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        backgroundColor: '#f3eef8',
        borderRadius: '0'
      }}>
        {/* TOPO */}
        <div style={{
          width: '100%',
          height: '140px',
          backgroundImage: 'url("/imagens/moldura-topo-evolucao.jpeg")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top center',
          backgroundSize: 'cover',
          flexShrink: 0,
          zIndex: 3
        }} />

        {/* MEIO EXPANSÍVEL */}
        <div style={{
          width: '100%',
          backgroundImage: 'url("/imagens/moldura-meio.jpeg")',
          backgroundRepeat: 'repeat-y',
          backgroundPosition: 'center top',
          backgroundSize: '100% auto',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: '10px 16px 40px 16px',
          position: 'relative',
          zIndex: 2,
          marginTop: '-10px'
        }}>
          {/* Marca d'água centralizada */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '280px',
            height: '280px',
            backgroundImage: 'url("/imagens/logo-samiramarcadagua.jpeg")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundSize: 'contain',
            opacity: 0.35,
            pointerEvents: 'none',
            zIndex: 1
          }} />

          {/* Conteúdo do Formulário */}
          <div style={{ width: '100%', zIndex: 2, position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '2px' }}>
                <div style={{ flex: 1, height: '1.5px', background: 'rgba(212, 175, 55, 0.5)' }} />
                <div style={{ fontFamily: "'Cinzel', serif", color: '#1A1A1A', background: 'rgba(244, 239, 252, 0.9)', padding: '3px 10px', fontSize: '11px', fontWeight: 700, border: '1.5px solid #D4AF37', borderRadius: '12px', textAlign: 'center' }}>
                  DADOS DO PACIENTE (ANAMNESE)
                </div>
                <div style={{ flex: 1, height: '1.5px', background: 'rgba(212, 175, 55, 0.5)' }} />
              </div>
                
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>
                  <label htmlFor="nomeCliente" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: '11px', display: 'block' }}>NOME:</label>
                  <input 
                    id="nomeCliente"
                    name="nomeCliente"
                    type="text" 
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    disabled={isView}
                    className="input-line" 
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <label htmlFor="dataNasc" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: '10px', display: 'block' }}>DATA DE NASC.:</label>
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                      <input 
                        id="dataNasc"
                        name="dataNasc"
                        type="text" 
                        value={dataNasc}
                        onChange={(e) => setDataNasc(mascaraData(e.target.value))}
                        disabled={isView}
                        className="input-line"
                        style={{ paddingRight: '24px' }}
                      />
                      {!isView && (
                                         <>
                                           <input 
                                             id="evo-datanasc-picker"
                                             name="dataNascPicker"
                                             type="date"
                                             aria-label="Selecionar Data de Nascimento"
                                             onChange={(e) => {
                                               if (e.target.value) {
                                                 const [ano, mes, dia] = e.target.value.split('-');
                                                 setDataNasc(`${dia}/${mes}/${ano}`);
                                               }
                                             }}
                                             style={{ position: 'absolute', right: '0', width: '28px', height: '18px', opacity: 0, cursor: 'pointer', zIndex: 3 }}
                                           />
                                           <MdDateRange size={18} color="#C8A24A" style={{ position: 'absolute', right: '2px', pointerEvents: 'none', zIndex: 2 }} />
                                         </>
                                       )}
                    </div>
                  </div>

                  <div style={{ flex: 1, position: 'relative' }}>
                    <label htmlFor="dataRealizacao" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: '10px', display: 'block' }}>DATA DE REALIZAÇÃO:</label>
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                      <input 
                        id="dataRealizacao"
                        name="dataRealizacao"
                        type="text" 
                        value={dataRealizacao}
                        onChange={(e) => setDataRealizacao(mascaraData(e.target.value))}
                        disabled={isView}
                        className="input-line"
                        style={{ paddingRight: '24px' }}
                      />
                      {!isView && (
                                         <>
                                           <input 
                                             id="evo-datarealizacao-picker"
                                             name="dataRealizacaoPicker"
                                             type="date"
                                             aria-label="Selecionar Data de Realização"
                                             onChange={(e) => {
                                               if (e.target.value) {
                                                 const [ano, mes, dia] = e.target.value.split('-');
                                                 setDataRealizacao(`${dia}/${mes}/${ano}`);
                                               }
                                             }}
                                             style={{ position: 'absolute', right: '0', width: '28px', height: '18px', opacity: 0, cursor: 'pointer', zIndex: 3 }}
                                           />
                                           <MdDateRange size={18} color="#C8A24A" style={{ position: 'absolute', right: '2px', pointerEvents: 'none', zIndex: 2 }} />
                                         </>
                                       )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="telefone" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: '11px', display: 'block' }}>TELEFONE:</label>
                    <input 
                      id="telefone"
                      name="telefone"
                      type="tel" 
                      value={telefone} 
                      onChange={(e) => setTelefone(e.target.value)}
                      disabled={isView}
                      className="input-line" 
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label htmlFor="documento" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: '11px', display: 'block' }}>Nº DOCUMENTO:</label>
                    <input 
                      id="documento"
                      name="documento"
                      type="text" 
                      value={documento} 
                      onChange={(e) => setDocumento(e.target.value)}
                      disabled={isView}
                      className="input-line" 
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="endereco" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: '11px', display: 'block' }}>ENDEREÇO:</label>
                  <input 
                    id="endereco"
                    name="endereco"
                    type="text" 
                    value={endereco} 
                    onChange={(e) => setEndereco(e.target.value)}
                    disabled={isView}
                    className="input-line" 
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '2px' }}>
                <div style={{ flex: 1, height: '1.5px', background: 'rgba(212, 175, 55, 0.5)' }} />
                <div style={{ fontFamily: "'Cinzel', serif", color: '#1A1A1A', background: 'rgba(244, 239, 252, 0.9)', padding: '3px 10px', fontSize: '11px', fontWeight: 700, border: '1.5px solid #D4AF37', borderRadius: '12px', textAlign: 'center' }}>
                  REGISTRO DE EVOLUÇÃO
                </div>
                <div style={{ flex: 1, height: '1.5px', background: 'rgba(212, 175, 55, 0.5)' }} />
              </div>

              <textarea
                ref={textareaRef}
                id="textoLivre"
                name="textoLivre"
                value={textoLivre}
                onChange={(e) => {
                  setTextoLivre(e.target.value);
                  ajustarAlturaTextarea();
                }}
                disabled={isView}
                placeholder="Digite as observações e evolução do procedimento..."
                style={{
                  width: '100%',
                  minHeight: '180px',
                  height: 'auto',
                  border: '1px solid rgba(212, 175, 55, 0.5)',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.85)',
                  padding: '12px',
                  fontSize: '12px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: "'Montserrat', sans-serif",
                  boxSizing: 'border-box',
                  lineHeight: '1.5',
                  color: '#1A1A1A',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word'
                }}
              />
            </div>
          </div>
        </div>

        {/* BASE (Moldura Base + Botões) */}
        <div style={{
          width: '100%',
          height: '320px',
          backgroundImage: 'url("/imagens/moldura-base.jpeg")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top center',
          backgroundSize: '100% 100%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '40px 16px 20px 16px',
          gap: '12px',
          boxSizing: 'border-box',
          zIndex: 3,
          marginTop: '-25px'
        }}>
          {!isView && (
            <button
              type="button"
              onClick={handleSubmit}
              style={{
                backgroundColor: '#D4AF37',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: "'Cinzel', serif",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                width: '100%',
                maxWidth: '240px'
              }}
            >
              <MdSave size={18} /> SALVAR EVOLUÇÃO
            </button>
          )}

          {isView && initialData && (
            <button
              type="button"
              onClick={initialData.onIrParaEdicao}
              style={{
                backgroundColor: '#D4AF37',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: "'Cinzel', serif",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                width: '100%',
                maxWidth: '240px'
              }}
            >
              EDITAR EVOLUÇÃO
            </button>
          )}

          <button
            type="button"
            onClick={onVoltar || (() => window.history.back())}
            style={{
              backgroundColor: '#D4AF37',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 20px',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: "'Cinzel', serif",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              width: '100%',
              maxWidth: '240px'
            }}
          >
            <MdArrowBack size={18} /> VOLTAR
          </button>
        </div>
      </div>
    </div>
  );
}