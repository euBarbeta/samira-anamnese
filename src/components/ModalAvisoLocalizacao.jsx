// src/components/ModalAvisoLocalizacao.jsx
import React from 'react';
import { MdLocationOff, MdLocationOn, MdWarning, MdClose } from 'react-icons/md';

/**
 * Modal que avisa o paciente quando o GPS é desligado
 * ou a permissão de localização é revogada.
 *
 * Props:
 *  - tipo: 'gps_desligado' | 'negada' | 'reativada'
 *  - onFechar: () => void
 *  - onAbrirConfiguracoes: () => void  (opcional — abre config do device)
 */
export default function ModalAvisoLocalizacao({
  tipo,
  onFechar,
  onAbrirConfiguracoes,
}) {
  // ============================================================
  // Config visual por tipo
  // ============================================================
  const config = {
    gps_desligado: {
      icone: MdLocationOff,
      corIcone: '#92400e',
      bgIcone: 'linear-gradient(135deg, #fff8e1 0%, #fef3c7 100%)',
      bordaIcone: '#fcd34d',
      titulo: 'GPS desligado',
      corTitulo: '#92400e',
      descricao:
        'Sua localização parou de ser compartilhada porque o GPS foi desligado. ' +
        'A profissional não conseguirá te avisar sobre acessos suspeitos à sua conta.',
      dica: 'Ative o GPS nas configurações rápidas do celular (deslize a barra de notificações).',
      textoBotao: 'ENTENDI',
    },
    negada: {
      icone: MdLocationOff,
      corIcone: '#991b1b',
      bgIcone: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
      bordaIcone: '#fca5a5',
      titulo: 'Localização desativada',
      corTitulo: '#991b1b',
      descricao:
        'Você revogou a permissão de localização. A profissional não verá mais ' +
        'sua cidade aproximada e perderá a proteção contra acessos suspeitos.',
      dica: 'Se quiser ativar de novo, vá em Configurações do celular → Aplicativos → Samira Estética → Permissões → Localização.',
      textoBotao: 'ENTENDI',
    },
    reativada: {
      icone: MdLocationOn,
      corIcone: '#166534',
      bgIcone: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      bordaIcone: '#86efac',
      titulo: 'Localização reativada',
      corTitulo: '#166534',
      descricao:
        'Sua localização aproximada voltou a ser compartilhada com a profissional. ' +
        'Isso ajuda a proteger sua conta contra acessos suspeitos.',
      dica: null,
      textoBotao: 'OK',
    },
  }[tipo] || {
    icone: MdWarning,
    corIcone: '#92400e',
    bgIcone: 'linear-gradient(135deg, #fff8e1 0%, #fef3c7 100%)',
    bordaIcone: '#fcd34d',
    titulo: 'Aviso de localização',
    corTitulo: '#92400e',
    descricao: 'Houve uma mudança no estado da sua localização.',
    dica: null,
    textoBotao: 'ENTENDI',
  };

  const Icone = config.icone;

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.75)',
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
          padding: '28px 24px 22px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.5)',
          border: `1.5px solid ${config.bordaIcone}`,
          fontFamily: "'Montserrat', sans-serif",
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Botão X */}
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888',
          }}
        >
          <MdClose size={20} />
        </button>

        {/* Ícone */}
        <div
          style={{
            width: 68,
            height: 68,
            margin: '0 auto 16px auto',
            borderRadius: '50%',
            background: config.bgIcone,
            border: `2px solid ${config.bordaIcone}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icone size={34} color={config.corIcone} />
        </div>

        {/* Título */}
        <h3
          style={{
            fontFamily: "'Cinzel', serif",
            color: config.corTitulo,
            fontSize: 17,
            fontWeight: 700,
            margin: '0 0 12px 0',
          }}
        >
          {config.titulo}
        </h3>

        {/* Descrição */}
        <p
          style={{
            fontSize: 13,
            color: '#2c163a',
            margin: '0 0 16px 0',
            lineHeight: 1.6,
          }}
        >
          {config.descricao}
        </p>

        {/* Dica */}
        {config.dica && (
          <div
            style={{
              background: config.bgIcone,
              border: `1px solid ${config.bordaIcone}`,
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 11.5,
              color: config.corTitulo,
              textAlign: 'left',
              lineHeight: 1.5,
              marginBottom: 18,
            }}
          >
            💡 {config.dica}
          </div>
        )}

        {/* Botão confirmar */}
        <button
          type="button"
          onClick={onFechar}
          style={{
            width: '100%',
            fontFamily: "'Cinzel', serif",
            background:
              tipo === 'reativada'
                ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)'
                : 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
            color: '#fff',
            border:
              tipo === 'reativada'
                ? '1.5px solid #15803d'
                : '1.5px solid #9c7826',
            padding: '13px 20px',
            borderRadius: 22,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.5px',
            boxShadow:
              tipo === 'reativada'
                ? '0 4px 14px rgba(22, 163, 74, 0.35)'
                : '0 4px 14px rgba(200, 162, 74, 0.35)',
          }}
        >
          {config.textoBotao}
        </button>

        {/* Botão "abrir configurações" (só quando GPS desligado/permissão negada) */}
        {(tipo === 'gps_desligado' || tipo === 'negada') && onAbrirConfiguracoes && (
          <button
            type="button"
            onClick={() => {
              onAbrirConfiguracoes();
              onFechar();
            }}
            style={{
              width: '100%',
              fontFamily: "'Montserrat', sans-serif",
              background: 'transparent',
              color: '#7e22ce',
              border: 'none',
              padding: '10px',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              marginTop: 8,
            }}
          >
            Abrir configurações do celular
          </button>
        )}
      </div>
    </div>
  );
}