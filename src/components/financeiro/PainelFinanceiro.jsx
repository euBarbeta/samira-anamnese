// src/components/financeiro/PainelFinanceiro.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, onSnapshot, doc, addDoc,
  updateDoc, deleteDoc, orderBy,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import GraficoBarras, { GraficoPizza } from './GraficoBarras';
import ModalDespesa from './ModalDespesa';
import RelatorioFinanceiroPDF from './RelatorioFinanceiroPDF';
import ModalBase from './ModalBase';
import { gerarPdfFinanceiro, salvarPdfFinanceiro } from '../../utils/gerarPdfFinanceiro';

import {
  MdAdd, MdTrendingUp, MdTrendingDown, MdAttachMoney,
  MdPictureAsPdf, MdEdit,
  MdDelete, MdCalendarMonth, MdArrowBack, MdArrowForward,
  MdClose, MdDownload, MdPictureAsPdf as MdPdf,
  MdExpandMore,
} from 'react-icons/md';

/* ============================================================
   Helpers
   ============================================================ */
function mesAnoDeHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtMoeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function nomeMes(anoMes) {
  const MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const [ano, mes] = anoMes.split('-');
  return `${MESES[parseInt(mes, 10) - 1]} ${ano}`;
}

function gerarUltimos12Meses(referencia) {
  const [anoRef, mesRef] = referencia.split('-').map(Number);
  const meses = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(anoRef, mesRef - 1 - i, 1);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    meses.push(`${ano}-${mes}`);
  }
  return meses;
}

