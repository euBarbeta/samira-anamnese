// src/components/agendamento/TelaAgendamentoPublico.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, getDocs, addDoc, doc, getDoc,onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  gerarSlotsDisponiveis, gerarCodigoAutenticidade, validarCPF, toISODateLocal,
} from '../../utils/agenda';
import { notificarAgendamento } from '../../utils/agendamentoNotify';
import {
  MdCheckCircle, MdWarning, MdArrowBack, MdSearch, MdCalendarMonth,
} from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import ModalConsentimentoAgendamento from './ModalConsentimentoAgendamento';
import CalendarioAgenda, { LegendaCalendario } from './CalendarioAgenda';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

// ✅ Overlay global de "sem internet" — mesmo do AnamneseFicha
import TelaSemInternet from '../TelaSemInternet';

/* ============================================================
   WhatsApp — contato direto da profissional
   ============================================================ */
const WHATSAPP_NUMERO = '5511934656630'; // +55 11 93465-6630
const WHATSAPP_MENSAGEM = 'Olá! Gostaria de agendar um horário com a Samira.';
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(
  WHATSAPP_MENSAGEM
)}`;

export function BotaoWhatsApp() {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className="tap-whatsapp"
      aria-label="Falar no WhatsApp"
      title="Falar no WhatsApp"
    >
      <FaWhatsapp size={30} />
    </a>
  );
}

/* ============================================================
   Rodapé — Desenvolvido por Mb tech (link Instagram)
   ============================================================ */
const INSTAGRAM_MBTECH = 'https://www.instagram.com/miguelbarbetatech/';

export function Rodape() {
  return (
    <footer className="tap-rodape">
      <span className="tap-rodape-texto">
        Desenvolvido por:{' '}
        <a
          href={INSTAGRAM_MBTECH}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-rodape-link"
        >
          Mb tech
        </a>
      </span>
    </footer>
  );
}

/* ============================================================
   Aba de navegação pública — Agendar | Consultar
   ============================================================ */
export function AbasPublicas({ abaAtiva }) {
  return (
    <div className="tap-tabs" role="tablist">
      <a
        href="/#agendar"
        role="tab"
        aria-selected={abaAtiva === 'agendar'}
        className={`tap-tab${abaAtiva === 'agendar' ? ' ativo' : ''}`}
      >
        <MdCalendarMonth size={16} />
        Agendar
      </a>
      <a
        href="/#consultar"
        role="tab"
        aria-selected={abaAtiva === 'consultar'}
        className={`tap-tab${abaAtiva === 'consultar' ? ' ativo' : ''}`}
      >
        <MdSearch size={16} />
        Consultar
      </a>
    </div>
  );
}

/* ============================================================
   Loading elegante — spinner duplo + logo + shimmer
   ============================================================ */
function LoadingElegante({ texto = 'Carregando agenda' }) {
  return (
    <div className="tap-loading">
      <div className="tap-loading-orbe">
        <div className="tap-loading-anel tap-loading-anel-1" />
        <div className="tap-loading-anel tap-loading-anel-2" />
        <div className="tap-loading-anel tap-loading-anel-3" />
        <img
          src="/imagens/logo-telainicial.jpeg"
          alt=""
          className="tap-loading-logo"
        />
      </div>
      <div className="tap-loading-texto">{texto}</div>
      <div className="tap-loading-pontos">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

/* ============================================================
   Botão "Voltar pro prontuário"
   ============================================================ */
function BotaoVoltarProntuario() {
  let uidSalvo = null;
  try {
    uidSalvo =
      localStorage.getItem('af_uidDaURL') ||
      sessionStorage.getItem('af_uidDaURL');
  } catch {}

  if (!uidSalvo) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1 && window.history.state) {
          window.history.back();
          setTimeout(() => {
            const h = window.location.hash;
            if (!h || h === '#agendar' || h.startsWith('#agendar/')) {
              window.location.href = `/#${uidSalvo}`;
            }
          }, 400);
        } else {
          window.location.href = `/#${uidSalvo}`;
        }
      }}
      className="btn-voltar-lista tap-target"
      style={{
        fontFamily: "'Cinzel', serif",
        background:
          'linear-gradient(135deg, rgba(200, 162, 74, 0.12) 0%, rgba(168, 85, 247, 0.10) 100%)',
        color: '#2c163a',
        border: '1.5px solid #C8A24A',
        padding: '10px 20px',
        borderRadius: '25px',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.5px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        boxShadow: '0 3px 10px rgba(200, 162, 74, 0.15)',
        transition: 'all 0.25s ease',
        backdropFilter: 'blur(6px)',
        minHeight: 40,
      }}
    >
      <MdArrowBack size={15} color="#C8A24A" />
      Voltar para o menu da pasta
    </button>
  );
}

