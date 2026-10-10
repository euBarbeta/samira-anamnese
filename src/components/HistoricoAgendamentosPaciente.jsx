// src/components/HistoricoAgendamentosPaciente.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import {
  MdExpandMore, MdExpandLess, MdPictureAsPdf, MdCheckCircle,
  MdCancel, MdHourglassEmpty, MdPersonOff, MdRefresh,
  MdInfoOutline, MdEvent, MdAccessTime, MdClose, MdDownload,
} from 'react-icons/md';

// ✅ Imports nativos (funcionam tanto em web quanto em APK)
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// ============================================================
// Helpers
// ============================================================
function normalizarNome(str) {
  return (str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarDoc(str) {
  return (str || '').replace(/\D/g, '');
}

function formatarDataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function formatarDataLonga(iso) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  const d = new Date(iso + 'T12:00:00');
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return `${dias[d.getDay()]}, ${dia}/${mes}/${ano}`;
}

// ✅ Detecta se está rodando como app nativo (APK)
function isNativo() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ✅ Converte Blob → base64 (sem o prefixo data:)
function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      const base64 = String(result).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============================================================
// Mapa de status
// ============================================================
const STATUS_INFO = {
  pendente:   { label: 'Pendente',   cor: '#92400e', bg: '#fff8e1', bd: '#fcd34d', Icone: MdHourglassEmpty },
  confirmado: { label: 'Confirmado', cor: '#166534', bg: '#f0fdf4', bd: '#86efac', Icone: MdCheckCircle },
  concluido:  { label: 'Concluído',  cor: '#166534', bg: '#f0fdf4', bd: '#86efac', Icone: MdCheckCircle },
  cancelado:  { label: 'Cancelado',  cor: '#991b1b', bg: '#fef2f2', bd: '#fca5a5', Icone: MdCancel },
  faltou:     { label: 'Faltou',     cor: '#c2410c', bg: '#fff7ed', bd: '#fdba74', Icone: MdPersonOff },
  reagendado: { label: 'Reagendado', cor: '#7e22ce', bg: '#faf5ff', bd: '#d8b4fe', Icone: MdRefresh },
};

const PERIODOS = [
  { key: 30,    label: '30 dias' },
  { key: 90,    label: '90 dias' },
  { key: 180,   label: '6 meses' },
  { key: 365,   label: '1 ano'   },
  { key: 0,     label: 'Tudo'    },
];

/* ============================================================
   RELATÓRIO PDF — JSX renderizado pelo React (mesma técnica da FichaMobile)
   ============================================================ */
function RelatorioPDF({ id, filtrados, pacienteNome, pacienteDocumento, periodoDias }) {
  const hoje = new Date();
  const limiteTexto =
    periodoDias > 0 ? `Últimos ${periodoDias} dias` : 'Todo o histórico';

  const resumo = Object.entries(
    filtrados.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([status, qtd]) => {
      const info = STATUS_INFO[status] || { label: status };
      return `${info.label}: ${qtd}`;
    })
    .join(' · ');

  return (
    <div
      id={id}
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '794px',
        zIndex: -1,
        pointerEvents: 'none',
        visibility: 'visible',
        opacity: 1,
        background: '#ffffff',
      }}
    >
      <div
        style={{
          fontFamily: 'Helvetica, Arial, sans-serif',
          padding: '30px',
          color: '#2c163a',
          background: '#ffffff',
        }}
      >
        <h1
          style={{
            fontSize: '20px',
            margin: '0 0 8px',
            color: '#2c163a',
            fontWeight: 700,
          }}
        >
          Histórico de Agendamentos
        </h1>

        <div
          style={{
            fontSize: '12px',
            color: '#666',
            marginBottom: '20px',
            paddingBottom: '14px',
            borderBottom: '2px solid #C8A24A',
            lineHeight: 1.7,
          }}
        >
          <strong style={{ color: '#2c163a' }}>{pacienteNome || 'Paciente'}</strong>
          <br />
          Documento: {pacienteDocumento || '—'}
          <br />
          Filtro: {limiteTexto}
        </div>

        <div
          style={{
            background: '#faf5ff',
            border: '1px solid #e2d2f5',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '18px',
            fontSize: '11px',
            lineHeight: 1.8,
            color: '#2c163a',
          }}
        >
          <strong>Total no período:</strong> {filtrados.length}
          <br />
          {resumo}
        </div>

        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '11px',
          }}
        >
          <thead>
            <tr>
              <th style={thEstilo}>Data</th>
              <th style={thEstilo}>Hora</th>
              <th style={thEstilo}>Serviço</th>
              <th style={thEstilo}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => {
              const info = STATUS_INFO[a.status] || STATUS_INFO.pendente;
              const horaReal = a.horaRealFim ? ` → real ${a.horaRealFim}` : '';

              return (
                <tr key={a.id}>
                  <td style={tdEstilo}>{formatarDataBR(a.data)}</td>
                  <td style={tdEstilo}>
                    {a.horaInicio || ''}
                    {a.horaFim ? `–${a.horaFim}` : ''}
                    {horaReal}
                  </td>
                  <td style={tdEstilo}>{a.servicoNome || '—'}</td>
                  <td style={tdEstilo}>{info.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div
          style={{
            marginTop: '30px',
            paddingTop: '14px',
            borderTop: '1px dashed #C8A24A',
            fontSize: '10px',
            color: '#888',
            textAlign: 'center',
            lineHeight: 1.7,
          }}
        >
          Gerado em {hoje.toLocaleString('pt-BR')}
          <br />
          Samira Ferreira Estética & Cosmetologia
        </div>
      </div>
    </div>
  );
}

const thEstilo = {
  background: '#7e22ce',
  color: '#ffffff',
  padding: '10px 8px',
  textAlign: 'left',
  border: '1px solid #7e22ce',
  fontWeight: 700,
};

const tdEstilo = {
  padding: '8px',
  border: '1px solid #e2d2f5',
  fontSize: '11px',
};

/* ============================================================
   MODAL DE PRÉ-VISUALIZAÇÃO — funciona em web, PWA e APK
   ============================================================ */
function ModalPreviewPDF({ url, blob, nomeArquivo, onFechar }) {
  const [processando, setProcessando] = useState(false);

  // ============================================================
  // BAIXAR — detecta plataforma
  // ============================================================
  const handleBaixar = async () => {
    setProcessando(true);
    try {
      if (isNativo()) {
        // ✅ APK: salva no cache + abre menu nativo "Salvar como"
        const base64 = await blobParaBase64(blob);
        const resultado = await Filesystem.writeFile({
          path: nomeArquivo,
          data: base64,
          directory: Directory.Cache,
          recursive: true,
        });

        await Share.share({
          title: 'Salvar PDF',
          text: 'Escolha onde salvar o PDF:',
          url: resultado.uri,
          dialogTitle: 'Salvar PDF',
        });
      } else {
        // ✅ Web/PWA: download normal
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      if (e?.message?.toLowerCase().includes('cancel')) return;
      console.error('Erro ao baixar:', e);
      alert('Não foi possível baixar. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div
      onClick={processando ? undefined : onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.85)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2147483647,
        padding: 16,
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 820,
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.5)',
          border: '1.5px solid #C8A24A',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1.5px solid #e2d2f5',
            background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <MdPictureAsPdf size={20} color="#7e22ce" />
            <h3
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#2c163a',
                fontSize: 14,
                margin: 0,
              }}
            >
              Pré-visualizar PDF
            </h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={processando}
            aria-label="Fechar"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: processando ? 'not-allowed' : 'pointer',
              padding: 6,
              borderRadius: '50%',
              display: 'flex',
              opacity: processando ? 0.5 : 1,
            }}
          >
            <MdClose size={22} color="#2c163a" />
          </button>
        </div>

        {/* Preview — iframe em web, mensagem em APK */}
        <div
          style={{
            flex: 1,
            background: '#f3eef8',
            position: 'relative',
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isNativo() ? (
            <div
              style={{
                padding: 30,
                textAlign: 'center',
                color: '#666',
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <MdPictureAsPdf
                size={56}
                color="#7e22ce"
                style={{ marginBottom: 12 }}
              />
              <div
                style={{
                  fontWeight: 700,
                  color: '#2c163a',
                  marginBottom: 6,
                  fontFamily: "'Cinzel', serif",
                }}
              >
                PDF pronto!
              </div>
              <div style={{ fontSize: 12 }}>
                Toque em <strong>Baixar</strong> abaixo para salvar o PDF.
              </div>
            </div>
          ) : (
            <iframe
              src={url}
              title="Pré-visualização do PDF"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#fff',
              }}
            />
          )}
        </div>

        {/* Rodapé com botão único */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1.5px solid #e2d2f5',
            background: '#fafafc',
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleBaixar}
            disabled={processando}
            style={{
              fontFamily: "'Cinzel', serif",
              background: processando
                ? '#ddd'
                : 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
              color: processando ? '#888' : '#fff',
              border: '1.5px solid #9c7826',
              padding: '10px 20px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              cursor: processando ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 42,
            }}
          >
            <MdDownload size={16} />
            {processando ? 'PROCESSANDO…' : 'BAIXAR'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
export default function HistoricoAgendamentosPaciente({
  pacienteId,
  pacienteNome,
  pacienteDocumento,
  uidEsteticista,
  modo = 'esteticista',
  colapsavel = true,
  abertoPorPadrao = false,
}) {
  const [aberto, setAberto] = useState(!colapsavel || abertoPorPadrao);
  const [agendamentos, setAgendamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [periodoDias, setPeriodoDias] = useState(180);
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [gerandoPDF, setGerandoPDF] = useState(false);

  // ✅ Estados pra PDF
  const [renderizandoPDF, setRenderizandoPDF] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [nomeArquivoAtual, setNomeArquivoAtual] = useState('');

  // ============================================================
  // Listener
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;

    let cancelado = false;

    const q = query(
      collection(db, 'agendamentos'),
      where('uidEsteticista', '==', uidEsteticista)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (cancelado) return;

        const pacIdStr = String(pacienteId || '');
        const docNorm = normalizarDoc(pacienteDocumento);
        const nomeNorm = normalizarNome(pacienteNome);

        const todos = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => {
            if (a.pacienteId && String(a.pacienteId) === pacIdStr) return true;
            if (
              normalizarNome(a.nome) === nomeNorm &&
              normalizarDoc(a.documento) === docNorm
            ) {
              return true;
            }
            return false;
          })
          .sort((a, b) => {
            const ka = `${a.data} ${a.horaInicio}`;
            const kb = `${b.data} ${b.horaInicio}`;
            return kb.localeCompare(ka);
          });

        setAgendamentos(todos);
        setCarregando(false);
      },
      (err) => {
        console.error('Erro histórico de agendamentos:', err);
        setCarregando(false);
      }
    );

    return () => {
      cancelado = true;
      unsub();
    };
  }, [uidEsteticista, pacienteId, pacienteDocumento, pacienteNome, modo]);

  // ============================================================
  // Filtro por período + status
  // ============================================================
  const filtrados = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const limite =
      periodoDias > 0
        ? new Date(hoje.getTime() - periodoDias * 24 * 60 * 60 * 1000)
        : null;

    return agendamentos.filter((a) => {
      if (statusFiltro !== 'todos' && a.status !== statusFiltro) return false;

      if (limite) {
        const d = new Date((a.data || '') + 'T12:00:00');
        if (d < limite) return false;
      }

      return true;
    });
  }, [agendamentos, periodoDias, statusFiltro]);

  // ============================================================
  // Geração do PDF via container RENDERIZADO PELO REACT
  // ============================================================
  useEffect(() => {
    if (!renderizandoPDF) return;

    const timer = setTimeout(async () => {
      try {
        const containerId = 'historico-pdf-container';
        const elemento = document.getElementById(containerId);

        if (!elemento) {
          console.error('❌ Container #historico-pdf-container não encontrado');
          alert('Erro: container do PDF não encontrado.');
          setRenderizandoPDF(false);
          setGerandoPDF(false);
          return;
        }

        // Força largura A4
        elemento.style.width = '210mm';
        elemento.style.maxWidth = 'none';

        const html2pdf = (await import('html2pdf.js')).default;

        const blob = await html2pdf()
          .from(elemento)
          .set({
            margin: 0,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              letterRendering: true,
              scrollY: 0,
              scrollX: 0,
              windowWidth: 794,
            },
            jsPDF: {
              unit: 'mm',
              format: 'a4',
              orientation: 'portrait',
            },
          })
          .outputPdf('blob');

        const url = URL.createObjectURL(blob);
        const nomeArquivo = `Historico-${(pacienteNome || 'Paciente').replace(/\s+/g, '-')}.pdf`;

        setPreviewUrl(url);
        setPreviewBlob(blob);
        setNomeArquivoAtual(nomeArquivo);
      } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        alert('Erro ao gerar PDF. Tente novamente.');
      } finally {
        setRenderizandoPDF(false);
        setGerandoPDF(false);
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [renderizandoPDF, pacienteNome]);

  // ============================================================
  // Handler do botão
  // ============================================================
  const handleExportarPDF = () => {
    if (filtrados.length === 0) {
      alert('Nenhum agendamento no período selecionado.');
      return;
    }
    setGerandoPDF(true);
    setRenderizandoPDF(true);
  };

  // ============================================================
  // Fechar modal (libera memória)
  // ============================================================
  const fecharPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewBlob(null);
    setNomeArquivoAtual('');
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1.5px solid #d8b4fe',
          borderRadius: 14,
          overflow: 'hidden',
          marginTop: 16,
        }}
      >
        {/* HEADER colapsável */}
        <button
          type="button"
          onClick={() => colapsavel && setAberto((v) => !v)}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
            border: 'none',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: colapsavel ? 'pointer' : 'default',
            fontFamily: "'Cinzel', serif",
            color: '#2c163a',
            fontSize: 13,
            fontWeight: 700,
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <MdEvent size={18} color="#7e22ce" />
            Histórico de Agendamentos do Paciente
          </span>
          {colapsavel && (
            <span style={{ display: 'flex', alignItems: 'center', color: '#7e22ce' }}>
              {aberto ? <MdExpandLess size={22} /> : <MdExpandMore size={22} />}
            </span>
          )}
        </button>

        {/* CONTEÚDO */}
        {aberto && (
          <div style={{ padding: 16 }}>
            {/* Filtros de período */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {PERIODOS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriodoDias(p.key)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 14,
                    border: '1.5px solid #C8A24A',
                    background: periodoDias === p.key ? '#C8A24A' : 'transparent',
                    color: periodoDias === p.key ? '#fff' : '#C8A24A',
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'Cinzel', serif",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Status + Exportar */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: 14,
                paddingBottom: 12,
                borderBottom: '1px dashed #e2d2f5',
              }}
            >
              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value)}
                style={{
                  padding: '6px 10px',
                  border: '1.5px solid #d8b4fe',
                  borderRadius: 8,
                  fontSize: 11,
                  color: '#2c163a',
                  background: '#fff',
                  fontFamily: "'Montserrat', sans-serif",
                  outline: 'none',
                }}
              >
                <option value="todos">Todos os status</option>
                <option value="concluido">Concluídos</option>
                <option value="confirmado">Confirmados</option>
                <option value="pendente">Pendentes</option>
                <option value="faltou">Faltas</option>
                <option value="cancelado">Cancelados</option>
                <option value="reagendado">Reagendados</option>
              </select>

              <div style={{ flex: 1 }} />

              <button
                type="button"
                onClick={handleExportarPDF}
                disabled={gerandoPDF || filtrados.length === 0}
                style={{
                  fontFamily: "'Cinzel', serif",
                  background:
                    gerandoPDF || filtrados.length === 0
                      ? '#ddd'
                      : 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
                  color: gerandoPDF || filtrados.length === 0 ? '#888' : '#fff',
                  border: '1.5px solid #6b21a8',
                  padding: '8px 14px',
                  borderRadius: 16,
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor:
                    gerandoPDF || filtrados.length === 0
                      ? 'not-allowed'
                      : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <MdPictureAsPdf size={14} />
                {gerandoPDF ? 'GERANDO…' : 'EXPORTAR PDF'}
              </button>
            </div>

            {/* Lista */}
            {carregando ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#888', fontSize: 12 }}>
                Carregando histórico…
              </div>
            ) : filtrados.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px 16px',
                  background: '#faf5ff',
                  borderRadius: 10,
                  border: '1px dashed #d8b4fe',
                  fontSize: 12,
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <MdInfoOutline size={16} color="#7e22ce" />
                {agendamentos.length === 0
                  ? 'Nenhum agendamento registrado ainda.'
                  : 'Nenhum agendamento no período selecionado.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtrados.map((a) => {
                  const info = STATUS_INFO[a.status] || STATUS_INFO.pendente;
                  const Icone = info.Icone;

                  return (
                    <div
                      key={a.id}
                      style={{
                        background: '#fff',
                        border: `1px solid ${info.bd}`,
                        borderRadius: 10,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: info.bg,
                          border: `1.5px solid ${info.bd}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icone size={18} color={info.cor} />
                      </div>

                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div
                          style={{
                            fontFamily: "'Cinzel', serif",
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: '#2c163a',
                            lineHeight: 1.3,
                          }}
                        >
                          {formatarDataLonga(a.data)}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: '#666',
                            marginTop: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <MdAccessTime size={12} color="#7e22ce" />
                            {a.horaInicio}
                            {a.horaFim ? `–${a.horaFim}` : ''}
                          </span>
                          {a.servicoNome && <span>· {a.servicoNome}</span>}
                          {a.horaRealFim && (
                            <span style={{ color: '#166534', fontWeight: 600 }}>
                              · real: {a.horaRealFim}
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: info.bg,
                          color: info.cor,
                          border: `1px solid ${info.bd}`,
                          borderRadius: 12,
                          padding: '3px 10px',
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: "'Cinzel', serif",
                          flexShrink: 0,
                        }}
                      >
                        <Icone size={11} />
                        {info.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Container do PDF — renderizado pelo React */}
      {renderizandoPDF && (
        <RelatorioPDF
          id="historico-pdf-container"
          filtrados={filtrados}
          pacienteNome={pacienteNome}
          pacienteDocumento={pacienteDocumento}
          periodoDias={periodoDias}
        />
      )}

      {/* Modal de preview */}
      {previewUrl && (
        <ModalPreviewPDF
          url={previewUrl}
          blob={previewBlob}
          nomeArquivo={nomeArquivoAtual}
          onFechar={fecharPreview}
        />
      )}
    </>
  );
}