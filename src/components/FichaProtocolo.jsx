// src/components/FichaProtocolo.jsx
import React, { useState, useEffect, useRef } from 'react';
import { MdSave, MdArrowBack, MdDownload, MdAdd, MdDelete } from 'react-icons/md';
import { exportarParaPDF } from '../utils/gerarPdf';

export default function FichaProtocolo({
  mode = 'create',
  initialData,
  onSave,
  onVoltar,
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
      }, 1200);
    } catch (err) {
      console.error('Erro ao salvar protocolo:', err);
      setSalvando(false);
      alert('Erro ao salvar protocolo. Tente novamente.');
    }
  };

  // ============================================================
  // LEMBRETES (copiado da lógica da FichaDesktop)
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

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: '#dfc6fc',
        minHeight: '100vh',
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            borderBottom: '1px solid #eee',
            paddingBottom: '16px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <h2
            style={{
              fontFamily: "'Cinzel', serif",
              color: '#2c163a',
              margin: 0,
              fontSize: '18px',
            }}
          >
            {isView ? 'Protocolo' : initialData ? 'Editar Protocolo' : 'Novo Protocolo'}
          </h2>
          <button
            type="button"
            onClick={onVoltar}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#7e22ce',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              fontFamily: "'Cinzel', serif",
              fontSize: '12px',
            }}
          >
            <MdArrowBack size={18} /> Voltar
          </button>
        </div>

        {/* DADOS DO PACIENTE */}
        <div
          style={{
            marginBottom: '20px',
            padding: '14px',
            background: '#faf5ff',
            borderRadius: '10px',
            border: '1px solid #e2d2f5',
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            <label
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#C8A24A',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Nome:
            </label>
            <input
              type="text"
              value={nomeCliente}
              readOnly
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                fontWeight: 600,
                color: '#2c163a',
                outline: 'none',
                fontSize: '14px',
              }}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#C8A24A',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Data de Realização:
            </label>
            <input
              type="text"
              value={dataRealizacao}
              readOnly
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                fontWeight: 600,
                color: '#2c163a',
                outline: 'none',
                fontSize: '14px',
              }}
            />
          </div>
        </div>

        {/* PROTOCOLO (texto livre) */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              color: '#2c163a',
              marginBottom: '8px',
              fontFamily: "'Cinzel', serif",
            }}
          >
            Descrição do Protocolo
          </label>
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
              minHeight: '250px',
              padding: '14px',
              borderRadius: '10px',
              border: '1.5px solid #d8b4fe',
              fontSize: '14px',
              outline: 'none',
              resize: 'none',
              overflow: 'hidden',
              fontFamily: "'Montserrat', sans-serif",
              lineHeight: 1.6,
              color: '#2c163a',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* LEMBRETES */}
        <div
          style={{
            marginBottom: '20px',
            padding: '16px',
            background: '#fff8e1',
            borderRadius: '10px',
            border: '1.5px solid #fcd34d',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <h3
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#92400e',
                fontSize: '14px',
                margin: 0,
              }}
            >
              Lembretes para o Paciente
            </h3>
            {!isView && (
              <button
                type="button"
                onClick={adicionarLembrete}
                style={{
                  background: '#C8A24A',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '14px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 700,
                  fontFamily: "'Cinzel', serif",
                }}
              >
                <MdAdd size={14} /> Adicionar
              </button>
            )}
          </div>

          {lembretes.length === 0 ? (
            <p
              style={{
                fontSize: '12px',
                color: '#92400e',
                fontStyle: 'italic',
                textAlign: 'center',
                margin: 0,
              }}
            >
              Nenhum lembrete registrado.
            </p>
          ) : (
            lembretes.map((lembrete, index) => (
              <div
                key={index}
                style={{
                  background: '#fff',
                  border: '1px solid #fcd34d',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#C8A24A',
                    }}
                  >
                    Lembrete #{index + 1}
                  </span>
                  {!isView && (
                    <button
                      type="button"
                      onClick={() => removerLembrete(index)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#c62828',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <MdDelete size={16} />
                    </button>
                  )}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label
                    style={{
                      fontSize: '10px',
                      color: '#666',
                      display: 'block',
                      marginBottom: '3px',
                      fontWeight: 600,
                    }}
                  >
                    Título:
                  </label>
                  <input
                    type="text"
                    value={lembrete.titulo}
                    onChange={(e) => atualizarLembrete(index, 'titulo', e.target.value)}
                    readOnly={isView}
                    placeholder="Ex: Retorno em 30 dias"
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid #ccc',
                      fontSize: '12px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <label
                      style={{
                        fontSize: '10px',
                        color: '#666',
                        display: 'block',
                        marginBottom: '3px',
                        fontWeight: 600,
                      }}
                    >
                      Tipo:
                    </label>
                    <select
                      value={lembrete.tipo}
                      onChange={(e) => atualizarLembrete(index, 'tipo', e.target.value)}
                      disabled={isView}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                        fontSize: '12px',
                      }}
                    >
                      <option value="intervalo">Intervalo</option>
                      <option value="data_hora">Data e Hora</option>
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label
                      style={{
                        fontSize: '10px',
                        color: '#666',
                        display: 'block',
                        marginBottom: '3px',
                        fontWeight: 600,
                      }}
                    >
                      {lembrete.tipo === 'intervalo' ? 'A cada:' : 'Data e Hora:'}
                    </label>
                    {lembrete.tipo === 'intervalo' ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          type="number"
                          value={lembrete.intervaloNumero}
                          onChange={(e) =>
                            atualizarLembrete(index, 'intervaloNumero', e.target.value)
                          }
                          readOnly={isView}
                          min="1"
                          style={{
                            width: '60px',
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #ccc',
                            fontSize: '12px',
                          }}
                        />
                        <select
                          value={lembrete.intervaloUnidade}
                          onChange={(e) =>
                            atualizarLembrete(index, 'intervaloUnidade', e.target.value)
                          }
                          disabled={isView}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '6px',
                            border: '1px solid #ccc',
                            fontSize: '12px',
                          }}
                        >
                          <option value="horas">Horas</option>
                          <option value="dias">Dias</option>
                          <option value="minutos">Minutos</option>
                        </select>
                      </div>
                    ) : (
                      <input
                        type="datetime-local"
                        value={lembrete.valor}
                        onChange={(e) => atualizarLembrete(index, 'valor', e.target.value)}
                        readOnly={isView}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '6px',
                          border: '1px solid #ccc',
                          fontSize: '12px',
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end',
            marginTop: '20px',
            borderTop: '1px solid #eee',
            paddingTop: '20px',
            flexWrap: 'wrap',
          }}
        >
          {isView ? (
            <>
              <button
                type="button"
                onClick={() => exportarParaPDF('protocolo-container', nomeCliente)}
                style={{
                  background: 'linear-gradient(135deg, #b8a3c9 0%, #d7cee0 100%)',
                  color: '#2c163a',
                  border: '1.5px solid #8a6fa8',
                  padding: '12px 24px',
                  borderRadius: '22px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: "'Cinzel', serif",
                  fontSize: '12px',
                  boxShadow: '0 3px 10px rgba(138, 111, 168, 0.3)',
                }}
              >
                <MdDownload size={18} /> Baixar PDF
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={salvando || salvoSucesso}
              style={{
                background: salvoSucesso
                  ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)'
                  : 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '22px',
                fontWeight: 700,
                cursor: salvando || salvoSucesso ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: "'Cinzel', serif",
                fontSize: '12px',
                boxShadow: '0 4px 14px rgba(200, 162, 74, 0.35)',
                opacity: salvando || salvoSucesso ? 0.85 : 1,
              }}
            >
              <MdSave size={18} />
              {salvando ? 'Salvando...' : salvoSucesso ? 'Salvo!' : 'Salvar Protocolo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}