export default function TelaAgendamentoPublico({ uidEsteticista }) {
  const [config, setConfig] = useState(null);
  const [slots, setSlots] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [slotSelecionado, setSlotSelecionado] = useState(null);

  const [mesRef, setMesRef] = useState(() => new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [email, setEmail] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [lgpdAceito, setLgpdAceito] = useState(false);
  const [mostrarModalLgpd, setMostrarModalLgpd] = useState(false);
  const [telefone, setTelefone] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(null);
  const [erro, setErro] = useState('');

  const slotsPorDia = useMemo(() => {
    const map = {};
    for (const s of slots) {
      if (!map[s.data]) map[s.data] = [];
      map[s.data].push(s);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    }
    return map;
  }, [slots]);

// ============================================================
// Estado separado: config da agenda + agendamentos ocupados
// ============================================================
const [configAgenda, setConfigAgenda] = useState(null);
const [agendamentosOcupados, setAgendamentosOcupados] = useState([]);

// ============================================================
// Listener 1 — CONFIG da agenda (tempo real)
// ============================================================
useEffect(() => {
  if (!uidEsteticista) return;

  let cancelado = false;

  const unsub = onSnapshot(
    doc(db, `usuarios/${uidEsteticista}/agenda_config`, 'principal'),
    (snap) => {
      if (cancelado) return;

      if (!snap.exists()) {
        setErro('Agenda ainda não configurada pela profissional.');
        setConfigAgenda(null);
        setSlots([]);
        setCarregando(false);
        return;
      }

      setConfigAgenda(snap.data());
      setConfig(null); // compat — o `config` só é usado pra checar "erro && !config"
    },
    (err) => {
      console.error('Erro listener config:', err);
      setCarregando(false);
    }
  );

  return () => {
    cancelado = true;
    unsub();
  };
}, [uidEsteticista]);

// ============================================================
// Listener 2 — AGENDAMENTOS do período (tempo real)
// ============================================================
useEffect(() => {
  if (!uidEsteticista || !configAgenda) return;

  let cancelado = false;

  const hoje = toISODateLocal(new Date());
  const max = new Date();
  max.setDate(max.getDate() + (configAgenda.diasFuturosMaximo || 60));
  const dataFim = toISODateLocal(max);

  const unsub = onSnapshot(
    query(
      collection(db, 'agendamentos'),
      where('uidEsteticista', '==', uidEsteticista),
      where('data', '>=', hoje),
      where('data', '<=', dataFim)
    ),
    (snap) => {
      if (cancelado) return;
      const ocupados = snap.docs
        .map((d) => d.data())
        .filter((a) => a.status === 'pendente' || a.status === 'confirmado');
      setAgendamentosOcupados(ocupados);
      setCarregando(false);
    },
    (err) => {
      console.error('Erro listener agendamentos:', err);
      setCarregando(false);
    }
  );

  return () => {
    cancelado = true;
    unsub();
  };
}, [uidEsteticista, configAgenda]);

// ============================================================
// Recalcula slots SEMPRE que config ou agendamentos mudarem
// ============================================================
useEffect(() => {
  if (!configAgenda) return;

  const hoje = toISODateLocal(new Date());
  const max = new Date();
  max.setDate(max.getDate() + (configAgenda.diasFuturosMaximo || 60));
  const dataFim = toISODateLocal(max);

  const lista = gerarSlotsDisponiveis(
    configAgenda,
    agendamentosOcupados,
    hoje,
    dataFim
  );

  setSlots(lista);
}, [configAgenda, agendamentosOcupados]);

  const validarDocumento = (docStr) => {
    const trimmed = docStr.trim();
    if (trimmed.length < 5) {
      return 'Documento muito curto. Informe pelo menos 5 caracteres.';
    }
    if (trimmed.length > 30) {
      return 'Documento muito longo.';
    }
    const apenasDigitos = trimmed.replace(/\D/g, '');
    if (apenasDigitos.length === 11 && /^\d{11}$/.test(apenasDigitos)) {
      if (!validarCPF(apenasDigitos)) {
        return 'CPF brasileiro inválido. Confira os números ou use outro documento.';
      }
    }
    return null;
  };

  const agendar = async () => {
    setErro('');

    if (!nome.trim() || nome.trim().split(/\s+/).length < 2) {
      setErro('Por favor, informe seu nome completo.');
      return;
    }

    const erroDoc = validarDocumento(documento);
    if (erroDoc) {
      setErro(erroDoc);
      return;
    }

    if (!telefone || telefone.length < 8) {
      setErro('Informe um telefone válido com DDI.');
      return;
    }

    if (!lgpdAceito) {
      setErro('Você precisa autorizar o tratamento dos seus dados (LGPD).');
      return;
    }

    setEnviando(true);
    try {
      const codigo = gerarCodigoAutenticidade();
      const consentimento = {
        aceito: true,
        dataAceite: new Date().toISOString(),
        versaoTermo: '1.0',
        plataforma: detectarPlataforma(),
        userAgent: (navigator.userAgent || '').slice(0, 200),
      };

     const docRef = await addDoc(collection(db, 'agendamentos'), {
  uidEsteticista,
  profissionalId: uidEsteticista,   // ⬅️ NOVO

  data: slotSelecionado.data,
  horaInicio: slotSelecionado.horaInicio,
  horaFim: slotSelecionado.horaFim,
  duracaoMin: calcularDuracao(slotSelecionado),

  servicoId: null,                 
  servicoNome: null,                

  nome: nome.trim(),
        documento: documento.trim(),
        telefone: telefone,

        email: email.trim().toLowerCase(),
        observacoes: observacoes.trim(),
        status: 'pendente',
        criadoPor: 'publico',
        canceladoPor: null,
        consentimentoLGPD: consentimento,
        codigoAutenticidade: codigo,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });

      notificarAgendamento({
        tipoEvento: 'novo',
        uidEsteticista,
        agendamento: {
          id: docRef.id,
          nome: nome.trim(),
          data: slotSelecionado.data,
          horaInicio: slotSelecionado.horaInicio,
          documento: documento.trim(),
          telefone: telefone,
        },
      });

      setSucesso({
        data: slotSelecionado.data,
        hora: slotSelecionado.horaInicio,
        nome: nome.trim(),
        documento: documento.trim(),
      });
    } catch (e) {
      console.error('Erro ao agendar:', e);
      setErro('Erro ao confirmar agendamento. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  /* =================== RENDER =================== */

  // 1) Carregando
  if (carregando) {
    return (
      <>
        <TelaSemInternet />
        <div className="tap-tela">
          <div className="tap-conteudo">
            <BotaoVoltarProntuario />
            <AbasPublicas abaAtiva="agendar" />
            <div className="tap-card" style={{ padding: 0 }}>
              <LoadingElegante texto="Carregando agenda" />
            </div>
            <Rodape />
          </div>
          <BotaoWhatsApp />
          <EstilosTAP />
        </div>
      </>
    );
  }

  // 2) Config não encontrada
  if (erro && !config) {
    return (
      <>
        <TelaSemInternet />
        <div className="tap-tela">
          <div className="tap-conteudo">
            <BotaoVoltarProntuario />
            <AbasPublicas abaAtiva="agendar" />
            <div className="tap-card" style={{ textAlign: 'center' }}>
              <MdWarning size={40} color="#e65100" />
              <p style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>{erro}</p>
            </div>
            <Rodape />
          </div>
          <BotaoWhatsApp />
          <EstilosTAP />
        </div>
      </>
    );
  }

  // 3) Sucesso
  if (sucesso) {
    return (
      <>
        <TelaSemInternet />
        <div className="tap-tela">
          <div className="tap-conteudo" style={{ maxWidth: 520 }}>
            <BotaoVoltarProntuario />
            <AbasPublicas abaAtiva="agendar" />
            <div className="tap-card" style={{ textAlign: 'center' }}>
              <MdCheckCircle size={56} color="#16a34a" />
              <h2
                style={{
                  fontFamily: "'Cinzel', serif",
                  color: '#2c163a',
                  fontSize: 20,
                  margin: '12px 0 8px 0',
                }}
              >
                Agendamento solicitado!
              </h2>
              <p style={{ fontSize: 14, color: '#444' }}>
                <strong>{formatarDataLonga(sucesso.data)}</strong> às{' '}
                <strong>{sucesso.hora}</strong>
              </p>

              <div className="tap-instrucao">
                <p className="tap-instrucao-titulo">
                  Como acompanhar sua solicitação
                </p>
                <p className="tap-instrucao-texto">
                  Vá até a aba <strong>Consultar</strong> e informe seu{' '}
                  <strong>nome completo</strong> e o mesmo <strong>documento</strong>{' '}
                  que você usou agora. Você verá se a profissional{' '}
                  <strong>confirmou</strong> o horário.
                </p>
                <p className="tap-instrucao-hint">
                  Tire um print desta tela para não esquecer os dados usados.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginTop: 18,
                }}
              >
                <a
                  href="/#consultar"
                  className="tap-btn-acompanhar tap-target"
                  style={{ textDecoration: 'none' }}
                >
                  <MdSearch size={16} />
                  Ir para Consultar
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setSucesso(null);
                    setSlotSelecionado(null);
                    setDiaSelecionado(null);
                    setNome('');
                    setDocumento('');
                    setEmail('');
                    setObservacoes('');
                    setTelefone('');
                    setLgpdAceito(false);
                  }}
                  className="tap-btn-secundario tap-target"
                >
                  Fazer outro agendamento
                </button>
              </div>
            </div>
            <Rodape />
          </div>
          <BotaoWhatsApp />
          <EstilosTAP />
        </div>
      </>
    );
  }

  // 4) Tela principal
  return (
    <>
      <TelaSemInternet />
      <div className="tap-tela">
        <div className="tap-conteudo">
          <BotaoVoltarProntuario />
          <AbasPublicas abaAtiva="agendar" />

          <div className="tap-card">
            <h2
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#2c163a',
                margin: '0 0 8px 0',
                textAlign: 'center',
                fontSize: 22,
              }}
            >
              Agendar horário
            </h2>
            <p
              style={{
                fontSize: 12,
                color: '#666',
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              Samira Ferreira Estética & Cosmetologia
            </p>

            {slots.length === 0 ? (
              <div
                style={{
                  background: '#fff8e1',
                  border: '1px solid #fcd34d',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center',
                  fontSize: 13,
                  color: '#92400e',
                  lineHeight: 1.5,
                }}
              >
                <MdWarning
                  size={22}
                  color="#92400e"
                  style={{ verticalAlign: 'middle', marginRight: 6 }}
                />
                Agenda ainda não disponível. Tente novamente em alguns dias.
              </div>
            ) : (
              <>
                <h3 className="tap-secao"> Escolha a data</h3>

                <div className="tap-calendario-wrap">
                  <CalendarioAgenda
                    mesRef={mesRef}
                    onMudarMes={(delta) => {
                      const nova = new Date(mesRef);
                      nova.setMonth(nova.getMonth() + delta);
                      setMesRef(nova);
                      setDiaSelecionado(null);
                    }}
                    irHoje={() => {
                      setMesRef(new Date());
                      setDiaSelecionado(null);
                    }}
                    diaSelecionado={diaSelecionado}
                    compacto
                   renderDia={(data) => {
  const iso = toISODateLocal(data);
  const slotsDoDia = slotsPorDia[iso] || [];
  const temSlot = slotsDoDia.length > 0;
  return {
    status: temSlot ? 'aberto' : 'vazio',
    times: temSlot ? slotsDoDia.map((s) => s.horaInicio) : [],
    disabled: !temSlot,
    title: temSlot
      ? `${slotsDoDia.length} horário${slotsDoDia.length > 1 ? 's' : ''} disponível${slotsDoDia.length > 1 ? 'is' : ''}`
      : 'Sem vagas',
    onClick: (d) => setDiaSelecionado(toISODateLocal(d)),
  };
}}
                  />
                </div>
                <LegendaCalendario />

                {!diaSelecionado ? (
                  <div className="tap-hint-dia">
                    Toque em um dia com vagas no calendário para ver os horários.
                  </div>
                ) : (
                  <div style={{ marginTop: 16 }}>
                    <div className="tap-horarios-header">
                      <h4
                        style={{
                          fontFamily: "'Cinzel', serif",
                          fontSize: 12,
                          color: '#2c163a',
                          margin: 0,
                        }}
                      >
                        Horários de {formatarDataLonga(diaSelecionado)}
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setDiaSelecionado(null);
                          setSlotSelecionado(null);
                        }}
                        className="tap-btn-trocar-dia tap-target"
                      >
                        Trocar dia
                      </button>
                    </div>

                    <div className="tap-slots-grid">
                      {slotsPorDia[diaSelecionado]?.map((s, i) => {
                        const ativo =
                          slotSelecionado?.data === s.data &&
                          slotSelecionado?.horaInicio === s.horaInicio;
                        return (
                         <button
  key={i}
  type="button"
  onClick={() => setSlotSelecionado(s)}
  className={`tap-slot-btn${ativo ? ' ativo' : ''}`}
>
  {s.horaInicio}
</button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {slotSelecionado && (
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: '1px dashed #e2d2f5',
                }}
              >
                <h3 className="tap-secao">2. Seus dados</h3>

                <Campo label="Nome completo *">
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="tap-input"
                    placeholder="Como no documento"
                    autoComplete="name"
                  />
                </Campo>

                <Campo label="Documento * (CPF, RG, passaporte, ID…)">
                  <input
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    className="tap-input"
                    placeholder="Ex: 123.456.789-00 / AB123456 / 12345678Z"
                    autoComplete="off"
                  />
                  <span
                    style={{
                      display: 'block',
                      fontSize: 10.5,
                      color: '#7e22ce',
                      marginTop: 4,
                      lineHeight: 1.5,
                    }}
                  >
                    Guarde exatamente este nome e documento — você vai usá-los para
                    consultar depois.
                  </span>
                </Campo>

                <Campo label="Telefone / WhatsApp *">
                  <div className="tap-phone-wrap">
                    <PhoneInput
                      international
                      defaultCountry="BR"
                      value={telefone}
                      onChange={setTelefone}
                      placeholder="Digite seu número"
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: '#888',
                      marginTop: 4,
                      display: 'block',
                    }}
                  >
                    Será salvo como{' '}
                    <code style={{ color: '#7e22ce' }}>{telefone || '…'}</code>
                  </span>
                </Campo>

                <Campo label="E-mail (opcional)">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    className="tap-input"
                    placeholder="voce@email.com"
                    autoComplete="email"
                  />
                </Campo>

                <Campo label="Observações (opcional)">
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={3}
                    className="tap-input"
                    style={{ resize: 'vertical', minHeight: 70 }}
                    placeholder="Alguma informação que a profissional precise saber?"
                  />
                </Campo>

                <label
                  className={`tap-lgpd${lgpdAceito ? ' aceito' : ''}`}
                  style={{ cursor: 'pointer', marginTop: 10 }}
                >
                  <input
                    type="checkbox"
                    checked={lgpdAceito}
                    onChange={(e) => setLgpdAceito(e.target.checked)}
                    style={{ marginTop: 3, width: 20, height: 20, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 11.5, color: '#333', lineHeight: 1.6 }}>
                    Autorizo o tratamento dos meus dados pessoais e de saúde para
                    fins de agendamento e realização dos procedimentos, conforme a
                    LGPD.{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setMostrarModalLgpd(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#7e22ce',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: 0,
                      }}
                    >
                      Ver política
                    </button>
                  </span>
                </label>

                {erro && <div className="tap-erro">{erro}</div>}

                <button
                  type="button"
                  onClick={agendar}
                  disabled={enviando}
                  className="tap-btn-confirmar tap-target"
                >
                  {enviando ? 'ENVIANDO…' : 'CONFIRMAR AGENDAMENTO'}
                </button>
              </div>
            )}
          </div>

          <Rodape />
        </div>

        {mostrarModalLgpd && (
          <ModalConsentimentoAgendamento
            onFechar={() => setMostrarModalLgpd(false)}
          />
        )}

        <BotaoWhatsApp />
        <EstilosTAP />
      </div>
    </>
  );
}

/* ============================================================
   Estilos injetados — vivo, brilhante, responsivo
   ============================================================ */
export function EstilosTAP() {
  return (
    <style>{`
      /* ====== TELA — fundo vivo em 3 camadas ====== */
    /* ====== TELA — fundo vivo em 3 camadas (mais profundo) ====== */
.tap-tela {
  position: relative;
  min-height: 100vh;
  background:
    /* brilho superior esquerdo — roxo luminoso */
    radial-gradient(ellipse 85% 60% at 18% -10%,
      rgba(199, 125, 255, 0.60) 0%,
      transparent 65%),
    /* brilho superior direito — dourado quente */
    radial-gradient(ellipse 70% 55% at 100% -5%,
      rgba(226, 190, 100, 0.42) 0%,
      transparent 62%),
    /* brilho inferior direito — dourado suave */
    radial-gradient(ellipse 60% 50% at 100% 100%,
      rgba(200, 162, 74, 0.30) 0%,
      transparent 70%),
    /* brilho inferior esquerdo — ameixa profunda */
    radial-gradient(ellipse 65% 55% at 0% 105%,
      rgba(85, 40, 111, 0.35) 0%,
      transparent 70%),
    /* halo central — pulso lilás */
    radial-gradient(ellipse 50% 40% at 50% 50%,
      rgba(216, 180, 254, 0.30) 0%,
      transparent 75%),
    /* degradê base — mais profundo e saturado */
    linear-gradient(160deg,
      #b89fdb 0%,
      #c7b0e3 22%,
      #d5c1eb 45%,
      #c2a8e0 70%,
      #a385cc 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  padding: 30px 16px 100px 16px;
  padding-top: max(30px, env(safe-area-inset-top));
  font-family: 'Montserrat', sans-serif;
  box-sizing: border-box;
  overflow-x: hidden;
  isolation: isolate;
}
  /* ── Camada 1 — Aurora de blobs (movimento orbital) ── */
.tap-tela::before {
  content: '';
  position: fixed;
  inset: -30%;
  background-image:
    radial-gradient(circle 50% at 15% 20%,
      rgba(199, 125, 255, 0.65) 0%,
      rgba(168, 85, 247, 0.30) 35%,
      transparent 65%),
    radial-gradient(circle 55% at 85% 15%,
      rgba(255, 215, 128, 0.60) 0%,
      rgba(226, 190, 100, 0.30) 35%,
      transparent 65%),
    radial-gradient(circle 60% at 22% 88%,
      rgba(147, 51, 234, 0.55) 0%,
      rgba(126, 34, 206, 0.28) 35%,
      transparent 68%),
    radial-gradient(circle 50% at 90% 85%,
      rgba(250, 204, 100, 0.55) 0%,
      rgba(200, 162, 74, 0.25) 35%,
      transparent 65%),
    radial-gradient(circle 45% at 55% 50%,
      rgba(180, 100, 240, 0.40) 0%,
      rgba(85, 40, 111, 0.18) 40%,
      transparent 75%);
  z-index: 0;
  pointer-events: none;
  filter: blur(65px) saturate(150%);
  -webkit-filter: blur(65px) saturate(150%);
  animation: tapAurora 24s ease-in-out infinite alternate;
  will-change: transform;
  transform: translateZ(0);
}

      /* ── Camada 2 — Brilho varrendo diagonal ── */
      .tap-tela::after {
        content: '';
        position: fixed;
        inset: 0;
        background: linear-gradient(
          115deg,
          transparent 20%,
          rgba(255, 240, 200, 0.20) 35%,
          rgba(226, 190, 100, 0.28) 45%,
          rgba(255, 255, 255, 0.22) 52%,
          rgba(199, 125, 255, 0.24) 60%,
          rgba(168, 85, 247, 0.18) 68%,
          transparent 82%
        );
        background-size: 300% 100%;
        background-repeat: no-repeat;
        z-index: 0;
        pointer-events: none;
        animation: tapShine 14s linear infinite;
        will-change: background-position;
      }

      @keyframes tapAurora {
        0% {
          transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
        }
        25% {
          transform: translate3d(-6%, 4%, 0) scale(1.10) rotate(4deg);
        }
        50% {
          transform: translate3d(4%, -3%, 0) scale(1.04) rotate(-3deg);
        }
        75% {
          transform: translate3d(-3%, 5%, 0) scale(1.12) rotate(2deg);
        }
        100% {
          transform: translate3d(5%, -2%, 0) scale(1.06) rotate(-1deg);
        }
      }

      @keyframes tapShine {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      /* Acessibilidade: reduz movimento */
      @media (prefers-reduced-motion: reduce) {
        .tap-tela::before,
        .tap-tela::after,
        .tap-loading-anel,
        .tap-loading-logo,
        .tap-loading-texto,
        .tap-loading-pontos span,
        .tap-card,
        .tap-btn-confirmar::after,
        .tap-tab.ativo {
          animation: none !important;
          transition: none !important;
        }
      }

      /* ── Coluna de conteúdo ── */
      .tap-conteudo {
        position: relative;
        z-index: 2;
        width: 100%;
        max-width: 720px;
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
      }

      /* ── WhatsApp FAB ── */
      .tap-tela > .tap-whatsapp {
        position: fixed;
        right: 20px;
        bottom: 20px;
        bottom: max(20px, env(safe-area-inset-bottom));
        width: 58px;
        height: 58px;
        border-radius: 50%;
        background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow:
          0 8px 24px rgba(37, 211, 102, 0.55),
          0 0 0 0 rgba(37, 211, 102, 0.5);
        cursor: pointer;
        z-index: 100;
        text-decoration: none;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        border: 2px solid #ffffff;
      }
      .tap-tela > .tap-whatsapp:hover {
        transform: scale(1.08) translateY(-2px);
        box-shadow: 0 12px 32px rgba(37, 211, 102, 0.7);
      }
      .tap-tela > .tap-whatsapp::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: rgba(37, 211, 102, 0.5);
        animation: tapPulse 2s ease-out infinite;
        z-index: -1;
      }
      @keyframes tapPulse {
        0%   { transform: scale(1);   opacity: 0.7; }
        100% { transform: scale(1.6); opacity: 0;   }
      }

      /* ── RODAPÉ ── */
      .tap-rodape {
        margin-top: auto;
        padding: 44px 12px 10px 12px;
        text-align: center;
        font-family: 'Montserrat', sans-serif;
        font-size: 14px;
        font-weight: 600;
        color: #4b2a68;
        letter-spacing: 0.4px;
        width: 100%;
        box-sizing: border-box;
        flex-shrink: 0;
        text-shadow: 0 1px 2px rgba(255, 255, 255, 0.7);
      }
      .tap-rodape-texto {
        display: inline-block;
        line-height: 1.6;
      }
      .tap-rodape-link {
        color: #7e22ce;
        font-weight: 800;
        text-decoration: none;
        border-bottom: 1.5px dashed rgba(126, 34, 206, 0.55);
        padding-bottom: 2px;
        transition: color 0.2s ease, border-color 0.2s ease;
      }
      .tap-rodape-link:hover {
        color: #a86a00;
        border-bottom-color: #C8A24A;
      }

      /* ═══════════════════════════════════════════════
         LOADING ELEGANTE — órbitas + logo pulsando
         ═══════════════════════════════════════════════ */
      .tap-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 24px 50px 24px;
        gap: 22px;
      }
      .tap-loading-orbe {
        position: relative;
        width: 110px;
        height: 110px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .tap-loading-anel {
        position: absolute;
        border-radius: 50%;
        border-style: solid;
        border-color: transparent;
        will-change: transform;
      }
      .tap-loading-anel-1 {
        inset: 0;
        border-width: 3px;
        border-top-color: #a855f7;
        border-right-color: #a855f7;
        animation: tapSpin 1.4s linear infinite;
        filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.6));
      }
      .tap-loading-anel-2 {
        inset: 12px;
        border-width: 2.5px;
        border-bottom-color: #C8A24A;
        border-left-color: #C8A24A;
        animation: tapSpinReverse 2s linear infinite;
        filter: drop-shadow(0 0 6px rgba(200, 162, 74, 0.6));
      }
      .tap-loading-anel-3 {
        inset: 24px;
        border-width: 2px;
        border-top-color: rgba(126, 34, 206, 0.7);
        border-left-color: rgba(126, 34, 206, 0.7);
        animation: tapSpin 2.6s linear infinite;
      }
      .tap-loading-logo {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        object-fit: cover;
        opacity: 0.9;
        animation: tapPulseLogo 1.8s ease-in-out infinite;
        box-shadow: 0 0 20px rgba(168, 85, 247, 0.35);
      }
      .tap-loading-texto {
        font-family: 'Cinzel', serif;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        color: #55286f;
        background: linear-gradient(90deg,
          #55286f 0%,
          #a855f7 30%,
          #C8A24A 50%,
          #a855f7 70%,
          #55286f 100%);
        background-size: 200% auto;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: tapShimmerText 3s linear infinite;
      }
      .tap-loading-pontos {
        display: flex;
        gap: 8px;
        margin-top: -6px;
      }
      .tap-loading-pontos span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: linear-gradient(135deg, #a855f7, #C8A24A);
        animation: tapBounce 1.2s ease-in-out infinite;
        box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
      }
      .tap-loading-pontos span:nth-child(2) { animation-delay: 0.15s; }
      .tap-loading-pontos span:nth-child(3) { animation-delay: 0.30s; }

      @keyframes tapSpin {
        to { transform: rotate(360deg); }
      }
      @keyframes tapSpinReverse {
        to { transform: rotate(-360deg); }
      }
      @keyframes tapPulseLogo {
        0%, 100% { transform: scale(1);    opacity: 0.9; }
        50%      { transform: scale(1.12); opacity: 1;   }
      }
      @keyframes tapShimmerText {
        0%   { background-position: 200% center; }
        100% { background-position: -200% center; }
      }
      @keyframes tapBounce {
        0%, 80%, 100% { transform: scale(1)   translateY(0);    opacity: 0.55; }
        40%           { transform: scale(1.4) translateY(-4px); opacity: 1;    }
      }

      /* ── ABAS ── */
      .tap-tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 14px;
        background: rgba(255, 255, 255, 0.82);
        backdrop-filter: blur(14px) saturate(150%);
        -webkit-backdrop-filter: blur(14px) saturate(150%);
        border: 1px solid rgba(200, 162, 74, 0.55);
        border-radius: 14px;
        padding: 5px;
        box-shadow:
          0 4px 16px rgba(44, 22, 58, 0.14),
          inset 0 1px 0 rgba(255, 255, 255, 0.7);
      }
      .tap-tab {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 11px 12px;
        border-radius: 10px;
        font-family: 'Cinzel', serif;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.4px;
        color: #55286f;
        text-decoration: none;
        background: transparent;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        min-height: 44px;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
      }
      .tap-tab:hover {
        background: rgba(168, 85, 247, 0.12);
      }
      .tap-tab.ativo {
        background: linear-gradient(135deg, #C8A24A 0%, #e2be64 100%);
        color: #fff;
        box-shadow:
          0 3px 12px rgba(200, 162, 74, 0.5),
          inset 0 1px 0 rgba(255, 255, 255, 0.4);
      }
      /* Brilho periódico na aba ativa */
      .tap-tab.ativo::after {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 60%;
        height: 100%;
        background: linear-gradient(
          100deg,
          transparent,
          rgba(255, 255, 255, 0.5) 50%,
          transparent
        );
        animation: tapTabShine 3.5s ease-in-out infinite;
        pointer-events: none;
      }
      @keyframes tapTabShine {
        0%   { left: -100%; }
        55%  { left: 200%;  }
        100% { left: 200%;  }
      }

      /* ── CARD — com brilho passando no topo ── */
      .tap-card {
        position: relative;
        background: rgba(255, 255, 255, 0.94);
        border-radius: 20px;
        border: 1.5px solid #C8A24A;
        padding: 28px;
        width: 100%;
        box-shadow:
          0 20px 55px rgba(44, 22, 58, 0.22),
          0 0 0 1px rgba(255, 255, 255, 0.6) inset,
          0 0 40px rgba(168, 85, 247, 0.10);
        box-sizing: border-box;
        backdrop-filter: blur(12px) saturate(130%);
        -webkit-backdrop-filter: blur(12px) saturate(130%);
        overflow: hidden;
      }
      /* Linha brilhante varrendo o card de tempos em tempos */
      .tap-card::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -120%;
        width: 70%;
        height: 3px;
        background: linear-gradient(
          90deg,
          transparent,
          #C8A24A 30%,
          #fff4c8 50%,
          #a855f7 70%,
          transparent
        );
        filter: blur(0.5px);
        animation: tapCardShine 5s ease-in-out infinite;
        pointer-events: none;
      }
      @keyframes tapCardShine {
        0%   { left: -120%; }
        40%  { left: 130%;  }
        100% { left: 130%;  }
      }

      .tap-secao {
        font-family: 'Cinzel', serif;
        font-size: 13px;
        color: #2c163a;
        margin-bottom: 10px;
        letter-spacing: 0.3px;
      }

      .tap-input {
        width: 100%;
        padding: 11px 12px;
        border: 1.5px solid #ccc;
        border-radius: 8px;
        font-size: 14px;
        outline: none;
        box-sizing: border-box;
        font-family: inherit;
        color: #2c163a;
        background: #fff;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        min-height: 44px;
      }
      .tap-input:focus {
        border-color: #a855f7;
        box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.18);
      }

      .tap-calendario-wrap {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .tap-hint-dia {
        margin-top: 16px;
        padding: 16px;
        background: #faf5ff;
        border: 1.5px dashed #d8b4fe;
        border-radius: 12px;
        text-align: center;
        font-size: 12px;
        color: #666;
        line-height: 1.5;
      }

      .tap-horarios-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        gap: 8px;
        flex-wrap: wrap;
      }

      .tap-btn-trocar-dia {
        background: transparent;
        border: 1px solid #ddd;
        border-radius: 12px;
        padding: 6px 12px;
        font-size: 10px;
        color: #666;
        cursor: pointer;
        font-family: inherit;
        min-height: 32px;
      }

      .tap-slots-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
        gap: 8px;
      }

      .tap-slot-btn {
        padding: 12px 8px;
        border-radius: 10px;
        border: 1.5px solid #d8b4fe;
        background: #fff;
        cursor: pointer;
        text-align: center;
        font-size: 13px;
        font-weight: 600;
        color: #2c163a;
        transition: all 0.18s ease;
        font-family: inherit;
        min-height: 44px;
      }
      .tap-slot-btn:hover {
        border-color: #a855f7;
        background: #faf5ff;
        transform: translateY(-2px);
        box-shadow: 0 6px 14px rgba(168, 85, 247, 0.22);
      }
      .tap-slot-btn.ativo {
        border: 2px solid #7e22ce;
        background: linear-gradient(135deg, #faf5ff, #f5edff);
        color: #7e22ce;
        font-weight: 700;
        box-shadow:
          0 0 0 3px rgba(168, 85, 247, 0.18),
          0 6px 14px rgba(168, 85, 247, 0.20);
        transform: scale(1.03);
      }

      .tap-phone-wrap .PhoneInput {
        width: 100%;
        border: 1.5px solid #ccc;
        border-radius: 8px;
        padding: 6px 10px;
        background: #fff;
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        box-sizing: border-box;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .tap-phone-wrap .PhoneInput:focus-within {
        border-color: #a855f7;
        box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.18);
      }
      .tap-phone-wrap .PhoneInputInput {
        border: none;
        outline: none;
        font-size: 14px;
        font-family: inherit;
        color: #2c163a;
        background: transparent;
        width: 100%;
        min-width: 0;
      }
      .tap-phone-wrap .PhoneInputCountry {
        flex-shrink: 0;
      }

      .tap-lgpd {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        background: #faf5ff;
        border: 1.5px solid #d8b4fe;
        border-radius: 10px;
        padding: 12px;
        transition: background 0.2s ease, border-color 0.2s ease;
      }
      .tap-lgpd.aceito {
        background: #f0fdf4;
        border-color: #86efac;
      }

      .tap-erro {
        background: #fde8e8;
        border: 1px solid #f98080;
        color: #c81e1e;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        margin-top: 12px;
        line-height: 1.5;
      }

      .tap-btn-confirmar {
        position: relative;
        margin-top: 18px;
        width: 100%;
        background: linear-gradient(135deg, #C8A24A, #e2be64);
        color: #fff;
        border: 1.5px solid #9c7826;
        padding: 14px;
        border-radius: 22px;
        font-family: 'Cinzel', serif;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 1px;
        cursor: pointer;
        min-height: 48px;
        overflow: hidden;
        transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        box-shadow:
          0 6px 20px rgba(200, 162, 74, 0.45),
          inset 0 1px 0 rgba(255, 255, 255, 0.3);
      }
      .tap-btn-confirmar::after {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 60%;
        height: 100%;
        background: linear-gradient(
          100deg,
          transparent,
          rgba(255, 255, 255, 0.45) 50%,
          transparent
        );
        animation: tapTabShine 3s ease-in-out infinite;
        pointer-events: none;
      }
      .tap-btn-confirmar:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow:
          0 12px 28px rgba(200, 162, 74, 0.6),
          inset 0 1px 0 rgba(255, 255, 255, 0.3);
      }
      .tap-btn-confirmar:disabled {
        opacity: 0.7;
        cursor: wait;
      }

      .tap-btn-acompanhar {
        width: 100%;
        font-family: 'Cinzel', serif;
        background: linear-gradient(135deg, rgba(200, 162, 74, 0.15) 0%, rgba(168, 85, 247, 0.13) 100%);
        color: #7e22ce;
        border: 1.5px solid #7e22ce;
        padding: 12px 24px;
        border-radius: 22px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.5px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-shadow: 0 3px 12px rgba(126, 34, 206, 0.2);
        transition: all 0.25s ease;
        min-height: 48px;
        box-sizing: border-box;
      }
      .tap-btn-acompanhar:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 22px rgba(126, 34, 206, 0.35);
      }

      .tap-btn-secundario {
        width: 100%;
        font-family: 'Cinzel', serif;
        background: transparent;
        color: #55286f;
        border: 1.5px solid rgba(85, 40, 111, 0.4);
        padding: 11px 20px;
        border-radius: 22px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.4px;
        cursor: pointer;
        min-height: 44px;
        transition: all 0.2s ease;
        box-sizing: border-box;
      }
      .tap-btn-secundario:hover {
        background: rgba(85, 40, 111, 0.08);
      }

      .tap-instrucao {
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        border: 1.5px solid #86efac;
        border-radius: 14px;
        padding: 14px 16px;
        margin-top: 18px;
        text-align: left;
      }
      .tap-instrucao-titulo {
        font-family: 'Cinzel', serif;
        font-size: 12.5px;
        font-weight: 700;
        color: #166534;
        margin: 0 0 6px 0;
        line-height: 1.4;
      }
      .tap-instrucao-texto {
        font-size: 12px;
        color: #14532d;
        margin: 0 0 8px 0;
        line-height: 1.6;
      }
      .tap-instrucao-hint {
        font-size: 11px;
        color: #4b7a5a;
        font-style: italic;
        margin: 0;
        line-height: 1.5;
      }

      .btn-voltar-lista {
        transition: all 0.25s ease-in-out !important;
      }
      .btn-voltar-lista:hover {
        transform: translateX(-3px);
        background: linear-gradient(135deg, rgba(200, 162, 74, 0.25) 0%, rgba(168, 85, 247, 0.20) 100%) !important;
        box-shadow: 0 6px 18px rgba(200, 162, 74, 0.4) !important;
        border-color: #a8852f !important;
      }
      .btn-voltar-lista:active {
        transform: translateX(-1px) scale(0.98);
      }

      /* ====== RESPONSIVO ====== */
      @media (min-width: 768px) {
        .tap-tela { padding: 40px 24px 110px 24px; }
        .tap-card { padding: 32px; }
        .tap-slots-grid {
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 10px;
        }
        .tap-tela > .tap-whatsapp {
          width: 64px;
          height: 64px;
          right: 28px;
          bottom: 28px;
        }
        .tap-rodape {
          font-size: 15px;
          padding-top: 56px;
        }
        .tap-loading { padding: 80px 32px 70px 32px; }
        .tap-loading-orbe { width: 130px; height: 130px; }
        .tap-loading-logo { width: 52px; height: 52px; }
        .tap-loading-texto { font-size: 14px; }
      }

      @media (max-width: 640px) {
        .tap-tela { padding: 18px 12px 90px 12px; }
        .tap-card {
          padding: 20px 16px;
          border-radius: 18px;
        }
        .tap-card h2 { font-size: 19px !important; }
        .tap-secao { font-size: 12px; }

        .tap-input,
        .tap-phone-wrap .PhoneInputInput {
          font-size: 16px;
        }

        .tap-tab {
          font-size: 11.5px;
          padding: 10px 8px;
          gap: 4px;
        }
        .tap-tab svg { width: 14px; height: 14px; }

        .tap-slots-grid {
          grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
          gap: 6px;
        }
        .tap-slot-btn {
          padding: 10px 6px;
          font-size: 13px;
        }

        .tap-btn-confirmar {
          font-size: 12px;
          letter-spacing: 0.6px;
          padding: 14px 12px;
        }

        .tap-btn-acompanhar {
          font-size: 11.5px;
          padding: 12px 16px;
        }

        .tap-hint-dia {
          padding: 14px 12px;
          font-size: 11.5px;
        }

        .tap-instrucao {
          padding: 12px 14px;
        }
        .tap-instrucao-titulo { font-size: 12px; }
        .tap-instrucao-texto { font-size: 11.5px; }

        .tap-tela > .tap-whatsapp {
          width: 54px;
          height: 54px;
          right: 16px;
          bottom: 16px;
          bottom: max(16px, env(safe-area-inset-bottom));
        }

        .tap-rodape {
          font-size: 13px;
          padding: 36px 10px 8px 10px;
        }

        /* Mobile: blur reduzido = GPU mais leve, mais FPS */
        .tap-tela::before {
          filter: blur(45px) saturate(135%);
          -webkit-filter: blur(45px) saturate(135%);
        }

        /* Loading mais compacto */
        .tap-loading { padding: 50px 18px 40px 18px; gap: 18px; }
        .tap-loading-orbe { width: 92px; height: 92px; }
        .tap-loading-logo { width: 38px; height: 38px; }
        .tap-loading-texto { font-size: 12px; letter-spacing: 1px; }
      }

      @media (max-width: 380px) {
        .tap-tela { padding: 12px 8px 88px 8px; }
        .tap-card {
          padding: 16px 12px;
          border-radius: 14px;
        }
        .tap-slots-grid {
          grid-template-columns: repeat(4, 1fr);
          gap: 5px;
        }
        .tap-slot-btn {
          font-size: 12px;
          padding: 10px 2px;
          min-height: 42px;
        }
        .btn-voltar-lista {
          font-size: 11px !important;
          padding: 9px 14px !important;
        }
        .tap-tabs {
          border-radius: 12px;
          padding: 4px;
        }
        .tap-tab {
          font-size: 11px;
          padding: 9px 6px;
        }
        .tap-rodape {
          font-size: 12.5px;
        }
      }

      .tap-target {
        min-height: 40px;
      }

      @media (max-height: 500px) and (orientation: landscape) {
        .tap-tela { padding: 12px 12px 90px 12px; }
        .tap-card { padding: 16px; }
        .tap-loading { padding: 30px 20px 30px 20px; gap: 14px; }
        .tap-loading-orbe { width: 80px; height: 80px; }
        .tap-loading-logo { width: 32px; height: 32px; }
      }
    `}</style>
  );
}

/* ============================================================
   Helpers
   ============================================================ */
function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 700,
          color: '#2c163a',
          marginBottom: 4,
          letterSpacing: '0.2px',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function formatarDataLonga(iso) {
  const [ano, mes, dia] = iso.split('-');
  const d = new Date(iso + 'T12:00:00');
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return `${dias[d.getDay()]}, ${dia}/${mes}/${ano}`;
}

function calcularDuracao(slot) {
  const [h1, m1] = slot.horaInicio.split(':').map(Number);
  const [h2, m2] = slot.horaFim.split(':').map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
}

function detectarPlataforma() {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad/i.test(ua)) return 'ios';
  return 'web';
}