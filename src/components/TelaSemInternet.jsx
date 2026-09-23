import React, { useState, useEffect } from 'react';
import { MdWifiOff, MdRefresh } from 'react-icons/md';

export default function TelaSemInternet() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [tentando, setTentando] = useState(false);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const tentarNovamente = () => {
    setTentando(true);
    // Se voltou a conexão, o listener vai fechar a tela automaticamente
    setTimeout(() => {
      setOffline(!navigator.onLine);
      setTentando(false);
    }, 900);
  };

  if (!offline) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2147483647,
      backgroundColor: '#d7cee0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      boxSizing: 'border-box',
      fontFamily: "'Montserrat', sans-serif",
      overflow: 'hidden'
    }}>
      {/* Marca d'água centralizada */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: 0
      }}>
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

        @keyframes pulseOffline {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.06); opacity: 0.85; }
        }

        @keyframes spinRefresh {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .icone-offline-pulse {
          animation: pulseOffline 2.4s ease-in-out infinite;
        }

        .icone-refresh-girando {
          animation: spinRefresh 0.9s linear infinite;
        }

        .btn-tentar-novamente {
          transition: all 0.25s ease;
        }
        .btn-tentar-novamente:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 22px rgba(200, 162, 74, 0.5) !important;
        }
        .btn-tentar-novamente:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }
      `}</style>

      <div style={{
        position: 'relative',
        zIndex: 1,
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1.5px solid #C8A24A',
        borderRadius: '20px',
        padding: '36px 28px',
        maxWidth: '380px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 15px 40px rgba(44, 22, 58, 0.25)',
        backdropFilter: 'blur(8px)'
      }}>
        {/* Ícone circular com WiFi cortado */}
        <div
          className="icone-offline-pulse"
          style={{
            width: '86px',
            height: '86px',
            borderRadius: '50%',
            margin: '0 auto 20px auto',
            background: 'linear-gradient(135deg, #fdf4ff 0%, #f5e6ff 100%)',
            border: '2px solid #C8A24A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(200, 162, 74, 0.25)'
          }}
        >
          <MdWifiOff size={42} color="#a855f7" />
        </div>

        <h2 style={{
          fontFamily: "'Cinzel', serif",
          color: '#2c163a',
          fontSize: '20px',
          margin: '0 0 10px 0',
          letterSpacing: '0.5px'
        }}>
          Sem conexão
        </h2>

        <p style={{
          fontSize: '13px',
          color: '#555',
          lineHeight: 1.6,
          margin: '0 0 24px 0'
        }}>
          Não conseguimos acessar a internet agora. Verifique sua conexão de Wi-Fi ou dados móveis e tente novamente.
        </p>

        <div style={{
          height: '1.5px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(200, 162, 74, 0.4) 50%, transparent 100%)',
          margin: '0 0 22px 0'
        }} />

        <button
          type="button"
          onClick={tentarNovamente}
          disabled={tentando}
          className="btn-tentar-novamente"
          style={{
            fontFamily: "'Cinzel', serif",
            background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
            color: '#fff',
            border: '1.5px solid #9c7826',
            padding: '13px 28px',
            borderRadius: '26px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '1px',
            cursor: tentando ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            boxShadow: '0 4px 15px rgba(200, 162, 74, 0.35)',
            opacity: tentando ? 0.75 : 1
          }}
        >
          <MdRefresh
            size={18}
            className={tentando ? 'icone-refresh-girando' : ''}
          />
          {tentando ? 'VERIFICANDO...' : 'TENTAR NOVAMENTE'}
        </button>

        <p style={{
          fontSize: '10px',
          color: '#888',
          margin: '18px 0 0 0',
          fontStyle: 'italic'
        }}>
          Sua sessão será mantida automaticamente.
        </p>
      </div>
    </div>
  );
}