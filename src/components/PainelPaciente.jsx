import React, { useState, useEffect, useCallback } from 'react';
import { inscreverPush } from './push-notifications';
import AvisoNotificacoes from './AvisoNotificacoes';
import { isNativo } from './push-notifications-native';
import { Capacitor } from '@capacitor/core';
import {
  DownloadCloud,
  X,
  Share,
  MoreVertical,
  Monitor,
  Smartphone,
  Bell,
  AlertTriangle   // ← adicionar
} from 'lucide-react';
import FichaDesktop from './FichaDesktop';
import FichaMobile from './FichaMobile';
import FichaEvoDesktop from './FichaEvoDesktop';
import FichaEvoMobile from './FichaEvoMobile';

/* ============================================================
   MODAL DE INSTALAÇÃO (PWA) — embutido no mesmo arquivo
   ============================================================ */
function ModalInstalacao({ onClose }) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isDesktop = !isIOS && !isAndroid;

  // Detecta se é Chrome/Firefox/Edge no iOS (todos NÃO suportam PWA)
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
        boxSizing: 'border-box'
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
          position: 'relative'
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
            justifyContent: 'center'
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
            paddingRight: '30px'
          }}
        >
          Instalar o Web App
        </h2>

        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 20px 0' }}>
          Siga os passos abaixo de acordo com o seu aparelho.
        </p>

        {/* ============ iOS — Chrome / Firefox / Edge ============ */}
        {isIOSNaoSafari && (
          <div style={{ ...blocoEstilo, border: '1.5px solid #ffb74d', background: '#fff3e0' }}>
            <div style={headerBloco}>
              <AlertTriangle size={16} color="#e65100" />
              <span style={{ ...tituloBloco, color: '#e65100' }}>
                ⚠️ Use o Safari para instalar
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

        {/* ============ iOS Safari ============ */}
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
              <li>
                O ícone aparecerá na sua Tela de Início como um app normal.
              </li>
            </ol>
            <p style={{ fontSize: '11px', color: '#666', margin: '10px 0 0 0', lineHeight: 1.5 }}>
              💡 <strong>Dica:</strong> depois de instalar, abra o app pela Tela de Início (não
              pelo Safari) para receber notificações.
            </p>
          </div>
        )}

        {/* ============ Android ============ */}
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
              💡 Prefere o app nativo? Baixe o <strong>APK da Samira</strong> — tem notificações
              mais confiáveis.
            </p>
          </div>
        )}

        {/* ============ Desktop ============ */}
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
              💡 <strong>Não aparece o ícone?</strong> Acesse em outro navegador (Edge, Brave) ou
              limpe os dados do site nas configurações.
            </p>
          </div>
        )}

        {/* ============ Notificações ============ */}
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
            cursor: 'pointer'
          }}
        >
          Entendi
        </button>
      </div>
    </div>
  );
}

/* Estilos auxiliares do modal */
const blocoEstilo = {
  background: 'rgba(215, 206, 224, 0.25)',
  border: '1px solid rgba(226, 210, 245, 0.7)',
  borderRadius: '14px',
  padding: '14px'
};

const headerBloco = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '10px'
};

const tituloBloco = {
  fontFamily: "'Cinzel', serif",
  fontSize: '12px',
  fontWeight: 700,
  color: '#2c163a'
};

const listaEstilo = {
  margin: 0,
  paddingLeft: '20px',
  fontSize: '12px',
  color: '#444',
  lineHeight: 1.7
};

/* ============================================================
   PAINEL DO PACIENTE
   ============================================================ */
