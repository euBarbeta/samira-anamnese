// src/components/financeiro/ModalDespesa.jsx
import React, { useState } from 'react';
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
  MdMoreHoriz,      // Outros
} from 'react-icons/md';

// ============================================================
// CATEGORIAS FIXAS — cada uma com seu ícone do react-icons
// ============================================================
const CATEGORIAS_FIXAS = [
  { value: 'Aluguel',     label: 'Aluguel',                Icone: MdHome },
  { value: 'Produto',     label: 'Produto / Estoque',      Icone: MdInventory2 },
  { value: 'Luz/Água',    label: 'Luz / Água / Internet',  Icone: MdLightbulb },
  { value: 'Impostos',    label: 'Impostos (DAS / MEI)',   Icone: MdReceipt },
  { value: 'Manutenção',  label: 'Manutenção / Equipamento', Icone: MdBuild },
  { value: 'Marketing',   label: 'Marketing / Anúncios',   Icone: MdCampaign },
  { value: 'Outros',      label: 'Outros',                 Icone: MdMoreHoriz },
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
    CATEGORIAS_FIXAS.find((c) => c.value === categoria) || CATEGORIAS_FIXAS[0];
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
          maxWidth: 480,
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.5)',
          border: '1.5px solid #fca5a5',
          fontFamily: "'Montserrat', sans-serif",
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 10,
        }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{
              fontFamily: "'Cinzel', serif",
              color: '#c62828',
              fontSize: 16,
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
            }}
          >
            <MdClose size={22} />
          </button>
        </div>

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
              fontSize: 22,
              fontWeight: 700,
              color: '#c62828',
              fontFamily: "'Cinzel', serif",
              padding: '10px 12px',
              border: '2px solid #fca5a5',
              borderRadius: 10,
              outline: 'none',
              background: '#fff',
              textAlign: 'right',
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

        {/* Categoria — com ícone */}
        <label style={labelEstilo}>Categoria</label>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
        }}>
          {/* Ícone da categoria selecionada — sempre visível à esquerda */}
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
            border: '1.5px solid #fca5a5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <IconeCategoria size={22} color="#c62828" />
          </div>

          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            disabled={salvando || excluindo}
            style={{ ...inputEstilo, marginBottom: 0, flex: 1 }}
          >
            {CATEGORIAS_FIXAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
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

        {/* Botões */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
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
            {salvando ? 'SALVANDO…' : (editando ? 'SALVAR' : 'LANÇAR DESPESA')}
          </button>
        </div>

        {/* Confirmação de exclusão */}
        {confirmarExclusao && (
          <div style={{
            marginTop: 16,
            padding: 14,
            background: '#fef2f2',
            border: '1.5px solid #fca5a5',
            borderRadius: 12,
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