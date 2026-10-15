// src/components/financeiro/GraficoBarras.jsx
import React, { useState, useEffect } from 'react';

/**
 * 📊 Gráfico de BARRAS animado (receita × despesa por mês)
 *    + 🥧 Gráfico de PIZZA animado (faturamento por serviço)
 *
 * 100% SVG, sem dependências externas.
 *
 * Props:
 *  - dados: [{ mes: '2026-10', receitas: 8450, despesas: 3200 }, ...]
 *  - altura: number (padrão 220)
 *  - animar: boolean (padrão true). Use FALSE dentro do PDF.
 *  - onClickMes: (mes: string) => void  (opcional — clicar numa barra)
 *  - mesSelecionado: string (opcional — destaca a label do mês)
 */
export function GraficoBarras({
  dados = [],
  altura = 220,
  animar = true,
  onClickMes = null,
  mesSelecionado = null,
}) {
  const [animacao, setAnimacao] = useState(animar ? 0 : 1);
  const [mesHover, setMesHover] = useState(null);

  useEffect(() => {
    if (!animar) {
      setAnimacao(1);
      return;
    }

    setAnimacao(0);
    const inicio = performance.now();
    const duracao = 900;

    let rafId;
    const tick = (agora) => {
      const t = Math.min((agora - inicio) / duracao, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setAnimacao(ease);
      if (t < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [dados, animar]);

  if (!dados || dados.length === 0) {
    return (
      <div style={{
        padding: 30,
        textAlign: 'center',
        color: '#999',
        fontSize: 12,
        fontStyle: 'italic',
      }}>
        Sem dados ainda. Conclua atendimentos e lance despesas para ver o gráfico.
      </div>
    );
  }

  const MESES_CURTO = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];

  const maxValor = Math.max(
    1,
    ...dados.map((d) => Math.max(d.receitas || 0, d.despesas || 0))
  );

  const passo = Math.pow(10, Math.floor(Math.log10(maxValor)));
  const maxArredondado = Math.ceil(maxValor / passo) * passo;

  const padding = { top: 24, right: 10, bottom: 44, left: 55 };
  const larguraTotal = 100;
  const alturaGrafico = altura - padding.top - padding.bottom;

  const fmt = (v) =>
    Number(v || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const clicavel = typeof onClickMes === 'function';

  return (
    <div style={{ width: '100%', fontFamily: "'Montserrat', sans-serif" }}>
      <style>{`
        .gb-barra-grupo {
          transition: opacity 0.2s ease;
          cursor: ${clicavel ? 'pointer' : (animar ? 'default' : 'default')};
        }
        .gb-barra-grupo.dim {
          opacity: 0.35;
        }
        .gb-barra-grupo:hover .gb-tooltip {
          opacity: ${animar || clicavel ? 1 : 0};
          transform: translateY(-2px);
        }
        .gb-barra-grupo:hover rect {
          filter: ${animar || clicavel ? 'brightness(1.08) drop-shadow(0 3px 6px rgba(0,0,0,0.15))' : 'none'};
        }
        .gb-tooltip {
          opacity: 0;
          transition: opacity 0.18s ease, transform 0.18s ease;
          pointer-events: none;
        }
        .gb-hint {
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          color: #b0a8b8;
          font-weight: 500;
          letter-spacing: 0.2px;
        }
      `}</style>

      <svg
        viewBox={`0 0 ${larguraTotal * 6} ${altura}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: altura, display: 'block' }}
      >
        {/* Linhas guia horizontais */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
          const y = padding.top + alturaGrafico * (1 - frac);
          const valorLinha = Math.round(maxArredondado * frac);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={larguraTotal * 6 - padding.right}
                y2={y}
                stroke="#ede4fb"
                strokeWidth="1"
                strokeDasharray={frac === 0 ? '0' : '3 3'}
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fill="#999"
                fontFamily="Montserrat, sans-serif"
              >
                {valorLinha >= 1000
                  ? `${(valorLinha / 1000).toFixed(0)}k`
                  : valorLinha}
              </text>
            </g>
          );
        })}

        {/* Barras */}
        {(() => {
          const larguraDisponivel =
            larguraTotal * 6 - padding.left - padding.right;
          const espacoPorMes = larguraDisponivel / dados.length;
          const larguraBarra = Math.min(espacoPorMes * 0.3, 22);
          const gapEntreBarras = 2;

          return dados.map((d, i) => {
            const x0 = padding.left + i * espacoPorMes + espacoPorMes / 2;
            const xReceita = x0 - larguraBarra - gapEntreBarras / 2;
            const xDespesa = x0 + gapEntreBarras / 2;

            const hReceita = ((d.receitas || 0) / maxArredondado) * alturaGrafico * animacao;
            const hDespesa = ((d.despesas || 0) / maxArredondado) * alturaGrafico * animacao;

            const yReceita = padding.top + alturaGrafico - hReceita;
            const yDespesa = padding.top + alturaGrafico - hDespesa;

            const [ano, mes] = (d.mes || '').split('-');
            const labelMes = MESES_CURTO[parseInt(mes, 10) - 1] || mes;

            const ehHover = mesHover === d.mes;
            const temHover = mesHover !== null;
            const ehSelecionado = mesSelecionado === d.mes;

            // ✅ Zona clicável "invisível" cobre toda a coluna
            const xZona = x0 - espacoPorMes / 2;
            const larguraZona = espacoPorMes;

            return (
              <g
                key={d.mes || i}
                className={`gb-barra-grupo${temHover && !ehHover ? ' dim' : ''}`}
                onMouseEnter={animar || clicavel ? () => setMesHover(d.mes) : undefined}
                onMouseLeave={animar || clicavel ? () => setMesHover(null) : undefined}
                onClick={clicavel ? () => onClickMes(d.mes) : undefined}
              >
                {/* ✅ Zona clicável invisível — SEM stroke, SEM contorno */}
                {clicavel && (
                  <rect
                    x={xZona}
                    y={padding.top - 10}
                    width={larguraZona}
                    height={alturaGrafico + 60}
                    fill="transparent"
                    stroke="none"
                    style={{ pointerEvents: 'all' }}
                  />
                )}

                <rect
                  x={xReceita}
                  y={yReceita}
                  width={larguraBarra}
                  height={Math.max(hReceita, 0)}
                  fill="url(#gradReceita)"
                  rx="3"
                  stroke="none"
                  style={{ transition: animar ? 'filter 0.2s ease' : 'none', pointerEvents: 'none' }}
                />
                <rect
                  x={xDespesa}
                  y={yDespesa}
                  width={larguraBarra}
                  height={Math.max(hDespesa, 0)}
                  fill="url(#gradDespesa)"
                  rx="3"
                  stroke="none"
                  style={{ transition: animar ? 'filter 0.2s ease' : 'none', pointerEvents: 'none' }}
                />

                <g className="gb-tooltip" style={{ pointerEvents: 'none' }}>
                  <rect
                    x={x0 - 55}
                    y={padding.top - 2}
                    width="110"
                    height="34"
                    rx="6"
                    fill="#2c163a"
                    opacity="0.95"
                  />
                  <text
                    x={x0}
                    y={padding.top + 12}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="#86efac"
                    fontFamily="Cinzel, serif"
                    fontWeight="700"
                  >
                    ↑ R$ {fmt(d.receitas)}
                  </text>
                  <text
                    x={x0}
                    y={padding.top + 24}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="#fca5a5"
                    fontFamily="Cinzel, serif"
                    fontWeight="700"
                  >
                    ↓ R$ {fmt(d.despesas)}
                  </text>
                </g>

                {/* ✅ Label do mês — só aqui tem destaque roxo no selecionado */}
                <text
                  x={x0}
                  y={padding.top + alturaGrafico + 16}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill={ehHover || ehSelecionado ? '#7e22ce' : '#666'}
                  fontFamily="Montserrat, sans-serif"
                  fontWeight={ehHover || ehSelecionado ? 800 : 600}
                  style={{
                    transition: animar ? 'fill 0.2s ease, font-weight 0.2s ease' : 'none',
                    pointerEvents: 'none',
                  }}
                >
                  {labelMes}
                </text>
                {dados.length > 1 && i === 0 && (
                  <text
                    x={x0}
                    y={padding.top + alturaGrafico + 28}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#aaa"
                    fontFamily="Montserrat, sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    {ano}
                  </text>
                )}
              </g>
            );
          });
        })()}

        <defs>
          <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#c62828" />
          </linearGradient>
        </defs>
      </svg>

      {/* ✅ Legenda + hint SUTIL */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 18,
        marginTop: 8,
        fontSize: 11,
        color: '#666',
        fontFamily: "'Montserrat', sans-serif",
        fontWeight: 600,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            borderRadius: 3,
            background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
          }} />
          Receitas
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            borderRadius: 3,
            background: 'linear-gradient(180deg, #ef4444 0%, #c62828 100%)',
          }} />
          Despesas
        </span>

        {/* ✅ Hint sutil em vez do aviso com emoji */}
        {clicavel && (
          <span className="gb-hint">
            · toque em um mês para detalhar
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   🥧 GRÁFICO DE PIZZA — animado + interativo
   (sem alterações)
   ============================================================ */
const CORES_PIZZA = [
  '#a855f7',
  '#C8A24A',
  '#16a34a',
  '#2563eb',
  '#db2777',
  '#ea580c',
  '#0d9488',
  '#7c3aed',
  '#dc2626',
  '#0891b2',
];

function polarParaCartesiano(cx, cy, raio, anguloGraus) {
  const rad = ((anguloGraus - 90) * Math.PI) / 180;
  return {
    x: cx + raio * Math.cos(rad),
    y: cy + raio * Math.sin(rad),
  };
}

function arcoPath(cx, cy, raioExterno, raioInterno, anguloInicial, anguloFinal) {
  const p1 = polarParaCartesiano(cx, cy, raioExterno, anguloInicial);
  const p2 = polarParaCartesiano(cx, cy, raioExterno, anguloFinal);
  const p3 = polarParaCartesiano(cx, cy, raioInterno, anguloFinal);
  const p4 = polarParaCartesiano(cx, cy, raioInterno, anguloInicial);

  const grandeArco = anguloFinal - anguloInicial > 180 ? 1 : 0;

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${raioExterno} ${raioExterno} 0 ${grandeArco} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${raioInterno} ${raioInterno} 0 ${grandeArco} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

export function GraficoPizza({ dados = [], tamanho = 220, animar = true }) {
  const [animacao, setAnimacao] = useState(animar ? 0 : 1);
  const [fatiaHover, setFatiaHover] = useState(null);

  useEffect(() => {
    if (!animar) {
      setAnimacao(1);
      return;
    }

    setAnimacao(0);
    const inicio = performance.now();
    const duracao = 900;

    let rafId;
    const tick = (agora) => {
      const t = Math.min((agora - inicio) / duracao, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setAnimacao(ease);
      if (t < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [dados, animar]);

  const dadosValidos = (dados || []).filter(
    (d) => d && typeof d.valor === 'number' && d.valor > 0
  );

  const total = dadosValidos.reduce((acc, d) => acc + d.valor, 0);

  if (total === 0) {
    return (
      <div style={{
        padding: 30,
        textAlign: 'center',
        color: '#999',
        fontSize: 12,
        fontStyle: 'italic',
      }}>
        Sem faturamento registrado neste período.
      </div>
    );
  }

  const cx = tamanho / 2;
  const cy = tamanho / 2;
  const raioExterno = tamanho * 0.42;
  const raioInterno = tamanho * 0.26;
  const espacoEntreFatias = 1.5;

  let anguloAtual = 0;
  const fatias = dadosValidos.map((d, i) => {
    const pct = d.valor / total;
    const angulo = pct * 360 * animacao;
    const inicio = anguloAtual;
    const fim = anguloAtual + angulo;
    anguloAtual = fim;

    const ehHover = fatiaHover === i;
    const offsetRaio = ehHover ? 6 : 0;
    const anguloMedio = (inicio + fim) / 2;
    const offset = polarParaCartesiano(0, 0, offsetRaio, anguloMedio);

    return {
      index: i,
      nome: d.nome,
      valor: d.valor,
      pct,
      inicio,
      fim,
      cor: d.cor || CORES_PIZZA[i % CORES_PIZZA.length],
      offsetX: offset.x,
      offsetY: offset.y,
      ehHover,
    };
  });

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      fontFamily: "'Montserrat', sans-serif",
    }}>
      <style>{`
        .gp-fatia {
          cursor: ${animar ? 'pointer' : 'default'};
          transition: ${animar ? 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.2s ease' : 'none'};
          transform-origin: center;
          transform-box: fill-box;
        }
        .gp-fatia:hover {
          filter: ${animar ? 'brightness(1.08) drop-shadow(0 4px 10px rgba(0,0,0,0.18))' : 'none'};
        }
        .gp-centro-texto {
          transition: opacity 0.25s ease;
        }
      `}</style>

      <svg
        viewBox={`0 0 ${tamanho} ${tamanho}`}
        style={{ width: tamanho, height: tamanho, overflow: 'visible' }}
      >
        {fatias.map((f) => {
          const angIni = f.inicio + espacoEntreFatias / 2;
          const angFim = f.fim - espacoEntreFatias / 2;

          if (angFim <= angIni) return null;

          const path = arcoPath(cx, cy, raioExterno, raioInterno, angIni, angFim);

          return (
            <g
              key={f.index}
              className="gp-fatia"
              onMouseEnter={animar ? () => setFatiaHover(f.index) : undefined}
              onMouseLeave={animar ? () => setFatiaHover(null) : undefined}
            >
              <path
                d={path}
                fill={f.cor}
                stroke="#fff"
                strokeWidth="1.5"
                transform={
                  f.ehHover
                    ? `translate(${f.offsetX}, ${f.offsetY})`
                    : 'translate(0, 0)'
                }
              />
            </g>
          );
        })}

        <g className="gp-centro-texto" style={{ pointerEvents: 'none' }}>
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fontSize="9.5"
            fill="#888"
            fontFamily="Cinzel, serif"
            fontWeight="700"
            letterSpacing="0.5"
          >
            {fatiaHover !== null ? 'SERVIÇO' : 'TOTAL'}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            fontSize="13"
            fill="#2c163a"
            fontFamily="Cinzel, serif"
            fontWeight="800"
          >
            {fatiaHover !== null
              ? `R$ ${Number(fatias[fatiaHover].valor || 0).toLocaleString('pt-BR', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`
              : `R$ ${Number(total || 0).toLocaleString('pt-BR', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`}
          </text>
          {fatiaHover !== null && (
            <text
              x={cx}
              y={cy + 26}
              textAnchor="middle"
              fontSize="8.5"
              fill="#7e22ce"
              fontFamily="Montserrat, sans-serif"
              fontWeight="700"
            >
              {`${(fatias[fatiaHover].pct * 100).toFixed(1)}%`}
            </text>
          )}
        </g>
      </svg>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
        maxWidth: 420,
      }}>
        {fatias.map((f) => (
          <button
            key={f.index}
            type="button"
            onMouseEnter={animar ? () => setFatiaHover(f.index) : undefined}
            onMouseLeave={animar ? () => setFatiaHover(null) : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px',
              background: f.ehHover ? '#faf5ff' : 'transparent',
              border: `1.5px solid ${f.ehHover ? '#d8b4fe' : 'transparent'}`,
              borderRadius: 8,
              cursor: animar ? 'pointer' : 'default',
              textAlign: 'left',
              fontFamily: 'inherit',
              transition: animar ? 'background 0.18s ease, border-color 0.18s ease' : 'none',
              width: '100%',
            }}
          >
            <span style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: 3,
              background: f.cor,
              flexShrink: 0,
              boxShadow: f.ehHover ? `0 0 0 2px ${f.cor}33` : 'none',
            }} />

            <span style={{
              flex: 1,
              fontSize: 11.5,
              color: '#2c163a',
              fontWeight: f.ehHover ? 700 : 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {f.nome}
            </span>

            <span style={{
              fontSize: 11,
              color: f.cor,
              fontWeight: 800,
              fontFamily: "'Cinzel', serif",
            }}>
              R$ {Number(f.valor || 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>

            <span style={{
              fontSize: 10,
              color: '#888',
              fontWeight: 700,
              minWidth: 42,
              textAlign: 'right',
            }}>
              {(f.pct * 100).toFixed(1)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default GraficoBarras;