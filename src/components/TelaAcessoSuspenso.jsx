// src/components/TelaAcessoSuspenso.jsx
import React from 'react';
import { MdBlock, MdWhatsapp } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';

const WHATSAPP_NUMERO = '5511934656630';
const WHATSAPP_MENSAGEM =
  'Olá! Meu acesso ao app está suspenso. Pode verificar, por favor?';

export default function TelaAcessoSuspenso({ motivo, onVoltarLogin }) {
  const linkWhats = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
    WHATSAPP_MENSAGEM
  )}`;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#d7cee0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        boxSizing: 'border-box',
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.98)',
          border: '1.5px solid #C8A24A',
          borderRadius: 20,
          padding: '36px 28px',
          maxWidth: 440,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 15px 40px rgba(44, 22, 58, 0.25)',
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            margin: '0 auto 18px auto',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ffebee 0%, #fde8e8 100%)',
            border: '2px solid #ef9a9a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MdBlock size={38} color="#c62828" />
        </div>

        <h2
          style={{
            fontFamily: "'Cinzel', serif",
            color: '#c62828',
            fontSize: 20,
            margin: '0 0 12px 0',
            letterSpacing: '0.4px',
          }}
        >
          Acesso suspenso
        </h2>

        <p
          style={{
            fontSize: 13,
            color: '#2c163a',
            lineHeight: 1.6,
            margin: '0 0 16px 0',
          }}
        >
          Este dispositivo foi bloqueado pela profissional responsável.
        </p>

        {motivo && (
          <div
            style={{
              background: '#fde8e8',
              border: '1px solid #f98080',
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 20,
              fontSize: 12,
              color: '#7f1d1d',
              textAlign: 'left',
              lineHeight: 1.6,
            }}
          >
            <strong>Motivo:</strong>
            <br />
            {motivo}
          </div>
        )}

        <p
          style={{
            fontSize: 12,
            color: '#666',
            margin: '0 0 22px 0',
            lineHeight: 1.6,
          }}
        >
          Se você acredita que foi um engano, entre em contato com a
          profissional para solicitar a liberação.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href={linkWhats}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "'Cinzel', serif",
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              color: '#fff',
              border: '1.5px solid #128C7E',
              padding: '14px 20px',
              borderRadius: 24,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.5px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
              cursor: 'pointer',
            }}
          >
            <FaWhatsapp size={16} />
            FALAR NO WHATSAPP
          </a>

          <button
            type="button"
            onClick={onVoltarLogin}
            style={{
              fontFamily: "'Cinzel', serif",
              background: 'transparent',
              color: '#55286f',
              border: '1.5px solid rgba(85, 40, 111, 0.4)',
              padding: '12px 20px',
              borderRadius: 24,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.4px',
              cursor: 'pointer',
            }}
          >
            VOLTAR AO LOGIN
          </button>
        </div>
      </div>
    </div>
  );
}