// src/components/financeiro/ModalDespesa.jsx
import React, { useState, useEffect } from 'react';
import {
  MdClose, MdAttachMoney, MdCheckCircle, MdWarning,
  MdDelete, MdRepeat,
  // ✅ Ícones das categorias
  MdHome,           // Aluguel
  MdInventory2,     // Produto / Estoque
  MdLightbulb,      // Luz / Água / Internet
  MdReceipt,        // Impostos
  MdBuild,          // Manutenção / Equipamento
  MdCampaign,       // Marketing / Anúncios
  MdCategory,       // ✅ Outros (ícone de categoria/etiqueta)
} from 'react-icons/md';

// ============================================================
// CATEGORIAS FIXAS — cada uma com seu ícone do react-icons
// ============================================================
const CATEGORIAS_FIXAS = [
  { value: 'Aluguel',     label: 'Aluguel',                Icone: MdHome,       cor: '#7e22ce' },
  { value: 'Produto',     label: 'Produto',                Icone: MdInventory2, cor: '#C8A24A' },
  { value: 'Luz/Água',    label: 'Luz / Água',             Icone: MdLightbulb,  cor: '#d97706' },
  { value: 'Impostos',    label: 'Impostos',               Icone: MdReceipt,    cor: '#dc2626' },
  { value: 'Manutenção',  label: 'Manutenção',             Icone: MdBuild,      cor: '#0891b2' },
  { value: 'Marketing',   label: 'Marketing',              Icone: MdCampaign,   cor: '#db2777' },
  { value: 'Outros',      label: 'Outros',                 Icone: MdCategory,   cor: '#64748b' },
];

const FORMAS_PAGAMENTO = [
  'Dinheiro',
  'Pix',
  'Cartão de Débito',
  'Cartão de Crédito',
  'Boleto',
  'Transferência',
  'Outro',
];

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

