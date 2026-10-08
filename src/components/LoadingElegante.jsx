// src/components/LoadingElegante.jsx
import React from 'react';

/**
 * Loading elegante com órbitas + logo pulsando + texto com shimmer.
 * Mesmo efeito da agenda pública (TelaAgendamentoPublico).
 *
 * Props:
 *  - texto: string (padrão: "Carregando...")
 */
export default function LoadingElegante({ texto = 'Carregando...' }) {
  return (
    <>
      <style>{`
        .le-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 24px 50px 24px;
          gap: 22px;
        }
        .le-orbe {
          position: relative;
          width: 110px;
          height: 110px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .le-anel {
          position: absolute;
          border-radius: 50%;
          border-style: solid;
          border-color: transparent;
          will-change: transform;
        }
        .le-anel-1 {
          inset: 0;
          border-width: 3px;
          border-top-color: #a855f7;
          border-right-color: #a855f7;
          animation: leSpin 1.4s linear infinite;
          filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.6));
        }
        .le-anel-2 {
          inset: 12px;
          border-width: 2.5px;
          border-bottom-color: #C8A24A;
          border-left-color: #C8A24A;
          animation: leSpinReverse 2s linear infinite;
          filter: drop-shadow(0 0 6px rgba(200, 162, 74, 0.6));
        }
        .le-anel-3 {
          inset: 24px;
          border-width: 2px;
          border-top-color: rgba(126, 34, 206, 0.7);
          border-left-color: rgba(126, 34, 206, 0.7);
          animation: leSpin 2.6s linear infinite;
        }
        .le-logo {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          opacity: 0.9;
          animation: lePulseLogo 1.8s ease-in-out infinite;
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.35);
        }
        .le-texto {
          font-family: 'Cinzel', serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #55286f;
          background: linear-gradient(90deg,
            #55286f 0%,
            #a855f7 30%,
            #C8A24A 50%,
            #a855f7 70%,
            #55286f 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: leShimmerText 3s linear infinite;
          text-align: center;
          padding: 0 16px;
          line-height: 1.5;
        }
        .le-pontos {
          display: flex;
          gap: 8px;
          margin-top: -6px;
        }
        .le-pontos span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7, #C8A24A);
          animation: leBounce 1.2s ease-in-out infinite;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
        }
        .le-pontos span:nth-child(2) { animation-delay: 0.15s; }
        .le-pontos span:nth-child(3) { animation-delay: 0.30s; }

        @keyframes leSpin { to { transform: rotate(360deg); } }
        @keyframes leSpinReverse { to { transform: rotate(-360deg); } }
        @keyframes lePulseLogo {
          0%, 100% { transform: scale(1);    opacity: 0.9; }
          50%      { transform: scale(1.12); opacity: 1;   }
        }
        @keyframes leShimmerText {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes leBounce {
          0%, 80%, 100% { transform: scale(1)   translateY(0);    opacity: 0.55; }
          40%           { transform: scale(1.4) translateY(-4px); opacity: 1;    }
        }

        @media (max-width: 640px) {
          .le-container { padding: 50px 18px 40px 18px; gap: 18px; }
          .le-orbe { width: 92px; height: 92px; }
          .le-logo { width: 38px; height: 38px; }
          .le-texto { font-size: 12px; letter-spacing: 1px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .le-anel, .le-logo, .le-texto, .le-pontos span {
            animation: none !important;
          }
        }
      `}</style>

      <div className="le-container">
        <div className="le-orbe">
          <div className="le-anel le-anel-1" />
          <div className="le-anel le-anel-2" />
          <div className="le-anel le-anel-3" />
          <img
            src="/imagens/logo-telainicial.jpeg"
            alt=""
            className="le-logo"
          />
        </div>
        <div className="le-texto">{texto}</div>
        <div className="le-pontos">
          <span />
          <span />
          <span />
        </div>
      </div>
    </>
  );
}