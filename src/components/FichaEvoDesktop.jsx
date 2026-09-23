import React, { useState, useEffect, useRef } from 'react';
import { MdSave, MdArrowBack, MdDateRange, MdImage, MdKeyboardArrowUp, MdKeyboardArrowDown, MdClose, MdEvent } from 'react-icons/md';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export default function FichaEvoDesktop({ mode = 'create', initialData, onSave, onVoltar, pacienteSelecionado, pacienteNomeProp }) {
  const dadosOrigem = pacienteSelecionado?.anamnese || pacienteSelecionado || initialData?.anamnese || initialData || {};

  const [dataNasc, setDataNasc] = useState('');
  const [dataRealizacao, setDataRealizacao] = useState('');
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numDocumento, setNumDocumento] = useState('');
  const [textoLivre, setTextoLivre] = useState('');

  const textareaRef = useRef(null);

  const ajustarAlturaTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(400, textarea.scrollHeight)}px`;
    }
  };

  // ✅ Fotos vinculadas a esta evolução
  const [fotosVinculadas, setFotosVinculadas] = useState([]);
  const [fotoAberta, setFotoAberta] = useState(null);
  const [mostrarGaleria, setMostrarGaleria] = useState(false);

  useEffect(() => {
    const pacId = pacienteSelecionado?.id || initialData?.pacienteId;
    const uidEst = pacienteSelecionado?.criadoPorUid;
    const evoId = initialData?.id;

    if (!pacId || !uidEst || !evoId) {
      setFotosVinculadas([]);
      return;
    }

    const colRef = collection(db, `usuarios/${uidEst}/pacientes/${pacId}/fotos`);
    const unsub = onSnapshot(colRef, (snap) => {
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((f) => (f.vinculadoA || []).includes(evoId));
      setFotosVinculadas(lista);
    }, (err) => console.error('Erro fotos vinculadas:', err));

    return () => unsub();
  }, [pacienteSelecionado, initialData]);

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
    setDataRealizacao(realizacaoFinal);
    setTelefone(telFinal);
    setEndereco(endFinal);
    setNumDocumento(docFinal);
    setTextoLivre(initialData?.textoLivre || initialData?.conteudo || '');
  }, [initialData, pacienteSelecionado, pacienteNomeProp]);

  const mascaraData = (valor) => {
    let v = valor.replace(/\D/g, '');
    if (v.length > 8) v = v.substring(0, 8);
    if (v.length > 4) return `${v.substring(0, 2)}/${v.substring(2, 4)}/${v.substring(4)}`;
    else if (v.length > 2) return `${v.substring(0, 2)}/${v.substring(2)}`;
    return v;
  };

  // ✅ Formata timestamp do Firestore (data + hora) para exibir embaixo da foto
  const formatarDataHora = (ts) => {
    if (!ts) return '';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const handleSubmit = () => {
    const dadosEvolucao = {
      id: initialData?.id || Date.now(),
      nomeCliente: nomeCliente || 'Paciente sem nome',
      dataNasc,
      dataRealizacao,
      telefone,
      endereco,
      numDocumento,
      textoLivre,
      dataCriacao: initialData?.dataCriacao || (new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    };
    if (onSave) onSave(dadosEvolucao);
  };

  const isView = mode === 'view';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: '#dfc6fc', display: 'flex', flexDirection: 'column',
      alignItems: 'center', margin: 0, padding: '20px 10px',
      fontFamily: "'Montserrat', sans-serif", boxSizing: 'border-box',
      overflowY: 'auto', zIndex: 9999
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600&display=swap');

        .input-line {
          width: 100%; border: none; background: transparent;
          border-bottom: 1px solid #C8A24A; outline: none;
          height: 18px; font-size: 13px; color: #1A1A1A;
          -webkit-text-fill-color: #1A1A1A;
        }

        input, select, textarea {
          color: #1A1A1A !important;
          -webkit-text-fill-color: #1A1A1A !important;
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

        .btn-fotos-vinculadas {
          font-family: 'Cinzel', serif;
          color: #ffffff;
          border: 1.5px solid #7e22ce;
          padding: 12px 28px;
          border-radius: 24px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 1px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 14px rgba(168, 85, 247, 0.35);
          transition: all 0.25s ease;
        }

        .btn-fotos-vinculadas:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(168, 85, 247, 0.5);
        }

        .foto-vinculada-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .foto-vinculada-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(168, 85, 247, 0.3) !important;
        }

        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body, html { background: transparent !important; height: auto !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          div[style*="position: fixed"] { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: transparent !important; padding: 0 !important; overflow: visible !important; }
          .ficha-container { width: 100% !important; max-width: 100% !important; height: auto !important; max-height: none !important; box-shadow: none !important; overflow: visible !important; display: flex !important; flex-direction: column !important; }
          textarea { display: none !important; }
          .show-on-print { display: block !important; white-space: pre-wrap; word-break: break-word; font-size: 14px; line-height: 1.6; min-height: 450px; height: auto !important; max-height: none !important; overflow: visible !important; border: 1px solid rgba(200, 162, 74, 0.4); padding: 15px; border-radius: 6px; font-family: 'Montserrat', sans-serif; color: #1A1A1A; background: rgba(255, 255, 255, 0.65); }
          .moldura-base-print { display: flex !important; visibility: visible !important; page-break-inside: avoid; break-inside: avoid; margin-top: -140px !important; height: 400px !important; }
          button, .btn-acao-ficha, .btn-fotos-vinculadas { display: none !important; }
        }

        @media screen { .show-on-print { display: none !important; } }
      `}</style>

      <div
        className="ficha-container"
        style={{
          width: '100%', maxWidth: '1175px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          position: 'relative', display: 'flex', flexDirection: 'column',
          boxSizing: 'border-box', zIndex: 1, backgroundColor: '#fff'
        }}
      >
        {/* 1. TOPO */}
        <div style={{
          width: '100%', height: '420px',
          backgroundImage: 'url("/imagens/moldura-topo-evolucao.jpeg")',
          backgroundRepeat: 'no-repeat', backgroundPosition: 'center bottom',
          backgroundSize: '100% 100%', flexShrink: 0, marginBottom: '-130px',
          zIndex: 3, position: 'relative', boxSizing: 'border-box',
          padding: '330px 95px 0 95px', pointerEvents: 'auto'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px', minWidth: '220px' }}>
                <label htmlFor="evo-nome" style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>Nome:</label>
                <div style={{ flexGrow: 1, minWidth: 0, display: 'flex' }}>
                  <input id="evo-nome" name="nomeCliente" type="text" value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} disabled={isView} className="input-line" autoComplete="name" />
                </div>
              </div>

              <div style={{ width: '250px', flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px' }}>
                <label htmlFor="evo-datanasc" style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>DATA DE NASC.:</label>
                <div style={{ width: '120px', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input id="evo-datanasc" name="dataNasc" type="text" value={dataNasc} onChange={(e) => setDataNasc(mascaraData(e.target.value))} disabled={isView} className="input-line" style={{ paddingRight: '22px' }} />
                  {!isView && (
                    <>
                      <input id="evo-datanasc-picker" name="dataNascPicker" type="date" aria-label="Selecionar Data de Nascimento" onChange={(e) => { if (e.target.value) { const [ano, mes, dia] = e.target.value.split('-'); setDataNasc(`${dia}/${mes}/${ano}`); } }} style={{ position: 'absolute', right: '0', width: '28px', height: '18px', opacity: 0, cursor: 'pointer', zIndex: 3 }} />
                      <MdDateRange size={18} color="#C8A24A" style={{ position: 'absolute', right: '2px', pointerEvents: 'none', zIndex: 2 }} />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px', minWidth: '220px' }}>
                <label htmlFor="evo-telefone" style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>Telefone:</label>
                <div style={{ flexGrow: 1, minWidth: 0, display: 'flex' }}>
                  <input id="evo-telefone" name="telefone" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} disabled={isView} className="input-line" autoComplete="tel" />
                </div>
              </div>

              <div style={{ width: '310px', flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px' }}>
                <label htmlFor="evo-datarealizacao" style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>DATA DE REALIZAÇÃO:</label>
                <div style={{ width: '120px', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input id="evo-datarealizacao" name="dataRealizacao" type="text" value={dataRealizacao} onChange={(e) => setDataRealizacao(mascaraData(e.target.value))} disabled={isView} className="input-line" style={{ paddingRight: '22px' }} />
                  {!isView && (
                    <>
                      <input id="evo-datarealizacao-picker" name="dataRealizacaoPicker" type="date" aria-label="Selecionar Data de Realização" onChange={(e) => { if (e.target.value) { const [ano, mes, dia] = e.target.value.split('-'); setDataRealizacao(`${dia}/${mes}/${ano}`); } }} style={{ position: 'absolute', right: '0', width: '28px', height: '18px', opacity: 0, cursor: 'pointer', zIndex: 3 }} />
                      <MdDateRange size={18} color="#C8A24A" style={{ position: 'absolute', right: '2px', pointerEvents: 'none', zIndex: 2 }} />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px', minWidth: '220px' }}>
                <label htmlFor="evo-endereco" style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>Endereço:</label>
                <div style={{ flexGrow: 1, minWidth: 0, display: 'flex' }}>
                  <input id="evo-endereco" name="endereco" type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} disabled={isView} className="input-line" autoComplete="street-address" />
                </div>
              </div>

              <div style={{ width: '250px', flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px' }}>
                <label htmlFor="evo-documento" style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer' }}>Nº Documento:</label>
                <div style={{ flexGrow: 1, display: 'flex' }}>
                  <input id="evo-documento" name="numDocumento" type="text" value={numDocumento} onChange={(e) => setNumDocumento(e.target.value)} disabled={isView} className="input-line" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. MEIO — Botão + galeria DENTRO desta seção para não ser coberto pela BASE */}
        <div style={{
          width: '100%',
          backgroundImage: 'url("/imagens/moldura-meio.jpeg")',
          backgroundRepeat: 'repeat-y',
          backgroundPosition: 'center top',
          backgroundSize: '100% auto',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: '135px 95px 140px 95px',
          position: 'relative',
          zIndex: 2
        }}>
          <div style={{
            position: 'absolute', top: '55%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '480px', height: '480px',
            backgroundImage: 'url("/imagens/logo-samiramarcadagua.jpeg")',
            backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
            backgroundSize: 'contain', opacity: 0.45,
            pointerEvents: 'none', zIndex: 1
          }} />

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '5px' }}>
              <div style={{ flex: 1, height: '1.5px', background: 'rgba(200, 162, 74, 0.5)' }} />
              <div style={{
                fontFamily: "'Cinzel', serif", color: '#1A1A1A',
                background: 'rgba(255, 255, 255, 0.9)', padding: '4px 14px',
                fontSize: '12px', fontWeight: 700, border: '1.5px solid #C8A24A',
                borderRadius: '12px', textAlign: 'center', letterSpacing: '1.5px'
              }}>
                REGISTRO DE EVOLUÇÃO
              </div>
              <div style={{ flex: 1, height: '1.5px', background: 'rgba(200, 162, 74, 0.5)' }} />
            </div>

            <textarea
              ref={textareaRef}
              id="evo-textolivre"
              name="textoLivre"
              value={textoLivre}
              onChange={(e) => { setTextoLivre(e.target.value); ajustarAlturaTextarea(); }}
              disabled={isView}
              placeholder="Digite as observações e evolução do procedimento..."
              style={{
                width: '100%', minHeight: '400px', height: 'auto',
                border: '1px solid rgba(200, 162, 74, 0.4)', borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.65)', padding: '15px',
                fontSize: '14px', outline: 'none', resize: 'none',
                overflow: 'hidden', fontFamily: "'Montserrat', sans-serif",
                boxSizing: 'border-box', lineHeight: '1.6', color: '#1A1A1A',
                wordWrap: 'break-word', overflowWrap: 'break-word'
              }}
            />

            <div className="show-on-print">
              {textoLivre || "Nenhuma evolução registrada."}
            </div>

            {/* ✅ BOTÃO "VER FOTOS VINCULADAS" */}
            {fotosVinculadas.length > 0 && (
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setMostrarGaleria((v) => !v)}
                  className="btn-fotos-vinculadas"
                  style={{
                    background: mostrarGaleria
                      ? 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)'
                      : 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)'
                  }}
                >
                  <MdImage size={18} />
                  {mostrarGaleria ? 'OCULTAR FOTOS VINCULADAS' : `VER FOTOS VINCULADAS (${fotosVinculadas.length})`}
                  {mostrarGaleria ? <MdKeyboardArrowUp size={18} /> : <MdKeyboardArrowDown size={18} />}
                </button>
              </div>
            )}

            {/* ✅ GALERIA EXPANSÍVEL COM DATA/HORA */}
            {fotosVinculadas.length > 0 && mostrarGaleria && (
              <div style={{
                width: '100%', background: '#faf5ff',
                border: '1.5px dashed #d8b4fe', borderRadius: '12px',
                padding: '24px', boxSizing: 'border-box', marginTop: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
                  <MdImage size={18} color="#a855f7" />
                  <span style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontWeight: 700, fontSize: '13px', letterSpacing: '1px' }}>
                    FOTOS VINCULADAS À EVOLUÇÃO
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px' }}>
                  {fotosVinculadas.map((foto) => (
                    <div
                      key={foto.id}
                      className="foto-vinculada-card"
                      style={{
                        background: '#fff',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid #e2d2f5',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                      }}
                    >
                      <img
                        src={foto.thumbUrl}
                        alt="Foto vinculada"
                        onClick={() => setFotoAberta(foto)}
                        style={{ width: '100%', height: '140px', objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                      />
                      <div style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        color: '#665078',
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: 600,
                        textAlign: 'center',
                        background: '#faf5ff',
                        borderTop: '1px solid #ede4fb'
                      }}>
                        <MdEvent size={12} color="#a855f7" style={{ verticalAlign: 'middle', marginRight: '4px' }} />
{formatarDataHora(foto.enviadoEm) || 'Data não disponível'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. BASE */}
        <div
          className="moldura-base-print"
          style={{
            width: '100%', height: '600px',
            backgroundImage: 'url("/imagens/moldura-base.jpeg")',
            backgroundRepeat: 'no-repeat', backgroundPosition: 'center top',
            backgroundSize: '100% 100%', flexShrink: 0, marginTop: '-140px',
            zIndex: 3, position: 'relative', pointerEvents: 'auto',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-start', paddingTop: '90px', gap: '15px',
            boxSizing: 'border-box'
          }}
        >
          {!isView && (
            <button type="button" className="btn-acao-ficha" onClick={handleSubmit}>
              <MdSave size={20} /> SALVAR FICHA DE EVOLUÇÃO
            </button>
          )}

          {isView && initialData && (
            <button type="button" className="btn-acao-ficha" onClick={initialData.onIrParaEdicao}>
              EDITAR FICHA DE EVOLUÇÃO
            </button>
          )}

          <button type="button" className="btn-acao-ficha" onClick={onVoltar || (() => window.history.back())}>
            <MdArrowBack size={20} /> VOLTAR
          </button>
        </div>
      </div>

      {/* ✅ MODAL DE FOTO AMPLIADA — Fora do fluxo do container para não ser coberto por nada */}
      {fotoAberta && (
        <div
          onClick={() => setFotoAberta(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 2147483647,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px 20px 60px 20px',
            cursor: 'zoom-out'
          }}
        >
          {/* Botão X de fechar */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setFotoAberta(null); }}
            title="Fechar"
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              border: '1.5px solid rgba(255,255,255,0.4)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 2147483647,
              backdropFilter: 'blur(6px)'
            }}
          >
            <MdClose size={24} color="#fff" />
          </button>

          <img
            src={fotoAberta.url}
            alt="Foto ampliada"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 10px 50px rgba(0,0,0,0.6)',
              cursor: 'default'
            }}
          />

          <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#fff',
            fontSize: '12px',
            background: 'rgba(0,0,0,0.65)',
            padding: '8px 18px',
            borderRadius: '20px',
            fontFamily: "'Montserrat', sans-serif",
            whiteSpace: 'nowrap',
             display: 'flex',           // ← adicionar
             alignItems: 'center',      // ← adicionar
             gap: '6px'                 // ← adicionar
          }}>
            <MdEvent size={14} color="#fff" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
Enviada em {formatarDataHora(fotoAberta.enviadoEm) || 'data não disponível'}
          </div>
        </div>
      )}
    </div>
  );
}