// src/components/financeiro/ModalRegistrarReceita.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MdClose, MdAttachMoney, MdCheckCircle, MdWarning,
  MdTrendingUp, MdTrendingDown, MdPayment,
} from 'react-icons/md';
import ModalBase from './ModalBase';

function formatarMoeda(valor) {
  const num = Number(valor) || 0;
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMoeda(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const limpo = String(str).replace(/[^\d.,]/g, '');
  if (!limpo) return 0;
  const normalizado = limpo.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalizado);
  return isNaN(num) ? 0 : num;
}

function formatarDataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export default function ModalRegistrarReceita({
  agendamento,
  onFechar,
  onConfirmar,
}) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 640 : false
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const precoOriginal = useMemo(() => {
    const p = Number(agendamento?.precoServico || 0);
    return p > 0 ? p : 0;
  }, [agendamento]);

  const [valorFinal, setValorFinal] = useState(precoOriginal);
  const [percentual, setPercentual] = useState(0);
  const [modoAjuste, setModoAjuste] = useState('desconto');
  const [inputValorStr, setInputValorStr] = useState(
    precoOriginal > 0 ? formatarMoeda(precoOriginal) : ''
  );
  const [inputPercentStr, setInputPercentStr] = useState('0');
  const [formaPagamento, setFormaPagamento] = useState('Pix');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const ultimoEditadoRef = useRef(null);

  useEffect(() => {
    if (ultimoEditadoRef.current === 'valor') {
      if (precoOriginal <= 0) {
        setPercentual(0);
        return;
      }
      const diff = valorFinal - precoOriginal;
      const pct = (diff / precoOriginal) * 100;
      setPercentual(Number(pct.toFixed(2)));
      setInputPercentStr(Math.abs(pct).toFixed(2).replace('.', ','));
      if (diff < 0) setModoAjuste('desconto');
      else if (diff > 0) setModoAjuste('acrescimo');
    } else if (ultimoEditadoRef.current === 'percent') {
      if (precoOriginal <= 0) {
        setValorFinal(0);
        setInputValorStr('');
        return;
      }
      const sinal = modoAjuste === 'desconto' ? -1 : 1;
      const novoValor = precoOriginal + (sinal * precoOriginal * percentual) / 100;
      const valorSeguro = Math.max(0, novoValor);
      setValorFinal(Number(valorSeguro.toFixed(2)));
      setInputValorStr(formatarMoeda(valorSeguro));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorFinal, percentual, modoAjuste, precoOriginal]);

  const handleValorChange = (e) => {
    const raw = e.target.value;
    if (raw.startsWith('-')) return;
    setInputValorStr(raw);
    const num = parseMoeda(raw);
    const maximo = Math.max(precoOriginal * 2, 999999);
    const seguro = Math.min(Math.max(0, num), maximo);
    ultimoEditadoRef.current = 'valor';
    setValorFinal(seguro);
    setErro('');
  };

  const handleValorBlur = () => {
    setInputValorStr(valorFinal > 0 ? formatarMoeda(valorFinal) : '');
  };

  const handlePercentChange = (e) => {
    const raw = e.target.value;
    if (raw.startsWith('-')) return;
    setInputPercentStr(raw);
    const num = parseMoeda(raw);
    const seguro = Math.min(Math.max(0, num), 100);
    ultimoEditadoRef.current = 'percent';
    setPercentual(seguro);
    setErro('');
  };

  const handlePercentBlur = () => {
    setInputPercentStr(percentual.toFixed(2).replace('.', ','));
  };

  const handleToggleModo = (novoModo) => {
    setModoAjuste(novoModo);
    ultimoEditadoRef.current = 'percent';
  };

  const handleConfirmar = async () => {
    setErro('');

    if (valorFinal < 0) {
      setErro('Valor não pode ser negativo.');
      return;
    }

    setSalvando(true);
    try {
      await onConfirmar({
        valor: Number(valorFinal.toFixed(2)),
        valorOriginal: Number(precoOriginal.toFixed(2)),
        descontoPercent:
          modoAjuste === 'desconto' && percentual > 0
            ? Number(percentual.toFixed(2))
            : 0,
        acrescimoPercent:
          modoAjuste === 'acrescimo' && percentual > 0
            ? Number(percentual.toFixed(2))
            : 0,
        formaPagamento,
        observacao: observacao.trim() || null,
      });
    } catch (e) {
      console.error('Erro ao registrar receita:', e);
      setErro('Erro ao salvar. Tente novamente.');
      setSalvando(false);
    }
  };

  const diffAbsoluto = Math.abs(valorFinal - precoOriginal);
  const temAjuste = diffAbsoluto > 0.009 && percentual > 0;

  const corDiferenca =
    modoAjuste === 'desconto' && temAjuste ? '#c62828'
    : modoAjuste === 'acrescimo' && temAjuste ? '#166534'
    : '#888';

  const IconeDiferenca =
    modoAjuste === 'desconto' ? MdTrendingDown : MdTrendingUp;

  return (
    <ModalBase
      onFechar={onFechar}
      bloquearFechar={salvando}
      isMobile={isMobile}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '18px 18px 14px' : '24px 24px 16px',
        gap: 10,
        borderBottom: '1px solid #f0f0f0',
        flexShrink: 0,
      }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{
            fontFamily: "'Cinzel', serif",
            color: '#2c163a',
            fontSize: isMobile ? 15 : 16,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <MdAttachMoney size={18} color="#C8A24A" />
            Registrar Receita
          </h3>
          <span style={{ fontSize: 11, color: '#666' }}>
            {agendamento?.nome} · {formatarDataBR(agendamento?.data)} às {agendamento?.horaInicio}
          </span>
        </div>
        <button
          type="button"
          onClick={onFechar}
          disabled={salvando}
          aria-label="Fechar"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: salvando ? 'not-allowed' : 'pointer',
            padding: 4,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888',
            flexShrink: 0,
          }}
        >
          <MdClose size={22} />
        </button>
      </div>

      {/* Conteúdo rolável */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: isMobile ? '16px 18px' : '20px 24px',
      }}>
        {/* Serviço + Preço original */}
        <div style={{
          background: '#faf5ff',
          border: '1px solid #e2d2f5',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: '#7e22ce',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            marginBottom: 6,
          }}>
            Serviço
          </div>
          <div style={{
            fontFamily: "'Cinzel', serif",
            color: '#2c163a',
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 6,
          }}>
            {agendamento?.servicoNome || 'Serviço não definido'}
          </div>
          <div style={{ fontSize: 11.5, color: '#666' }}>
            Preço original:{' '}
            <strong style={{ color: '#2c163a', fontSize: 13 }}>
              R$ {formatarMoeda(precoOriginal)}
            </strong>
          </div>
        </div>

        {/* Valor final */}
        <label style={labelEstilo}>Valor final recebido (R$)</label>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
        }}>
          <span style={{
            fontFamily: "'Cinzel', serif",
            color: '#2c163a',
            fontSize: 18,
            fontWeight: 700,
          }}>
            R$
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={inputValorStr}
            onChange={handleValorChange}
            onBlur={handleValorBlur}
            onKeyDown={(e) => {
              if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                e.preventDefault();
              }
            }}
            disabled={salvando}
            placeholder="0,00"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: isMobile ? 20 : 22,
              fontWeight: 700,
              color: '#2c163a',
              fontFamily: "'Cinzel', serif",
              padding: '10px 12px',
              border: '2px solid #C8A24A',
              borderRadius: 10,
              outline: 'none',
              background: '#fff',
              textAlign: 'right',
              WebkitAppearance: 'none',
              appearance: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Toggle Desconto / Acréscimo */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 10,
        }}>
          <button
            type="button"
            onClick={() => handleToggleModo('desconto')}
            disabled={salvando}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 20,
              border: `1.5px solid ${modoAjuste === 'desconto' ? '#c62828' : '#e0e0e0'}`,
              background: modoAjuste === 'desconto' ? '#fef2f2' : '#fff',
              color: modoAjuste === 'desconto' ? '#c62828' : '#888',
              fontFamily: "'Cinzel', serif",
              fontSize: 11,
              fontWeight: 700,
              cursor: salvando ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'all 0.15s',
            }}
          >
            <MdTrendingDown size={14} />
            Desconto −
          </button>
          <button
            type="button"
            onClick={() => handleToggleModo('acrescimo')}
            disabled={salvando}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 20,
              border: `1.5px solid ${modoAjuste === 'acrescimo' ? '#166534' : '#e0e0e0'}`,
              background: modoAjuste === 'acrescimo' ? '#f0fdf4' : '#fff',
              color: modoAjuste === 'acrescimo' ? '#166534' : '#888',
              fontFamily: "'Cinzel', serif",
              fontSize: 11,
              fontWeight: 700,
              cursor: salvando ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'all 0.15s',
            }}
          >
            <MdTrendingUp size={14} />
            Acréscimo +
          </button>
        </div>

        {/* % */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#2c163a',
            whiteSpace: 'nowrap',
          }}>
            {modoAjuste === 'desconto' ? '% de desconto:' : '% de acréscimo:'}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={inputPercentStr}
            onChange={handlePercentChange}
            onBlur={handlePercentBlur}
            onKeyDown={(e) => {
              if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                e.preventDefault();
              }
            }}
            disabled={salvando || precoOriginal <= 0}
            placeholder="0"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 14,
              fontWeight: 700,
              color: modoAjuste === 'desconto' ? '#c62828' : '#166534',
              padding: '8px 12px',
              border: `1.5px solid ${modoAjuste === 'desconto' ? '#fca5a5' : '#86efac'}`,
              borderRadius: 8,
              outline: 'none',
              background: '#fff',
              textAlign: 'right',
              WebkitAppearance: 'none',
              appearance: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            color: modoAjuste === 'desconto' ? '#c62828' : '#166534',
          }}>
            %
          </span>
        </div>

        {/* Preview */}
        {temAjuste && (
          <div style={{
            background: modoAjuste === 'desconto' ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${modoAjuste === 'desconto' ? '#fca5a5' : '#86efac'}`,
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: corDiferenca,
            fontWeight: 600,
          }}>
            <IconeDiferenca size={16} color={corDiferenca} style={{ flexShrink: 0 }} />
            <span style={{ minWidth: 0 }}>
              {modoAjuste === 'desconto' ? 'Desconto' : 'Acréscimo'} de{' '}
              <strong>R$ {formatarMoeda(diffAbsoluto)}</strong>{' '}
              ({percentual.toFixed(2).replace('.', ',')}%)
            </span>
          </div>
        )}

        {/* Forma de pagamento */}
        <label style={labelEstilo}>Forma de pagamento</label>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
        }}>
          <MdPayment size={16} color="#C8A24A" style={{ flexShrink: 0 }} />
          <select
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
            disabled={salvando}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '10px 12px',
              border: '1.5px solid #d8b4fe',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              color: '#2c163a',
              outline: 'none',
              background: '#fff',
              fontFamily: "'Montserrat', sans-serif",
              WebkitAppearance: 'none',
              appearance: 'none',
              boxSizing: 'border-box',
            }}
          >
            <option value="Pix">Pix</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="Cartão de Débito">Cartão de Débito</option>
            <option value="Cartão de Crédito">Cartão de Crédito</option>
            <option value="Boleto">Boleto</option>
            <option value="Transferência">Transferência</option>
            <option value="Outro">Outro</option>
          </select>
        </div>

        {/* Observação */}
        <label style={labelEstilo}>Observação (opcional)</label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={2}
          disabled={salvando}
          placeholder="Ex: paciente pagou metade em dinheiro..."
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1.5px solid #d8b4fe',
            borderRadius: 10,
            fontSize: 13,
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: "'Montserrat', sans-serif",
            color: '#2c163a',
            minHeight: 60,
            marginBottom: 14,
          }}
        />

        {/* Erro */}
        {erro && (
          <div style={{
            background: '#fde8e8',
            border: '1px solid #f98080',
            color: '#c81e1e',
            padding: '9px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <MdWarning size={16} />
            {erro}
          </div>
        )}
      </div>

      {/* Botões */}
      <div style={{
        display: 'flex',
        gap: 10,
        padding: isMobile ? '12px 18px 18px' : '14px 24px 20px',
        borderTop: '1px solid #f0f0f0',
        flexShrink: 0,
        background: '#fff',
      }}>
        <button
          type="button"
          onClick={onFechar}
          disabled={salvando}
          style={{
            flex: 1,
            background: '#f0f0f0',
            color: '#333',
            border: 'none',
            padding: '14px 20px',
            borderRadius: 22,
            fontSize: 12,
            fontWeight: 700,
            cursor: salvando ? 'not-allowed' : 'pointer',
            fontFamily: "'Cinzel', serif",
            opacity: salvando ? 0.6 : 1,
          }}
        >
          CANCELAR
        </button>
        <button
          type="button"
          onClick={handleConfirmar}
          disabled={salvando}
          style={{
            flex: 1.4,
            background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
            color: '#fff',
            border: '1.5px solid #15803d',
            padding: '14px 20px',
            borderRadius: 22,
            fontSize: 12,
            fontWeight: 700,
            cursor: salvando ? 'wait' : 'pointer',
            fontFamily: "'Cinzel', serif",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
            opacity: salvando ? 0.7 : 1,
          }}
        >
          <MdCheckCircle size={16} />
          {salvando ? 'SALVANDO…' : 'CONFIRMAR'}
        </button>
      </div>
    </ModalBase>
  );
}

const labelEstilo = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#2c163a',
  marginBottom: 6,
  letterSpacing: '0.2px',
};