export default function PainelPaciente({
  pacienteData,
  onLogout,
  abrirAnamneseInicial = false,
}) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
 const [telaAtual, setTelaAtual] = useState('detalhe_pasta'); // ✅ sempre começa na pasta
  const [evolucaoSelecionada, setEvolucaoSelecionada] = useState(null);

  // Estados para gerenciar a instalação do WebApp (PWA)
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [appInstalado, setAppInstalado] = useState(false);
  const [mostrarModalInstalacao, setMostrarModalInstalacao] = useState(false);
   const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const irParaTela = useCallback((novaTela) => {
    if (novaTela === telaAtual) return;
    window.history.pushState(
      { ...(window.history.state || {}), painelPacienteTela: novaTela },
      '',
      window.location.pathname
    );
    setTelaAtual(novaTela);
  }, [telaAtual]);
  useEffect(() => {
  const telaInicial = abrirAnamneseInicial ? 'ver_anamnese' : 'detalhe_pasta';
  window.history.replaceState(
    { ...(window.history.state || {}), painelPacienteTela: telaInicial },
    '',
    window.location.pathname
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
   useEffect(() => {
    const onPop = (e) => {
      const st = e.state;
      if (st?.painelPacienteTela) {
        setTelaAtual(st.painelPacienteTela);
      } else {
        // Sem state nosso → volta pro menu da pasta
        setTelaAtual('detalhe_pasta');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

// ✅ Re-registra push ao logar — funciona em nativo E navegador
useEffect(() => {
  if (!pacienteData?.id) return;

  (async () => {
    try {
      const { inscreverPush } = await import('./push-notifications');

      if (isNativo()) {
        // ✅ Nativo: tenta registrar direto (a função interna já checa permissão)
        await inscreverPush(pacienteData.id);
        return;
      }

      // 🌐 Navegador: só registra se permissão já foi concedida
      if (typeof Notification === 'undefined') return;
      if (Notification.permission !== 'granted') return;
      await inscreverPush(pacienteData.id);
    } catch (e) {
      console.warn('Falha ao re-registrar push:', e);
    }
  })();
}, [pacienteData?.id]);
// ✅ Re-registra push quando o app volta ao primeiro plano
useEffect(() => {
  const handleVisibility = () => {
    if (document.visibilityState !== 'visible') return;
    if (!pacienteData?.id) return;

    import('./push-notifications').then(({ inscreverPush }) => {
      if (isNativo()) {
        // Nativo: tenta sempre
        inscreverPush(pacienteData.id).catch(() => {});
      } else {
        // Navegador: só se permissão concedida
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
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

    // ✅ Se for APK nativo → considera "instalado" (esconde o botão Baixar)
    if (isNativo()) {
      setAppInstalado(true);
    }

    // Recupera prompt global (capturado no main.jsx)
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
  // ✅ ANDROID → baixa o APK direto
  if (isAndroid) {
    const confirmar = window.confirm(
      '📱 Download do aplicativo Samira Ferreira\n\n' +
      'Após o download:\n' +
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

  // ✅ iOS → SEMPRE abre o modal (iOS nunca tem prompt nativo)
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIOS) {
    setMostrarModalInstalacao(true);
    return;
  }

  // ✅ Desktop → tenta prompt nativo, senão abre modal
  const prompt = deferredPrompt || (typeof window !== 'undefined' ? window.__deferredPrompt : null);

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
      // Cancelou → abre modal com instruções
      setMostrarModalInstalacao(true);
      return;
    } catch (e) {
      console.warn('beforeinstallprompt falhou, abrindo modal:', e);
      // Cai no modal
    }
  }

  // Sem prompt nativo → modal custom
  setMostrarModalInstalacao(true);
};

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
          boxSizing: 'border-box'
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
            boxShadow: '0 8px 24px rgba(44, 22, 58, 0.1)'
          }}
        >
          <h2
            style={{
              fontFamily: "'Cinzel', serif",
              color: '#2c163a',
              fontSize: '18px',
              margin: '0 0 12px 0'
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
                transition: 'all 0.2s ease'
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
        boxSizing: 'border-box'
      }}
    >
      {/* MARCA D'ÁGUA RESPONSIVA */}
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
          overflow: 'hidden'
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
            objectFit: 'contain'
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
     <AvisoNotificacoes
  pacienteId={pacienteData?.id}
  appInstalado={appInstalado}
/>
   
    {/* CONTEÚDO PRINCIPAL */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', boxSizing: 'border-box' }}>
        {/* CABEÇALHO DO PACIENTE */}
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
            boxShadow: '0 2px 10px rgba(44, 22, 58, 0.03)'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%'
            }}
          >
            <h1
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#2c163a',
                fontSize: '20px',
                margin: 0,
                textShadow: '0 1px 2px rgba(255,255,255,0.8)'
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
                  transition: 'all 0.2s ease'
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

        {/* CONTEÚDO DINÂMICO */}
        <div style={{ padding: '0 2px', width: '100%', boxSizing: 'border-box' }}>
          {/* TELA DE DETALHES DA PASTA */}
          {telaAtual === 'detalhe_pasta' && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '20px',
                border: '1px solid rgba(226, 210, 245, 0.9)',
                padding: '24px',
                boxShadow: '0 8px 24px rgba(44, 22, 58, 0.06)',
                backdropFilter: 'blur(8px)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '10px' }}>
                <div
                  style={{
                    padding: '16px',
                    background: 'rgba(215, 206, 224, 0.25)',
                    borderRadius: '14px',
                    border: '1px solid rgba(226, 210, 245, 0.6)'
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "'Cinzel', serif",
                      color: '#2c163a',
                      fontSize: '18px',
                      margin: '0 0 6px 0'
                    }}
                  >
                    📁 {pacienteData.nome}
                  </h2>
                  <span style={{ fontSize: '11px', color: '#555' }}>
                    Pasta criada em:{' '}
                    <strong style={{ color: '#2c163a' }}>{pacienteData.dataCriacao}</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                  <button
  type="button"
  onClick={() => irParaTela('ver_anamnese')}   // ⬅️ era setTelaAtual
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
    transition: 'all 0.25s ease'
  }}
>
  Ver Ficha de Anamnese
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
      transition: 'all 0.25s ease'
    }}
  >
    <DownloadCloud size={16} color="#2c163a" />
    {isAndroid ? 'Baixar App' : 'Baixar Web App'}
  </button>
)}

                </div>
              </div>
            </div>
          )}

          {/* TELA DE VISUALIZAÇÃO DA ANAMNESE */}
          {telaAtual === 'ver_anamnese' && (
  <div>
    <button
      type="button"
      onClick={() => window.history.back()}   // ⬅️ usa o próprio histórico
      style={{
        background: 'rgba(255, 255, 255, 0.8)',
        border: '1px solid rgba(226, 210, 245, 0.8)',
        color: '#2c163a',
        cursor: 'pointer',
        fontWeight: 600,
        marginBottom: '16px',
        fontSize: '11px',
        padding: '10px 16px',
        borderRadius: '14px',
        boxShadow: '0 2px 6px rgba(44, 22, 58, 0.04)',
        transition: 'all 0.2s ease'
      }}
    >
      ← Voltar para o menu da pasta
    </button>
    <div style={{ opacity: 0.98 }}>
      {isMobile ? (
        <FichaMobile
          mode="view"
          fichaSelecionada={pacienteData.anamnese || pacienteData}
          onVoltar={() => window.history.back()}   // ⬅️ botão interno também
        />
      ) : (
        <FichaDesktop
          mode="view"
          fichaSelecionada={pacienteData.anamnese || pacienteData}
          onVoltar={() => window.history.back()}   // ⬅️ botão interno também
        />
      )}
    </div>
  </div>
)}
        </div>
      </div>
      {/* BANNER DE PERMISSÃO DE NOTIFICAÇÃO */}


      {/* MODAL DE INSTALAÇÃO (renderizado por cima de tudo) */}
      {mostrarModalInstalacao && (
        <ModalInstalacao onClose={() => setMostrarModalInstalacao(false)} />
      )}
    </div>
  );
}