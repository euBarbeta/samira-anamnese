// src/components/agendamento/PainelAgendamentosEsteticista.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import GerenciarServicos from './GerenciarServicos';
import ModalAgendarParaPaciente from './ModalAgendarParaPaciente';
import ModalEscolherServico from './ModalEscolherServico';
import ConfiguradorAgenda from './ConfiguradorAgenda';
import FichaDesktop from '../FichaDesktop';
import FichaMobile from '../FichaMobile';
import {
  reativarPorEdicao,
  reativarPacienteCompleto,
} from '../../utils/lgpdExclusao';
import ModalEditarSobra from './ModalEditarSobra';
import ModalRegistrarReceita from '../financeiro/ModalRegistrarReceita';
import { gerarPdfHistorico, salvarPdfHistorico } from '../../utils/gerarPdfHistorico';   // ✅ NOVO
import { createPortal } from 'react-dom';   // ✅ NOVO

import {
  collection, query, where, onSnapshot, doc, getDoc, setDoc,
  updateDoc, deleteDoc, orderBy, addDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import { secondaryAuth } from '../firebaseSecondary';
import { registrarLinkPaciente, gerarUidDeterministico, limparUndefined } from '../../utils/validarUID';
import { sanitizarFichaAnamnese, sanitizarTexto } from '../../utils/sanitizar';
import { formatPhoneNumberIntl } from 'react-phone-number-input';

import {
  MdCheckCircle, MdCancel, MdWarning, MdSearch,
  MdCalendarMonth, MdSettings, MdPhone, MdBadge,
  MdEmail, MdChatBubbleOutline, MdClear, MdHourglassEmpty,
  MdContentCopy, MdCheck, MdDelete, MdAssignment, MdEvent,
  MdPersonOff, MdRefresh, MdPictureAsPdf, MdLock,MdDownload,MdClose, 
} from 'react-icons/md';

// ============================================================
// ✅ Escapa texto pra uso seguro dentro de HTML
//    (evita XSS quando o nome do paciente tem <script> ou onerror=)
// ============================================================
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DIAS_HISTORICO = 30;

// ============================================================
// ✅ O e-mail do agendamento pode ser @sistema.local (login) ou vazio.
//    Só devolve como e-mail de CONTATO se for um e-mail real.
// ============================================================
function emailContatoDoAgendamento(emailBruto) {
  const email = (emailBruto || '').trim().toLowerCase();
  if (!email) return '';
  if (email.endsWith('@sistema.local')) return '';
  return email;
}

// ============================================================
// ✅ A ficha pode salvar emailContato/telefone na RAIZ do doc OU
//    dentro de `anamnese`. Estes helpers leem dos dois.
// ============================================================
function getEmailContatoDoPaciente(pac) {
  if (!pac) return '';
  const emailRaiz = (pac.emailContato || '').trim();
  if (emailRaiz) return emailRaiz;
  return (pac.anamnese?.emailContato || '').trim();
}

function getTelefoneDoPaciente(pac) {
  if (!pac) return '';
  const telRaiz = (pac.telefone || '').trim();
  if (telRaiz) return telRaiz;
  return (pac.anamnese?.telefone || '').trim();
}

function normalizarNome(str) {
  return (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizarDoc(str) {
  return (str || '').replace(/\D/g, '');
}

// ============================================================
// ✅ Chave única por agendamento + campo.
//    E-mail e telefone são resolvidos INDEPENDENTEMENTE.
// ============================================================
const chaveDivergencia = (agId, campo) => `${String(agId)}|${campo}`;

function formatarTelefoneInternacional(tel) {
  if (!tel) return '—';
  try {
    const f = formatPhoneNumberIntl(String(tel));
    return f || String(tel);
  } catch {
    return String(tel);
  }
}

function BotaoCopiar({ valor, rotulo, title }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async (e) => {
    e?.stopPropagation?.();
    const texto = String(valor || '');
    if (!texto) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
      } else {
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch (err) {
      console.warn('Falha ao copiar:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={copiar}
      title={copiado ? 'Copiado!' : (title || `Copiar ${rotulo || ''}`)}
      aria-label={copiado ? 'Copiado' : `Copiar ${rotulo || ''}`}
      style={{
        background: copiado ? '#f0fdf4' : '#faf5ff',
        border: copiado ? '1px solid #86efac' : '1px solid #d8b4fe',
        color: copiado ? '#166534' : '#7e22ce',
        width: 22,
        height: 22,
        borderRadius: 6,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        flexShrink: 0,
        transition: 'all 0.18s ease',
        marginLeft: 4,
        verticalAlign: 'middle',
      }}
    >
      {copiado ? <MdCheck size={12} /> : <MdContentCopy size={11} />}
    </button>
  );
}

/* ============================================================
   MODAL DE CONFIRMAÇÃO DE CANCELAMENTO
   ✅ CORRIGIDO: sem state de serviços, sem listener, sem funções órfãs
   ============================================================ */
function ModalConfirmarCancelamento({
  agendamento,
  carregando,
  onConfirmar,
  onFechar,
}) {
  // ✅ Atalhos de teclado: Enter = confirmar | Esc = cancelar
  useEffect(() => {
    if (carregando) return;

    const handler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirmar?.();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onFechar?.();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [carregando, onConfirmar, onFechar]);

  return (
    <div
      onClick={carregando ? undefined : onFechar}
      style={{
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
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '28px 24px 24px 24px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
          border: '1.5px solid #e2d2f5',
          fontFamily: "'Montserrat', sans-serif",
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            margin: '0 auto 16px auto',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ffebee 0%, #fde8e8 100%)',
            border: '2px solid #ef9a9a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(198, 40, 40, 0.18)',
          }}
        >
          <MdCancel size={32} color="#c62828" />
        </div>

        <h3
          style={{
            fontFamily: "'Cinzel', serif",
            color: '#c62828',
            fontSize: 17,
            fontWeight: 700,
            margin: '0 0 10px 0',
            letterSpacing: '0.4px',
          }}
        >
          Cancelar agendamento?
        </h3>

        <p
          style={{
            fontSize: 13,
            color: '#2c163a',
            margin: '0 0 6px 0',
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          {agendamento?.nome || 'Paciente'}
        </p>

        <p
          style={{
            fontSize: 12,
            color: '#555',
            margin: '0 0 18px 0',
            lineHeight: 1.6,
          }}
        >
          {formatarDataBR(agendamento?.data)} às {agendamento?.horaInicio}
          <br />
          <span
            style={{
              fontSize: 11,
              color: '#888',
              display: 'block',
              marginTop: 6,
            }}
          >
            O paciente será notificado (se tiver app). Esta ação não pode ser desfeita.
          </span>
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={onFechar}
            disabled={carregando}
            style={{
              flex: 1,
              background: '#f0f0f0',
              color: '#333',
              border: 'none',
              padding: '12px 16px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: carregando ? 'not-allowed' : 'pointer',
              fontFamily: "'Cinzel', serif",
              opacity: carregando ? 0.6 : 1,
              minHeight: 44,
            }}
          >
            VOLTAR
          </button>

          <button
            type="button"
            onClick={onConfirmar}
            disabled={carregando}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
              color: '#fff',
              border: 'none',
              padding: '12px 16px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: carregando ? 'wait' : 'pointer',
              fontFamily: "'Cinzel', serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(198, 40, 40, 0.35)',
              opacity: carregando ? 0.7 : 1,
              minHeight: 44,
            }}
          >
            {carregando ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: 13,
                    height: 13,
                    border: '2px solid #fff',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spinCancel 0.8s linear infinite',
                  }}
                />
                CANCELANDO…
              </>
            ) : (
              <>
                <MdDelete size={14} />
                CANCELAR
              </>
            )}
          </button>
        </div>

        <style>{`
          @keyframes spinCancel { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}

/* ============================================================
   MODAL DE FEEDBACK — estética do sistema (substitui alert)
   ============================================================ */
function ModalFeedback({ tipo = 'info', titulo, mensagem, onFechar }) {
  const config = {
    info:    { cor: '#7e22ce', bg: '#faf5ff', borda: '#d8b4fe', icone: 'ℹ️' },
    sucesso: { cor: '#166534', bg: '#f0fdf4', borda: '#86efac', icone: '✅' },
    aviso:   { cor: '#92400e', bg: '#fff8e1', borda: '#fcd34d', icone: '⚠️' },
    erro:    { cor: '#991b1b', bg: '#fef2f2', borda: '#fca5a5', icone: '❌' },
  }[tipo] || { cor: '#7e22ce', bg: '#faf5ff', borda: '#d8b4fe', icone: 'ℹ️' };

  const { cor, bg, borda, icone } = config;

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2147483647,
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '28px 24px 22px',
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 20px 60px rgba(44, 22, 58, 0.4)',
          border: '1.5px solid #e2d2f5',
          fontFamily: "'Montserrat', sans-serif",
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 14px auto',
            borderRadius: '50%',
            background: bg,
            border: `2px solid ${borda}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            boxShadow: `0 4px 14px ${cor}22`,
          }}
        >
          {icone}
        </div>

        {titulo && (
          <h3
            style={{
              fontFamily: "'Cinzel', serif",
              color: cor,
              fontSize: 17,
              fontWeight: 700,
              margin: '0 0 10px 0',
              letterSpacing: '0.4px',
            }}
          >
            {titulo}
          </h3>
        )}

        {mensagem && (
          <p
            style={{
              fontSize: 13,
              color: '#2c163a',
              margin: '0 0 20px 0',
              lineHeight: 1.6,
              whiteSpace: 'pre-line',
            }}
          >
            {mensagem}
          </p>
        )}

        <button
          type="button"
          onClick={onFechar}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
            color: '#fff',
            border: '1.5px solid #9c7826',
            padding: '13px 16px',
            borderRadius: 22,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Cinzel', serif",
            boxShadow: '0 4px 14px rgba(200, 162, 74, 0.35)',
            letterSpacing: '0.6px',
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   MODAL DE EXPORTAÇÃO PDF — Histórico por período
   ============================================================ */
function ModalExportarAgendamentos({ agendamentos, filtroStatus, onFechar }) {
  const toISO = (d) => {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  const hoje = new Date();
  const noventaDiasAtras = new Date(hoje);
  noventaDiasAtras.setDate(noventaDiasAtras.getDate() - 90);

  const [dataInicio, setDataInicio] = useState(toISO(noventaDiasAtras));
  const [dataFim, setDataFim] = useState(toISO(hoje));
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [gerando, setGerando] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // ✅ Estados do PDF (novo padrão)
  const [renderizandoPDF, setRenderizandoPDF] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [nomeArquivoAtual, setNomeArquivoAtual] = useState('');

  const filtradosPreview = useMemo(() => {
    if (!dataInicio || !dataFim) return [];

    return agendamentos.filter((a) => {
      if (a.data < dataInicio || a.data > dataFim) return false;
      if (statusFiltro !== 'todos' && a.status !== statusFiltro) return false;
      if (a.ocultoParaEsteticista) return false;
      return true;
    });
  }, [agendamentos, dataInicio, dataFim, statusFiltro]);

  const gerarPDF = () => {
    if (!dataInicio || !dataFim) {
      setFeedback({
        tipo: 'aviso',
        titulo: 'Datas obrigatórias',
        mensagem: 'Escolha a data inicial e a data final para gerar o relatório.',
      });
      return;
    }

    if (dataInicio > dataFim) {
      setFeedback({
        tipo: 'aviso',
        titulo: 'Datas invertidas',
        mensagem:
          'A data inicial precisa ser anterior ou igual à data final.\n' +
          'Corrija o período e tente novamente.',
      });
      return;
    }

    if (filtradosPreview.length === 0) {
      setFeedback({
        tipo: 'info',
        titulo: 'Nenhum agendamento no período',
        mensagem:
          `Não encontramos agendamentos entre ${dataInicio.split('-').reverse().join('/')} e ${dataFim.split('-').reverse().join('/')}` +
          (statusFiltro !== 'todos' ? ` com status "${statusFiltro}".` : '.') +
          '\n\nAjuste as datas ou o filtro e tente novamente.',
      });
      return;
    }

    setGerando(true);
    setRenderizandoPDF(true);
  };

  // ✅ Gera o PDF usando gerarPdfHistorico
  useEffect(() => {
    if (!renderizandoPDF) return;

    let cancelado = false;

    const timer = setTimeout(async () => {
      try {
        const containerId = 'agendamentos-pdf-container';
        const elemento = document.getElementById(containerId);

        if (!elemento) {
          throw new Error('Container do PDF não encontrado.');
        }

        const blob = await gerarPdfHistorico(elemento);
        if (cancelado) return;

        const url = URL.createObjectURL(blob);
        const nomeArquivo = `Agendamentos-${dataInicio}-a-${dataFim}.pdf`;

        setPreviewUrl(url);
        setPreviewBlob(blob);
        setNomeArquivoAtual(nomeArquivo);
      } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        setFeedback({
          tipo: 'erro',
          titulo: 'Erro ao gerar PDF',
          mensagem: err?.message || 'Tente novamente.',
        });
      } finally {
        if (!cancelado) {
          setRenderizandoPDF(false);
          setGerando(false);
        }
      }
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [renderizandoPDF, dataInicio, dataFim]);

  const fecharPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setNomeArquivoAtual('');
  };

  const totalPreview = filtradosPreview.length;

  return (
    <>
      {/* MODAL DE FILTRO */}
      <div
        onClick={gerando ? undefined : onFechar}
        style={{
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
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#fff',
            borderRadius: 20,
            padding: '28px 24px 24px 24px',
            maxWidth: 460,
            width: '100%',
            boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
            border: '1.5px solid #C8A24A',
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          <h3
            style={{
              fontFamily: "'Cinzel', serif",
              color: '#2c163a',
              fontSize: 17,
              fontWeight: 700,
              margin: '0 0 6px 0',
            }}
          >
            Exportar agendamentos
          </h3>
          <p style={{ fontSize: 12, color: '#666', margin: '0 0 20px 0', lineHeight: 1.5 }}>
            Escolha o período e o status. O PDF abre em preview — salve ou compartilhe por lá.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelEstilo}>Data inicial</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                disabled={gerando}
                style={inputEstilo}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelEstilo}>Data final</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                disabled={gerando}
                style={inputEstilo}
              />
            </div>
          </div>

          <label style={labelEstilo}>Status</label>
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            disabled={gerando}
            style={{ ...inputEstilo, marginBottom: 12 }}
          >
            <option value="todos">Todos os status</option>
            <option value="concluido">Somente concluídos</option>
            <option value="confirmado">Somente confirmados</option>
            <option value="pendente">Somente pendentes</option>
            <option value="faltou">Somente faltas</option>
            <option value="cancelado">Somente cancelados</option>
          </select>

          <div
            style={{
              background: totalPreview > 0 ? '#f0fdf4' : '#fff8e1',
              border: `1.5px solid ${totalPreview > 0 ? '#86efac' : '#fcd34d'}`,
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 18,
              fontSize: 12,
              color: totalPreview > 0 ? '#166534' : '#92400e',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontSize: 16 }}>{totalPreview > 0 ? 'OK' : '!'}</span>
            <span>
              {totalPreview === 0
                ? 'Nenhum agendamento no período selecionado.'
                : totalPreview === 1
                  ? '1 agendamento encontrado.'
                  : `${totalPreview} agendamentos encontrados.`}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onFechar}
              disabled={gerando}
              style={{
                flex: 1,
                background: '#f0f0f0',
                color: '#333',
                border: 'none',
                padding: '12px 16px',
                borderRadius: 22,
                fontSize: 12,
                fontWeight: 700,
                cursor: gerando ? 'not-allowed' : 'pointer',
                fontFamily: "'Cinzel', serif",
                opacity: gerando ? 0.6 : 1,
                minHeight: 44,
              }}
            >
              CANCELAR
            </button>
            <button
              type="button"
              onClick={gerarPDF}
              disabled={gerando || totalPreview === 0}
              style={{
                flex: 1,
                background:
                  gerando || totalPreview === 0
                    ? '#ddd'
                    : 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
                color: gerando || totalPreview === 0 ? '#888' : '#fff',
                border: '1.5px solid #6b21a8',
                padding: '12px 16px',
                borderRadius: 22,
                fontSize: 12,
                fontWeight: 700,
                cursor: gerando || totalPreview === 0 ? 'not-allowed' : 'pointer',
                fontFamily: "'Cinzel', serif",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 44,
              }}
            >
              {gerando ? 'GERANDO…' : 'GERAR PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* ✅ CONTAINER DO PDF (oculto) */}
      {renderizandoPDF && (
        <RelatorioAgendamentosPDF
          id="agendamentos-pdf-container"
          filtrados={filtradosPreview}
          dataInicio={dataInicio}
          dataFim={dataFim}
          statusFiltro={statusFiltro}
        />
      )}

      {/* ✅ PREVIEW DO PDF */}
      {previewUrl && (
        <ModalPreviewAgendamentosPDF
          url={previewUrl}
          blob={previewBlob}
          nomeArquivo={nomeArquivoAtual}
          onFechar={fecharPreview}
        />
      )}

      {feedback && (
        <ModalFeedback
          tipo={feedback.tipo}
          titulo={feedback.titulo}
          mensagem={feedback.mensagem}
          onFechar={() => setFeedback(null)}
        />
      )}
    </>
  );
}
/* ============================================================
   RELATÓRIO PDF — container oculto, renderizado pelo React
   ============================================================ */
function RelatorioAgendamentosPDF({ id, filtrados, dataInicio, dataFim, statusFiltro }) {
  const hoje = new Date();

  const fmtData = (iso) => {
    if (!iso) return '—';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  };

  const dataBRIni = dataInicio.split('-').reverse().join('/');
  const dataBRFim = dataFim.split('-').reverse().join('/');

  const resumo = Object.entries(
    filtrados.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, qtd]) => {
    const label = {
      pendente: 'Pendente',
      confirmado: 'Confirmado',
      concluido: 'Concluído',
      cancelado: 'Cancelado',
      faltou: 'Faltou',
      reagendado: 'Reagendado',
    }[status] || status;
    return `${label}: ${qtd}`;
  }).join(' · ');

  return (
    <div
      id={id}
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        top: 0,
        width: '794px',
        zIndex: -1,
        pointerEvents: 'none',
        background: '#ffffff',
      }}
    >
      <div style={{
        fontFamily: 'Helvetica, Arial, sans-serif',
        padding: '30px',
        color: '#2c163a',
        background: '#ffffff',
      }}>
        <h1 style={{
          fontSize: 20,
          margin: '0 0 8px',
          color: '#2c163a',
          fontWeight: 700,
        }}>
          Relatório de Agendamentos
        </h1>

        <div style={{
          fontSize: 12,
          color: '#666',
          marginBottom: '20px',
          paddingBottom: '14px',
          borderBottom: '2px solid #C8A24A',
          lineHeight: 1.7,
        }}>
          <strong style={{ color: '#2c163a' }}>Samira Ferreira Estética & Cosmetologia</strong>
          <br />
          Período: <strong>{dataBRIni}</strong> a <strong>{dataBRFim}</strong>
          {statusFiltro !== 'todos' && ` · Filtro: ${statusFiltro}`}
        </div>

        <div style={{
          background: '#faf5ff',
          border: '1px solid #e2d2f5',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '18px',
          fontSize: '11px',
          lineHeight: 1.8,
          color: '#2c163a',
        }}>
          <strong>Total no período:</strong> {filtrados.length}
          <br />
          {resumo}
        </div>

        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '10.5px',
        }}>
          <thead>
            <tr>
              <th style={thEstilo}>Data</th>
              <th style={thEstilo}>Hora</th>
              <th style={thEstilo}>Paciente</th>
              <th style={thEstilo}>Telefone</th>
              <th style={thEstilo}>Serviço</th>
              <th style={thEstilo}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => {
              const label = {
                pendente: 'Pendente',
                confirmado: 'Confirmado',
                concluido: 'Concluído',
                cancelado: 'Cancelado',
                faltou: 'Faltou',
                reagendado: 'Reagendado',
              }[a.status] || a.status;

              return (
                <tr key={a.id}>
                  <td style={tdEstilo}>{fmtData(a.data)}</td>
                  <td style={tdEstilo}>
                    {a.horaInicio || ''}
                    {a.horaFim ? `–${a.horaFim}` : ''}
                  </td>
                  <td style={tdEstilo}>{a.nome || ''}</td>
                  <td style={tdEstilo}>{a.telefone || ''}</td>
                  <td style={tdEstilo}>{a.servicoNome || '—'}</td>
                  <td style={tdEstilo}>{label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{
          marginTop: '30px',
          paddingTop: '14px',
          borderTop: '1px dashed #C8A24A',
          fontSize: '10px',
          color: '#888',
          textAlign: 'center',
          lineHeight: 1.7,
        }}>
          Gerado em {hoje.toLocaleString('pt-BR')}
          <br />
          Documento de uso interno.
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MODAL DE PREVIEW DO PDF — com createPortal
   ============================================================ */
function ModalPreviewAgendamentosPDF({ url, blob, nomeArquivo, onFechar }) {
  const [processando, setProcessando] = useState(false);

  const isNativo = typeof window !== 'undefined' &&
    (window.Capacitor?.isNativePlatform?.() ?? false);

  const handleBaixar = async () => {
    setProcessando(true);
    try {
      await salvarPdfHistorico(blob, nomeArquivo);
    } catch (e) {
      if (e?.message?.toLowerCase().includes('cancel')) return;
      console.error('Erro ao baixar:', e);
      alert('Não foi possível baixar. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  const handleAbrir = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const conteudo = (
    <div
      onClick={processando ? undefined : onFechar}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(44, 22, 58, 0.85)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2147483647,
        padding: 16,
        boxSizing: 'border-box',
        transform: 'none',
        filter: 'none',
        isolation: 'isolate',
        overflow: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.5)',
          border: '1.5px solid #C8A24A',
          margin: 'auto',
          transform: 'none',
          filter: 'none',
        }}
      >
        <div style={{
          padding: '14px 18px',
          borderBottom: '1.5px solid #e2d2f5',
          background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdPictureAsPdf size={20} color="#7e22ce" />
            <h3 style={{
              fontFamily: "'Cinzel', serif",
              color: '#2c163a',
              fontSize: 14,
              margin: 0,
            }}>
              PDF pronto
            </h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={processando}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: processando ? 'not-allowed' : 'pointer',
              padding: 6,
              opacity: processando ? 0.5 : 1,
            }}
          >
            <MdClose size={22} color="#2c163a" />
          </button>
        </div>

        <div style={{
          padding: '28px 24px',
          textAlign: 'center',
          fontFamily: "'Montserrat', sans-serif",
          background: '#faf5ff',
        }}>
          <MdPictureAsPdf size={64} color="#7e22ce" style={{ marginBottom: 14 }} />
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#2c163a',
            marginBottom: 6,
            fontFamily: "'Cinzel', serif",
          }}>
            Seu PDF está pronto
          </div>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
            {nomeArquivo}
          </div>
        </div>

        <div style={{
          padding: '14px 18px',
          borderTop: '1.5px solid #e2d2f5',
          background: '#fafafc',
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          {!isNativo && (
            <button
              type="button"
              onClick={handleAbrir}
              disabled={processando}
              style={{
                fontFamily: "'Cinzel', serif",
                background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
                color: '#fff',
                border: '1.5px solid #6b21a8',
                padding: '10px 20px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                cursor: processando ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 42,
              }}
            >
              <MdPictureAsPdf size={15} />
              ABRIR PDF
            </button>
          )}

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
              fontSize: 11,
              fontWeight: 700,
              cursor: processando ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 42,
            }}
          >
            <MdDownload size={16} />
            {processando
              ? 'PROCESSANDO…'
              : isNativo
                ? 'SALVAR / COMPARTILHAR'
                : 'BAIXAR'}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(conteudo, document.body);
}

/* ============================================================
   Estilos reutilizáveis dos modais
   ============================================================ */
const labelEstilo = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#2c163a',
  marginBottom: 6,
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
  background: '#fff',
};

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
export default function PainelAgendamentosEsteticista({
  uidEsteticista,
  onCampoSubstituido,
}) {
  const [aba, setAba] = useState('agenda');
  const [agendamentos, setAgendamentos] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [fichaPreenchida, setFichaPreenchida] = useState(null);

  // ✅ States do módulo financeiro
  const [agendamentoParaRegistrarReceita, setAgendamentoParaRegistrarReceita] = useState(null);
  const [servicos, setServicos] = useState([]);

  const [agendamentoParaConfirmar, setAgendamentoParaConfirmar] = useState(null);
  const [agendamentoParaCancelar, setAgendamentoParaCancelar] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [agendamentoParaEditarSobra, setAgendamentoParaEditarSobra] = useState(null);

  const [pacientesExistentes, setPacientesExistentes] = useState(new Set());
  const [pacientesPorId, setPacientesPorId] = useState({});
  const [substituindo, setSubstituindo] = useState(null);
  const [divergenciasMantidas, setDivergenciasMantidas] = useState(new Set());
  const autoSyncRef = useRef(new Set());

  // ✅ Contador que FORÇA re-render depois de marcar/limpar uma divergência.
  const [divergenciasVersion, setDivergenciasVersion] = useState(0);

  const [agendamentoParaReagendar, setAgendamentoParaReagendar] = useState(null);
  const [pacienteReagendar, setPacienteReagendar] = useState(null);
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);

  const [agendamentoParaExcluir, setAgendamentoParaExcluir] = useState(null);
  const [modalExportAberto, setModalExportAberto] = useState(false);
  const [excluindoAg, setExcluindoAg] = useState(false);

  // ============================================================
  // ✅ Resolve uma divergência de forma PERSISTENTE
  // ============================================================
  const resolverDivergencia = async (agId, campo) => {
    const chave = chaveDivergencia(agId, campo);

    setDivergenciasMantidas((prev) => {
      const novo = new Set(prev);
      novo.add(chave);
      return novo;
    });
    setDivergenciasVersion((v) => v + 1);

    try {
      await updateDoc(doc(db, 'agendamentos', agId), {
        [`divergenciasResolvidas.${campo}`]: true,
        atualizadoEm: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Erro ao persistir divergência:', e);
    }
  };

  // ============================================================
  // Listener 1 — AGENDAMENTOS em tempo real
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;

    const q = query(
      collection(db, 'agendamentos'),
      where('uidEsteticista', '==', uidEsteticista),
      orderBy('data', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgendamentos(lista);
      setCarregando(false);
    }, (err) => {
      console.error('Erro agendamentos:', err);
      setCarregando(false);
    });

    return () => unsub();
  }, [uidEsteticista]);

  // ============================================================
  // ✅ Listener 2 — PACIENTES existentes
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;

    const unsub = onSnapshot(
      collection(db, `usuarios/${uidEsteticista}/pacientes`),
      (snap) => {
        const set = new Set();
        const map = {};
        snap.docs.forEach((d) => {
          set.add(`id:${d.id}`);

          const p = d.data();
          const nomeNorm = normalizarNome(p.nome);
          const docNorm = normalizarDoc(p.documento);
          if (nomeNorm && docNorm) {
            set.add(`nome:${nomeNorm}|${docNorm}`);
          }

          map[d.id] = { id: d.id, ...p };
        });
        setPacientesExistentes(set);
        setPacientesPorId(map);
      },
      (err) => console.warn('Erro listener pacientes:', err)
    );

    return () => unsub();
  }, [uidEsteticista]);

  // ============================================================
  // ✅ Listener 3 — SERVIÇOS (para o modal de receita pegar o preço)
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;

    const q = query(
      collection(db, `usuarios/${uidEsteticista}/servicos`),
      orderBy('ordem', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setServicos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn('Erro listener serviços:', err));

    return () => unsub();
  }, [uidEsteticista]);

  // ============================================================
  // ✅ Helper — encontra paciente por ID ou por nome+doc
  // ============================================================
  const acharPacienteDoAgendamento = (ag) => {
    if (ag.pacienteId && pacientesPorId[ag.pacienteId]) {
      return pacientesPorId[ag.pacienteId];
    }

    const agNome = normalizarNome(ag.nome);
    const agDoc = normalizarDoc(ag.documento);
    if (!agNome || !agDoc) return null;

    return (
      Object.values(pacientesPorId).find((p) => {
        return (
          normalizarNome(p.nome) === agNome &&
          normalizarDoc(p.documento) === agDoc
        );
      }) || null
    );
  };

  // ============================================================
  // ✅ AUTO-SYNC — copia email/tel vazios da ficha a partir do agendamento
  // ============================================================
  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    Object.values(pacientesPorId).forEach((pac) => {
      const pacNomeNorm = normalizarNome(pac.nome);
      const pacDocNorm = normalizarDoc(pac.documento);

      const agsDoPaciente = agendamentos.filter((a) => {
        if (a.pacienteId && a.pacienteId === pac.id) return true;

        if (!a.pacienteId) {
          return (
            normalizarNome(a.nome) === pacNomeNorm &&
            normalizarDoc(a.documento) === pacDocNorm
          );
        }
        return false;
      });

      if (agsDoPaciente.length === 0) return;

      const ag = agsDoPaciente[0];

      const emailFicha = getEmailContatoDoPaciente(pac);
      const emailRealAg = emailContatoDoAgendamento(ag.email);
      const chaveEmail = `${pac.id}|email|${emailRealAg}`;

      if (
        !emailFicha &&
        emailRealAg &&
        !autoSyncRef.current.has(chaveEmail)
      ) {
        autoSyncRef.current.add(chaveEmail);
        updateDoc(
          doc(db, `usuarios/${user.uid}/pacientes`, pac.id),
          {
            emailContato: emailRealAg,
            'anamnese.emailContato': emailRealAg,
            atualizadoEm: new Date().toISOString(),
          }
        ).catch((e) => console.warn('Auto-sync email falhou:', e));
      }

      const telFicha = getTelefoneDoPaciente(pac);
      const telAg = (ag.telefone || '').trim();
      const chaveTel = `${pac.id}|tel|${telAg}`;

      if (!telFicha && telAg && !autoSyncRef.current.has(chaveTel)) {
        autoSyncRef.current.add(chaveTel);
        updateDoc(
          doc(db, `usuarios/${user.uid}/pacientes`, pac.id),
          {
            telefone: telAg,
            'anamnese.telefone': telAg,
            atualizadoEm: new Date().toISOString(),
          }
        ).catch((e) => console.warn('Auto-sync tel falhou:', e));
      }
    });
  }, [pacientesPorId, agendamentos]);

  const solicitarEscolhaServico = (ag) => {
    setAgendamentoParaConfirmar(ag);
  };

  const solicitarCancelamento = (ag) => {
    setAgendamentoParaCancelar(ag);
  };

  const confirmarCancelamento = async () => {
    if (!agendamentoParaCancelar) return;
    const ag = agendamentoParaCancelar;
    setCancelando(true);

    try {
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        status: 'cancelado',
        canceladoPor: 'esteticista',
        atualizadoEm: new Date().toISOString(),
      });

      fetch('/.netlify/functions/sincronizar-slot-publico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamentoId: ag.id }),
      }).catch((e) => console.warn('Falha ao sincronizar slot público:', e));

      if (ag.pacienteId) {
        fetch('/.netlify/functions/notificar-paciente-agendamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pacienteId: ag.pacienteId,
            agendamento: ag,
            tipoEvento: 'cancelado',
          }),
        }).catch((e) => console.warn('Falha ao notificar paciente (cancelado):', e));
      }

      setAgendamentoParaCancelar(null);
    } catch (e) {
      alert('Erro ao cancelar: ' + e.message);
    } finally {
      setCancelando(false);
    }
  };

  // ============================================================
  // ✅ Cria ficha automaticamente ao concluir consulta
  // ============================================================
  const criarFichaAutomatica = async (ag) => {
    const user = getAuth().currentUser;
    if (!user) return;

    if (ag.pacienteId) {
      try {
        const snap = await getDoc(
          doc(db, `usuarios/${user.uid}/pacientes`, String(ag.pacienteId))
        );
        if (snap.exists()) return;
      } catch {}
    }

    const nome = ag.nome || 'Paciente';
    const partes = nome.split(/\s+/);
    const pNome = (partes[0] || 'usuario').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const sNome = (partes[partes.length - 1] || 'paciente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const emailFicticio = `${pNome}.${sNome}@sistema.local`;
    const docLimpo = (ag.documento || '').replace(/\D/g, '');
    const senha = (docLimpo.length >= 6 ? docLimpo.slice(-6) : '123456').padEnd(6, '0');

    let pacienteUid = '';
    try {
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, emailFicticio, senha);
        pacienteUid = cred.user.uid;
        await signOut(secondaryAuth);
      } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
          try {
            const cred = await signInWithEmailAndPassword(secondaryAuth, emailFicticio, senha);
            pacienteUid = cred.user.uid;
            await signOut(secondaryAuth);
          } catch {
            pacienteUid = gerarUidDeterministico(`${emailFicticio}|${docLimpo}`);
          }
        } else {
          pacienteUid = gerarUidDeterministico(`${emailFicticio}|${docLimpo}`);
        }
      }
    } catch {
      pacienteUid = gerarUidDeterministico(`${emailFicticio}|${docLimpo}`);
    }

    const agora = new Date();
    const dataHora = agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const emailContatoReal = emailContatoDoAgendamento(ag.email);

    const novaFicha = {
      id: pacienteUid,
      nome,
      documento: ag.documento || '',
      telefone: ag.telefone || '',
      email: emailFicticio,
      emailAcesso: emailFicticio,
      emailContato: emailContatoReal,
      criadoPorUid: user.uid,
      dataCriacao: dataHora,
      dataUltimaEdicao: dataHora,
      anamnese: {
        nome,
        telefone: ag.telefone || '',
        emailContato: emailContatoReal,
        numeroDocumento: ag.documento || '',
        dataRealizacao: new Date().toLocaleDateString('pt-BR'),
        observacoes: `Ficha criada automaticamente ao concluir o agendamento.\nServiço: ${ag.servicoNome || 'Não informado'}${ag.observacoes ? `\nObservações do paciente: ${ag.observacoes}` : ''}`,
      },
      evolucoes: [{
        id: Date.now(),
        dataCriacao: dataHora,
        textoLivre: `Atendimento realizado em ${formatarDataBR(ag.data)} às ${ag.horaInicio}.\nServiço: ${ag.servicoNome || 'Não informado'}${ag.observacoes ? `\nObservações: ${ag.observacoes}` : ''}`,
      }],
      agendamentoOrigemId: ag.id,

      ...(ag.consentimentoLGPD?.aceito
        ? { consentimentoLGPD: ag.consentimentoLGPD }
        : {}),
    };

    await setDoc(
      doc(db, `usuarios/${user.uid}/pacientes`, pacienteUid),
      limparUndefined(novaFicha)
    );
    await registrarLinkPaciente(pacienteUid, user.uid);

    await setDoc(
      doc(db, 'mapeamento_emails', emailFicticio),
      {
        profissionalUid: user.uid,
        pacienteId: pacienteUid,
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );

    await updateDoc(doc(db, 'agendamentos', ag.id), { pacienteId: pacienteUid });
  };

  // ============================================================
  // ✅ CONCLUIR ATENDIMENTO — abre o modal de receita
  // ============================================================
  const concluirManual = (ag) => {
    setAgendamentoParaRegistrarReceita(ag);
  };

  // ============================================================
  // ✅ CONFIRMAR RECEITA — atualiza agendamento + cria lançamento
  // ============================================================
  const handleConfirmarReceita = async (dadosReceita) => {
    const ag = agendamentoParaRegistrarReceita;
    if (!ag) return;

    try {
      const user = getAuth().currentUser;
      if (!user) throw new Error('Sessão expirada');

      const agora = new Date();
      const horaRealFim = agora.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const dataHoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      // 1) Atualiza o agendamento
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        status: 'concluido',
        concluidoPor: 'esteticista',
        concluidoEm: agora.toISOString(),
        horaRealFim,
        atualizadoEm: agora.toISOString(),
        valorCobrado: dadosReceita.valor,
      });

      // 2) Cria o lançamento financeiro
      await addDoc(collection(db, `usuarios/${user.uid}/financeiro`), {
        tipo: 'receita',
        valor: dadosReceita.valor,
        valorOriginal: dadosReceita.valorOriginal,
        descontoPercent: dadosReceita.descontoPercent,
        acrescimoPercent: dadosReceita.acrescimoPercent,
        data: dataHoje,
        categoria: 'Serviço',
        descricao: ag.servicoNome || 'Serviço',
        formaPagamento: dadosReceita.formaPagamento,
        observacao: dadosReceita.observacao,

        // Vínculos
        pacienteId: ag.pacienteId || null,
        pacienteNome: ag.nome || null,
        agendamentoId: ag.id,
        servicoId: ag.servicoId || null,
        servicoNome: ag.servicoNome || null,

        criadoEm: agora.toISOString(),
        criadoPor: user.uid,
      });

      // 3) Sincroniza slot público
      fetch('/.netlify/functions/sincronizar-slot-publico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamentoId: ag.id }),
      }).catch(() => {});

      setAgendamentoParaRegistrarReceita(null);
    } catch (e) {
      console.error('Erro ao concluir + registrar receita:', e);
      alert('Erro ao concluir: ' + e.message);
      throw e; // re-lança pro modal não fechar
    }
  };

  const marcarFaltou = async (ag) => {
    try {
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        status: 'faltou',
        faltouPor: 'paciente',
        faltouEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });

      fetch('/.netlify/functions/sincronizar-slot-publico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamentoId: ag.id }),
      }).catch((e) => console.warn('Falha ao sincronizar slot público:', e));
    } catch (e) {
      alert('Erro ao marcar falta: ' + e.message);
    }
  };

  const abrirReagendamento = async (ag) => {
    if (ag.pacienteId) {
      setBuscandoPaciente(true);
      try {
        const snap = await getDoc(
          doc(db, `usuarios/${uidEsteticista}/pacientes`, String(ag.pacienteId))
        );

        if (snap.exists()) {
          setPacienteReagendar({ id: snap.id, ...snap.data() });
          setAgendamentoParaReagendar(ag);
          setBuscandoPaciente(false);
          return;
        }
      } catch (e) {
        console.error('Erro ao buscar paciente:', e);
      } finally {
        setBuscandoPaciente(false);
      }
    }

    setPacienteReagendar({
      id: ag.pacienteId || null,
      nome: ag.nome,
      documento: ag.documento,
      telefone: ag.telefone,
      email: ag.email,
      emailAcesso: ag.email,
      consentimentoLGPD: ag.consentimentoLGPD,
    });
    setAgendamentoParaReagendar(ag);
  };

  const fecharReagendamento = () => {
    setPacienteReagendar(null);
    setAgendamentoParaReagendar(null);
  };

  const solicitarExclusaoAgendamento = (ag) => {
    setAgendamentoParaExcluir(ag);
  };

  const confirmarExclusaoAgendamento = async () => {
    if (!agendamentoParaExcluir) return;
    setExcluindoAg(true);
    try {
      await updateDoc(doc(db, 'agendamentos', agendamentoParaExcluir.id), {
        ocultoParaEsteticista: true,
        ocultadoEsteticistaEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });

      try {
        await fetch('/.netlify/functions/sincronizar-slot-publico', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agendamentoId: agendamentoParaExcluir.id }),
        });
      } catch (e) {
        console.warn('Falha ao sincronizar slot público:', e);
      }

      setAgendamentoParaExcluir(null);
    } catch (e) {
      console.error('Erro ao remover da visualização:', e);
      alert('Erro ao remover. Tente novamente.');
    } finally {
      setExcluindoAg(false);
    }
  };

  // ============================================================
  // ✅ Atalhos de teclado do modal de exclusão: Enter / Esc
  // ============================================================
  useEffect(() => {
    if (!agendamentoParaExcluir || excluindoAg) return;

    const handler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmarExclusaoAgendamento();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setAgendamentoParaExcluir(null);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentoParaExcluir, excluindoAg]);

  const contagens = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() - DIAS_HISTORICO);

    const cont = {
      pendente: 0,
      confirmado: 0,
      cancelado: 0,
      concluido: 0,
      faltou: 0,
    };
    for (const a of agendamentos) {
      if (!(a.status in cont)) continue;

      if (a.ocultoParaEsteticista) continue;

      if (
        a.status === 'cancelado' ||
        a.status === 'concluido' ||
        a.status === 'faltou'
      ) {
        const d = new Date((a.data || '') + 'T12:00:00');
        if (d < limite) continue;
      }
      cont[a.status]++;
    }
    return cont;
  }, [agendamentos]);

  const filtrados = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() - DIAS_HISTORICO);

    const termo = busca.toLowerCase().trim();

    return agendamentos.filter((a) => {
      if (a.ocultoParaEsteticista) return false;

      if (a.status !== filtroStatus) return false;

      if (
        a.status === 'cancelado' ||
        a.status === 'concluido' ||
        a.status === 'faltou'
      ) {
        const d = new Date((a.data || '') + 'T12:00:00');
        if (d < limite) return false;
      }

      if (!termo) return true;
      const nome = (a.nome || '').toLowerCase();
      const doc_ = (a.documento || a.cpf || '').toLowerCase();
      const dataBR = formatarDataBR(a.data);
      const email = (a.email || '').toLowerCase();

      return (
        nome.includes(termo) ||
        doc_.includes(termo) ||
        dataBR.includes(termo) ||
        email.includes(termo)
      );
    });
  }, [agendamentos, filtroStatus, busca]);

  const pacienteJaExiste = (ag) => {
    if (ag.pacienteId && pacientesExistentes.has(`id:${ag.pacienteId}`)) {
      return true;
    }

    const nomeNorm = normalizarNome(ag.nome);
    const docNorm = normalizarDoc(ag.documento);
    if (!nomeNorm || !docNorm) return false;

    return pacientesExistentes.has(`nome:${nomeNorm}|${docNorm}`);
  };


  const substituirCampo = async (pacId, campo, valor) => {
    const user = getAuth().currentUser;
    if (!user) return;

    const chave = `${pacId}|${campo}`;
    setSubstituindo(chave);

    try {
      await updateDoc(
        doc(db, `usuarios/${user.uid}/pacientes`, pacId),
        {
          [campo]: valor,
          [`anamnese.${campo}`]: valor,
          atualizadoEm: new Date().toISOString(),
        }
      );

      onCampoSubstituido?.(pacId, campo, valor);
    } catch (e) {
      console.error('Erro ao substituir campo:', e);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSubstituindo(null);
    }
  };
  // ============================================================
