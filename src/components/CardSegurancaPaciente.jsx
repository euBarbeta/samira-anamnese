// src/components/CardSegurancaPaciente.jsx
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import {
  MdLocationOn, MdDevices, MdAccessTime, MdWarning,
  MdCheckCircle, MdLock,
} from 'react-icons/md';
import { rotuloStatusLocalizacao, corStatusLocalizacao } from '../utils/geolocalizacao';

export default function CardSegurancaPaciente({ pacienteId }) {
  const [estado, setEstado] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!pacienteId) return;
    const unsub = onSnapshot(
      doc(db, 'seguranca_estado', String(pacienteId)),
      (snap) => {
        setEstado(snap.exists() ? snap.data() : null);
        setCarregando(false);
      },
      (e) => {
        console.warn('Erro card segurança:', e);
        setCarregando(false);
      }
    );
    return () => unsub();
  }, [pacienteId]);

  if (carregando) return null;

  if (!estado) {
    return (
      <div style={cardVazio}>
        <MdLock size={16} color="#888" style={{ verticalAlign: 'middle', marginRight: 6 }} />
        <span style={{ fontSize: 11, color: '#888' }}>
          Sem dados de segurança ainda — o paciente precisa logar pelo menos uma vez.
        </span>
      </div>
    );
  }

  const corStatus = corStatusLocalizacao(estado.localizacaoStatus);

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <MdLock size={16} color="#7e22ce" />
        <span style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: 12, fontWeight: 700 }}>
          Estado de Segurança
        </span>
      </div>

      <div style={linha}>
        <MdLocationOn size={14} color={corStatus} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={labelMini}>Localização</div>
          <div style={{ ...valorMini, color: corStatus }}>
            {rotuloStatusLocalizacao(estado.localizacaoStatus)}
            {estado.cidade && (
              <span style={{ color: '#555', fontWeight: 500 }}>
                {' · '}{estado.cidade}{estado.pais ? `/${estado.pais}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={linha}>
        <MdDevices size={14} color="#7e22ce" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={labelMini}>Dispositivo atual</div>
          <div style={valorMini}>{estado.dispositivo || '—'}</div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
            {estado.plataforma === 'apk' ? '📱 App nativo' : '🌐 Navegador/PWA'}
          </div>
        </div>
      </div>

      <div style={linha}>
        <MdAccessTime size={14} color="#7e22ce" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={labelMini}>Última verificação</div>
          <div style={valorMini}>
            {estado.ultimaVerificacao
              ? new Date(estado.ultimaVerificacao).toLocaleString('pt-BR')
              : '—'}
          </div>
        </div>
      </div>

      {estado.trocouDispositivo && (
        <div style={avisoAmarelo}>
          <MdWarning size={14} color="#92400e" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>⚠️ Login de dispositivo novo</strong>
            <br />
            <span style={{ fontSize: 10 }}>
              Antes: {estado.dispositivoAnterior || '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const card = {
  marginTop: 15,
  background: 'rgba(255, 255, 255, 0.95)',
  padding: '14px 16px',
  borderRadius: 12,
  border: '1.5px solid #d8b4fe',
};

const cardVazio = {
  marginTop: 15,
  background: '#faf5ff',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1.5px dashed #d8b4fe',
  textAlign: 'center',
};

const linha = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  marginBottom: 10,
};

const labelMini = {
  fontSize: 9.5,
  fontWeight: 700,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  marginBottom: 2,
};

const valorMini = {
  fontSize: 12,
  fontWeight: 600,
  color: '#2c163a',
  wordBreak: 'break-word',
};

const avisoAmarelo = {
  marginTop: 10,
  padding: '10px 12px',
  background: '#fff8e1',
  border: '1.5px solid #fcd34d',
  borderRadius: 10,
  fontSize: 11,
  color: '#92400e',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  lineHeight: 1.5,
};