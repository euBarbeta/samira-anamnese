// src/components/agendamento/ModalConflitoServico.jsx
import React from 'react';
import {
  MdWarning, MdClose, MdCancel, MdRefresh, MdPhone, MdBadge, MdEmail,
  MdAccessTime,
} from 'react-icons/md';

/**
 * Mini-modal exibido quando a esteta tenta confirmar um serviço
 * mas já existe outro paciente agendado no intervalo.
 *
 * 3 ações:
 *  - CANCELAR ELE   → cancela o paciente impactado
 *  - REAGENDAR ELE  → abre o modal de agendar para o impacto
 *  - VOLTAR         → fecha o mini-modal, nada acontece
 */
export default function ModalConflitoServico({
  conflito,        // { nome, horaInicio, horaFim, telefone, documento, email, observacoes }
  servicoNome,
  servicoDuracao,
  inicioServico,
  fimServico,
  onCancelar,
  onReagendar,
  onVoltar,
}) {
  if (!conflito) return null;

  return (
    <div
      onClick={onVoltar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.78)',
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
          padding: '26px 24px 22px',
          maxWidth: 460,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.5)',
          border: '1.5px solid #fca5a5',
          fontFamily: "'Montserrat', sans-serif",
          position: 'relative',
        }}
      >
        {/* Botão X */}
        <button
          type="button"
          onClick={onVoltar}
          aria-label="Fechar"
          title="Fechar"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 34,
            height: 34,
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

        <div
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 14px auto',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fff8e1 0%, #fef3c7 100%)',
            border: '2px solid #fcd34d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MdWarning size={32} color="#92400e" />
        </div>

        <h3
          style={{
            fontFamily: "'Cinzel', serif",
            color: '#92400e',
            fontSize: 17,
            fontWeight: 700,
            margin: '0 0 8px 0',
            textAlign: 'center',
          }}
        >
          Conflito de horário
        </h3>

        <p
          style={{
            fontSize: 12.5,
            color: '#2c163a',
            margin: '0 0 16px 0',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          O serviço <strong>{servicoNome}</strong> ({servicoDuracao}min) vai de{' '}
          <strong>{inicioServico}</strong> até <strong>{fimServico}</strong>.
          <br />
          Mas já existe um paciente agendado nesse intervalo.
        </p>

        {/* Card do paciente em conflito */}
        <div
          style={{
            background: '#fff8e1',
            border: '1.5px solid #fcd34d',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: '#92400e',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              marginBottom: 8,
            }}
          >
            Paciente que será impactado
          </div>

          <div
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 13,
              fontWeight: 700,
              color: '#2c163a',
              marginBottom: 6,
            }}
          >
            {conflito.nome}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              color: '#555',
              marginBottom: 3,
            }}
          >
            <MdAccessTime size={13} color="#555" />
            <span>
              <strong>{conflito.horaInicio}</strong>
              {conflito.horaFim ? `–${conflito.horaFim}` : ''}
              {conflito.servicoNome ? ` · ${conflito.servicoNome}` : ''}
            </span>
          </div>

          {conflito.telefone && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                color: '#555',
                marginBottom: 3,
              }}
            >
              <MdPhone size={13} color="#555" />
              <span>{conflito.telefone}</span>
            </div>
          )}

          {conflito.documento && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                color: '#555',
                marginBottom: 3,
              }}
            >
              <MdBadge size={13} color="#555" />
              <span>{conflito.documento}</span>
            </div>
          )}

          {conflito.email && !conflito.email.endsWith('@sistema.local') && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                color: '#555',
                marginBottom: 3,
                wordBreak: 'break-all',
              }}
            >
              <MdEmail size={13} color="#555" style={{ flexShrink: 0 }} />
              <span>{conflito.email}</span>
            </div>
          )}
        </div>

        <p
          style={{
            fontSize: 12,
            color: '#666',
            margin: '0 0 16px 0',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          Para confirmar este serviço, é preciso resolver o conflito primeiro.
          Escolha uma das ações abaixo:
        </p>

        {/* Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={onCancelar}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
              color: '#fff',
              border: '1.5px solid #9c1c1c',
              padding: '13px 20px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Cinzel', serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(198, 40, 40, 0.35)',
            }}
          >
            <MdCancel size={16} />
            CANCELAR {conflito.nome.split(' ')[0].toUpperCase()}
          </button>

          <button
            type="button"
            onClick={onReagendar}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
              color: '#fff',
              border: '1.5px solid #1e40af',
              padding: '13px 20px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Cinzel', serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
            }}
          >
            <MdRefresh size={16} />
            REAGENDAR {conflito.nome.split(' ')[0].toUpperCase()}
          </button>

          <button
            type="button"
            onClick={onVoltar}
            style={{
              width: '100%',
              background: '#f0f0f0',
              color: '#333',
              border: 'none',
              padding: '13px 20px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Cinzel', serif",
            }}
          >
            VOLTAR SEM ALTERAR
          </button>
        </div>
      </div>
    </div>
  );
}