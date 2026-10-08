// src/components/PainelPaciente.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { inscreverPush } from './push-notifications';
import AvisoNotificacoes from './AvisoNotificacoes';
import GaleriaPaciente from './GaleriaPaciente';
import { isNativo } from './push-notifications-native';
import ModalConsentimentoPrimeiroAcesso from './ModalConsentimentoPrimeiroAcesso';
import {
  MdSearch, MdPhotoLibrary, MdArrowBack, MdWarning, MdCalendarMonth,
  MdFolderOpen, MdInfoOutline, MdHourglassEmpty, MdCancel,
  MdLightbulbOutline, MdDelete, MdCheckCircle, MdErrorOutline, MdClose,
} from 'react-icons/md';
import ModalExclusaoConta from './ModalExclusaoConta';
import {
  DownloadCloud,
  X,
  Images,
  Share,
  MoreVertical,
  Monitor,
  Smartphone,
  Bell,
  AlertTriangle,
} from 'lucide-react';
import FichaDesktop from './FichaDesktop';
import FichaMobile from './FichaMobile';
import FichaEvoDesktop from './FichaEvoDesktop';
import FichaEvoMobile from './FichaEvoMobile';
import ModalAgendarParaPaciente from './agendamento/ModalAgendarParaPaciente';

/* ============================================================
   MODAL AMIGÁVEL DE DOWNLOAD DO APK (Android)
   — "Baixar App Agora" em destaque (largura total).
   — "Agora não" discreto como link embaixo.
   ============================================================ */
function ModalBaixarAPK({ onFechar, onConfirmar }) {
  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999999,
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '28px 24px 20px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
          border: '1.5px solid #C8A24A',
          fontFamily: "'Montserrat', sans-serif",
          textAlign: 'center',
        }}
      >
        {/* Ícone amigável */}
        <div
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 16px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
            border: '2px solid #d8b4fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(126, 34, 206, 0.15)',
          }}
        >
          <DownloadCloud size={34} color="#7e22ce" />
        </div>

        <h3
          style={{
            fontFamily: "'Cinzel', serif",
            color: '#2c163a',
            fontSize: 17,
            fontWeight: 700,
            margin: '0 0 8px',
            letterSpacing: '0.4px',
          }}
        >
          Instalar o App Samira
        </h3>

        <p
          style={{
            fontSize: 12.5,
            color: '#666',
            margin: '0 0 16px',
            lineHeight: 1.6,
          }}
        >
          Acesso rápido ao seu prontuário, lembretes e notificações direto no
          celular. É só seguir os passos:
        </p>

        {/* Passo a passo numerado */}
        <div
          style={{
            background: 'rgba(250, 245, 255, 0.9)',
            border: '1.5px dashed #d8b4fe',
            borderRadius: 12,
            padding: '14px 16px',
            textAlign: 'left',
            marginBottom: 20,
          }}
        >
          {[
            'Toque em "Baixar App" no final',
            'Abra o arquivo .apk baixado',
            'Permita "Instalar de fontes desconhecidas"',
            'Confirme a instalação',
          ].map((passo, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: i < 3 ? 8 : 0,
                fontSize: 12,
                color: '#2c163a',
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#a855f7',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {i + 1}
              </span>
              <span>{passo}</span>
            </div>
          ))}
        </div>

        {/* BOTÃO PRINCIPAL EM DESTAQUE (largura total) */}
        <button
          type="button"
          onClick={onConfirmar}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
            color: '#fff',
            border: '1.5px solid #9c7826',
            padding: '16px 20px',
            borderRadius: 26,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.8px',
            cursor: 'pointer',
            fontFamily: "'Cinzel', serif",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            boxShadow: '0 6px 20px rgba(200, 162, 74, 0.45)',
            transition: 'all 0.2s ease',
            marginBottom: 12,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 10px 26px rgba(200, 162, 74, 0.55)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(200, 162, 74, 0.45)';
          }}
        >
          <DownloadCloud size={18} />
          BAIXAR APP AGORA
        </button>

        {/* LINK DISCRETO — "Agora não" */}
        <button
          type="button"
          onClick={onFechar}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#999',
            fontSize: 11.5,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: "'Montserrat', sans-serif",
            padding: '8px 12px',
            textDecoration: 'underline',
            letterSpacing: '0.2px',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#666'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#999'; }}
        >
          Agora não
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   MODAL DE AVISO / CONFIRMAÇÃO — estética do sistema
   Substitui alert() e window.confirm() nativos
   ============================================================ */
