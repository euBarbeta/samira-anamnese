// src/components/ModalConsentimentoLocalizacao.jsx
import React, { useState } from 'react';
import { MdLocationOn, MdWarning } from 'react-icons/md';
import { atualizarEstadoSeguranca } from '../utils/segurancaEstado';

export default function ModalConsentimentoLocalizacao({ pacienteId, onFinalizar }) {
  const [processando, setProcessando] = useState(false);
  const [mostrarAviso, setMostrarAviso] = useState(false);

  const handleAutorizar = async () => {
    setProcessando(true);
    try {
      // Tenta pegar a localização
      const resultado = await atualizarEstadoSeguranca(pacienteId, {
        incluirLocalizacao: true,
      });

      if (resultado?.localizacaoStatus === 'ativa') {
        onFinalizar({ autorizou: true, status: 'ativa' });
      } else {
        // Usuário autorizou o modal mas o navegador negou → mostra aviso
        setMostrarAviso(true);
        setProcessando(false);
      }
    } catch (e) {
      setMostrarAviso(true);
      setProcessando(false);
    }
  };

  const handleNegar = async () => {
    setProcessando(true);
    try {
      await atualizarEstadoSeguranca(pacienteId, { incluirLocalizacao: false });
    } catch (e) {
      console.warn(e);
    }
    // Salva localizacaoStatus como negada
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      await setDoc(
        doc(db, 'seguranca_estado', String(pacienteId)),
        {
          localizacaoStatus: 'negada',
          pacienteId: String(pacienteId),
          atualizadoEm: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {}

    setProcessando(false);
    setMostrarAviso(true);
  };

  const confirmarAviso = () => {
    setMostrarAviso(false);
    onFinalizar({ autorizou: false, status: 'negada' });
  };

  // ============================================================
  // TELA DE AVISO PÓS-NEGAÇÃO
  // ============================================================
  if (mostrarAviso) {
    return (
      <div style={overlay}>
        <div style={{ ...card, borderColor: '#fcd34d' }}>
          <div style={{
            width: 68, height: 68, margin: '0 auto 16px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fff8e1 0%, #fef3c7 100%)',
            border: '2px solid #fcd34d',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MdWarning size={34} color="#92400e" />
          </div>

          <h3 style={titulo}>Entendido</h3>
          <p style={texto}>
            Sua localização <strong>não será compartilhada</strong>.
            <br /><br />
            A profissional vai ver que você optou por não compartilhar. Se um dia
            aparecer um acesso suspeito, ela poderá entrar em contato pra confirmar
            se foi você.
            <br /><br />
            Você pode autorizar depois nas configurações do seu celular e recarregando o app.
          </p>

          <button type="button" onClick={confirmarAviso} style={botaoPrimario}>
            ENTENDI
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // TELA PRINCIPAL
  // ============================================================
  return (
    <div style={overlay}>
      <div style={card}>
        <div style={{
          width: 68, height: 68, margin: '0 auto 16px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #fdf4ff 0%, #f5e6ff 100%)',
          border: '2px solid #a855f7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MdLocationOn size={34} color="#a855f7" />
        </div>

        <h3 style={titulo}>Autorizar localização?</h3>

        <p style={texto}>
          Isso ajuda a profissional a confirmar que é <strong>você</strong> em caso
          de acesso suspeito à sua conta.
          <br /><br />
          Registramos apenas a <strong>cidade aproximada</strong> no momento do login.
          Nunca rastreamos em tempo real.
        </p>

        <div style={{
          background: '#f0fdf4',
          border: '1.5px solid #86efac',
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 11.5,
          color: '#166534',
          marginBottom: 16,
          textAlign: 'left',
          lineHeight: 1.6,
        }}>
          ✅ <strong>Opcional.</strong> Se você negar, o app funciona normalmente.
          Você só vai receber um aviso lembrando que a profissional saberá da sua escolha.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={handleAutorizar}
            disabled={processando}
            style={botaoPrimario}
          >
            {processando ? 'PROCESSANDO…' : 'AUTORIZAR LOCALIZAÇÃO'}
          </button>

          <button
            type="button"
            onClick={handleNegar}
            disabled={processando}
            style={botaoSecundario}
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(44, 22, 58, 0.75)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 2147483646,
  padding: 20,
  boxSizing: 'border-box',
};

const card = {
  background: '#fff',
  borderRadius: 20,
  padding: '30px 26px 22px',
  maxWidth: 420,
  width: '100%',
  boxShadow: '0 25px 70px rgba(44, 22, 58, 0.5)',
  border: '1.5px solid #C8A24A',
  fontFamily: "'Montserrat', sans-serif",
  textAlign: 'center',
};

const titulo = {
  fontFamily: "'Cinzel', serif",
  color: '#2c163a',
  fontSize: 17,
  fontWeight: 700,
  margin: '0 0 12px',
};

const texto = {
  fontSize: 13,
  color: '#555',
  lineHeight: 1.6,
  margin: '0 0 18px',
};

const botaoPrimario = {
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
};

const botaoSecundario = {
  width: '100%',
  fontFamily: "'Montserrat', sans-serif",
  background: 'transparent',
  color: '#888',
  border: 'none',
  padding: '10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'underline',
};