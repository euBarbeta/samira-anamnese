// src/components/agendamento/CalendarioAgenda.jsx
import React from 'react';
import { MdArrowBack, MdArrowForward, MdEventBusy } from 'react-icons/md';
import { toISODateLocal } from '../../utils/agenda';

const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function montarCells(mesRef) {
  const ano = mesRef.getFullYear();
  const mes = mesRef.getMonth();
  const primeiro = new Date(ano, mes, 1);
  const ultimo = new Date(ano, mes + 1, 0);

  const diaSemanaInicial = primeiro.getDay();
  const totalDias = ultimo.getDate();

  const cells = [];
  for (let i = 0; i < diaSemanaInicial; i++) cells.push(null);
  for (let dia = 1; dia <= totalDias; dia++) cells.push(new Date(ano, mes, dia));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarioAgenda({
  mesRef,
  onMudarMes,
  irHoje,
  renderDia,
  diaSelecionado,
  compacto = false,
}) {
  const cells = montarCells(mesRef);

  return (
    <div style={{
      background: '#fff',
      border: '1.5px solid #e2d2f5',
      borderRadius: 14,
      padding: compacto ? 12 : 16,
    }}>
      {/* Navegação */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
      }}>
        <button type="button" onClick={() => onMudarMes(-1)} style={btnNav}>
          <MdArrowBack size={18} color="#7e22ce" />
        </button>

        <button
          type="button"
          onClick={irHoje}
          style={{
            fontFamily: "'Cinzel', serif",
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#2c163a',
            fontSize: compacto ? 13 : 14,
            fontWeight: 700,
            padding: '4px 12px',
          }}
        >
          {MESES[mesRef.getMonth()]} {mesRef.getFullYear()}
        </button>

        <button type="button" onClick={() => onMudarMes(1)} style={btnNav}>
          <MdArrowForward size={18} color="#7e22ce" />
        </button>
      </div>

      {/* Cabeçalho dias */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
        marginBottom: 6,
      }}>
        {DIAS_CURTO.map((d) => (
          <div key={d} style={{
            textAlign: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: '#7e22ce',
            fontFamily: "'Cinzel', serif",
            padding: '4px 0',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
      }}>
        {cells.map((data, i) => {
          if (!data) return <div key={`e-${i}`} style={{ aspectRatio: '1 / 1' }} />;

          const iso = toISODateLocal(data);
          const ehHoje = iso === toISODateLocal(new Date());
          const sel = diaSelecionado === iso;
          const info = renderDia(data);
          const dia = data.getDate();

          const bg = sel ? '#f3e8ff'
            : info.status === 'bloqueado' ? '#ffebee'
            : info.status === 'aberto' ? '#f0fdf4'
            : '#f5f5f5';

          const border = sel ? '#7e22ce'
            : info.status === 'bloqueado' ? '#ef9a9a'
            : info.status === 'aberto' ? '#86efac'
            : ehHoje ? '#7e22ce'
            : '#e0e0e0';

          const corTexto = sel ? '#7e22ce'
            : info.status === 'bloqueado' ? '#c62828'
            : info.status === 'aberto' ? '#166534'
            : '#999';

          const qtd = info.times?.length || 0;
          const temHorarios = info.status === 'aberto' && qtd > 0;

          return (
            <button
              key={i}
              type="button"
              onClick={info.disabled ? undefined : () => info.onClick?.(data)}
              disabled={info.disabled}
              title={info.title}
              style={{
                aspectRatio: '1 / 1',
                background: bg,
                border: `1.5px solid ${border}`,
                borderRadius: 8,
                cursor: info.disabled ? 'default' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: compacto ? '4px 2px' : '10px 6px',
                position: 'relative',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
                overflow: 'hidden',
              }}
            >
              {/* NÚMERO DO DIA — sempre no topo */}
              <span style={{
                fontSize: compacto ? 12 : 'clamp(14px, 1.4vw, 18px)',
                fontWeight: ehHoje || sel ? 800 : 600,
                color: corTexto,
                lineHeight: 1,
                flexShrink: 0,
              }}>
                {dia}
              </span>

              {/* BLOCO DE HORÁRIOS — cor roxa, tamanho escala com a tela */}
              {temHorarios && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  marginTop: compacto ? 1 : 6,
                  lineHeight: 1,
                  overflow: 'hidden',
                  flexGrow: 1,
                  gap: compacto ? 0 : 2,
                }}>
                  {/* Quantidade — destaque grande */}
                  <span style={{
                    fontSize: compacto ? 10 : 'clamp(20px, 3.5vw, 28px)',
                    fontWeight: 800,
                    color: '#7e22ce',
                    lineHeight: 1,
                    fontFamily: "'Cinzel', serif",
                  }}>
                    {qtd}
                  </span>

                  {/* "horários" — legível e escala */}
                  <span style={{
                    fontSize: compacto ? 5.5 : 'clamp(11px, 1.6vw, 16px)',
                    fontWeight: 700,
                    color: '#7e22ce',
                    textTransform: 'lowercase',
                    lineHeight: 1.15,
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.1px',
                  }}>
                    {qtd === 1 ? 'horário' : 'horários'}
                  </span>
                </div>
              )}

              {info.status === 'bloqueado' && (
                <MdEventBusy
                  size={compacto ? 10 : 14}
                  color="#c62828"
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LegendaCalendario() {
  return (
    <div style={{
      display: 'flex',
      gap: 14,
      marginTop: 12,
      paddingTop: 10,
      borderTop: '1px dashed #e2d2f5',
      fontSize: 10,
      color: '#666',
      flexWrap: 'wrap',
      justifyContent: 'center',
    }}>
      <Legenda cor="#f0fdf4" borda="#86efac" texto="Com vagas" />
      <Legenda cor="#ffebee" borda="#ef9a9a" texto="Bloqueado" />
      <Legenda cor="#f5f5f5" borda="#e0e0e0" texto="Sem agenda" />
      <Legenda cor="#f3e8ff" borda="#7e22ce" texto="Selecionado" />
    </div>
  );
}

function Legenda({ cor, borda, texto }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        background: cor,
        border: `1.5px solid ${borda}`,
        borderRadius: 3,
      }} />
      {texto}
    </span>
  );
}

const btnNav = {
  background: '#faf5ff',
  border: '1.5px solid #d8b4fe',
  borderRadius: 10,
  padding: '6px 10px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};