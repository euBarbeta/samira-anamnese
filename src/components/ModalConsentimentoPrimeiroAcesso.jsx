import React, { useState } from 'react';
import { MdLock, MdWarning } from 'react-icons/md';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import PoliticaPrivacidade from './PoliticaPrivacidade';

export default function ModalConsentimentoPrimeiroAcesso({
  pacienteData,
  onAceitar,
  onRecusar,
}) {
  const [aceito, setAceito] = useState(false);
  const [mostrarPolitica, setMostrarPolitica] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const handleAceitar = async () => {
    if (!aceito) {
      setErro('Você precisa marcar a caixa para continuar.');
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      const uidEsteticista = pacienteData.criadoPorUid;
      const pacienteId = pacienteData.id;

      if (!uidEsteticista || !pacienteId) {
        throw new Error('Dados do paciente incompletos.');
      }

      const consentimentoLGPD = {
        aceito: true,
        dataAceite: new Date().toISOString(),
        versaoTermo: '1.0',
        plataforma: detectarPlataforma(),
        userAgent: (navigator.userAgent || '').slice(0, 200),
      };

      await updateDoc(
        doc(db, `usuarios/${uidEsteticista}/pacientes`, String(pacienteId)),
        { consentimentoLGPD }
      );

      onAceitar?.(consentimentoLGPD);
    } catch (err) {
      console.error('Erro ao salvar consentimento:', err);
      setErro('Não foi possível salvar seu consentimento. Verifique sua conexão e tente novamente.');
      setSalvando(false);
    }
  };

  return (
    <>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483646,
        background: 'rgba(44, 22, 58, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '20px',
          padding: 0,
          maxWidth: '540px',
          width: '100%',
          maxHeight: '92vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.45)',
          border: '1.5px solid #C8A24A',
          fontFamily: "'Montserrat', sans-serif",
        }}>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600&display=swap');
            .consent-scroll::-webkit-scrollbar { width: 8px; }
            .consent-scroll::-webkit-scrollbar-track { background: #f3eef8; }
            .consent-scroll::-webkit-scrollbar-thumb { background: #C8A24A; border-radius: 4px; }
          `}</style>

          {/* Cabeçalho */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1.5px solid #e2d2f5',
            background: 'linear-gradient(135deg, rgba(200, 162, 74, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
            textAlign: 'center',
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              margin: '0 auto 12px auto',
              background: 'linear-gradient(135deg, #fdf4ff 0%, #f5e6ff 100%)',
              border: '2px solid #C8A24A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MdLock size={28} color="#a855f7" />
            </div>
            <h2 style={{
              fontFamily: "'Cinzel', serif",
              color: '#2c163a',
              fontSize: '17px',
              margin: 0,
              letterSpacing: '0.3px',
            }}>
              Bem-vindo(a)! Antes de continuar...
            </h2>
          </div>

          {/* Corpo */}
          <div className="consent-scroll" style={{
            padding: '22px 26px',
            overflowY: 'auto',
            fontSize: '13px',
            color: '#333',
            lineHeight: 1.6,
          }}>
            <p style={{ marginTop: 0 }}>
              Olá, <strong>{pacienteData?.nome || 'paciente'}</strong>! Para acessar seu prontuário,
              precisamos do seu <strong>consentimento para tratamento dos seus dados</strong>.
            </p>

            <p>
              Isso é exigido pela <strong>LGPD (Lei 13.709/2018)</strong> — especialmente porque
              sua ficha contém <strong>dados sensíveis de saúde</strong> (alergias, medicações,
              condições clínicas) e <strong>imagens</strong>.
            </p>

            <div style={{
              background: 'rgba(200, 162, 74, 0.08)',
              border: '1.5px dashed #C8A24A',
              borderRadius: '10px',
              padding: '14px 16px',
              fontSize: '12px',
              color: '#55286f',
              marginBottom: '18px',
            }}>
              <strong>O que você autoriza:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: 1.8 }}>
                <li>Guardar seus dados pessoais e de saúde</li>
                <li>Armazenar fotos de acompanhamento</li>
                <li>Enviar lembretes de tratamento via notificação</li>
              </ul>
            </div>

            <p style={{ fontSize: '12px', color: '#666' }}>
              Você pode <strong>revogar este consentimento a qualquer momento</strong> através do
              botão "Excluir minha conta" no painel. Todos os seus dados serão permanentemente
              removidos.
            </p>

            {/* Checkbox */}
            <label style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              padding: '14px',
              background: aceito ? 'rgba(200, 162, 74, 0.10)' : 'rgba(0,0,0,0.02)',
              border: `2px solid ${aceito ? '#C8A24A' : '#ddd'}`,
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginTop: '6px',
            }}>
              <input
                type="checkbox"
                checked={aceito}
                onChange={(e) => { setAceito(e.target.checked); setErro(''); }}
                style={{
                  marginTop: '3px',
                  width: '20px',
                  height: '20px',
                  accentColor: '#C8A24A',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
              <span style={{
                fontSize: '12px',
                color: '#2c163a',
                lineHeight: 1.6,
                fontWeight: 500,
              }}>
                Li e <strong>autorizo</strong> o tratamento dos meus dados pessoais e de saúde para
                fins de procedimentos estéticos, conforme a{' '}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMostrarPolitica(true); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#7e22ce',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: 0,
                    fontFamily: 'inherit',
                  }}
                >
                  Política de Privacidade
                </button>
                {' '}(v1.0).
              </span>
            </label>

            {erro && (
              <div style={{
                marginTop: '12px',
                background: '#fde8e8',
                border: '1px solid #f98080',
                color: '#c81e1e',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
              }}>
                {erro}
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div style={{
            padding: '18px 24px',
            borderTop: '1.5px solid #e2d2f5',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            <button
              type="button"
              onClick={handleAceitar}
              disabled={salvando || !aceito}
              style={{
                fontFamily: "'Cinzel', serif",
                background: aceito
                  ? 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)'
                  : 'linear-gradient(135deg, #ddd 0%, #ccc 100%)',
                color: aceito ? '#fff' : '#888',
                border: aceito ? '1.5px solid #9c7826' : '1.5px solid #bbb',
                padding: '14px 24px',
                borderRadius: '26px',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '1px',
                cursor: aceito && !salvando ? 'pointer' : 'not-allowed',
                boxShadow: aceito ? '0 4px 15px rgba(200, 162, 74, 0.4)' : 'none',
                transition: 'all 0.25s ease',
                opacity: salvando ? 0.7 : 1,
              }}
            >
              {salvando ? 'SALVANDO...' : 'ACEITO E AUTORIZO'}
            </button>

            <button
              type="button"
              onClick={onRecusar}
              disabled={salvando}
              style={{
                fontFamily: "'Montserrat', sans-serif",
                background: 'transparent',
                color: '#888',
                border: 'none',
                padding: '6px',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                textDecoration: 'underline',
                opacity: salvando ? 0.5 : 1,
              }}
            >
              Não aceito — sair
            </button>
          </div>
        </div>
      </div>

      {mostrarPolitica && (
        <PoliticaPrivacidade onFechar={() => setMostrarPolitica(false)} />
      )}
    </>
  );
}

function detectarPlataforma() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (/Android/i.test(ua) && !/wv/i.test(ua)) return 'android-app';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios-app';
  if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)')?.matches) return 'pwa';
  return 'web';
}