function hojeISO() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarDataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export default function ModalDespesa({
  lancamento = null,
  onFechar,
  onSalvar,
  onExcluir,
}) {
  const editando = Boolean(lancamento?.id);

  // ✅ Detecção de mobile
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 640 : false
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const [valorStr, setValorStr] = useState(
    editando ? formatarMoeda(lancamento.valor) : ''
  );
  const [valor, setValor] = useState(
    editando ? Number(lancamento.valor) || 0 : 0
  );
  const [data, setData] = useState(
    editando ? lancamento.data || hojeISO() : hojeISO()
  );
  const [categoria, setCategoria] = useState(
    editando ? lancamento.categoria || 'Outros' : 'Outros'
  );
  const [descricao, setDescricao] = useState(
    editando ? lancamento.descricao || '' : ''
  );
  const [formaPagamento, setFormaPagamento] = useState(
    editando ? lancamento.formaPagamento || 'Pix' : 'Pix'
  );
  const [recorrente, setRecorrente] = useState(
    editando ? Boolean(lancamento.recorrente) : false
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Ícone da categoria selecionada
  const categoriaSelecionada =
    CATEGORIAS_FIXAS.find((c) => c.value === categoria) || CATEGORIAS_FIXAS[6];
  const IconeCategoria = categoriaSelecionada.Icone;

  const handleValorChange = (e) => {
    const raw = e.target.value;
    if (raw.startsWith('-')) return;
    setValorStr(raw);
    const num = parseMoeda(raw);
    if (num < 0) return;
    if (num > 999999.99) return;
    setValor(num);
    setErro('');
  };

  const handleValorBlur = () => {
    setValorStr(valor > 0 ? formatarMoeda(valor) : '');
  };

  const handleSalvar = async () => {
    setErro('');

    if (!valor || valor <= 0) {
      setErro('Informe um valor maior que zero.');
      return;
    }
    if (valor > 999999.99) {
      setErro('Valor muito alto (máx R$ 999.999,99).');
      return;
    }
    if (!data) {
      setErro('Informe a data da despesa.');
      return;
    }
    if (!categoria) {
      setErro('Escolha uma categoria.');
      return;
    }
    if (!descricao.trim()) {
      setErro('Descreva a despesa (ex: aluguel de outubro).');
      return;
    }

    setSalvando(true);
    try {
      await onSalvar({
        valor: Number(valor.toFixed(2)),
        data,
        categoria,
        descricao: descricao.trim(),
        formaPagamento,
        recorrente,
      });
    } catch (e) {
      console.error('Erro ao salvar despesa:', e);
      setErro('Erro ao salvar. Tente novamente.');
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!editando) return;
    setExcluindo(true);
    try {
      await onExcluir(lancamento.id);
    } catch (e) {
      console.error('Erro ao excluir:', e);
      setErro('Erro ao excluir. Tente novamente.');
      setExcluindo(false);
      setConfirmarExclusao(false);
    }
  };

  return (
    <div
      onClick={salvando || excluindo ? undefined : onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2147483647,
        padding: isMobile ? 0 : 20,
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: isMobile ? 0 : 20,
          padding: isMobile ? '20px 18px 18px' : '26px 24px 22px',
          maxWidth: isMobile ? '100%' : 480,
          width: '100%',
          height: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '100%' : '92vh',
          overflowY: 'auto',
          boxShadow: isMobile ? 'none' : '0 25px 70px rgba(44, 22, 58, 0.5)',
          border: isMobile ? 'none' : '1.5px solid #fca5a5',
          fontFamily: "'Montserrat', sans-serif",
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header — fixo no topo em mobile */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 10,
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{
              fontFamily: "'Cinzel', serif",
              color: '#c62828',
              fontSize: isMobile ? 15 : 16,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <MdAttachMoney size={18} color="#c62828" />
              {editando ? 'Editar Despesa' : 'Nova Despesa'}
            </h3>
            <span style={{ fontSize: 11, color: '#666' }}>
              {editando
                ? `Lançada em ${formatarDataBR(lancamento.data)}`
                : 'Registre uma saída do caixa'}
            </span>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando || excluindo}
            aria-label="Fechar"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: salvando || excluindo ? 'not-allowed' : 'pointer',
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
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Valor */}
          <label style={labelEstilo}>Valor (R$)</label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 14,
          }}>
            <span style={{
              fontFamily: "'Cinzel', serif",
              color: '#c62828',
              fontSize: 18,
              fontWeight: 700,
            }}>
              R$
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={valorStr}
              onChange={handleValorChange}
              onBlur={handleValorBlur}
              onKeyDown={(e) => {
                if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                  e.preventDefault();
                }
              }}
              disabled={salvando || excluindo}
              placeholder="0,00"
              style={{
                flex: 1,
                fontSize: isMobile ? 20 : 22,
                fontWeight: 700,
                color: '#c62828',
                fontFamily: "'Cinzel', serif",
                padding: '10px 12px',
                border: '2px solid #fca5a5',
                borderRadius: 10,
                outline: 'none',
                background: '#fff',
                textAlign: 'right',
                WebkitAppearance: 'none',
                appearance: 'none',
              }}
            />
          </div>

          {/* Data */}
          <label style={labelEstilo}>Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            disabled={salvando || excluindo}
            style={{ ...inputEstilo, marginBottom: 14 }}
          />

          {/* ✅ Categoria — GRID visual de cards (em vez de select) */}
          <label style={labelEstilo}>Categoria</label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: 8,
            marginBottom: 14,
          }}>
            {CATEGORIAS_FIXAS.map((c) => {
              const Icone = c.Icone;
              const ativa = categoria === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setCategoria(c.value);
                    setErro('');
                  }}
                  disabled={salvando || excluindo}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '10px 4px',
                    borderRadius: 12,
                    border: ativa
                      ? `2px solid ${c.cor}`
                      : '1.5px solid #e0e0e0',
                    background: ativa
                      ? `linear-gradient(135deg, ${c.cor}15 0%, ${c.cor}25 100%)`
                      : '#fafafa',
                    color: ativa ? c.cor : '#666',
                    cursor: salvando || excluindo ? 'not-allowed' : 'pointer',
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    transition: 'all 0.15s ease',
                    boxShadow: ativa ? `0 2px 8px ${c.cor}33` : 'none',
                    minHeight: 64,
                  }}
                >
                  <Icone size={20} color={ativa ? c.cor : '#999'} />
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                    padding: '0 2px',
                  }}>
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Descrição */}
          <label style={labelEstilo}>Descrição</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            disabled={salvando || excluindo}
            placeholder="Ex: Aluguel de outubro, compra de máscaras..."
            maxLength={120}
            style={{ ...inputEstilo, marginBottom: 14 }}
          />

          {/* Forma de pagamento */}
          <label style={labelEstilo}>Forma de pagamento</label>
          <select
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
            disabled={salvando || excluindo}
            style={{ ...inputEstilo, marginBottom: 14 }}
          >
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          {/* Recorrente */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            background: recorrente ? '#fef2f2' : '#fafafa',
            border: `1.5px solid ${recorrente ? '#fca5a5' : '#e0e0e0'}`,
            borderRadius: 10,
            cursor: salvando || excluindo ? 'not-allowed' : 'pointer',
            marginBottom: 14,
          }}>
            <input
              type="checkbox"
              checked={recorrente}
              onChange={(e) => setRecorrente(e.target.checked)}
              disabled={salvando || excluindo}
              style={{ width: 18, height: 18 }}
            />
            <MdRepeat size={16} color={recorrente ? '#c62828' : '#888'} />
            <span style={{
              fontSize: 12,
              color: recorrente ? '#c62828' : '#666',
              fontWeight: 600,
              flex: 1,
            }}>
              Despesa recorrente (todo mês)
            </span>
          </label>

          {/* Erro */}
          {erro && (
            <div style={erroBox}>
              <MdWarning size={16} />
              {erro}
            </div>
          )}

          {/* Confirmação de exclusão */}
          {confirmarExclusao && (
            <div style={{
              marginTop: 8,
              padding: 14,
              background: '#fef2f2',
              border: '1.5px solid #fca5a5',
              borderRadius: 12,
              marginBottom: 14,
            }}>
              <div style={{
                fontSize: 12,
                color: '#991b1b',
                fontWeight: 600,
                marginBottom: 10,
                lineHeight: 1.5,
              }}>
                Tem certeza que deseja excluir esta despesa?
                <br />
                <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>
                  Esta ação não pode ser desfeita.
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setConfirmarExclusao(false)}
                  disabled={excluindo}
                  style={{
                    flex: 1,
                    background: '#f0f0f0',
                    color: '#333',
                    border: 'none',
                    padding: '10px',
                    borderRadius: 16,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: excluindo ? 'not-allowed' : 'pointer',
                    fontFamily: "'Cinzel', serif",
                  }}
                >
                  VOLTAR
                </button>
                <button
                  type="button"
                  onClick={handleExcluir}
                  disabled={excluindo}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '10px',
                    borderRadius: 16,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: excluindo ? 'wait' : 'pointer',
                    fontFamily: "'Cinzel', serif",
                    opacity: excluindo ? 0.7 : 1,
                  }}
                >
                  {excluindo ? 'EXCLUINDO…' : 'SIM, EXCLUIR'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Botões — fixos no rodapé em mobile */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginTop: 12,
          paddingTop: 12,
          borderTop: isMobile ? '1px solid #f0f0f0' : 'none',
          flexShrink: 0,
        }}>
          {editando && !confirmarExclusao && (
            <button
              type="button"
              onClick={() => setConfirmarExclusao(true)}
              disabled={salvando || excluindo}
              style={{
                background: '#ffebee',
                color: '#c62828',
                border: '1.5px solid #ef9a9a',
                padding: '14px 16px',
                borderRadius: 22,
                fontSize: 12,
                fontWeight: 700,
                cursor: salvando || excluindo ? 'not-allowed' : 'pointer',
                fontFamily: "'Cinzel', serif",
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <MdDelete size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={onFechar}
            disabled={salvando || excluindo}
            style={{
              flex: 1,
              background: '#f0f0f0',
              color: '#333',
              border: 'none',
              padding: '14px 20px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: salvando || excluindo ? 'not-allowed' : 'pointer',
              fontFamily: "'Cinzel', serif",
              opacity: salvando || excluindo ? 0.6 : 1,
            }}
          >
            CANCELAR
          </button>

          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando || excluindo}
            style={{
              flex: 1.4,
              background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
              color: '#fff',
              border: '1.5px solid #9c1c1c',
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
              boxShadow: '0 4px 14px rgba(198, 40, 40, 0.35)',
              opacity: salvando ? 0.7 : 1,
            }}
          >
            <MdCheckCircle size={16} />
            {salvando ? 'SALVANDO…' : (editando ? 'SALVAR' : 'LANÇAR')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Estilos auxiliares
   ============================================================ */
const labelEstilo = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#2c163a',
  marginBottom: 6,
  letterSpacing: '0.2px',
};

const inputEstilo = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #fca5a5',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  color: '#2c163a',
  fontFamily: "'Montserrat', sans-serif",
  background: '#fff',
  WebkitAppearance: 'none',
  appearance: 'none',
};

const erroBox = {
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
};