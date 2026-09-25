// src/components/agendamento/ModalConsentimentoAgendamento.jsx
import React, { useState } from 'react';
import { MdClose, MdLock, MdVerifiedUser } from 'react-icons/md';

/**
 * Modal que exibe o termo de consentimento LGPD no fluxo de AGENDAMENTO.
 * É um resumo simplificado — o termo completo está em PoliticaPrivacidade.
 *
 * Props:
 *  - onFechar: () => void
 */
export default function ModalConsentimentoAgendamento({ onFechar }) {
  const [mostrarPoliticaCompleta, setMostrarPoliticaCompleta] = useState(false);

  const handleFechar = () => {
    onFechar?.();
  };

  return (
    <div
      onClick={handleFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2147483647,
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '20px',
          padding: 0,
          maxWidth: '640px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
          fontFamily: "'Montserrat', sans-serif",
          border: '1.5px solid #C8A24A',
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600&display=swap');
          .agend-lgpd-scroll::-webkit-scrollbar { width: 8px; }
          .agend-lgpd-scroll::-webkit-scrollbar-track { background: #f3eef8; }
          .agend-lgpd-scroll::-webkit-scrollbar-thumb { background: #C8A24A; border-radius: 4px; }
          .agend-lgpd-scroll::-webkit-scrollbar-thumb:hover { background: #a8852f; }
        `}</style>

        {/* Cabeçalho */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 24px',
            borderBottom: '1.5px solid #e2d2f5',
            background:
              'linear-gradient(135deg, rgba(200, 162, 74, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MdLock size={22} color="#a855f7" />
            <h2
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#2c163a',
                fontSize: 16,
                margin: 0,
                letterSpacing: '0.3px',
              }}
            >
              Consentimento para agendamento
            </h2>
          </div>
          <button
            type="button"
            onClick={handleFechar}
            aria-label="Fechar"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MdClose size={22} color="#2c163a" />
          </button>
        </div>

        {/* Corpo rolável */}
        <div
          className="agend-lgpd-scroll"
          style={{
            padding: '22px 26px',
            overflowY: 'auto',
            fontSize: 13,
            color: '#333',
            lineHeight: 1.7,
          }}
        >
          <p style={{ marginTop: 0, fontWeight: 600, color: '#2c163a' }}>
            Antes de confirmar seu agendamento, precisamos do seu consentimento:
          </p>

          <div
            style={{
              background: 'rgba(200, 162, 74, 0.08)',
              border: '1.5px dashed #C8A24A',
              borderRadius: 10,
              padding: '14px 16px',
              fontSize: 12.5,
              color: '#55286f',
              marginBottom: 18,
            }}
          >
            <strong>O que você autoriza ao agendar:</strong>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
              <li>Guardar seus dados pessoais (nome, documento, telefone, e-mail) para contato e identificação;</li>
              <li>Registrar o motivo/procedimento informado no agendamento;</li>
              <li>Enviar lembretes do atendimento por notificação, e-mail ou telefone;</li>
              <li>Compartilhar os dados com a profissional responsável pelo atendimento.</li>
            </ul>
          </div>

          <p style={{ fontSize: 12, color: '#555' }}>
            Este consentimento é exigido pela <strong>LGPD (Lei 13.709/2018)</strong>. Você pode
            revogá-lo a qualquer momento entrando em contato com a profissional.
          </p>

          <p style={{ fontSize: 12, color: '#555' }}>
            Ao aceitar no formulário, você declara que leu, entendeu e concorda com o tratamento
            dos seus dados para as finalidades acima.
          </p>

          <div
            style={{
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              borderRadius: 10,
              padding: '12px 14px',
              marginTop: 16,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              fontSize: 12,
              color: '#166534',
            }}
          >
            <MdVerifiedUser size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Seus direitos:</strong> você pode solicitar acesso, correção, exclusão ou
              portabilidade dos seus dados a qualquer momento. Basta pedir à profissional.
            </div>
          </div>

          {mostrarPoliticaCompleta && (
            <div
              style={{
                marginTop: 18,
                padding: 16,
                background: '#faf5ff',
                border: '1.5px solid #d8b4fe',
                borderRadius: 10,
                fontSize: 12,
                color: '#333',
                lineHeight: 1.7,
              }}
            >
              <strong style={{ display: 'block', marginBottom: 8, color: '#7e22ce' }}>
                Mais detalhes:
              </strong>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>
                  <strong>Quem armazena:</strong> Samira Ferreira Estética & Cosmetologia (controladora);
                </li>
                <li>
                  <strong>Onde:</strong> Google Firebase (banco de dados) e Cloudinary (imagens) — ambos em conformidade com a LGPD;
                </li>
                <li>
                  <strong>Por quanto tempo:</strong> enquanto durar o relacionamento e pelos prazos legais aplicáveis (mínimo 5 anos para defesa em processos);
                </li>
                <li>
                  <strong>Com quem compartilha:</strong> apenas com a profissional responsável e os provedores técnicos (Firebase, Cloudinary, Netlify);
                </li>
                <li>
                  <strong>Como revogar:</strong> entre em contato por telefone/e-mail com a profissional para solicitar a exclusão dos dados.
                </li>
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMostrarPoliticaCompleta((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: '#7e22ce',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              padding: '12px 0 0 0',
              fontFamily: 'inherit',
            }}
          >
            {mostrarPoliticaCompleta ? 'Ocultar detalhes' : 'Ver mais detalhes da política'}
          </button>
        </div>

        {/* Rodapé */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1.5px solid #e2d2f5',
            display: 'flex',
            justifyContent: 'center',
            background: '#fafafc',
          }}
        >
          <button
            type="button"
            onClick={handleFechar}
            style={{
              fontFamily: "'Cinzel', serif",
              background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
              color: '#fff',
              border: '1.5px solid #9c7826',
              padding: '11px 32px',
              borderRadius: 24,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(200, 162, 74, 0.35)',
            }}
          >
            ENTENDI
          </button>
        </div>
      </div>
    </div>
  );
}