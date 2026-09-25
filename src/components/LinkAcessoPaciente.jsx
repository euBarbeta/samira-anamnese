// src/components/LinkAcessoPaciente.jsx
import React, { useState } from 'react';
import { MdContentCopy, MdCheck, MdLink } from 'react-icons/md';

/**
 * Link de acesso do paciente ao prontuário.
 *
 * Props:
 *  - pacienteId: string  (obrigatório)
 *  - compacto:   boolean (opcional) → versão pequena, pra lista de pastas
 */
export default function LinkAcessoPaciente({ pacienteId, compacto = false }) {
  const [copiado, setCopiado] = useState(false);

  const url = `${window.location.origin}/#${pacienteId}`;

  const copiar = async (e) => {
    // Impede que o clique propague pro card pai (que abriria a pasta)
    e?.stopPropagation?.();

    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch (err) {
      // Fallback para navegadores antigos
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    }
  };

  const abrirWhatsApp = (e) => {
    e?.stopPropagation?.();
    const msg = encodeURIComponent(
      `Olá! Aqui está seu link de acesso ao prontuário:\n\n${url}\n\nGuarde este link — ele é pessoal e intransferível.`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  // ============================================================
  // MODO COMPACTO (pra lista de pastas)
  // ============================================================
  if (compacto) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 6,
          padding: '4px 6px',
          background: 'rgba(219, 234, 254, 0.5)',
          border: '1px solid #93c5fd',
          borderRadius: 6,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <MdLink size={11} color="#1e40af" style={{ flexShrink: 0 }} />

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={url}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 9,
            color: '#1e40af',
            textDecoration: 'underline',
            fontWeight: 600,
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {url}
        </a>

        <button
          type="button"
          onClick={copiar}
          title={copiado ? 'Copiado!' : 'Copiar link'}
          style={{
            background: copiado ? '#16a34a' : '#1e40af',
            color: '#fff',
            border: 'none',
            padding: '3px 6px',
            borderRadius: 4,
            fontSize: 9,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexShrink: 0,
            transition: 'all 0.2s ease',
          }}
        >
          {copiado ? <MdCheck size={10} /> : <MdContentCopy size={10} />}
        </button>

        <button
          type="button"
          onClick={abrirWhatsApp}
          title="Enviar por WhatsApp"
          style={{
            background: '#25D366',
            color: '#fff',
            border: 'none',
            padding: '3px 6px',
            borderRadius: 4,
            fontSize: 8,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          WA
        </button>
      </div>
    );
  }

  // ============================================================
  // MODO COMPLETO (pra tela de detalhe da pasta)
  // ============================================================
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        padding: '10px 12px',
        background: 'rgba(219, 234, 254, 0.5)',
        border: '1px solid #93c5fd',
        borderRadius: 10,
        maxWidth: 620,
      }}
    >
      <MdLink size={16} color="#1e40af" style={{ flexShrink: 0 }} />

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          flex: 1,
          fontSize: 11,
          color: '#1e40af',
          textDecoration: 'underline',
          fontWeight: 600,
          wordBreak: 'break-all',
          fontFamily: 'monospace',
        }}
      >
        {url}
      </a>

      <button
        type="button"
        onClick={copiar}
        title="Copiar link"
        style={{
          background: copiado ? '#16a34a' : '#1e40af',
          color: '#fff',
          border: 'none',
          padding: '6px 10px',
          borderRadius: 8,
          fontSize: 10,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
          transition: 'all 0.2s ease',
        }}
      >
        {copiado ? <><MdCheck size={12} /> Copiado</> : <><MdContentCopy size={12} /> Copiar</>}
      </button>

      <button
        type="button"
        onClick={abrirWhatsApp}
        title="Enviar via WhatsApp"
        style={{
          background: '#25D366',
          color: '#fff',
          border: 'none',
          padding: '6px 10px',
          borderRadius: 8,
          fontSize: 10,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        WhatsApp
      </button>
    </div>
  );
}