import React, { useState, useEffect } from 'react';
import { DownloadCloud, X, Share, MoreVertical, Monitor, Smartphone, Bell, AlertTriangle } from 'lucide-react';

const APK_URL = 'https://samira-anamnese.netlify.app/downloads/samira-estetica.apk';

/* ============================================================
   MODAL DE INSTALAÇÃO — reutilizável
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
        position: 'fixed', inset: 0, background: 'rgba(44, 22, 58, 0.55)',
        backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center',
        alignItems: 'center', zIndex: 99999, padding: '20px', boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '20px', padding: '24px',
          maxWidth: '420px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(44, 22, 58, 0.35)',
          fontFamily: "'Montserrat', sans-serif", position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: 'absolute', top: '14px', right: '14px', background: 'transparent',
            border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={20} color="#2c163a" />
        </button>

        <h2 style={{
          fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '18px',
          margin: '0 0 6px 0', paddingRight: '30px',
        }}>
          Instalar o Web App
        </h2>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 20px 0' }}>
          Siga os passos abaixo de acordo com o seu aparelho.
        </p>

        {isIOSNaoSafari && (
          <div style={{ ...blocoEstilo, border: '1.5px solid #ffb74d', background: '#fff3e0' }}>
            <div style={headerBloco}>
              <AlertTriangle size={16} color="#e65100" />
              <span style={{ ...tituloBloco, color: '#e65100' }}>⚠️ Use o Safari para instalar</span>
            </div>
            <p style={{ fontSize: '12px', color: '#5d4037', margin: '0 0 8px 0', lineHeight: 1.5 }}>
              No iPhone/iPad, <strong>apenas o Safari</strong> consegue instalar Web Apps.
            </p>
            <p style={{ fontSize: '12px', color: '#5d4037', margin: 0, lineHeight: 1.5 }}>
              1. Copie o link deste site.<br />2. Abra no <strong>Safari</strong>.<br />3. Siga as instruções.
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
              <li>Toque em <strong>Compartilhar</strong>{' '}<Share size={14} style={{ verticalAlign: 'middle' }} />.</li>
              <li>Role e toque em <strong>"Adicionar à Tela de Início"</strong>.</li>
              <li>Confirme em <strong>"Adicionar"</strong>.</li>
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
              <li>Toque no menu <strong>⋮</strong>{' '}<MoreVertical size={14} style={{ verticalAlign: 'middle' }} />.</li>
              <li>Toque em <strong>"Instalar aplicativo"</strong>.</li>
              <li>Confirme em <strong>"Instalar"</strong>.</li>
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
              <li>Olhe para a <strong>barra de endereços</strong>.</li>
              <li>Clique no ícone de <strong>instalação</strong>.</li>
              <li>Se não aparecer, menu <strong>⋮</strong> → <strong>"Instalar Samira Ferreira"</strong>.</li>
            </ol>
          </div>
        )}

        <div style={{ ...blocoEstilo, marginTop: '16px' }}>
          <div style={headerBloco}>
            <Bell size={16} color="#C8A24A" />
            <span style={tituloBloco}>Permitir notificações</span>
          </div>
          <p style={{ fontSize: '11px', color: '#555', margin: 0, lineHeight: 1.5 }}>
            Ao abrir o app instalado, toque em <strong>"Permitir"</strong> quando pedir acesso às notificações.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: '20px', width: '100%', fontFamily: "'Cinzel', serif",
            background: '#2c163a', color: '#C8A24A', border: '1.2px solid #C8A24A',
            padding: '12px', borderRadius: '16px', fontSize: '11px', fontWeight: 700,
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
const headerBloco = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' };
const tituloBloco = { fontFamily: "'Cinzel', serif", fontSize: '12px', fontWeight: 700, color: '#2c163a' };
const listaEstilo = { margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#444', lineHeight: 1.7 };

/* ============================================================
   BOTÃO "BAIXAR APP / WEB APP"
   ============================================================ */
export default function BotaoInstalarApp({ compacto = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [appInstalado, setAppInstalado] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);

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

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setAppInstalado(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBefore);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleClick = async () => {
    // ANDROID → baixa APK
    if (isAndroid) {
      const confirmar = window.confirm(
        '📱 Download do aplicativo Samira Ferreira\n\n' +
        '1. Abra o arquivo .apk\n' +
        '2. Permita "Instalar de fontes desconhecidas"\n' +
        '3. Confirme a instalação\n\n' +
        'Deseja baixar agora?'
      );
      if (!confirmar) return;

      const link = document.createElement('a');
      link.href = APK_URL;
      link.download = 'samira-ferreira.apk';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // iOS → modal
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

      {mostrarModal && <ModalInstalacao onClose={() => setMostrarModal(false)} />}
    </>
  );
}