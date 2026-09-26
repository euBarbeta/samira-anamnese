// src/components/LinkAcessoPaciente.jsx
import React, { useState } from 'react';
import { MdContentCopy, MdCheck, MdLink } from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';

/**
 * Link de acesso do paciente ao prontuário.
 *
 * Props:
 *  - pacienteId: string  (obrigatório)
 *  - compacto:   boolean (opcional) → versão pequena, pra lista de pastas
 *  - empilhado:  boolean (opcional) → link em cima, botões embaixo (mobile)
 */
export default function LinkAcessoPaciente({
  pacienteId,
  compacto = false,
  empilhado = false,
}) {
  const [copiado, setCopiado] = useState(false);

  const url = `${window.location.origin}/#${pacienteId}`;

  const copiar = async (e) => {
    e?.stopPropagation?.();

    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch (err) {
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
    // ✅ Versão empilhada — mobile
    if (empilhado) {
      return (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            marginTop: 8,
            padding: '8px 10px',
            background: 'rgba(219, 234, 254, 0.5)',
            border: '1px solid #93c5fd',
            borderRadius: 8,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <MdLink size={12} color="#1e40af" style={{ flexShrink: 0, marginTop: 2 }} />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={url}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 10,
                color: '#1e40af',
                textDecoration: 'underline',
                fontWeight: 600,
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                lineHeight: 1.4,
              }}
            >
              {url}
            </a>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={copiar}
              title={copiado ? 'Copiado!' : 'Copiar link'}
              style={{
                flex: 1,
                background: copiado ? '#16a34a' : '#1e40af',
                color: '#fff',
                border: 'none',
                padding: '6px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                transition: 'all 0.2s ease',
              }}
            >
              {copiado
                ? <><MdCheck size={11} /> Copiado</>
                : <><MdContentCopy size={11} /> Copiar</>}
            </button>

            <button
              type="button"
              onClick={abrirWhatsApp}
              title="Enviar por WhatsApp"
              style={{
                flex: 1,
                background: '#25D366',
                color: '#fff',
                border: 'none',
                padding: '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              <FaWhatsapp size={12} /> WhatsApp
            </button>
          </div>
        </div>
      );
    }

    // ✅ Versão inline (desktop) — layout original intacto
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
            padding: '3px 5px',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FaWhatsapp size={13} />
        </button>
      </div>
    );
  }

  // ============================================================
  // MODO COMPLETO (detalhe da pasta)
  // ============================================================
  // ✅ Versão empilhada — mobile
  if (empilhado) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 10,
          padding: '12px 14px',
          background: 'rgba(219, 234, 254, 0.5)',
          border: '1px solid #93c5fd',
          borderRadius: 10,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <MdLink size={16} color="#1e40af" style={{ flexShrink: 0, marginTop: 3 }} />
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
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              lineHeight: 1.5,
            }}
          >
            {url}
          </a>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={copiar}
            style={{
              flex: 1,
              background: copiado ? '#16a34a' : '#1e40af',
              color: '#fff',
              border: 'none',
              padding: '9px 12px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              transition: 'all 0.2s ease',
            }}
          >
            {copiado
              ? <><MdCheck size={13} /> Copiado</>
              : <><MdContentCopy size={13} /> Copiar</>}
          </button>

          <button
            type="button"
            onClick={abrirWhatsApp}
            style={{
              flex: 1,
              background: '#25D366',
              color: '#fff',
              border: 'none',
              padding: '9px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <FaWhatsapp size={14} /> WhatsApp
          </button>
        </div>
      </div>
    );
  }

  // ✅ Versão inline (desktop) — layout original intacto
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
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        <FaWhatsapp size={14} />
        WhatsApp
      </button>
    </div>
  );
}