function ModalAviso({
  tipo = 'info',       // 'info' | 'sucesso' | 'aviso' | 'erro'
  titulo,
  mensagem,
  textoConfirmar = 'OK',
  textoCancelar = 'Cancelar',
  mostrarCancelar = false,
  onConfirmar,
  onFechar,
  carregando = false,
}) {
  const config = {
    info:     { cor: '#7e22ce', bg: '#faf5ff', borda: '#d8b4fe', Icone: MdInfoOutline },
    sucesso:  { cor: '#166534', bg: '#f0fdf4', borda: '#86efac', Icone: MdCheckCircle },
    aviso:    { cor: '#92400e', bg: '#fff8e1', borda: '#fcd34d', Icone: MdWarning },
    erro:     { cor: '#991b1b', bg: '#fef2f2', borda: '#fca5a5', Icone: MdErrorOutline },
  }[tipo] || { cor: '#7e22ce', bg: '#faf5ff', borda: '#d8b4fe', Icone: MdInfoOutline };

  const { cor, bg, borda, Icone } = config;

  const handleFechar = () => {
    if (carregando) return;
    onFechar?.();
  };

  const handleConfirmar = async () => {
    if (carregando) return;
    if (onConfirmar) {
      await onConfirmar();
    } else {
      onFechar?.();
    }
  };

  return (
    <div
      onClick={carregando ? undefined : handleFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999999,
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
            boxShadow: `0 4px 14px ${cor}22`,
          }}
        >
          <Icone size={30} color={cor} />
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
              margin: '0 0 18px 0',
              lineHeight: 1.6,
              whiteSpace: 'pre-line',
            }}
          >
            {mensagem}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 6, justifyContent: 'center' }}>
          {mostrarCancelar && (
            <button
              type="button"
              onClick={handleFechar}
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
              }}
            >
              {textoCancelar.toUpperCase()}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={carregando}
            style={{
              flex: 1,
              background:
                tipo === 'erro' || tipo === 'aviso'
                  ? 'linear-gradient(135deg, #c62828 0%, #e53935 100%)'
                  : 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
              color: '#fff',
              border:
                tipo === 'erro' || tipo === 'aviso'
                  ? '1.5px solid #9c1c1c'
                  : '1.5px solid #9c7826',
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
              boxShadow:
                tipo === 'erro' || tipo === 'aviso'
                  ? '0 4px 14px rgba(198, 40, 40, 0.35)'
                  : '0 4px 14px rgba(200, 162, 74, 0.35)',
              opacity: carregando ? 0.7 : 1,
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
                    animation: 'spinAviso 0.8s linear infinite',
                  }}
                />
                AGUARDE…
              </>
            ) : (
              textoConfirmar.toUpperCase()
            )}
          </button>
        </div>

        <style>{`
          @keyframes spinAviso { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}

/* ============================================================
   MODAL DE INSTALAÇÃO (PWA) — embutido no mesmo arquivo
   ============================================================ */
function ModalInstalacao({ onClose }) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isDesktop = !isIOS && !isAndroid;

  const isIOSChrome = isIOS && /CriOS/i.test(ua);
  const isIOSFirefox = isIOS && /FxiOS/i.test(ua);
  const isIOSEdge = isIOS && /EdgiOS/i.test(ua);
  const isIOSNaoSafari = isIOSChrome || isIOSFirefox || isIOSEdge;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '24px',
          maxWidth: '420px',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(44, 22, 58, 0.35)',
          fontFamily: "'Montserrat', sans-serif",
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={20} color="#2c163a" />
        </button>

        <h2
          style={{
            fontFamily: "'Cinzel', serif",
            color: '#2c163a',
            fontSize: '18px',
            margin: '0 0 6px 0',
            paddingRight: '30px',
          }}
        >
          Instalar o Web App
        </h2>

        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 20px 0' }}>
          Siga os passos abaixo de acordo com o seu aparelho.
        </p>

        {isIOSNaoSafari && (
          <div style={{ ...blocoEstilo, border: '1.5px solid #ffb74d', background: '#fff3e0' }}>
            <div style={headerBloco}>
              <AlertTriangle size={16} color="#e65100" />
              <span style={{ ...tituloBloco, color: '#e65100' }}>
                Use o Safari para instalar
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#5d4037', margin: '0 0 8px 0', lineHeight: 1.5 }}>
              No iPhone/iPad, <strong>apenas o Safari</strong> consegue instalar Web Apps. O
              Chrome, Firefox e Edge no iOS <strong>não suportam</strong> essa função.
            </p>
            <p style={{ fontSize: '12px', color: '#5d4037', margin: 0, lineHeight: 1.5 }}>
              1. Copie o link deste site.
              <br />
              2. Abra no <strong>Safari</strong>.
              <br />
              3. Siga as instruções abaixo.
            </p>
          </div>
        )}

        {isIOS && !isIOSNaoSafari && (
          <div style={blocoEstilo}>
            <div style={headerBloco}>
              <Smartphone size={16} color="#C8A24A" />
              <span style={tituloBloco}>iPhone / iPad (Safari)</span>
            </div>
            <ol style={listaEstilo}>
              <li>
                Toque no botão <strong>Compartilhar</strong>{' '}
                <Share size={14} style={{ verticalAlign: 'middle' }} /> na barra inferior.
              </li>
              <li>
                Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.
              </li>
              <li>
                Confirme tocando em <strong>"Adicionar"</strong>.
              </li>
              <li>O ícone aparecerá na sua Tela de Início como um app normal.</li>
            </ol>
            <p style={{ fontSize: '11px', color: '#666', margin: '10px 0 0 0', lineHeight: 1.5 }}>
              <MdLightbulbOutline
                size={13}
                color="#C8A24A"
                style={{ verticalAlign: 'middle', marginRight: 4 }}
              />
              <strong>Dica:</strong> depois de instalar, abra o app pela Tela de Início (não
              pelo Safari) para receber notificações.
            </p>
          </div>
        )}

        {isAndroid && (
          <div style={blocoEstilo}>
            <div style={headerBloco}>
              <Smartphone size={16} color="#C8A24A" />
              <span style={tituloBloco}>Android (Chrome)</span>
            </div>
            <ol style={listaEstilo}>
              <li>
                Toque no menu <strong>⋮</strong>{' '}
                <MoreVertical size={14} style={{ verticalAlign: 'middle' }} /> no canto superior
                direito.
              </li>
              <li>
                Toque em <strong>"Instalar aplicativo"</strong> ou{' '}
                <strong>"Adicionar à tela inicial"</strong>.
              </li>
              <li>
                Confirme tocando em <strong>"Instalar"</strong>.
              </li>
            </ol>
            <p style={{ fontSize: '11px', color: '#666', margin: '10px 0 0 0', lineHeight: 1.5 }}>
              <MdLightbulbOutline
                size={13}
                color="#C8A24A"
                style={{ verticalAlign: 'middle', marginRight: 4 }}
              />
              Prefere o app nativo? Baixe o <strong>APK da Samira</strong> — tem notificações
              mais confiáveis.
            </p>
          </div>
        )}

        {isDesktop && (
          <div style={blocoEstilo}>
            <div style={headerBloco}>
              <Monitor size={16} color="#C8A24A" />
              <span style={tituloBloco}>Computador (Chrome / Edge)</span>
            </div>
            <ol style={listaEstilo}>
              <li>
                Olhe para a <strong>barra de endereços</strong> no topo do navegador.
              </li>
              <li>
                Clique no ícone de <strong>instalação</strong> (parece um monitor com uma seta ↓
                ou um ⊕).
              </li>
              <li>
                Se não aparecer, clique no menu <strong>⋮</strong> e procure por{' '}
                <strong>"Instalar Samira Ferreira"</strong>.
              </li>
              <li>
                Confirme. O app abrirá como uma janela própria e o atalho ficará na área de
                trabalho.
              </li>
            </ol>
            <p style={{ fontSize: '11px', color: '#666', margin: '10px 0 0 0', lineHeight: 1.5 }}>
              <MdLightbulbOutline
                size={13}
                color="#C8A24A"
                style={{ verticalAlign: 'middle', marginRight: 4 }}
              />
              <strong>Não aparece o ícone?</strong> Acesse em outro navegador (Edge, Brave) ou
              limpe os dados do site nas configurações.
            </p>
          </div>
        )}

        <div style={{ ...blocoEstilo, marginTop: '16px' }}>
          <div style={headerBloco}>
            <Bell size={16} color="#C8A24A" />
            <span style={tituloBloco}>Permitir notificações</span>
          </div>
          <p style={{ fontSize: '11px', color: '#555', margin: '0 0 8px 0', lineHeight: 1.5 }}>
            Ao abrir o app instalado, o sistema perguntará se você permite{' '}
            <strong>notificações</strong>. Toque em <strong>"Permitir"</strong>.
          </p>
          <p style={{ fontSize: '11px', color: '#555', margin: 0, lineHeight: 1.5 }}>
            Se você negou sem querer, vá em:{' '}
            <strong>Configurações → Apps → Samira Estética → Notificações</strong> e ative.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: '20px',
            width: '100%',
            fontFamily: "'Cinzel', serif",
            background: '#2c163a',
            color: '#C8A24A',
            border: '1.2px solid #C8A24A',
            padding: '12px',
            borderRadius: '16px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Entendi
        </button>
      </div>
    </div>
  );
}

const blocoEstilo = {
  background: 'rgba(215, 206, 224, 0.25)',
  border: '1px solid rgba(226, 210, 245, 0.7)',
  borderRadius: '14px',
  padding: '14px',
};

const headerBloco = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '10px',
};

const tituloBloco = {
  fontFamily: "'Cinzel', serif",
  fontSize: '12px',
  fontWeight: 700,
  color: '#2c163a',
};

const listaEstilo = {
  margin: 0,
  paddingLeft: '20px',
  fontSize: '12px',
  color: '#444',
  lineHeight: 1.7,
};

function formatarDataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/* ============================================================
   MODAL DE CONFIRMAÇÃO DE REMOÇÃO DE AGENDAMENTO
   ============================================================ */
function ModalRemoverAgendamento({ agendamento, onFechar, onConfirmar }) {
  const [removendo, setRemovendo] = useState(false);

  const isConcluido = agendamento?.status === 'concluido';

  const handleConfirmar = async () => {
    if (removendo) return;
    setRemovendo(true);
    try {
      await onConfirmar();
    } finally {
      setRemovendo(false);
    }
  };

  return (
    <div
      onClick={removendo ? undefined : onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999999,
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
            background: 'linear-gradient(135deg, #ffebee 0%, #fde8e8 100%)',
            border: '2px solid #ef9a9a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(198, 40, 40, 0.15)',
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
            letterSpacing: '0.4px',
          }}
        >
          Remover da lista
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
          {formatarDataBR(agendamento?.data)} às {agendamento?.horaInicio}
        </p>

        <p
          style={{
            fontSize: 12,
            color: '#666',
            margin: '0 0 18px 0',
            lineHeight: 1.6,
          }}
        >
          {isConcluido
            ? 'Este atendimento já foi concluído. Deseja removê-lo do seu histórico?'
            : 'Deseja remover este agendamento cancelado da sua lista?'}
          <br />
          <span style={{ fontSize: 11, color: '#888', display: 'block', marginTop: 6 }}>
            Esta ação não pode ser desfeita.
          </span>
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={onFechar}
            disabled={removendo}
            style={{
              flex: 1,
              background: '#f0f0f0',
              color: '#333',
              border: 'none',
              padding: '12px 16px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: removendo ? 'not-allowed' : 'pointer',
              fontFamily: "'Cinzel', serif",
              opacity: removendo ? 0.6 : 1,
            }}
          >
            CANCELAR
          </button>

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={removendo}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
              color: '#fff',
              border: 'none',
              padding: '12px 16px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: removendo ? 'wait' : 'pointer',
              fontFamily: "'Cinzel', serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(198, 40, 40, 0.35)',
              opacity: removendo ? 0.7 : 1,
            }}
          >
            {removendo ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: 13,
                    height: 13,
                    border: '2px solid #fff',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spinRemover 0.8s linear infinite',
                  }}
                />
                REMOVENDO…
              </>
            ) : (
              <>
                <MdDelete size={14} />
                REMOVER
              </>
            )}
          </button>
        </div>

        <style>{`
          @keyframes spinRemover {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

/* ============================================================
   PAINEL DO PACIENTE
   ============================================================ */
export default function PainelPaciente({
  pacienteData,
  onLogout,
  abrirAnamneseInicial = false,
}) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const [telaAtual, setTelaAtual] = useState(() => {
    try {
      const salva =
        localStorage.getItem('pp_telaAtual') ||
        sessionStorage.getItem('pp_telaAtual');
      const validas = ['detalhe_pasta', 'galeria', 'ver_anamnese'];
      return validas.includes(salva) ? salva : 'detalhe_pasta';
    } catch {
      return 'detalhe_pasta';
    }
  });

  const [meusAgendamentos, setMeusAgendamentos] = useState([]);

  useEffect(() => {
    try {
      sessionStorage.setItem('pp_telaAtual', telaAtual);
      localStorage.setItem('pp_telaAtual', telaAtual);
    } catch {}
  }, [telaAtual]);

  const [evolucaoSelecionada, setEvolucaoSelecionada] = useState(null);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [appInstalado, setAppInstalado] = useState(false);

  const [mostrarModalInstalacao, setMostrarModalInstalacao] = useState(false);
  const [mostrarModalAPK, setMostrarModalAPK] = useState(false);
  const [mostrarConsentimento, setMostrarConsentimento] = useState(false);
  const [consentimentoRecusado, setConsentimentoRecusado] = useState(false);
  const [mostrarExclusaoConta, setMostrarExclusaoConta] = useState(false);

  // ✅ Modal de remoção de agendamento
  const [agendamentoParaRemover, setAgendamentoParaRemover] = useState(null);

  // ✅ NOVO: controla o modal de agendar pelo próprio painel do paciente
  const [mostrarModalAgendar, setMostrarModalAgendar] = useState(false);

  // ✅ NOVO: modal genérico de avisos / confirmações (substitui alert/confirm)
  const [aviso, setAviso] = useState(null);

  const isAndroid =
    typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  const irParaTela = useCallback(
    (novaTela) => {
      if (novaTela === telaAtual) return;

      const hashAtual = window.location.hash || '';
      const urlCompleta = window.location.pathname + hashAtual;

      window.history.pushState(
        { ...(window.history.state || {}), painelPacienteTela: novaTela },
        '',
        urlCompleta
      );
      setTelaAtual(novaTela);
    },
    [telaAtual]
  );

  useEffect(() => {
    if (!pacienteData) return;

    const consentimento = pacienteData.consentimentoLGPD;
    const aceito = consentimento?.aceito === true;
    const versaoOk = consentimento?.versaoTermo === '1.0';

    if (aceito && versaoOk) {
      setMostrarConsentimento(false);
      return;
    }

    setMostrarConsentimento(true);
  }, [pacienteData]);

  useEffect(() => {
    const telaInicial = abrirAnamneseInicial ? 'ver_anamnese' : 'detalhe_pasta';

    const hashAtual = window.location.hash || '';
    const urlCompleta = window.location.pathname + hashAtual;

    window.history.replaceState(
      { ...(window.history.state || {}), painelPacienteTela: telaInicial },
      '',
      urlCompleta
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pacienteData?.id) return;
    const q = query(
      collection(db, 'agendamentos'),
      where('pacienteId', '==', String(pacienteData.id))
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => !a.ocultoParaPaciente) 
          .sort((a, b) => {
            const ka = `${a.data} ${a.horaInicio}`;
            const kb = `${b.data} ${b.horaInicio}`;
            return kb.localeCompare(ka);
          });
        setMeusAgendamentos(lista);
      },
      (e) => console.warn('Erro listener agendamentos:', e)
    );
    return () => unsub();
  }, [pacienteData?.id]);

  useEffect(() => {
    const onPop = (e) => {
      const st = e.state;
      if (st?.painelPacienteTela) {
        setTelaAtual(st.painelPacienteTela);
      } else {
        setTelaAtual('detalhe_pasta');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!pacienteData?.id) return;

    (async () => {
      try {
        const { inscreverPush } = await import('./push-notifications');

        if (isNativo()) {
          await inscreverPush(pacienteData.id);
          return;
        }

        if (typeof Notification === 'undefined') return;
        if (Notification.permission !== 'granted') return;
        await inscreverPush(pacienteData.id);
      } catch (e) {
        console.warn('Falha ao re-registrar push:', e);
      }
    })();
  }, [pacienteData?.id]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!pacienteData?.id) return;

      import('./push-notifications').then(({ inscreverPush }) => {
        if (isNativo()) {
          inscreverPush(pacienteData.id).catch(() => {});
        } else {
          if (
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted'
          ) {
            inscreverPush(pacienteData.id).catch(() => {});
          }
        }
      });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pacienteData?.id]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);

    if (isNativo()) {
      setAppInstalado(true);
    }

    if (window.__deferredPrompt) {
      setDeferredPrompt(window.__deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      window.__deferredPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setAppInstalado(true);
      setDeferredPrompt(null);
      window.__deferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone
    ) {
      setAppInstalado(true);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const APK_URL = 'https://samira-anamnese.netlify.app/downloads/samira-estetica.apk';

  const handleInstalarApp = async () => {
    // ✅ ANDROID → abre o modal amigável (não mais o "aviso" vermelho)
    if (isAndroid) {
      setMostrarModalAPK(true);
      return;
    }

    // iOS → modal de instruções Safari
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) {
      setMostrarModalInstalacao(true);
      return;
    }

    // Desktop → prompt nativo ou modal
    const prompt =
      deferredPrompt ||
      (typeof window !== 'undefined' ? window.__deferredPrompt : null);

    if (prompt && typeof prompt.prompt === 'function') {
      try {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;

        setDeferredPrompt(null);
        window.__deferredPrompt = null;

        if (outcome === 'accepted') {
          setAppInstalado(true);
          return;
        }
        setMostrarModalInstalacao(true);
        return;
      } catch (e) {
        console.warn('beforeinstallprompt falhou, abrindo modal:', e);
      }
    }

    setMostrarModalInstalacao(true);
  };

  // ✅ Executa o download do APK (chamado pelo modal amigável)
  const baixarAPK = () => {
    setMostrarModalAPK(false);
    const link = document.createElement('a');
    link.href = APK_URL;
    link.download = 'samira-ferreira.apk';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cancelarAgendamento = (ag) => {
    setAviso({
      tipo: 'aviso',
      titulo: 'Cancelar agendamento?',
      mensagem: `Deseja cancelar o agendamento de ${formatarDataBR(ag.data)} às ${ag.horaInicio}?`,
      textoConfirmar: 'Sim, cancelar',
      textoCancelar: 'Voltar',
      mostrarCancelar: true,
      onConfirmar: async () => {
        try {
          await updateDoc(doc(db, 'agendamentos', ag.id), {
            status: 'cancelado',
            canceladoPor: 'paciente',
            atualizadoEm: new Date().toISOString(),
          });
          setAviso(null);
          setAviso({
            tipo: 'sucesso',
            titulo: 'Agendamento cancelado',
            mensagem: 'Seu agendamento foi cancelado com sucesso.',
            textoConfirmar: 'OK',
            onConfirmar: () => setAviso(null),
          });
        } catch (e) {
          setAviso(null);
          setAviso({
            tipo: 'erro',
            titulo: 'Erro ao cancelar',
            mensagem: e?.message || 'Não foi possível cancelar. Tente novamente.',
            textoConfirmar: 'OK',
            onConfirmar: () => setAviso(null),
          });
        }
      },
    });
  };

  // ✅ Abre o modal de confirmação de remoção
  const abrirModalRemoverAgendamento = (ag) => {
    setAgendamentoParaRemover(ag);
  };

  // ✅ Confirma e apaga o documento
const confirmarRemocaoAgendamento = async () => {
  if (!agendamentoParaRemover) return;
  try {
    // ✅ NÃO deleta — apenas marca como oculto pro paciente.
    //    Assim o agendamento continua aparecendo no painel da esteticista.
    await updateDoc(doc(db, 'agendamentos', agendamentoParaRemover.id), {
      ocultoParaPaciente: true,
      ocultadoPacienteEm: new Date().toISOString(),
    });
    setAgendamentoParaRemover(null);
  } catch (e) {
    setAgendamentoParaRemover(null);
    setAviso({
      tipo: 'erro',
      titulo: 'Erro ao remover',
      mensagem: e?.message || 'Não foi possível remover. Tente novamente.',
      textoConfirmar: 'OK',
      onConfirmar: () => setAviso(null),
    });
  }
};

  const podeRemover = (ag) =>
    ag.status === 'cancelado' || ag.status === 'concluido';

  if (consentimentoRecusado) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '100vh',
          backgroundColor: '#d7cee0',
          fontFamily: "'Montserrat', sans-serif",
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.98)',
            borderRadius: '20px',
            border: '1.5px solid #C8A24A',
            padding: '36px 28px',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 15px 40px rgba(44, 22, 58, 0.25)',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              margin: '0 auto 16px auto',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
              border: '2px solid #ffb74d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MdWarning size={34} color="#e65100" />
          </div>

          <h2
            style={{
              fontFamily: "'Cinzel', serif",
              color: '#2c163a',
              fontSize: '18px',
              margin: '0 0 12px 0',
            }}
          >
            Consentimento necessário
          </h2>

          <p
            style={{
              fontSize: '13px',
              color: '#555',
              lineHeight: 1.6,
              margin: '0 0 24px 0',
            }}
          >
            Sem autorizar o tratamento dos seus dados, <strong>não podemos</strong> exibir seu
            prontuário, suas fotos ou enviar lembretes.
          </p>

          <p
            style={{
              fontSize: '12px',
              color: '#888',
              fontStyle: 'italic',
              marginBottom: '20px',
            }}
          >
            Se mudar de ideia, faça login novamente e aceite o termo.
          </p>

          <button
            type="button"
            onClick={onLogout}
            style={{
              fontFamily: "'Cinzel', serif",
              background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
              color: '#fff',
              border: '1.5px solid #9c7826',
              padding: '13px 26px',
              borderRadius: '24px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1px',
              cursor: 'pointer',
              width: '100%',
              boxShadow: '0 4px 14px rgba(200, 162, 74, 0.35)',
            }}
          >
            VOLTAR AO LOGIN
          </button>
        </div>
      </div>
    );
  }

  if (!pacienteData) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '100vh',
          backgroundColor: '#d7cee0',
          fontFamily: "'Montserrat', sans-serif",
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '16px',
            border: '1px solid #e2d2f5',
            padding: '30px',
            textAlign: 'center',
            maxWidth: '450px',
            width: '100%',
            boxShadow: '0 8px 24px rgba(44, 22, 58, 0.1)',
          }}
        >
          <h2
            style={{
              fontFamily: "'Cinzel', serif",
              color: '#2c163a',
              fontSize: '18px',
              margin: '0 0 12px 0',
            }}
          >
            Nenhum dado encontrado
          </h2>
          <p style={{ color: '#666', fontSize: '13px', marginBottom: '24px' }}>
            Não foi possível carregar as informações do seu prontuário.
          </p>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              style={{
                fontFamily: "'Cinzel', serif",
                background: '#2c163a',
                color: '#C8A24A',
                border: '1.2px solid #C8A24A',
                padding: '12px 24px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(44, 22, 58, 0.2)',
                transition: 'all 0.2s ease',
              }}
            >
              Sair / Voltar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#d7cee0',
        fontFamily: "'Montserrat', sans-serif",
        paddingBottom: '30px',
        position: 'relative',
        overflowX: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'hidden',
        }}
      >
        <img
          src="/imagens/logo-telainicial.jpeg"
          alt="Marca d'água"
          style={{
            width: '100%',
            maxWidth: '450px',
            height: 'auto',
            opacity: 0.12,
            objectFit: 'contain',
          }}
        />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600&display=swap');

        .painel-btn-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(200, 162, 74, 0.35) !important;
        }
        .painel-btn-sec-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(44, 22, 58, 0.25) !important;
          background: #381d48 !important;
        }
        .painel-sair-hover:hover {
          background: rgba(231, 76, 60, 0.1) !important;
        }
      `}</style>

      <AvisoNotificacoes pacienteId={pacienteData?.id} appInstalado={appInstalado} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', boxSizing: 'border-box' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '24px 20px 14px 20px',
            gap: '12px',
            borderBottom: '1px solid rgba(226, 210, 245, 0.8)',
            marginBottom: '20px',
            background: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(5px)',
            boxShadow: '0 2px 10px rgba(44, 22, 58, 0.03)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <h1
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#2c163a',
                fontSize: '20px',
                margin: 0,
                textShadow: '0 1px 2px rgba(255,255,255,0.8)',
              }}
            >
              Meu Prontuário
            </h1>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="painel-sair-hover"
                style={{
                  fontFamily: "'Cinzel', serif",
                  background: 'transparent',
                  color: '#e74c3c',
                  border: '1.2px solid #e74c3c',
                  padding: '6px 14px',
                  borderRadius: '16px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Sair
              </button>
            )}
          </div>
          <span style={{ fontSize: '11px', color: '#55286f', fontWeight: 600, marginTop: '-4px' }}>
            Samira Ferreira Estética & Cosmetologia
          </span>
        </div>

        <div style={{ padding: '0 2px', width: '100%', boxSizing: 'border-box' }}>
          {telaAtual === 'detalhe_pasta' && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '20px',
                border: '1px solid rgba(226, 210, 245, 0.9)',
                padding: '24px',
                boxShadow: '0 8px 24px rgba(44, 22, 58, 0.06)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '10px' }}>
                <div
                  style={{
                    padding: '16px',
                    background: 'rgba(215, 206, 224, 0.25)',
                    borderRadius: '14px',
                    border: '1px solid rgba(226, 210, 245, 0.6)',
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "'Cinzel', serif",
                      color: '#2c163a',
                      fontSize: '18px',
                      margin: '0 0 6px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                   
                   📁{pacienteData.nome}
                  </h2>
                  <span style={{ fontSize: '11px', color: '#555' }}>
                    Pasta criada em:{' '}
                    <strong style={{ color: '#2c163a' }}>{pacienteData.dataCriacao}</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>

                  {meusAgendamentos.some(
                    (a) => a.aguardandoConsentimento && a.status === 'pendente'
                  ) && (
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #fff8e1 0%, #fef3c7 100%)',
                        border: '1.5px solid #fcd34d',
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 4,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}
                    >
                      <MdHourglassEmpty
                        size={22}
                        color="#92400e"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: "'Cinzel', serif",
                            color: '#92400e',
                            fontSize: 12,
                            fontWeight: 700,
                            marginBottom: 4,
                          }}
                        >
                          Você tem agendamento(s) aguardando confirmação
                        </div>
                        <p
                          style={{
                            fontSize: 11,
                            color: '#5d4037',
                            margin: '0 0 10px 0',
                            lineHeight: 1.5,
                          }}
                        >
                          Para confirmar, aceite o termo de consentimento abaixo.
                        </p>
                        <button
                          type="button"
                          onClick={() => setMostrarConsentimento(true)}
                          style={{
                            width: '100%',
                            fontFamily: "'Cinzel', serif",
                            background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                            color: '#fff',
                            border: '1.5px solid #9c7826',
                            padding: '10px 16px',
                            borderRadius: 16,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          <MdHourglassEmpty size={14} />
                          ACEITAR E CONFIRMAR AGENDAMENTOS
                        </button>
                      </div>
                    </div>
                  )}

                  {meusAgendamentos.length > 0 && (
                    <div
                      style={{
                        background: '#f0fdf4',
                        border: '1.5px solid #86efac',
                        borderRadius: 14,
                        padding: 16,
                        marginBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'Cinzel', serif",
                          color: '#166534',
                          fontSize: 13,
                          fontWeight: 700,
                          marginBottom: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <MdCalendarMonth size={16} color="#166534" />
                        Meus Agendamentos
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {meusAgendamentos.slice(0, 3).map((ag) => (
                          <div
                            key={ag.id}
                            style={{
                              background: '#fff',
                              border: '1px solid #d1fae5',
                              borderRadius: 10,
                              padding: '10px 12px',
                              fontSize: 12,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 4,
                                gap: 8,
                                flexWrap: 'wrap',
                              }}
                            >
                              <strong style={{ color: '#166534' }}>
                                {formatarDataBR(ag.data)} às {ag.horaInicio}
                              </strong>
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '1px 8px',
                                  borderRadius: 10,
                                  textTransform: 'capitalize',
                                  background:
                                    ag.status === 'confirmado'
                                      ? '#dcfce7'
                                      : ag.status === 'pendente'
                                      ? '#fef3c7'
                                      : ag.status === 'cancelado'
                                      ? '#fee2e2'
                                      : ag.status === 'concluido'
                                      ? '#e5e7eb'
                                      : '#f3f4f6',
                                  color:
                                    ag.status === 'confirmado'
                                      ? '#166534'
                                      : ag.status === 'pendente'
                                      ? '#92400e'
                                      : ag.status === 'cancelado'
                                      ? '#991b1b'
                                      : ag.status === 'concluido'
                                      ? '#374151'
                                      : '#666',
                                }}
                              >
                                {ag.status}
                              </span>
                            </div>

                            {ag.observacoes && (
                              <div
                                style={{
                                  fontSize: 10.5,
                                  color: '#555',
                                  fontStyle: 'italic',
                                  marginBottom: 6,
                                }}
                              >
                                {ag.observacoes}
                              </div>
                            )}

                            {/* Pendente / Confirmado → botão Cancelar */}
                            {(ag.status === 'pendente' || ag.status === 'confirmado') && (
                              <button
                                type="button"
                                onClick={() => cancelarAgendamento(ag)}
                                style={{
                                  marginTop: 4,
                                  background: '#ffebee',
                                  color: '#c62828',
                                  border: '1px solid #ef9a9a',
                                  padding: '4px 10px',
                                  borderRadius: 10,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  fontFamily: "'Cinzel', serif",
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <MdCancel size={12} />
                                Cancelar
                              </button>
                            )}

                            {/* Cancelado / Concluído → botão Remover da lista (abre modal) */}
                            {podeRemover(ag) && (
                              <button
                                type="button"
                                onClick={() => abrirModalRemoverAgendamento(ag)}
                                style={{
                                  marginTop: 4,
                                  background: '#f5f5f5',
                                  color: '#555',
                                  border: '1px solid #ddd',
                                  padding: '4px 10px',
                                  borderRadius: 10,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  fontFamily: "'Cinzel', serif",
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <MdDelete size={12} />
                                Remover da lista
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => irParaTela('ver_anamnese')}
                    className="painel-btn-hover"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '14px 18px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'center',
                      boxShadow: '0 4px 12px rgba(200, 162, 74, 0.25)',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    Ver Ficha de Anamnese
                  </button>

                  <button
                    type="button"
                    onClick={() => irParaTela('galeria')}
                    className="painel-btn-hover"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '14px 18px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(168, 85, 247, 0.25)',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    <Images size={16} color="#fff" />
                    Minha Galeria
                  </button>

                  {!appInstalado && (
                    <button
                      type="button"
                      onClick={handleInstalarApp}
                      className="painel-btn-lavanda-hover"
                      style={{
                        fontFamily: "'Cinzel', serif",
                        background: 'linear-gradient(135deg, #b8a3c9 0%, #d7cee0 100%)',
                        color: '#2c163a',
                        border: '1.2px solid #8a6fa8',
                        padding: '14px 18px',
                        borderRadius: '16px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(138, 111, 168, 0.25)',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      <DownloadCloud size={16} color="#2c163a" />
                      {isAndroid ? 'Baixar App' : 'Baixar Web App'}
                    </button>
                  )}

                  {/* ✅ AGENDAR NOVO HORÁRIO — abre modal direto (só data + hora) */}
                  <button
                    type="button"
                    onClick={() => setMostrarModalAgendar(true)}
                    className="painel-btn-hover"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 45%, #C8A24A 100%)',
                      color: '#fff',
                      border: '1.5px solid #9c7826',
                      padding: '14px 18px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                      cursor: 'pointer',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(200, 162, 74, 0.35)',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    <MdCalendarMonth size={16} color="#fff" />
                    AGENDAR NOVO HORÁRIO
                  </button>

                  <div
                    style={{
                      marginTop: '20px',
                      paddingTop: '16px',
                      borderTop: '1px dashed rgba(198, 40, 40, 0.2)',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setMostrarExclusaoConta(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#b0a8b8',
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: '10px',
                        fontWeight: 400,
                        letterSpacing: '0.3px',
                        cursor: 'pointer',
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'color 0.25s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#c62828';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#b0a8b8';
                      }}
                    >
                      <MdInfoOutline size={11} style={{ opacity: 0.7 }} />
                      excluir minha conta
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {telaAtual === 'galeria' && (
            <div>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="btn-voltar-lista"
                style={{
                  fontFamily: "'Cinzel', serif",
                  background:
                    'linear-gradient(135deg, rgba(200, 162, 74, 0.12) 0%, rgba(168, 85, 247, 0.10) 100%)',
                  color: '#2c163a',
                  border: '1.5px solid #C8A24A',
                  padding: '10px 20px',
                  borderRadius: '25px',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  boxShadow: '0 3px 10px rgba(200, 162, 74, 0.15)',
                  transition: 'all 0.25s ease',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <MdArrowBack size={15} color="#C8A24A" />
                Voltar para o menu da pasta
              </button>
              <GaleriaPaciente
                pacienteId={pacienteData.id}
                uidEsteticista={pacienteData.criadoPorUid}
                pacienteNome={pacienteData.nome}
                modo="paciente"
              />
            </div>
          )}

          {telaAtual === 'ver_anamnese' && (
            <div>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="btn-voltar-lista"
                style={{
                  fontFamily: "'Cinzel', serif",
                  background:
                    'linear-gradient(135deg, rgba(200, 162, 74, 0.12) 0%, rgba(168, 85, 247, 0.10) 100%)',
                  color: '#2c163a',
                  border: '1.5px solid #C8A24A',
                  padding: '10px 20px',
                  borderRadius: '25px',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  boxShadow: '0 3px 10px rgba(200, 162, 74, 0.15)',
                  transition: 'all 0.25s ease',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <MdArrowBack size={15} color="#C8A24A" />
                Voltar para o menu da pasta
              </button>
              <div style={{ opacity: 0.98 }}>
                {isMobile ? (
                  <FichaMobile
                    mode="view"
                    fichaSelecionada={pacienteData.anamnese || pacienteData}
                    onVoltar={() => window.history.back()}
                  />
                ) : (
                  <FichaDesktop
                    mode="view"
                    fichaSelecionada={pacienteData.anamnese || pacienteData}
                    onVoltar={() => window.history.back()}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {mostrarConsentimento && !consentimentoRecusado && (
        <ModalConsentimentoPrimeiroAcesso
          pacienteData={pacienteData}
          onAceitar={(consentimento) => {
            setMostrarConsentimento(false);
          }}
          onRecusar={() => {
            setMostrarConsentimento(false);
            setConsentimentoRecusado(true);
          }}
        />
      )}

      {mostrarExclusaoConta && (
        <ModalExclusaoConta
          pacienteData={pacienteData}
          onFechar={() => setMostrarExclusaoConta(false)}
          onExcluido={() => {
            setMostrarExclusaoConta(false);
            setAviso({
              tipo: 'sucesso',
              titulo: 'Conta excluída',
              mensagem:
                'Sua conta foi excluída com sucesso. Todos os seus dados foram removidos.',
              textoConfirmar: 'Voltar ao login',
              onConfirmar: () => {
                setAviso(null);
                if (onLogout) onLogout();
              },
            });
          }}
        />
      )}

      {mostrarModalInstalacao && (
        <ModalInstalacao onClose={() => setMostrarModalInstalacao(false)} />
      )}

      {/* ✅ NOVO: modal amigável de download do APK (Android) */}
      {mostrarModalAPK && (
        <ModalBaixarAPK
          onFechar={() => setMostrarModalAPK(false)}
          onConfirmar={baixarAPK}
        />
      )}

      {/* Modal de confirmação para remover agendamento */}
      {agendamentoParaRemover && (
        <ModalRemoverAgendamento
          agendamento={agendamentoParaRemover}
          onFechar={() => setAgendamentoParaRemover(null)}
          onConfirmar={confirmarRemocaoAgendamento}
        />
      )}

      {/* ✅ Modal de agendar — mesmo do painel da esteticista, só data + hora */}
      {mostrarModalAgendar && (
        <ModalAgendarParaPaciente
          paciente={pacienteData}
          uidEsteticista={pacienteData.criadoPorUid}
          origem="paciente"
          onFechar={() => setMostrarModalAgendar(false)}
          onSucesso={(ag) => {
            setMostrarModalAgendar(false);
            setAviso({
              tipo: 'sucesso',
              titulo: 'Solicitação enviada',
              mensagem:
                `Sua solicitação para ${formatarDataBR(ag.data)} às ${ag.horaInicio} foi enviada.\n` +
                `Aguarde a confirmação da profissional.`,
              textoConfirmar: 'OK',
              onConfirmar: () => setAviso(null),
            });
          }}
        />
      )}

      {/* ✅ Modal genérico de avisos/confirmações */}
      {aviso && (
        <ModalAviso
          tipo={aviso.tipo}
          titulo={aviso.titulo}
          mensagem={aviso.mensagem}
          textoConfirmar={aviso.textoConfirmar}
          textoCancelar={aviso.textoCancelar}
          mostrarCancelar={aviso.mostrarCancelar}
          carregando={aviso.carregando}
          onConfirmar={aviso.onConfirmar}
          onFechar={() => setAviso(null)}
        />
      )}
    </div>
  );
}