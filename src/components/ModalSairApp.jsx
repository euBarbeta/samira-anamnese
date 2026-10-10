// src/components/ModalSairApp.jsx
import React from 'react';
import { MdExitToApp } from 'react-icons/md';

export default function ModalSairApp({ onConfirmar, onCancelar }) {
  return (
    <div
      onClick={onCancelar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
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
          padding: '30px 26px 22px',
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.5)',
          border: '1.5px solid #C8A24A',
          fontFamily: "'Montserrat', sans-serif",
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 16px auto',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fdf4ff 0%, #f5e6ff 100%)',
            border: '2px solid #a855f7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(168, 85, 247, 0.2)',
          }}
        >
          <MdExitToApp size={34} color="#a855f7" />
        </div>

        <h3
          style={{
            fontFamily: "'Cinzel', serif",
            color: '#2c163a',
            fontSize: 17,
            fontWeight: 700,
            margin: '0 0 10px 0',
            letterSpacing: '0.4px',
          }}
        >
          Deseja sair do app?
        </h3>

        <p
          style={{
            fontSize: 13,
            color: '#555',
            margin: '0 0 22px 0',
            lineHeight: 1.6,
          }}
        >
          Você pode voltar quando quiser — seus dados ficam salvos.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={onCancelar}
            style={{
              width: '100%',
              fontFamily: "'Cinzel', serif",
              background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
              color: '#fff',
              border: '1.5px solid #9c7826',
              padding: '14px 20px',
              borderRadius: 24,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.5px',
              boxShadow: '0 4px 14px rgba(200, 162, 74, 0.35)',
            }}
          >
            NÃO, VOLTAR
          </button>

          <button
            type="button"
            onClick={onConfirmar}
            style={{
              width: '100%',
              fontFamily: "'Montserrat', sans-serif",
              background: 'transparent',
              color: '#c62828',
              border: 'none',
              padding: '10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              letterSpacing: '0.3px',
            }}
          >
            Sim, sair
          </button>
        </div>
      </div>
    </div>
  );
}