// ⚖️ LGPD — Verifica se o paciente está arquivado
// ============================================================
const pacienteEstaArquivado = (ag) => {
  if (!ag.pacienteId) return false;
  const pac = pacientesPorId[ag.pacienteId];
  return Boolean(pac?.anonimizadoEm);
};

// ============================================================
// ⚖️ LGPD — Abre ficha do paciente arquivado pra reativar
// ============================================================
const abrirFichaParaReativar = async (ag) => {
  if (!ag.pacienteId) return;

  const pac = pacientesPorId[ag.pacienteId];
  if (!pac) return;

  // ✅ Fonte: agendamento (o paciente arquivado está sem contato)
  //    Igual ao que o agendamento público coletou.
  const emailReal = emailContatoDoAgendamento(ag.email);

  setFichaPreenchida({
    ...(pac.anamnese || {}),
    _reativandoPacienteId: ag.pacienteId,
    // Pré-preenche com o que temos
    nome: ag.nome || pac.nome || '',
    numeroDocumento: ag.documento || pac.documento || '',
    telefone: ag.telefone || pac.telefone || '',
    emailContato: emailReal || pac.emailContato || '',
    endereco: pac.endereco || '',
  });
};

  // ============================================================
  // ✅ DIVERGÊNCIAS — cada campo resolvido de forma INDEPENDENTE
  // ============================================================
  const divergenciasDoAgendamento = (ag) => {
    // eslint-disable-next-line no-unused-vars
    const _v = divergenciasVersion;

    const pac = acharPacienteDoAgendamento(ag);
    if (!pac) return [];

    const lista = [];
    const resolvidas = ag.divergenciasResolvidas || {};

    // ─── E-MAIL ───────────────────────────────────────────
    const emailResolvido =
      resolvidas.emailContato === true ||
      divergenciasMantidas.has(chaveDivergencia(ag.id, 'emailContato'));

    if (!emailResolvido) {
      const emailFichaAtual = getEmailContatoDoPaciente(pac);
      const emailFicha = emailFichaAtual.toLowerCase();
      const emailRealAg = emailContatoDoAgendamento(ag.email);

      if (emailFicha && emailRealAg && emailFicha !== emailRealAg) {
        lista.push({
          campo: 'emailContato',
          label: 'E-mail',
          atual: emailFichaAtual,
          novo: emailRealAg,
          pacId: pac.id,
        });
      }
    }

    // ─── TELEFONE (independente do e-mail) ────────────────
    const telResolvido =
      resolvidas.telefone === true ||
      divergenciasMantidas.has(chaveDivergencia(ag.id, 'telefone'));

    if (!telResolvido) {
      const telFicha = getTelefoneDoPaciente(pac);
      const telAg = (ag.telefone || '').trim();

      if (telFicha && telAg && telFicha !== telAg) {
        lista.push({
          campo: 'telefone',
          label: 'Telefone',
          atual: telFicha,
          novo: telAg,
          pacId: pac.id,
        });
      }
    }

    return lista;
  };

  const abrirFichaPreenchida = (ag) => {
    setFichaPreenchida({
      _agendamentoOrigemId: ag.id,
      _agendamentoStatusOriginal: ag.status,
      nome: ag.nome || '',
      telefone: ag.telefone || '',
      emailContato: emailContatoDoAgendamento(ag.email),
      numeroDocumento: ag.documento || '',
      dataNascimento: '',
      endereco: '',
      dataRealizacao: new Date().toLocaleDateString('pt-BR'),
      observacoes: '',
    });
  };

