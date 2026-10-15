// src/components/financeiro/RelatorioFinanceiroPDF.jsx
import React from 'react';
import { GraficoBarras, GraficoPizza } from './GraficoBarras';

/**
 * Container de PDF do Relatório Financeiro.
 * Fica escondido da tela, mas visível pro html2canvas capturar.
 *
 * Props:
 *  - id: string (id do container, usado por gerarPdfFinanceiro)
 *  - dados: {
 *      periodoLabel, dataInicio, dataFim,
 *      receitas, despesas, lucro,
 *      totalLancamentos,
 *      porCategoria: [{ nome, valor }],
 *      porServico:   [{ nome, valor }],
 *      ultimos12Meses: [{ mes, receitas, despesas }],
 *      lancamentos: [{ tipo, valor, data, categoria, descricao, formaPagamento }],
 *    }
 *  - filtroTipo: 'todos' | 'receita' | 'despesa'
 *  - filtroCategoria: string | 'todos'
 *  - esteticistaNome: string
 */
export default function RelatorioFinanceiroPDF({
  id,
  dados,
  filtroTipo = 'todos',
  filtroCategoria = 'todos',
  esteticistaNome = 'Samira Ferreira Estética & Cosmetologia',
}) {
  const hoje = new Date();

  const filtrarLancamentos = () => {
    return (dados?.lancamentos || []).filter((l) => {
      if (filtroTipo !== 'todos' && l.tipo !== filtroTipo) return false;
      if (filtroCategoria !== 'todos' && l.categoria !== filtroCategoria) return false;
      return true;
    });
  };

  const lancamentosFiltrados = filtrarLancamentos();

  const fmtMoeda = (v) =>
    Number(v || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fmtData = (iso) => {
    if (!iso) return '—';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  };

  return (
    <div
      id={id}
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        top: 0,
        width: '794px',
        zIndex: -1,
        pointerEvents: 'none',
        opacity: 1,
        background: '#ffffff',
      }}
    >
      <div
        style={{
          fontFamily: 'Helvetica, Arial, sans-serif',
          padding: '30px',
          color: '#2c163a',
          background: '#ffffff',
        }}
      >
        {/* Cabeçalho */}
        <div style={{
          textAlign: 'center',
          marginBottom: 20,
          paddingBottom: 14,
          borderBottom: '2px solid #C8A24A',
        }}>
          <h1 style={{
            fontSize: 20,
            margin: '0 0 6px',
            color: '#2c163a',
            fontWeight: 700,
            letterSpacing: '0.5px',
          }}>
            Relatório Financeiro
          </h1>
          <div style={{
            fontSize: 11,
            color: '#666',
            lineHeight: 1.7,
          }}>
            <strong style={{ color: '#2c163a' }}>{esteticistaNome}</strong>
            <br />
            Período: <strong>{dados?.periodoLabel || '—'}</strong>
            <br />
            Gerado em: {hoje.toLocaleString('pt-BR')}
          </div>
        </div>

        {/* Resumo */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginBottom: 18,
        }}>
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: 8,
            padding: '12px 14px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 10,
              color: '#166534',
              fontWeight: 700,
              letterSpacing: '0.5px',
              marginBottom: 4,
            }}>
              RECEITAS
            </div>
            <div style={{
              fontSize: 16,
              color: '#166534',
              fontWeight: 800,
              fontFamily: 'Cinzel, serif',
            }}>
              R$ {fmtMoeda(dados?.receitas)}
            </div>
          </div>

          <div style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '12px 14px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 10,
              color: '#991b1b',
              fontWeight: 700,
              letterSpacing: '0.5px',
              marginBottom: 4,
            }}>
              DESPESAS
            </div>
            <div style={{
              fontSize: 16,
              color: '#991b1b',
              fontWeight: 800,
              fontFamily: 'Cinzel, serif',
            }}>
              R$ {fmtMoeda(dados?.despesas)}
            </div>
          </div>

          <div style={{
            background: (dados?.lucro || 0) >= 0 ? '#faf5ff' : '#fff8e1',
            border: (dados?.lucro || 0) >= 0 ? '1px solid #d8b4fe' : '1px solid #fcd34d',
            borderRadius: 8,
            padding: '12px 14px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 10,
              color: (dados?.lucro || 0) >= 0 ? '#7e22ce' : '#92400e',
              fontWeight: 700,
              letterSpacing: '0.5px',
              marginBottom: 4,
            }}>
              {(dados?.lucro || 0) >= 0 ? 'LUCRO' : 'PREJUÍZO'}
            </div>
            <div style={{
              fontSize: 16,
              color: (dados?.lucro || 0) >= 0 ? '#7e22ce' : '#92400e',
              fontWeight: 800,
              fontFamily: 'Cinzel, serif',
            }}>
              R$ {fmtMoeda(Math.abs(dados?.lucro || 0))}
            </div>
          </div>
        </div>

        {/* Evolução 12 meses */}
        {(dados?.ultimos12Meses?.length > 0) && (
          <div style={{
            marginBottom: 20,
            padding: '14px 16px',
            background: '#fafafc',
            border: '1px solid #e2d2f5',
            borderRadius: 10,
            pageBreakInside: 'avoid',
          }}>
            <h2 style={{
              fontSize: 13,
              margin: '0 0 12px',
              color: '#2c163a',
              fontFamily: 'Cinzel, serif',
              letterSpacing: '0.4px',
            }}>
              Evolução — Últimos 12 meses
            </h2>
            <GraficoBarras
              dados={dados.ultimos12Meses}
              altura={220}
              animar={false}
            />
          </div>
        )}

        {/* Faturamento por serviço (pizza) */}
        {(dados?.porServico?.length > 0) && (
          <div style={{
            marginBottom: 20,
            padding: '14px 16px',
            background: '#fafafc',
            border: '1px solid #e2d2f5',
            borderRadius: 10,
            pageBreakInside: 'avoid',
          }}>
            <h2 style={{
              fontSize: 13,
              margin: '0 0 12px',
              color: '#2c163a',
              fontFamily: 'Cinzel, serif',
              letterSpacing: '0.4px',
            }}>
              Faturamento por Serviço
            </h2>
            <GraficoPizza
              dados={dados.porServico}
              tamanho={220}
              animar={false}
            />
          </div>
        )}

        {/* Despesas por categoria */}
        {(dados?.porCategoria?.length > 0) && (
          <div style={{
            marginBottom: 20,
            padding: '14px 16px',
            background: '#fafafc',
            border: '1px solid #e2d2f5',
            borderRadius: 10,
            pageBreakInside: 'avoid',
          }}>
            <h2 style={{
              fontSize: 13,
              margin: '0 0 12px',
              color: '#2c163a',
              fontFamily: 'Cinzel, serif',
              letterSpacing: '0.4px',
            }}>
              Despesas por Categoria
            </h2>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 11,
            }}>
              <thead>
                <tr>
                  <th style={thEstilo}>Categoria</th>
                  <th style={{ ...thEstilo, textAlign: 'right' }}>Valor</th>
                  <th style={{ ...thEstilo, textAlign: 'right' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {dados.porCategoria.map((c, i) => {
                  const pct = dados.despesas > 0
                    ? (c.valor / dados.despesas) * 100
                    : 0;
                  return (
                    <tr key={i}>
                      <td style={tdEstilo}>{c.nome}</td>
                      <td style={{ ...tdEstilo, textAlign: 'right' }}>
                        R$ {fmtMoeda(c.valor)}
                      </td>
                      <td style={{ ...tdEstilo, textAlign: 'right' }}>
                        {pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Lista de lançamentos */}
        <div style={{
          marginBottom: 20,
          pageBreakInside: 'avoid',
        }}>
          <h2 style={{
            fontSize: 13,
            margin: '0 0 12px',
            color: '#2c163a',
            fontFamily: 'Cinzel, serif',
            letterSpacing: '0.4px',
          }}>
            Lançamentos ({lancamentosFiltrados.length})
            {filtroTipo !== 'todos' && ` — ${filtroTipo === 'receita' ? 'Apenas receitas' : 'Apenas despesas'}`}
            {filtroCategoria !== 'todos' && ` — Categoria: ${filtroCategoria}`}
          </h2>

          {lancamentosFiltrados.length === 0 ? (
            <div style={{
              padding: 20,
              textAlign: 'center',
              color: '#888',
              fontSize: 11,
              fontStyle: 'italic',
              background: '#fafafc',
              borderRadius: 8,
              border: '1px dashed #e2d2f5',
            }}>
              Nenhum lançamento no período com os filtros aplicados.
            </div>
          ) : (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 10.5,
            }}>
              <thead>
                <tr>
                  <th style={thEstilo}>Data</th>
                  <th style={thEstilo}>Tipo</th>
                  <th style={thEstilo}>Categoria</th>
                  <th style={thEstilo}>Descrição</th>
                  <th style={{ ...thEstilo, textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {lancamentosFiltrados.map((l, i) => (
                  <tr key={i}>
                    <td style={tdEstilo}>{fmtData(l.data)}</td>
                    <td style={{
                      ...tdEstilo,
                      color: l.tipo === 'receita' ? '#166534' : '#991b1b',
                      fontWeight: 700,
                    }}>
                      {l.tipo === 'receita' ? 'Receita' : 'Despesa'}
                    </td>
                    <td style={tdEstilo}>{l.categoria}</td>
                    <td style={tdEstilo}>{l.descricao}</td>
                    <td style={{
                      ...tdEstilo,
                      textAlign: 'right',
                      color: l.tipo === 'receita' ? '#166534' : '#991b1b',
                      fontWeight: 700,
                    }}>
                      {l.tipo === 'receita' ? '+' : '−'} R$ {fmtMoeda(l.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé */}
        <div style={{
          marginTop: 30,
          paddingTop: 14,
          borderTop: '1px dashed #C8A24A',
          fontSize: 10,
          color: '#888',
          textAlign: 'center',
          lineHeight: 1.7,
        }}>
          Documento gerado eletronicamente em {hoje.toLocaleString('pt-BR')}.
          <br />
          {esteticistaNome}
        </div>
      </div>
    </div>
  );
}

const thEstilo = {
  background: '#7e22ce',
  color: '#ffffff',
  padding: '8px 6px',
  textAlign: 'left',
  border: '1px solid #7e22ce',
  fontWeight: 700,
  fontSize: 10.5,
};

const tdEstilo = {
  padding: '6px',
  border: '1px solid #e2d2f5',
  fontSize: 10.5,
};