const MESES_CURTO = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
export default function PainelFinanceiro({ uidEsteticista }) {
  const [lancamentos, setLancamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // ✅ Detecção de mobile
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ✅ Detecção de app nativo (APK)
  const [isNativo, setIsNativo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        setIsNativo(Capacitor.isNativePlatform());
      } catch {
        setIsNativo(false);
      }
    })();
  }, []);

  // Navegação de mês
  const [mesRef, setMesRef] = useState(mesAnoDeHoje());

  // Dropdown de mês/ano
  const [dropdownMesAberto, setDropdownMesAberto] = useState(false);
  const [anoSelecionando, setAnoSelecionando] = useState(
    () => Number(mesAnoDeHoje().split('-')[0])
  );

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [busca, setBusca] = useState('');

  // Modais
  const [modalDespesaAberto, setModalDespesaAberto] = useState(false);
  const [despesaEditando, setDespesaEditando] = useState(null);

  // Estado do PDF
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [renderizandoPDF, setRenderizandoPDF] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [nomeArquivoAtual, setNomeArquivoAtual] = useState('');
  const [processandoPDF, setProcessandoPDF] = useState(false);

  // ============================================================
  // Listener — LANÇAMENTOS
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;

    const colRef = collection(db, `usuarios/${uidEsteticista}/financeiro`);
    const q = query(colRef, orderBy('data', 'desc'));

    const unsub = onSnapshot(q, (snap) => {
      setLancamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    }, (err) => {
      console.error('Erro listener financeiro:', err);
      setCarregando(false);
    });

    return () => unsub();
  }, [uidEsteticista]);

  // ============================================================
  // Cálculos do MÊS atual
  // ============================================================
  const dadosMes = useMemo(() => {
    const doMes = lancamentos.filter((l) => (l.data || '').startsWith(mesRef));

    let receitas = 0;
    let despesas = 0;

    for (const l of doMes) {
      if (l.tipo === 'receita') receitas += Number(l.valor) || 0;
      else if (l.tipo === 'despesa') despesas += Number(l.valor) || 0;
    }

    const lucro = receitas - despesas;
    return { receitas, despesas, lucro, doMes };
  }, [lancamentos, mesRef]);

  // ============================================================
  // Pizza — faturamento por serviço
  // ============================================================
  const porServico = useMemo(() => {
    const mapa = {};
    for (const l of dadosMes.doMes) {
      if (l.tipo !== 'receita') continue;
      const nome = l.servicoNome || l.descricao || 'Serviço';
      mapa[nome] = (mapa[nome] || 0) + (Number(l.valor) || 0);
    }
    return Object.entries(mapa)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [dadosMes]);

  // ============================================================
  // Lista — despesas por categoria
  // ============================================================
  const porCategoria = useMemo(() => {
    const mapa = {};
    for (const l of dadosMes.doMes) {
      if (l.tipo !== 'despesa') continue;
      const nome = l.categoria || 'Outros';
      mapa[nome] = (mapa[nome] || 0) + (Number(l.valor) || 0);
    }
    return Object.entries(mapa)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [dadosMes]);

  // ============================================================
  // Evolução — últimos 12 meses
  // ============================================================
  const ultimos12Meses = useMemo(() => {
    const meses = gerarUltimos12Meses(mesRef);
    return meses.map((m) => {
      let receitas = 0;
      let despesas = 0;
      for (const l of lancamentos) {
        if (!(l.data || '').startsWith(m)) continue;
        if (l.tipo === 'receita') receitas += Number(l.valor) || 0;
        else if (l.tipo === 'despesa') despesas += Number(l.valor) || 0;
      }
      return { mes: m, receitas, despesas };
    });
  }, [lancamentos, mesRef]);

  // ============================================================
  // Categorias disponíveis
  // ============================================================
  const categoriasDisponiveis = useMemo(() => {
    const set = new Set();
    for (const l of dadosMes.doMes) {
      if (l.categoria) set.add(l.categoria);
    }
    return Array.from(set).sort();
  }, [dadosMes]);

  // ============================================================
  // Lista filtrada
  // ============================================================
  const lancamentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return dadosMes.doMes.filter((l) => {
      if (filtroTipo !== 'todos' && l.tipo !== filtroTipo) return false;
      if (filtroCategoria !== 'todos' && l.categoria !== filtroCategoria) return false;
      if (termo) {
        const alvo = `${l.descricao || ''} ${l.categoria || ''} ${l.formaPagamento || ''} ${l.pacienteNome || ''}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [dadosMes, filtroTipo, filtroCategoria, busca]);

  // ============================================================
  // Navegação de mês
  // ============================================================
  const mudarMes = (delta) => {
    const [ano, mes] = mesRef.split('-').map(Number);
    const nova = new Date(ano, mes - 1 + delta, 1);
    setMesRef(`${nova.getFullYear()}-${String(nova.getMonth() + 1).padStart(2, '0')}`);
    setBusca('');
  };

  const irMesAtual = () => {
    setMesRef(mesAnoDeHoje());
    setBusca('');
  };

  const irParaMesEspecifico = (anoMes) => {
    setMesRef(anoMes);
    setBusca('');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const selecionarMesDropdown = (anoMes) => {
    setMesRef(anoMes);
    setDropdownMesAberto(false);
    setBusca('');
  };

  useEffect(() => {
    if (!dropdownMesAberto) return;
    const handler = (e) => {
      if (e.key === 'Escape') setDropdownMesAberto(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dropdownMesAberto]);

  // ============================================================
  // Salvar / editar / excluir DESPESA
  // ============================================================
  const handleSalvarDespesa = async (dados) => {
    const user = auth.currentUser;
    if (!user) return;

    const payload = {
      ...dados,
      tipo: 'despesa',
      atualizadoEm: new Date().toISOString(),
    };

    if (despesaEditando?.id) {
      await updateDoc(doc(db, `usuarios/${user.uid}/financeiro`, despesaEditando.id), payload);
    } else {
      payload.criadoEm = new Date().toISOString();
      payload.criadoPor = user.uid;
      await addDoc(collection(db, `usuarios/${user.uid}/financeiro`), payload);
    }

    setModalDespesaAberto(false);
    setDespesaEditando(null);
  };

  const handleExcluirDespesa = async (id) => {
    const user = auth.currentUser;
    if (!user) return;
    await deleteDoc(doc(db, `usuarios/${user.uid}/financeiro`, id));
    setModalDespesaAberto(false);
    setDespesaEditando(null);
  };

  // ============================================================
  // PDF
  // ============================================================
  const handleExportarPDF = () => {
    setGerandoPDF(true);
    setRenderizandoPDF(true);
  };

  useEffect(() => {
    if (!renderizandoPDF) return;

    let cancelado = false;

    const timer = setTimeout(async () => {
      try {
        const containerId = 'financeiro-pdf-container';
        const elemento = document.getElementById(containerId);
        if (!elemento) throw new Error('Container do PDF não encontrado.');

        const blob = await gerarPdfFinanceiro(elemento);
        if (cancelado) return;

        const url = URL.createObjectURL(blob);
        const nomeArquivo = `Financeiro-${mesRef}.pdf`;

        setPreviewUrl(url);
        setPreviewBlob(blob);
        setNomeArquivoAtual(nomeArquivo);
      } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        alert('Erro ao gerar PDF: ' + (err?.message || 'Tente novamente.'));
      } finally {
        if (!cancelado) {
          setRenderizandoPDF(false);
          setGerandoPDF(false);
        }
      }
    }, 350);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [renderizandoPDF, mesRef]);

  const fecharPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setNomeArquivoAtual('');
  };

  // ✅ Salvar/Compartilhar (funciona em APK, PWA e web)
  const salvarCompartilharPDF = async () => {
    if (!previewBlob) return;
    setProcessandoPDF(true);
    try {
      await salvarPdfFinanceiro(previewBlob, nomeArquivoAtual);
      fecharPreview();
    } catch (e) {
      if (e?.message?.toLowerCase().includes('cancel')) {
        setProcessandoPDF(false);
        return;
      }
      console.error('Erro ao salvar/compartilhar PDF:', e);
      alert('Não foi possível salvar. Tente novamente.');
    } finally {
      setProcessandoPDF(false);
    }
  };

  // ✅ Abrir PDF — só funciona em desktop web (não no APK)
  const abrirPDF = () => {
    if (!previewUrl) return;
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  // ============================================================
  // Render
  // ============================================================
  const MES_LABEL = nomeMes(mesRef);
  const lucroPositivo = dadosMes.lucro >= 0;

  // ✅ Mostrar botão ABRIR só em desktop web (não mobile, não APK)
  const mostrarBotaoAbrir = !isMobile && !isNativo;

  return (
    <div style={{ padding: '10px 0' }}>
      {/* ============================================================ */}
      {/* HEADER — Mês + Exportar */}
      {/* ============================================================ */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 12 : 10,
        marginBottom: 18,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          position: 'relative',
          justifyContent: 'space-between',
          width: isMobile ? '100%' : 'auto',
        }}>
          <button
            type="button"
            onClick={() => mudarMes(-1)}
            style={btnNav}
            aria-label="Mês anterior"
          >
            <MdArrowBack size={18} color="#7e22ce" />
          </button>

          <button
            type="button"
            onClick={() => {
              setAnoSelecionando(Number(mesRef.split('-')[0]));
              setDropdownMesAberto((v) => !v);
            }}
            style={{
              fontFamily: "'Cinzel', serif",
              background: dropdownMesAberto ? '#faf5ff' : 'transparent',
              border: dropdownMesAberto
                ? '1.5px solid #d8b4fe'
                : '1.5px solid transparent',
              borderRadius: 10,
              cursor: 'pointer',
              color: '#2c163a',
              fontSize: isMobile ? 14 : 16,
              fontWeight: 700,
              padding: '6px 12px',
              flex: isMobile ? 1 : 'none',
              minWidth: isMobile ? 0 : 200,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
            title="Clique para escolher mês e ano"
          >
            {MES_LABEL}
            <MdExpandMore
              size={18}
              color="#7e22ce"
              style={{
                transition: 'transform 0.2s ease',
                transform: dropdownMesAberto ? 'rotate(180deg)' : 'rotate(0deg)',
                flexShrink: 0,
              }}
            />
          </button>

          <button
            type="button"
            onClick={() => mudarMes(1)}
            style={btnNav}
            aria-label="Próximo mês"
          >
            <MdArrowForward size={18} color="#7e22ce" />
          </button>

          {/* DROPDOWN */}
          {dropdownMesAberto && (
            <>
              <div
                onClick={() => setDropdownMesAberto(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 999,
                  background: 'transparent',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: isMobile ? 0 : 0,
                  right: isMobile ? 0 : 'auto',
                  marginTop: 8,
                  background: '#fff',
                  border: '1.5px solid #C8A24A',
                  borderRadius: 16,
                  boxShadow: '0 15px 40px rgba(44, 22, 58, 0.25)',
                  padding: '14px 16px 16px',
                  zIndex: 1000,
                  minWidth: isMobile ? 'auto' : 300,
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                  gap: 8,
                }}>
                  <button
                    type="button"
                    onClick={() => setAnoSelecionando((a) => a - 1)}
                    style={btnNav}
                    aria-label="Ano anterior"
                  >
                    <MdArrowBack size={16} color="#7e22ce" />
                  </button>

                  <span style={{
                    fontFamily: "'Cinzel', serif",
                    color: '#2c163a',
                    fontSize: 16,
                    fontWeight: 800,
                    minWidth: 80,
                    textAlign: 'center',
                  }}>
                    {anoSelecionando}
                  </span>

                  <button
                    type="button"
                    onClick={() => setAnoSelecionando((a) => a + 1)}
                    style={btnNav}
                    aria-label="Próximo ano"
                  >
                    <MdArrowForward size={16} color="#7e22ce" />
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 6,
                }}>
                  {MESES_CURTO.map((nomeMesAbrev, idx) => {
                    const mesNum = String(idx + 1).padStart(2, '0');
                    const chave = `${anoSelecionando}-${mesNum}`;
                    const ehAtual = chave === mesRef;

                    return (
                      <button
                        key={nomeMesAbrev}
                        type="button"
                        onClick={() => selecionarMesDropdown(chave)}
                        style={{
                          padding: '10px 6px',
                          borderRadius: 10,
                          border: ehAtual
                            ? '1.5px solid #7e22ce'
                            : '1.5px solid #e2d2f5',
                          background: ehAtual
                            ? 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)'
                            : '#fff',
                          color: ehAtual ? '#fff' : '#2c163a',
                          fontSize: 12,
                          fontWeight: ehAtual ? 800 : 600,
                          cursor: 'pointer',
                          fontFamily: "'Montserrat', sans-serif",
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {nomeMesAbrev}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    irMesAtual();
                    setDropdownMesAberto(false);
                  }}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    fontFamily: "'Cinzel', serif",
                    background: 'transparent',
                    color: '#7e22ce',
                    border: '1.5px dashed #d8b4fe',
                    padding: '8px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Ir para o mês atual
                </button>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleExportarPDF}
          disabled={gerandoPDF}
          style={{
            fontFamily: "'Cinzel', serif",
            background: gerandoPDF
              ? '#ddd'
              : 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
            color: gerandoPDF ? '#888' : '#fff',
            border: '1.5px solid #6b21a8',
            padding: '10px 18px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            cursor: gerandoPDF ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: gerandoPDF ? 'none' : '0 3px 10px rgba(126, 34, 206, 0.3)',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          <MdPictureAsPdf size={15} />
          {gerandoPDF ? 'GERANDO…' : 'EXPORTAR PDF'}
        </button>
      </div>

      {/* ============================================================ */}
      {/* CARDS */}
      {/* ============================================================ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile
          ? '1fr'
          : 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
        marginBottom: 18,
      }}>
        <CardResumo
          titulo="RECEITAS"
          valor={dadosMes.receitas}
          Icone={MdTrendingUp}
          cor="#16a34a"
          bg="linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
          borda="#86efac"
        />
        <CardResumo
          titulo="DESPESAS"
          valor={dadosMes.despesas}
          Icone={MdTrendingDown}
          cor="#c62828"
          bg="linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)"
          borda="#fca5a5"
        />
        <CardResumo
          titulo={lucroPositivo ? 'LUCRO LÍQUIDO' : 'PREJUÍZO'}
          valor={Math.abs(dadosMes.lucro)}
          Icone={MdAttachMoney}
          cor={lucroPositivo ? '#7e22ce' : '#92400e'}
          bg={lucroPositivo
            ? 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)'
            : 'linear-gradient(135deg, #fff8e1 0%, #fef3c7 100%)'}
          borda={lucroPositivo ? '#d8b4fe' : '#fcd34d'}
        />
      </div>

      {/* ============================================================ */}
      {/* AÇÕES */}
      {/* ============================================================ */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 18,
        flexWrap: 'wrap',
      }}>
        <button
          type="button"
          onClick={() => {
            setDespesaEditando(null);
            setModalDespesaAberto(true);
          }}
          style={{
            fontFamily: "'Cinzel', serif",
            background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
            color: '#fff',
            border: '1.5px solid #9c1c1c',
            padding: '11px 20px',
            borderRadius: 22,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '0 3px 10px rgba(198, 40, 40, 0.3)',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          <MdAdd size={16} />
          NOVA DESPESA
        </button>
      </div>

      {/* ============================================================ */}
      {/* GRÁFICOS */}
      {/* ============================================================ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile
          ? '1fr'
          : (porServico.length > 0
              ? 'minmax(0, 1.3fr) minmax(0, 1fr)'
              : '1fr'),
        gap: 16,
        marginBottom: 20,
      }}>
        <div style={cardSecao}>
          <div style={tituloSecao}>
            <MdTrendingUp size={16} color="#7e22ce" />
            Evolução — Últimos 12 meses
          </div>
          <GraficoBarras
            dados={ultimos12Meses}
            altura={isMobile ? 200 : 240}
            animar={true}
            onClickMes={irParaMesEspecifico}
            mesSelecionado={mesRef}
          />
        </div>

        {porServico.length > 0 && (
          <div style={cardSecao}>
            <div style={tituloSecao}>
              <MdAttachMoney size={16} color="#7e22ce" />
              Faturamento por Serviço
            </div>
            <GraficoPizza
              dados={porServico}
              tamanho={isMobile ? 180 : 200}
              animar={true}
            />
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* FILTROS + LISTA */}
      {/* ============================================================ */}
      <div style={cardSecao}>
        <div style={tituloSecao}>
          <MdCalendarMonth size={16} color="#7e22ce" />
          Lançamentos de {MES_LABEL}
          <span style={{
            marginLeft: 'auto',
            fontSize: 10.5,
            color: '#888',
            fontWeight: 600,
            fontFamily: "'Montserrat', sans-serif",
          }}>
            {lancamentosFiltrados.length} de {dadosMes.doMes.length}
          </span>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 8,
          marginBottom: 14,
          flexWrap: 'wrap',
          alignItems: isMobile ? 'stretch' : 'center',
        }}>
          <div style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            width: isMobile ? '100%' : 'auto',
          }}>
            {[
              { key: 'todos', label: 'Tudo', cor: '#7e22ce' },
              { key: 'receita', label: 'Receitas', cor: '#16a34a' },
              { key: 'despesa', label: 'Despesas', cor: '#c62828' },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFiltroTipo(f.key)}
                style={{
                  fontFamily: "'Cinzel', serif",
                  background: filtroTipo === f.key ? f.cor : 'transparent',
                  color: filtroTipo === f.key ? '#fff' : f.cor,
                  border: `1.5px solid ${f.cor}`,
                  padding: '6px 12px',
                  borderRadius: 16,
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flex: isMobile ? 1 : 'none',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {categoriasDisponiveis.length > 0 && (
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              style={{
                padding: '6px 10px',
                border: '1.5px solid #d8b4fe',
                borderRadius: 12,
                fontSize: 11,
                color: '#2c163a',
                background: '#fff',
                fontFamily: "'Montserrat', sans-serif",
                outline: 'none',
                width: isMobile ? '100%' : 'auto',
                boxSizing: 'border-box',
              }}
            >
              <option value="todos">Todas categorias</option>
              {categoriasDisponiveis.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          <div style={{
            flex: 1,
            minWidth: isMobile ? 'auto' : 160,
            width: isMobile ? '100%' : 'auto',
          }}>
            <input
              type="text"
              placeholder="Buscar por descrição, paciente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px',
                border: '1.5px solid #d8b4fe',
                borderRadius: 12,
                fontSize: 11.5,
                color: '#2c163a',
                background: '#fff',
                fontFamily: "'Montserrat', sans-serif",
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {carregando ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#888', fontSize: 12 }}>
            Carregando lançamentos…
          </div>
        ) : lancamentosFiltrados.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '30px 16px',
            background: '#faf5ff',
            border: '1px dashed #d8b4fe',
            borderRadius: 10,
            fontSize: 12,
            color: '#666',
          }}>
            {dadosMes.doMes.length === 0
              ? 'Nenhum lançamento neste mês ainda.'
              : 'Nenhum lançamento com os filtros aplicados.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lancamentosFiltrados.map((l) => (
              <ItemLancamento
                key={l.id}
                lancamento={l}
                isMobile={isMobile}
                onEditar={() => {
                  setDespesaEditando(l);
                  setModalDespesaAberto(true);
                }}
                onExcluir={() => handleExcluirDespesa(l.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL DESPESA */}
      {/* ============================================================ */}
      {modalDespesaAberto && (
        <ModalDespesa
          lancamento={despesaEditando}
          onFechar={() => {
            setModalDespesaAberto(false);
            setDespesaEditando(null);
          }}
          onSalvar={handleSalvarDespesa}
          onExcluir={handleExcluirDespesa}
        />
      )}

      {/* ============================================================ */}
      {/* CONTAINER DE PDF OCULTO */}
      {/* ============================================================ */}
      {renderizandoPDF && (
        <RelatorioFinanceiroPDF
          id="financeiro-pdf-container"
          dados={{
            periodoLabel: MES_LABEL,
            dataInicio: `${mesRef}-01`,
            dataFim: `${mesRef}-31`,
            receitas: dadosMes.receitas,
            despesas: dadosMes.despesas,
            lucro: dadosMes.lucro,
            totalLancamentos: dadosMes.doMes.length,
            porCategoria,
            porServico,
            ultimos12Meses,
            lancamentos: dadosMes.doMes,
          }}
          filtroTipo={filtroTipo}
          filtroCategoria={filtroCategoria}
          esteticistaNome="Samira Ferreira Estética & Cosmetologia"
        />
      )}

      {/* ============================================================ */}
      {/* MODAL PDF PRONTO — com ModalBase */}
      {/* ============================================================ */}
      {previewBlob && (
        <ModalBase
          onFechar={fecharPreview}
          bloquearFechar={processandoPDF}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MdPdf size={22} color="#7e22ce" />
              <h3 style={{
                fontFamily: "'Cinzel', serif",
                color: '#2c163a',
                fontSize: isMobile ? 15 : 16,
                margin: 0,
              }}>
                PDF pronto
              </h3>
            </div>
            <button
              type="button"
              onClick={fecharPreview}
              disabled={processandoPDF}
              aria-label="Fechar"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: processandoPDF ? 'not-allowed' : 'pointer',
                padding: 4,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#888',
                flexShrink: 0,
                opacity: processandoPDF ? 0.5 : 1,
              }}
            >
              <MdClose size={22} />
            </button>
          </div>

          {/* Corpo */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: isMobile ? '24px 18px' : '28px 24px',
            textAlign: 'center',
            background: '#faf5ff',
            fontFamily: "'Montserrat', sans-serif",
          }}>
            <MdPdf size={64} color="#7e22ce" style={{ marginBottom: 14 }} />
            <div style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#2c163a',
              marginBottom: 6,
              fontFamily: "'Cinzel', serif",
            }}>
              Seu relatório está pronto
            </div>
            <div style={{
              fontSize: 12,
              color: '#666',
              lineHeight: 1.6,
              marginBottom: 16,
              wordBreak: 'break-word',
            }}>
              {nomeArquivoAtual}
            </div>

            {/* Dica contextual por plataforma */}
            {isNativo && (
              <div style={{
                marginTop: 8,
                fontSize: 11.5,
                color: '#7e22ce',
                lineHeight: 1.6,
                background: '#f3e8ff',
                borderRadius: 10,
                padding: '10px 14px',
                textAlign: 'left',
              }}>
                Toque em <strong>SALVAR / COMPARTILHAR</strong> abaixo para escolher onde salvar ou enviar.
              </div>
            )}

            {!isNativo && isMobile && (
              <div style={{
                marginTop: 8,
                fontSize: 11.5,
                color: '#7e22ce',
                lineHeight: 1.6,
                background: '#f3e8ff',
                borderRadius: 10,
                padding: '10px 14px',
                textAlign: 'left',
              }}>
                Toque em <strong>BAIXAR</strong> abaixo para salvar o arquivo no seu aparelho.
              </div>
            )}

            {!isNativo && !isMobile && (
              <div style={{
                marginTop: 8,
                fontSize: 11.5,
                color: '#7e22ce',
                lineHeight: 1.6,
                background: '#f3e8ff',
                borderRadius: 10,
                padding: '10px 14px',
                textAlign: 'left',
              }}>
                Toque em <strong>ABRIR PDF</strong> para visualizar numa nova aba,
                ou em <strong>BAIXAR</strong> para salvar o arquivo.
              </div>
            )}
          </div>

          {/* Rodapé — botões adaptados por plataforma */}
          <div style={{
            display: 'flex',
            gap: 10,
            padding: isMobile ? '12px 18px 18px' : '14px 24px 20px',
            borderTop: '1px solid #f0f0f0',
            flexShrink: 0,
            background: '#fff',
            flexWrap: 'wrap',
          }}>
            <button
              type="button"
              onClick={fecharPreview}
              disabled={processandoPDF}
              style={{
                flex: 1,
                background: '#f0f0f0',
                color: '#333',
                border: 'none',
                padding: '14px 20px',
                borderRadius: 22,
                fontSize: 12,
                fontWeight: 700,
                cursor: processandoPDF ? 'not-allowed' : 'pointer',
                fontFamily: "'Cinzel', serif",
                opacity: processandoPDF ? 0.6 : 1,
                minWidth: 100,
              }}
            >
              FECHAR
            </button>

            {/* ✅ ABRIR PDF — só em desktop web */}
            {mostrarBotaoAbrir && (
              <button
                type="button"
                onClick={abrirPDF}
                disabled={processandoPDF}
                style={{
                  flex: 1,
                  fontFamily: "'Cinzel', serif",
                  background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
                  color: '#fff',
                  border: '1.5px solid #6b21a8',
                  padding: '14px 20px',
                  borderRadius: 22,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: processandoPDF ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(126, 34, 206, 0.35)',
                  opacity: processandoPDF ? 0.7 : 1,
                  minWidth: 100,
                }}
              >
                <MdPictureAsPdf size={16} />
                ABRIR PDF
              </button>
            )}

            <button
              type="button"
              onClick={salvarCompartilharPDF}
              disabled={processandoPDF}
              style={{
                flex: 1.2,
                fontFamily: "'Cinzel', serif",
                background: processandoPDF
                  ? '#ddd'
                  : 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                color: processandoPDF ? '#888' : '#fff',
                border: '1.5px solid #9c7826',
                padding: '14px 20px',
                borderRadius: 22,
                fontSize: 12,
                fontWeight: 700,
                cursor: processandoPDF ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: processandoPDF ? 'none' : '0 4px 14px rgba(200, 162, 74, 0.35)',
                minWidth: 120,
              }}
            >
              <MdDownload size={16} />
              {processandoPDF
                ? 'PROCESSANDO…'
                : isNativo
                  ? 'SALVAR / COMPARTILHAR'
                  : 'BAIXAR'}
            </button>
          </div>
        </ModalBase>
      )}
    </div>
  );
}

/* ============================================================
   SUBCOMPONENTES
   ============================================================ */
function CardResumo({ titulo, valor, Icone, cor, bg, borda }) {
  return (
    <div style={{
      background: bg,
      border: `1.5px solid ${borda}`,
      borderRadius: 14,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10.5,
        fontWeight: 700,
        color: cor,
        letterSpacing: '0.5px',
        fontFamily: "'Cinzel', serif",
      }}>
        <Icone size={14} color={cor} />
        {titulo}
      </div>
      <div style={{
        fontSize: 22,
        fontWeight: 800,
        color: cor,
        fontFamily: "'Cinzel', serif",
        lineHeight: 1.1,
      }}>
        R$ {fmtMoeda(valor)}
      </div>
    </div>
  );
}

function ItemLancamento({ lancamento, isMobile, onEditar, onExcluir }) {
  const ehReceita = lancamento.tipo === 'receita';
  const cor = ehReceita ? '#16a34a' : '#c62828';
  const bg = ehReceita ? '#f0fdf4' : '#fef2f2';
  const borda = ehReceita ? '#86efac' : '#fca5a5';
  const Icone = ehReceita ? MdTrendingUp : MdTrendingDown;

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${borda}`,
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'stretch' : 'center',
      gap: isMobile ? 10 : 12,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        minWidth: 0,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: bg,
          border: `1.5px solid ${borda}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icone size={18} color={cor} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 12.5,
            fontWeight: 700,
            color: '#2c163a',
            lineHeight: 1.3,
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {lancamento.descricao || lancamento.servicoNome || '—'}
          </div>
          <div style={{
            fontSize: 10.5,
            color: '#666',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <span>{fmtDataBR(lancamento.data)}</span>
            {lancamento.categoria && <span>· {lancamento.categoria}</span>}
            {lancamento.formaPagamento && <span>· {lancamento.formaPagamento}</span>}
            {lancamento.pacienteNome && (
              <span style={{ color: '#7e22ce' }}>· {lancamento.pacienteNome}</span>
            )}
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isMobile ? 'space-between' : 'flex-end',
        gap: 8,
        width: isMobile ? '100%' : 'auto',
      }}>
        <div style={{
          fontFamily: "'Cinzel', serif",
          fontSize: 15,
          fontWeight: 800,
          color: cor,
          whiteSpace: 'nowrap',
        }}>
          {ehReceita ? '+' : '−'} R$ {fmtMoeda(lancamento.valor)}
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={onEditar}
            title="Editar"
            style={{
              background: '#faf5ff',
              border: '1px solid #d8b4fe',
              color: '#7e22ce',
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MdEdit size={14} />
          </button>
          <button
            type="button"
            onClick={onExcluir}
            title="Excluir"
            style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              color: '#c62828',
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MdDelete size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Estilos
   ============================================================ */
const btnNav = {
  background: '#faf5ff',
  border: '1.5px solid #d8b4fe',
  borderRadius: 10,
  padding: '8px 12px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};

const cardSecao = {
  background: 'rgba(255, 255, 255, 0.95)',
  border: '1.5px solid #e2d2f5',
  borderRadius: 14,
  padding: '16px 18px',
  boxShadow: '0 4px 14px rgba(44, 22, 58, 0.05)',
};

const tituloSecao = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontFamily: "'Cinzel', serif",
  color: '#2c163a',
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 14,
  paddingBottom: 10,
  borderBottom: '1px dashed #e2d2f5',
};