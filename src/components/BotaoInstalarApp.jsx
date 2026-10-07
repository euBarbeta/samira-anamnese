// src/components/BotaoInstalarApp.jsx
import React, { useState, useEffect } from 'react';
import {
  DownloadCloud,
  X,
  Share,
  MoreVertical,
  Monitor,
  Smartphone,
  Bell,
  AlertTriangle,
} from 'lucide-react';

const APK_URL = 'https://samira-anamnese.netlify.app/downloads/samira-estetica.apk';

/* ============================================================
   MODAL AMIGÁVEL DE DOWNLOAD DO APK (Android)
   — "BAIXAR APP AGORA" é o herói (largura total, dourado).
   — "Agora não" fica discreto como link embaixo.
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
          Acesso rápido ao painel, notificações de agendamento e fotos direto
          no celular. É só seguir os passos:
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
            'Toque em "Baixar App Agora" no final',
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

        {/* BOTÃO PRINCIPAL EM DESTAQUE */}
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
   MODAL DE INSTALAÇÃO (PWA) — iOS, Android (fallback) e Desktop
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
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
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

        {/* ✅ iOS non-Safari — dica amigável (não mais alerta vermelho) */}
        {isIOSNaoSafari && (
          <div
            style={{
              ...blocoEstilo,
              border: '1.5px solid #d8b4fe',
              background: 'rgba(250, 245, 255, 0.7)',
            }}
          >
            <div style={headerBloco}>
              <Smartphone size={16} color="#7e22ce" />
              <span style={{ ...tituloBloco, color: '#7e22ce' }}>
                Use o Safari para instalar
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#55286f', margin: '0 0 8px 0', lineHeight: 1.5 }}>
              No iPhone/iPad, <strong>apenas o Safari</strong> consegue instalar
              Web Apps. O Chrome, Firefox e Edge no iOS não têm essa opção.
            </p>
            <p style={{ fontSize: '12px', color: '#55286f', margin: 0, lineHeight: 1.5 }}>
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
                Toque em <strong>Compartilhar</strong>{' '}
                <Share size={14} style={{ verticalAlign: 'middle' }} />.
              </li>
              <li>
                Role e toque em <strong>"Adicionar à Tela de Início"</strong>.
              </li>
              <li>
                Confirme em <strong>"Adicionar"</strong>.
              </li>
              <li>O ícone aparecerá na Tela de Início.</li>
            </ol>
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
                <MoreVertical size={14} style={{ verticalAlign: 'middle' }} />.
              </li>
              <li>
                Toque em <strong>"Instalar aplicativo"</strong>.
              </li>
              <li>
                Confirme em <strong>"Instalar"</strong>.
              </li>
            </ol>
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
                Olhe para a <strong>barra de endereços</strong>.
              </li>
              <li>
                Clique no ícone de <strong>instalação</strong>.
              </li>
              <li>
                Se não aparecer, menu <strong>⋮</strong> →{' '}
                <strong>"Instalar Samira Ferreira"</strong>.
              </li>
            </ol>
          </div>
        )}

        <div style={{ ...blocoEstilo, marginTop: '16px' }}>
          <div style={headerBloco}>
            <Bell size={16} color="#C8A24A" />
            <span style={tituloBloco}>Permitir notificações</span>
          </div>
          <p style={{ fontSize: '11px', color: '#555', margin: 0, lineHeight: 1.5 }}>
            Ao abrir o app instalado, toque em <strong>"Permitir"</strong> quando
            pedir acesso às notificações.
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

/* ============================================================
   BOTÃO "BAIXAR APP / WEB APP"
   ============================================================ */
export default function BotaoInstalarApp({ compacto = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [appInstalado, setAppInstalado] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);

  // ✅ NOVO: controla o modal amigável de APK (Android)
  const [mostrarModalAPK, setMostrarModalAPK] = useState(false);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  // Detecta se é nativo (APK) → esconde botão
  useEffect(() => {
    let isNativo = false;
    try {
      const { Capacitor } = require('@capacitor/core');
      isNativo = Capacitor?.isNativePlatform?.() || false;
    } catch (e) {}
    if (isNativo) setAppInstalado(true);

    if (window.__deferredPrompt) setDeferredPrompt(window.__deferredPrompt);

    const handleBefore = (e) => {
      e.preventDefault();
      window.__deferredPrompt = e;
      setDeferredPrompt(e);
    };
    const handleInstalled = () => {
      setAppInstalado(true);
      setDeferredPrompt(null);
      window.__deferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBefore);
    window.addEventListener('appinstalled', handleInstalled);

    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone
    ) {
      setAppInstalado(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBefore);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleClick = async () => {
    // ✅ ANDROID → abre o modal amigável (não mais window.confirm)
    if (isAndroid) {
      setMostrarModalAPK(true);
      return;
    }

    // iOS → modal de instruções Safari
    if (isIOS) {
      setMostrarModal(true);
      return;
    }

    // Desktop → prompt nativo ou modal
    const prompt = deferredPrompt || window.__deferredPrompt;
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
      } catch (e) {
        console.warn('Prompt falhou:', e);
      }
    }
    setMostrarModal(true);
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

  if (appInstalado) return null;

  const texto = isAndroid ? 'Baixar App' : 'Baixar Web App';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        style={{
          fontFamily: "'Cinzel', serif",
          background: 'linear-gradient(135deg, #b8a3c9 0%, #d7cee0 100%)',
          color: '#2c163a',
          border: '1.2px solid #8a6fa8',
          padding: compacto ? '6px 14px' : '12px 24px',
          borderRadius: compacto ? '16px' : '20px',
          fontSize: compacto ? '10px' : '13px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          boxShadow: '0 3px 10px rgba(138, 111, 168, 0.25)',
          transition: 'all 0.25s ease',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(138, 111, 168, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 3px 10px rgba(138, 111, 168, 0.25)';
        }}
      >
        <DownloadCloud size={compacto ? 14 : 16} color="#2c163a" />
        {texto}
      </button>

      {/* ✅ NOVO: modal amigável de APK (Android) */}
      {mostrarModalAPK && (
        <ModalBaixarAPK
          onFechar={() => setMostrarModalAPK(false)}
          onConfirmar={baixarAPK}
        />
      )}

      {/* Modal de instruções PWA (iOS, Desktop) */}
      {mostrarModal && <ModalInstalacao onClose={() => setMostrarModal(false)} />}
    </>
  );
}