const handleSalvarFichaDoAgendamento = async (dadosAnamnese) => {
  const user = getAuth().currentUser;
  if (!user) return;

  // ============================================================
  // ✅ SANITIZAÇÃO DEFENSIVA
  // ------------------------------------------------------------
  // A esteta está autenticada, mas reforçamos a sanitização aqui
  // pra garantir que nada estranho (tags, handlers inline, chars
  // de controle) chegue ao Firestore — mesmo se o form for
  // manipulado via DevTools.
  //
  // ⚠️ Só sanitizamos TEXTO LIVRE (nome, observacoes, endereco).
  //    Documento/telefone/email usam formatos específicos e NÃO
  //    devem passar por sanitizarTexto (quebraria).
  //    O `sanitizarFichaAnamnese` já trata esses campos com as
  //    funções corretas (sanitizarDocumento, sanitizarTelefone,
  //    sanitizarEmail).
  // ============================================================
  const dadosLimpos = sanitizarFichaAnamnese(dadosAnamnese);
  dadosAnamnese = {
    ...dadosLimpos,
    nome: sanitizarTexto(dadosLimpos.nome, { maxLength: 100 }),
    observacoes: sanitizarTexto(dadosLimpos.observacoes, {
      maxLength: 5000,
      permitirQuebraLinha: true,
    }),
    endereco: sanitizarTexto(dadosLimpos.endereco, { maxLength: 200 }),
  };

  const nomeOriginal = (dadosAnamnese.nome || '').trim();
  const partes = nomeOriginal.split(/\s+/);
  const pNome = (partes[0] || 'usuario')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sNome = (partes[partes.length - 1] || 'paciente')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const emailFicticio = `${pNome}.${sNome}@sistema.local`;
  const docLimpo = (dadosAnamnese.numeroDocumento || '').replace(/\D/g, '');
  const senha = (docLimpo.length >= 6 ? docLimpo.slice(-6) : '123456').padEnd(6, '0');

  const nomeNorm = normalizarNome(nomeOriginal);
  const docNorm = normalizarDoc(dadosAnamnese.numeroDocumento);
  const existente = Object.values(pacientesPorId).find((p) =>
    normalizarNome(p.nome || p.anamnese?.nome) === nomeNorm &&
    normalizarDoc(p.documento || p.anamnese?.numeroDocumento) === docNorm
  );

  let pacienteUid = existente?.id || '';

  if (!pacienteUid) {
    try {
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, emailFicticio, senha);
        pacienteUid = cred.user.uid;
        await signOut(secondaryAuth);
      } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
          try {
            const cred = await signInWithEmailAndPassword(secondaryAuth, emailFicticio, senha);
            pacienteUid = cred.user.uid;
            await signOut(secondaryAuth);
          } catch {
            // cai no fallback
          }
        }
      }
    } catch { /* cai no fallback */ }

    if (!pacienteUid) {
      pacienteUid = gerarUidDeterministico(`${emailFicticio}|${docLimpo}`);
    }
  }

  const agora = new Date();
  const dataHora =
    agora.toLocaleDateString('pt-BR') + ' às ' +
    agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const novoPaciente = {
    ...(existente || {}),
    id: pacienteUid,
    nome: dadosAnamnese.nome,
    documento: dadosAnamnese.numeroDocumento || '',
    telefone: dadosAnamnese.telefone || '',
    email: emailFicticio,
    emailAcesso: emailFicticio,
    emailContato: dadosAnamnese.emailContato || '',
    criadoPorUid: user.uid,
    dataCriacao: existente?.dataCriacao || dataHora,
    dataUltimaEdicao: dataHora,
    anamnese: dadosAnamnese,
    evolucoes: existente?.evolucoes || [],
    agendamentoOrigemId: fichaPreenchida?._agendamentoOrigemId || existente?.agendamentoOrigemId || null,
  };

  await setDoc(
    doc(db, `usuarios/${user.uid}/pacientes`, pacienteUid),
    limparUndefined(novoPaciente),
    { merge: true }
  );
  await registrarLinkPaciente(pacienteUid, user.uid);

  await setDoc(
    doc(db, 'mapeamento_emails', emailFicticio),
    {
      profissionalUid: user.uid,
      pacienteId: pacienteUid,
      atualizadoEm: new Date().toISOString(),
    },
    { merge: true }
  );

  // ============================================================
  // ⚖️ LGPD — Se está REATIVANDO um paciente arquivado
  // ------------------------------------------------------------
  // Usa o helper COMPLETO: recria Auth + mapeamento + links.
  // Fonte dos dados: o que a esteta preencheu/editou na ficha
  // (dadosAnamnese), que já veio pré-preenchido com ag.nome,
  // ag.documento, ag.telefone, ag.email pelo abrirFichaParaReativar.
  // ============================================================
  if (fichaPreenchida?._reativandoPacienteId) {
    // ✅ Usa o email que está no FORM (dadosAnamnese),
    //    não o pré-preenchido (fichaPreenchida) — assim se a
    //    esteta editar, o novo valor prevalece.
    let emailReal = '';
    if (dadosAnamnese?.emailContato) {
      emailReal = String(dadosAnamnese.emailContato).toLowerCase().trim();
      if (emailReal.endsWith('@sistema.local')) emailReal = '';
    }

    await reativarPacienteCompleto({
      pacienteId: fichaPreenchida._reativandoPacienteId,
      uidEsteticista: user.uid,
      nome: dadosAnamnese.nome,
      documento: dadosAnamnese.numeroDocumento,
      telefone: dadosAnamnese.telefone || null,
      emailContato: emailReal || null,
      endereco: dadosAnamnese.endereco || null,
    });

    setFichaPreenchida(null);
    return;
  }

  if (fichaPreenchida?._agendamentoOrigemId) {
    // ⚠️ Só vincula o pacienteId ao agendamento.
    //    NÃO muda o status — concluir é ação manual (botão "Concluir").
    const patch = {
      pacienteId: pacienteUid,
      atualizadoEm: new Date().toISOString(),
    };

    await updateDoc(doc(db, 'agendamentos', fichaPreenchida._agendamentoOrigemId), patch);

    try {
      await fetch('/.netlify/functions/sincronizar-slot-publico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamentoId: fichaPreenchida._agendamentoOrigemId }),
      });
    } catch (e) {
      console.warn('Falha ao sincronizar slot público:', e);
    }
  }
  setFichaPreenchida(null);
};

  if (fichaPreenchida) {
    const isMobileView = window.innerWidth <= 768;
    const Comp = isMobileView ? FichaMobile : FichaDesktop;
    return (
      <Comp
        mode="create"
        fichaSelecionada={fichaPreenchida}
        onSave={handleSalvarFichaDoAgendamento}
        onVoltar={() => setFichaPreenchida(null)}
        onSalvarSucesso={() => setFichaPreenchida(null)}
      />
    );
  }

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Abas */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setAba('agenda')} style={abaBtn(aba === 'agenda')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MdCalendarMonth size={14} /> Agendamentos
          </span>
        </button>
        <button type="button" onClick={() => setAba('config')} style={abaBtn(aba === 'config')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MdSettings size={14} /> Configurar horários
          </span>
        </button>
        <button type="button" onClick={() => setAba('servicos')} style={abaBtn(aba === 'servicos')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MdAssignment size={14} /> Meus Serviços
          </span>
        </button>
      </div>

      {aba === 'servicos' && (
        <GerenciarServicos uidEsteticista={uidEsteticista} />
      )}

      {aba === 'config' && <ConfiguradorAgenda uidEsteticista={uidEsteticista} />}

      {aba === 'agenda' && (
        <>
          {/* Busca */}
          <div style={{
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '8px 16px',
            marginTop: '-4px',
            marginBottom: '20px',
            boxShadow: '0 4px 16px rgba(44, 22, 58, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            boxSizing: 'border-box',
          }}>
            <MdSearch
              size={18}
              color="#C8A24A"
              style={{ flexShrink: 0 }}
              aria-hidden="true"
            />

            <label
              htmlFor="busca-agendamentos"
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              Buscar agendamentos por nome, documento ou data
            </label>

            <input
              id="busca-agendamentos"
              name="busca_agendamentos"
              type="text"
              placeholder="Buscar por nome, documento ou data (DD/MM/AAAA)…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoComplete="off"
              aria-label="Buscar agendamentos por nome, documento ou data"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 12,
                color: '#2c163a',
                fontFamily: "'Montserrat', sans-serif",
                minWidth: 0,
              }}
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                aria-label="Limpar busca"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: 0,
                  fontWeight: 600,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <MdClear size={14} /> Limpar
              </button>
            )}
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { key: 'pendente',   label: 'Pendente'   },
              { key: 'confirmado', label: 'Confirmado' },
              { key: 'concluido',  label: 'Concluído'  },
              { key: 'faltou',     label: 'Faltou'     },
              { key: 'cancelado',  label: 'Cancelado'  },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFiltroStatus(key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 16,
                  border: '1.5px solid #C8A24A',
                  background: filtroStatus === key ? '#C8A24A' : 'transparent',
                  color: filtroStatus === key ? '#fff' : '#C8A24A',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', serif",
                }}
              >
                {label} ({contagens[key] || 0})
              </button>
            ))}
          </div>

          {(filtroStatus === 'cancelado' || filtroStatus === 'concluido' || filtroStatus === 'faltou') && (
            <div style={{
              fontSize: 10.5,
              color: '#888',
              marginBottom: 10,
              fontStyle: 'italic',
            }}>
              Exibindo apenas os últimos {DIAS_HISTORICO} dias.
            </div>
          )}

          {/* ✅ Botão Exportar PDF */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setModalExportAberto(true)}
              style={{
                fontFamily: "'Cinzel', serif",
                background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
                color: '#fff',
                border: '1.5px solid #6b21a8',
                padding: '8px 16px',
                borderRadius: 18,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 3px 10px rgba(126, 34, 206, 0.3)',
              }}
            >
              <MdPictureAsPdf size={15} />
              EXPORTAR PDF
            </button>
          </div>

          {/* Lista */}
          {carregando ? (
            <p style={{ color: '#666' }}>Carregando…</p>
          ) : filtrados.length === 0 ? (
            <div style={vazio}>
              {busca
                ? `Nenhum resultado para "${busca}".`
                : `Nenhum agendamento ${labelDe(filtroStatus)}.`}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtrados.map((ag) => (
                <div key={ag.id} style={cardAg}>
                  <h4 style={{
                    fontFamily: "'Cinzel', serif",
                    margin: '0 0 8px 0',
                    color: '#2c163a',
                    fontSize: 15,
                    lineHeight: 1.3,
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word',
                  }}>
                    {ag.nome}
                  </h4>

                  <div style={{ fontSize: 12, color: '#555', lineHeight: 1.9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <MdCalendarMonth size={13} color="#C8A24A" style={{ flexShrink: 0 }} />
                      <span>
                        {formatarDataBR(ag.data)} às {ag.horaInicio}
                        {ag.horaFim ? `–${ag.horaFim}` : ''}
                        {ag.duracaoMin ? ` (${ag.duracaoMin}min)` : ''}
                      </span>
                      {ag.servicoNome && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#7e22ce',
                          background: '#faf5ff',
                          border: '1px solid #d8b4fe',
                          borderRadius: 10,
                          padding: '1px 8px',
                          marginLeft: 2,
                        }}>
                          <MdEvent size={11} /> {ag.servicoNome}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MdPhone size={13} color="#C8A24A" style={{ flexShrink: 0 }} />
                      <span>{formatarTelefoneInternacional(ag.telefone)}</span>
                      {ag.telefone && (
                        <BotaoCopiar valor={ag.telefone} rotulo="telefone" title="Copiar telefone" />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MdBadge size={13} color="#C8A24A" style={{ flexShrink: 0 }} />
                      <span>{ag.documento || ag.cpf || '—'}</span>
                      {(ag.documento || ag.cpf) && (
                        <BotaoCopiar valor={ag.documento || ag.cpf} rotulo="documento" title="Copiar documento" />
                      )}
                    </div>

                    {(() => {
                      const pac = acharPacienteDoAgendamento(ag);
                      const emailContato =
                        getEmailContatoDoPaciente(pac) ||
                        emailContatoDoAgendamento(ag.email);

                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <MdEmail size={13} color="#C8A24A" style={{ flexShrink: 0 }} />
                          <span style={{ wordBreak: 'break-all' }}>
                            {emailContato || '—'}
                          </span>
                          {emailContato && (
                            <BotaoCopiar valor={emailContato} rotulo="e-mail" title="Copiar e-mail" />
                          )}
                        </div>
                      );
                    })()}

                    {ag.observacoes && (
                      <div style={{
                        marginTop: 6,
                        fontStyle: 'italic',
                        color: '#7e22ce',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 6,
                      }}>
                        <MdChatBubbleOutline size={13} style={{ marginTop: 3, flexShrink: 0 }} />
                        {ag.observacoes}
                      </div>
                    )}
                  </div>

                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
  {ag.aguardandoConsentimento && (
    <span style={badgeAguardando}>...</span>
  )}
  {ag.consentimentoLGPD?.aceito ? (
    <span style={badgeOk}>...</span>
  ) : (
    <span style={badgeWarn}>...</span>
  )}
  {ag.status === 'faltou' && (
    <span style={badgeFaltou}>...</span>
  )}
  
  {/* ⚖️ LGPD — Badge de cliente arquivada */}
  {pacienteEstaArquivado(ag) && (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      background: '#f5f5f5',
      color: '#666',
      border: '1px solid #ddd',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 10,
      fontWeight: 700,
    }}>
      📂 Cliente na aba Arquivadas
    </span>
  )}
</div>

                  {/* ✅ Horário real de conclusão */}
                  {ag.status === 'concluido' && ag.horaRealFim && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      borderRadius: 10,
                      fontSize: 11,
                      color: '#166534',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}>
                      <MdCheckCircle size={14} color="#16a34a" />
                      <span>
                        Atendimento concluído às <strong>{ag.horaRealFim}</strong>
                      </span>
                      {ag.horaInicio && (
                        <span style={{ color: '#4b7a5a', fontWeight: 500 }}>
                          (marcado para {ag.horaInicio})
                        </span>
                      )}
                    </div>
                  )}

                  {/* ✅ ESTADO DA SOBRA */}
                {/* ✅ ESTADO DA SOBRA */}
{(ag.status === 'confirmado' || ag.status === 'concluido') && ag.horaFim && (
  (() => {
    const temSobra = Array.isArray(ag.liberacoesExtras) && ag.liberacoesExtras.length > 0;
    const sobra = temSobra ? ag.liberacoesExtras[0] : null;

    // ============================================================
    // ⚖️ Verifica se a sobra está POLUÍDA
    // ------------------------------------------------------------
    // Se tiver qualquer agendamento confirmado/pendente dentro
    // do intervalo da sobra, o botão BARRAR/LIBERAR some.
    // ============================================================
    const sobraPoluida = (() => {
      if (!sobra) return false;

      // Só valida se tem sobra liberada
      const sobraInicioMin = (() => {
        const [h, m] = sobra.inicio.split(':').map(Number);
        return h * 60 + m;
      })();
      const sobraFimMin = (() => {
        const [h, m] = sobra.fim.split(':').map(Number);
        return h * 60 + m;
      })();

      // Pega agendamentos do mesmo dia, exceto o próprio
      const outrosDoDia = agendamentos.filter((outro) => {
        if (outro.id === ag.id) return false;
        if (outro.data !== ag.data) return false;
        if (outro.status !== 'confirmado' && outro.status !== 'pendente') return false;
        return true;
      });

      // Verifica se algum colide com a sobra
      return outrosDoDia.some((outro) => {
        const [h, m] = (outro.horaInicio || '00:00').split(':').map(Number);
        const outroInicioMin = h * 60 + m;
        const outroFimMin = outro.horaFim
          ? (() => {
              const [hh, mm] = outro.horaFim.split(':').map(Number);
              return hh * 60 + mm;
            })()
          : outroInicioMin + (outro.duracaoMin || 60);

        // Colisão por sobreposição
        return sobraInicioMin < outroFimMin && outroInicioMin < sobraFimMin;
      });
    })();

    return (
      <div style={{
        marginTop: 8,
        padding: '8px 12px',
        background: temSobra ? '#f0fdf4' : '#fafafa',
        border: `1px solid ${temSobra ? '#86efac' : '#e0e0e0'}`,
        borderRadius: 10,
        fontSize: 11,
        color: temSobra ? '#166534' : '#666',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        {temSobra ? (
          <MdCheckCircle size={14} color="#16a34a" />
        ) : (
          <MdLock size={14} color="#666" />
        )}

        <span style={{ flex: 1, minWidth: 0 }}>
          {temSobra ? (
            <>
              <strong>Sobra liberada:</strong> {sobra.inicio} → {sobra.fim}
              {sobra.duracaoMin ? ` (${sobra.duracaoMin} min)` : ''}
            </>
          ) : (
            <>
              <strong>Sobra bloqueada</strong>
              {' '}— o restante do bloco não aparece na agenda
            </>
          )}
        </span>

        {/* ⚖️ Só mostra o botão se a sobra estiver LIMPA */}
        {!sobraPoluida && (
          <button
            type="button"
            onClick={() => setAgendamentoParaEditarSobra(ag)}
            style={{
              fontFamily: "'Cinzel', serif",
              background: temSobra ? '#fff8e1' : '#f0fdf4',
              color: temSobra ? '#92400e' : '#166534',
              border: `1px solid ${temSobra ? '#fcd34d' : '#86efac'}`,
              padding: '4px 10px',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {temSobra ? 'BARRAR' : 'LIBERAR'}
          </button>
        )}
      </div>
    );
  })()
)}
                  {/* ✅ Painel de divergências */}
                  {(() => {
                    const divs = divergenciasDoAgendamento(ag);
                    if (divs.length === 0) return null;

                    return (
                      <div style={{
                        marginTop: 12,
                        background: 'linear-gradient(135deg, #fff8e1 0%, #fef3c7 100%)',
                        border: '1.5px solid #fcd34d',
                        borderRadius: 12,
                        padding: '12px 14px',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 10,
                        }}>
                          <MdWarning size={16} color="#92400e" />
                          <span style={{
                            fontFamily: "'Cinzel', serif",
                            color: '#92400e',
                            fontSize: 12,
                            fontWeight: 700,
                          }}>
                            Dados diferentes do cadastro do paciente
                          </span>
                        </div>

                        {divs.map((d) => {
                          const chave = `${d.pacId}|${d.campo}`;
                          const carregandoEste = substituindo === chave;

                          return (
                            <div
                              key={d.campo}
                              style={{
                                background: '#fff',
                                border: '1px solid #fcd34d',
                                borderRadius: 8,
                                padding: '10px 12px',
                                marginBottom: 8,
                              }}
                            >
                              <div style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#2c163a',
                                marginBottom: 6,
                              }}>
                                {d.label}
                              </div>

                              <div style={{ fontSize: 11, color: '#666', lineHeight: 1.6, marginBottom: 8 }}>
                                <div>
                                  <strong style={{ color: '#888' }}>Cadastro:</strong>{' '}
                                  <span style={{ wordBreak: 'break-all' }}>{d.atual}</span>
                                </div>
                                <div>
                                  <strong style={{ color: '#7e22ce' }}>Agendamento:</strong>{' '}
                                  <span style={{ wordBreak: 'break-all', color: '#7e22ce', fontWeight: 600 }}>
                                    {d.novo}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  type="button"
                                  disabled={carregandoEste}
                                  onClick={() => {
                                    resolverDivergencia(ag.id, d.campo);
                                  }}
                                  style={{
                                    flex: 1,
                                    background: '#f5f5f5',
                                    color: '#555',
                                    border: '1.5px solid #ddd',
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: carregandoEste ? 'not-allowed' : 'pointer',
                                    fontFamily: "'Cinzel', serif",
                                    opacity: carregandoEste ? 0.6 : 1,
                                    minHeight: 40,
                                  }}
                                >
                                  MANTER
                                </button>

                                <button
                                  type="button"
                                  disabled={carregandoEste}
                                  onClick={async () => {
                                    await substituirCampo(d.pacId, d.campo, d.novo);
                                    await resolverDivergencia(ag.id, d.campo);
                                  }}
                                  style={{
                                    flex: 1,
                                    background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                                    color: '#fff',
                                    border: '1.5px solid #9c7826',
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: carregandoEste ? 'wait' : 'pointer',
                                    fontFamily: "'Cinzel', serif",
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 4,
                                    boxShadow: '0 3px 10px rgba(200, 162, 74, 0.3)',
                                    opacity: carregandoEste ? 0.7 : 1,
                                    minHeight: 40,
                                  }}
                                >
                                  {carregandoEste ? 'SALVANDO…' : 'SUBSTITUIR'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* ✅ BOTÕES */}
                  <div style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px dashed #f0e6fa',
                  }}>
                  {/* ⚖️ LGPD — Se paciente está arquivado, mostra botão Reativar */}
{pacienteEstaArquivado(ag) ? (
  <button
    type="button"
  onClick={() => abrirFichaParaReativar(ag)}
    style={{
      ...btnFicha,
      flex: '1 1 140px',
      background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
    }}
    title="Reativar cadastro deste paciente (volta pra aba Ativos)"
  >
    <MdRefresh size={14} /> Reativar paciente
  </button>
) : (
  <>
    {(ag.status === 'confirmado' || ag.status === 'concluido') && !pacienteJaExiste(ag) && (
      <button
        type="button"
        onClick={() => abrirFichaPreenchida(ag)}
        style={{ ...btnFicha, flex: '1 1 140px' }}
        title="Abrir ficha de anamnese pré-preenchida com os dados deste agendamento"
      >
        <MdAssignment size={14} /> Ficha de Anamnese
      </button>
    )}
  </>
)}

                    {ag.status === 'pendente' && (
                      <>
                        <button
                          type="button"
                          onClick={() => solicitarEscolhaServico(ag)}
                          style={{ ...btnOk, flex: '1 1 140px' }}
                        >
                          <MdCheckCircle size={14} /> Escolher serviço
                        </button>
                        <button
                          type="button"
                          onClick={() => solicitarCancelamento(ag)}
                          style={{ ...btnDanger, flex: '1 1 100px' }}
                        >
                          <MdCancel size={14} /> Cancelar
                        </button>
                      </>
                    )}

                    {ag.status === 'confirmado' && (
                      <>
                        <button
                          type="button"
                          onClick={() => concluirManual(ag)}
                          style={{ ...btnOk, flex: '1 1 100px' }}
                          title="Paciente veio e foi atendido"
                        >
                          <MdCheckCircle size={14} /> Concluir
                        </button>
                        <button
                          type="button"
                          onClick={() => marcarFaltou(ag)}
                          style={{ ...btnFaltou, flex: '1 1 100px' }}
                          title="Paciente não compareceu"
                        >
                          <MdPersonOff size={14} /> Faltou
                        </button>
                        <button
                          type="button"
                          onClick={() => solicitarCancelamento(ag)}
                          style={{ ...btnDanger, flex: '1 1 100px' }}
                        >
                          <MdCancel size={14} /> Cancelar
                        </button>
                      </>
                    )}

                    {ag.status === 'faltou' && (
                      <>
                        <button
                          type="button"
                          onClick={() => abrirReagendamento(ag)}
                          disabled={buscandoPaciente}
                          style={{
                            ...btnReagendar,
                            flex: '1 1 140px',
                            opacity: buscandoPaciente ? 0.6 : 1,
                            cursor: buscandoPaciente ? 'wait' : 'pointer',
                          }}
                          title="Criar novo agendamento para este paciente"
                        >
                          <MdRefresh size={14} />
                          {buscandoPaciente ? 'Carregando…' : 'Reagendar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => solicitarCancelamento(ag)}
                          style={{ ...btnDanger, flex: '1 1 100px' }}
                        >
                          <MdCancel size={14} /> Cancelar
                        </button>
                      </>
                    )}

                    {/* ✅ Reagendar quando CANCELADO */}
                    {ag.status === 'cancelado' && (
                      <button
                        type="button"
                        onClick={() => abrirReagendamento(ag)}
                        disabled={buscandoPaciente}
                        style={{
                          ...btnReagendar,
                          flex: '1 1 140px',
                          opacity: buscandoPaciente ? 0.6 : 1,
                          cursor: buscandoPaciente ? 'wait' : 'pointer',
                        }}
                        title="Criar novo agendamento para este paciente"
                      >
                        <MdRefresh size={14} />
                        {buscandoPaciente ? 'Carregando…' : 'Reagendar'}
                      </button>
                    )}

                    {(ag.status === 'cancelado' ||
                      ag.status === 'faltou' ||
                      ag.status === 'concluido' ||
                      ag.status === 'reagendado') && (
                      <button
                        type="button"
                        onClick={() => solicitarExclusaoAgendamento(ag)}
                        title="Esconde da visualização — o registro continua no histórico"
                        style={{
                          flex: '1 1 100%',
                          background: '#f5f5f5',
                          color: '#666',
                          border: '1.5px solid #ddd',
                          padding: '8px 12px',
                          borderRadius: 16,
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: "'Cinzel', serif",
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          minHeight: 36,
                          marginTop: 4,
                        }}
                      >
                        <MdDelete size={13} /> REMOVER DA VISUALIZAÇÃO
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal de confirmação de cancelamento */}
      {agendamentoParaCancelar && (
        <ModalConfirmarCancelamento
          agendamento={agendamentoParaCancelar}
          carregando={cancelando}
          onConfirmar={confirmarCancelamento}
          onFechar={() => {
            if (!cancelando) setAgendamentoParaCancelar(null);
          }}
        />
      )}

      {/* ✅ Modal de editar sobra */}
      {agendamentoParaEditarSobra && (
        <ModalEditarSobra
          agendamento={agendamentoParaEditarSobra}
          uidEsteticista={uidEsteticista}
          onFechar={() => setAgendamentoParaEditarSobra(null)}
          onSucesso={() => setAgendamentoParaEditarSobra(null)}
        />
      )}

      {/* Modal de escolher serviço */}
      {agendamentoParaConfirmar && (
        <ModalEscolherServico
          agendamento={agendamentoParaConfirmar}
          uidEsteticista={uidEsteticista}
          onFechar={() => setAgendamentoParaConfirmar(null)}
          onConfirmado={() => setAgendamentoParaConfirmar(null)}
        />
      )}

      {/* ✅ Modal de registrar receita ao concluir */}
      {agendamentoParaRegistrarReceita && (
        <ModalRegistrarReceita
          agendamento={{
            ...agendamentoParaRegistrarReceita,
            precoServico: (() => {
              const serv = servicos?.find(
                (s) => s.id === agendamentoParaRegistrarReceita.servicoId
              );
              return serv?.preco || 0;
            })(),
          }}
          onFechar={() => setAgendamentoParaRegistrarReceita(null)}
          onConfirmar={handleConfirmarReceita}
        />
      )}

      {/* ✅ Modal de confirmação de exclusão de agendamento */}
      {agendamentoParaExcluir && (
        <div
          onClick={excluindoAg ? undefined : () => setAgendamentoParaExcluir(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(44, 22, 58, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2147483647,
            padding: 20,
            boxSizing: 'border-box',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 20,
              padding: '28px 24px 24px 24px',
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
              border: '1.5px solid #e2d2f5',
              fontFamily: "'Montserrat', sans-serif",
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                margin: '0 auto 16px auto',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ffebee 0%, #fde8e8 100%)',
                border: '2px solid #ef9a9a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 18px rgba(198, 40, 40, 0.18)',
              }}
            >
              <MdDelete size={30} color="#c62828" />
            </div>

            <h3
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#c62828',
                fontSize: 17,
                fontWeight: 700,
                margin: '0 0 10px 0',
              }}
            >
              Excluir da lista?
            </h3>

            <p
              style={{
                fontSize: 13,
                color: '#2c163a',
                margin: '0 0 6px 0',
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              {agendamentoParaExcluir.nome}
            </p>

            <p
              style={{
                fontSize: 12,
                color: '#555',
                margin: '0 0 18px 0',
                lineHeight: 1.6,
              }}
            >
              {formatarDataBR(agendamentoParaExcluir.data)} às {agendamentoParaExcluir.horaInicio}
              <br />
              <span style={{ fontSize: 11, color: '#888', display: 'block', marginTop: 6 }}>
                Esta ação não pode ser desfeita.
              </span>
            </p>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setAgendamentoParaExcluir(null)}
                disabled={excluindoAg}
                style={{
                  flex: 1,
                  background: '#f0f0f0',
                  color: '#333',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: 22,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: excluindoAg ? 'not-allowed' : 'pointer',
                  fontFamily: "'Cinzel', serif",
                  opacity: excluindoAg ? 0.6 : 1,
                  minHeight: 44,
                }}
              >
                CANCELAR
              </button>

              <button
                type="button"
                onClick={confirmarExclusaoAgendamento}
                disabled={excluindoAg}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: 22,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: excluindoAg ? 'wait' : 'pointer',
                  fontFamily: "'Cinzel', serif",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 4px 14px rgba(198, 40, 40, 0.35)',
                  opacity: excluindoAg ? 0.7 : 1,
                  minHeight: 44,
                }}
              >
                {excluindoAg ? 'EXCLUINDO…' : (
                  <>
                    <MdDelete size={14} /> EXCLUIR
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de reagendamento */}
      {pacienteReagendar && agendamentoParaReagendar && (
        <ModalAgendarParaPaciente
          paciente={pacienteReagendar}
          uidEsteticista={uidEsteticista}
          origem="esteticista"
          tipoNotificacao="remarcado"
          onFechar={fecharReagendamento}
          onSucesso={async (novoAg) => {
            try {
              await updateDoc(doc(db, 'agendamentos', novoAg.id), {
                reagendamentoDe: agendamentoParaReagendar.id,
                reagendamentoDeData: agendamentoParaReagendar.data,
                reagendamentoDeHora: agendamentoParaReagendar.horaInicio,
              });

              await updateDoc(
                doc(db, 'agendamentos', agendamentoParaReagendar.id),
                {
                  status: 'reagendado',
                  reagendadoPara: novoAg.id,
                  reagendadoEm: new Date().toISOString(),
                  atualizadoEm: new Date().toISOString(),
                }
              );
            } catch (e) {
              console.warn('Falha ao marcar reagendamento:', e);
            }
            fecharReagendamento();
          }}
        />
      )}

      {/* ✅ Modal de exportação PDF */}
      {modalExportAberto && (
        <ModalExportarAgendamentos
          agendamentos={agendamentos}
          filtroStatus={filtroStatus}
          onFechar={() => setModalExportAberto(false)}
        />
      )}
    </div>
  );
}

/* ============================================================
   Helpers
   ============================================================ */
function formatarDataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function labelDe(status) {
  return {
    pendente: 'pendente',
    confirmado: 'confirmado',
    cancelado: 'cancelado',
    concluido: 'concluído',
    faltou: 'com falta',
  }[status] || status;
}

/* ============================================================
   Estilos
   ============================================================ */
const abaBtn = (ativo) => ({
  padding: '10px 18px',
  borderRadius: 20,
  border: 'none',
  background: ativo ? 'linear-gradient(135deg, #C8A24A, #e2be64)' : '#f0e8fa',
  color: ativo ? '#fff' : '#2c163a',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "'Cinzel', serif",
  cursor: 'pointer',
});

const cardAg = {
  background: '#fff',
  border: '1.5px solid #e2d2f5',
  borderRadius: 12,
  padding: 16,
  overflow: 'hidden',
};

const vazio = {
  textAlign: 'center',
  padding: 40,
  color: '#888',
  background: '#fff',
  borderRadius: 12,
  border: '1px dashed #ddd',
};

const btnOk = {
  background: '#16a34a',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  minHeight: 40,
};

const btnFaltou = {
  background: '#f97316',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  minHeight: 40,
};

const btnReagendar = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  minHeight: 40,
};

const btnDanger = {
  background: '#c62828',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  minHeight: 40,
};

const btnFicha = {
  background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
  color: '#fff',
  border: '1.5px solid #9c7826',
  padding: '10px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  minHeight: 40,
  boxShadow: '0 3px 10px rgba(200, 162, 74, 0.3)',
};

const badgeOk = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#f0fdf4',
  color: '#16a34a',
  border: '1px solid #86efac',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
};

const badgeWarn = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#fff8e1',
  color: '#92400e',
  border: '1px solid #fcd34d',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
};

const badgeAguardando = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#fff8e1',
  color: '#92400e',
  border: '1px solid #fcd34d',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
};

const badgeFaltou = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#fff7ed',
  color: '#c2410c',
  border: '1px solid #fdba74',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
};/* ============================================================
   ✅ Estilos usados pelo RelatorioAgendamentosPDF (tabela do PDF)
   ============================================================ */
const thEstilo = {
  background: '#7e22ce',
  color: '#ffffff',
  padding: '8px 6px',
  textAlign: 'left',
  border: '1px solid #7e22ce',
  fontWeight: 700,
  fontSize: 10.5,
};

const tdEstilo = {
  padding: '6px',
  border: '1px solid #e2d2f5',
  fontSize: 10.5,
};