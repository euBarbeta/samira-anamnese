import React from 'react';
import { MdLinkOff } from 'react-icons/md';
import { Capacitor } from '@capacitor/core';

// ✅ URL pública pra onde o botão deve levar
const URL_AGENDAMENTO_PUBLICO =
  'https://samira-anamnese.netlify.app/#agendar';

function isNativo() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export default function PaginaNaoEncontrada() {
  const handleClick = (e) => {
    e.preventDefault();

    // ✅ No APK, o WebView é isolado → abre no navegador externo
    if (isNativo()) {
      // '_system' faz o Capacitor abrir no navegador padrão do aparelho
      window.open(URL_AGENDAMENTO_PUBLICO, '_system');
      return;
    }

    // ✅ Web/PWA: navega normalmente
    window.location.href = '/#agendar';
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#d7cee0',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: 20, boxSizing: 'border-box',
      fontFamily: "'Montserrat', sans-serif",
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.96)',
        border: '1.5px solid #C8A24A', borderRadius: 20,
        padding: '36px 28px', maxWidth: 420, width: '100%',
        textAlign: 'center',
        boxShadow: '0 15px 40px rgba(44, 22, 58, 0.25)',
      }}>
        <div style={{
          width: 80, height: 80, margin: '0 auto 18px auto',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
          border: '2px solid #ffb74d',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MdLinkOff size={38} color="#e65100" />
        </div>
        <h2 style={{
          fontFamily: "'Cinzel', serif", color: '#2c163a',
          fontSize: 20, margin: '0 0 10px 0',
        }}>
          Link inválido
        </h2>
        <p style={{
          fontSize: 13, color: '#555', lineHeight: 1.6,
          margin: '0 0 24px 0',
        }}>
          Este link não existe ou expirou.
          <br />
          Peça um novo link para a profissional.
        </p>
        <button
          type="button"
          onClick={handleClick}
          style={{
            display: 'inline-block',
            fontFamily: "'Cinzel', serif",
            background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
            color: '#fff', border: '1.5px solid #9c7826',
            padding: '12px 26px', borderRadius: 24,
            fontSize: 12, fontWeight: 700,
            textDecoration: 'none',
            letterSpacing: 1,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(200, 162, 74, 0.35)',
          }}
        >
          IR PARA AGENDAMENTO
        </button>
      </div>
    </div>
  );
}