// src/components/agendamento/TelaAgendamentoPublico.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, getDocs, addDoc, doc, getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  gerarSlotsDisponiveis, gerarCodigoAutenticidade, validarCPF, toISODateLocal,
} from '../../utils/agenda';
import { notificarAgendamento } from '../../utils/agendamentoNotify';
import {
  MdCheckCircle, MdWarning, MdArrowBack, MdSearch, MdCalendarMonth,
} from 'react-icons/md';
import ModalConsentimentoAgendamento from './ModalConsentimentoAgendamento';
import CalendarioAgenda, { LegendaCalendario } from './CalendarioAgenda';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

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

  useEffect(() => {
    if (!uidEsteticista) return;
    (async () => {
      try {
        const cfgSnap = await getDoc(
          doc(db, `usuarios/${uidEsteticista}/agenda_config`, 'principal')
        );
        if (!cfgSnap.exists()) {
          setErro('Agenda ainda não configurada pela profissional.');
          setCarregando(false);
          return;
        }
        const cfg = cfgSnap.data();
        setConfig(cfg);

        const hoje = toISODateLocal(new Date());
        const max = new Date();
        max.setDate(max.getDate() + (cfg.diasFuturosMaximo || 60));
        const dataFim = toISODateLocal(max);

        const ocupSnap = await getDocs(
          query(
            collection(db, 'agendamentos'),
            where('uidEsteticista', '==', uidEsteticista),
            where('data', '>=', hoje),
            where('data', '<=', dataFim)
          )
        );
        const ocupados = ocupSnap.docs
          .map((d) => d.data())
          .filter((a) => a.status === 'pendente' || a.status === 'confirmado');

        const lista = gerarSlotsDisponiveis(cfg, ocupados, hoje, dataFim);
        setSlots(lista);
      } catch (e) {
        console.error('Erro ao carregar agenda:', e);
        setErro('Não foi possível carregar a agenda. Tente novamente.');
      } finally {
        setCarregando(false);
      }
    })();
  }, [uidEsteticista]);

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
        data: slotSelecionado.data,
        horaInicio: slotSelecionado.horaInicio,
        horaFim: slotSelecionado.horaFim,
        duracaoMin: calcularDuracao(slotSelecionado),

        nome: nome.trim(),
        documento: documento.trim(),
        telefone: telefone,

        email: email.trim().toLowerCase(),
        observacoes: observacoes.trim(),
        status: 'pendente',
        criadoPor: 'publico',
        canceladoPor: null,
        consentimentoLGPD: consentimento,
        codigoAutenticidade: codigo, // mantido no doc (uso interno), mas não exibido
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
  if (carregando) {
    return (
      <div className="tap-tela">
        <div style={{ width: '100%', maxWidth: 720 }}>
          <BotaoVoltarProntuario />
          <AbasPublicas abaAtiva="agendar" />
          <div className="tap-card" style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
              Carregando agenda…
            </p>
          </div>
        </div>
        <EstilosTAP />
      </div>
    );
  }

  if (erro && !config) {
    return (
      <div className="tap-tela">
        <div style={{ width: '100%', maxWidth: 720 }}>
          <BotaoVoltarProntuario />
          <AbasPublicas abaAtiva="agendar" />
          <div className="tap-card" style={{ textAlign: 'center' }}>
            <MdWarning size={40} color="#e65100" />
            <p style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>{erro}</p>
          </div>
        </div>
        <EstilosTAP />
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="tap-tela">
        <div style={{ width: '100%', maxWidth: 520 }}>
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
        </div>
        <EstilosTAP />
      </div>
    );
  }

  return (
    <div className="tap-tela">
      <div style={{ width: '100%', maxWidth: 720 }}>
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
              <h3 className="tap-secao">1. Escolha a data</h3>

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
                    const qtd = slotsPorDia[iso]?.length || 0;
                    const temSlot = qtd > 0;
                    return {
                      status: temSlot ? 'aberto' : 'vazio',
                      badge: temSlot ? `${qtd}×` : null,
                      disabled: !temSlot,
                      title: temSlot
                        ? `${qtd} horário${qtd > 1 ? 's' : ''} disponível${qtd > 1 ? 'is' : ''}`
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
      </div>

      {mostrarModalLgpd && (
        <ModalConsentimentoAgendamento
          onFechar={() => setMostrarModalLgpd(false)}
        />
      )}

      <EstilosTAP />
    </div>
  );
}

/* ============================================================
   Estilos injetados — responsivo (com abas)
   ============================================================ */
export function EstilosTAP() {
  return (
    <style>{`
      .tap-tela {
        min-height: 100vh;
        background: #f3eef8;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 30px 16px;
        padding-top: max(30px, env(safe-area-inset-top));
        font-family: 'Montserrat', sans-serif;
        box-sizing: border-box;
      }

      /* ====== ABAS ====== */
      .tap-tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 14px;
        background: rgba(255, 255, 255, 0.55);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(200, 162, 74, 0.35);
        border-radius: 14px;
        padding: 5px;
        box-shadow: 0 3px 10px rgba(44, 22, 58, 0.05);
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
      }
      .tap-tab:hover {
        background: rgba(168, 85, 247, 0.08);
      }
      .tap-tab.ativo {
        background: linear-gradient(135deg, #C8A24A 0%, #e2be64 100%);
        color: #fff;
        box-shadow: 0 3px 10px rgba(200, 162, 74, 0.35);
      }

      .tap-card {
        background: #fff;
        border-radius: 20px;
        border: 1.5px solid #C8A24A;
        padding: 28px;
        width: 100%;
        box-shadow: 0 15px 40px rgba(44, 22, 58, 0.15);
        box-sizing: border-box;
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
        box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15);
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
        transition: all 0.15s ease;
        font-family: inherit;
        min-height: 44px;
      }
      .tap-slot-btn:hover {
        border-color: #a855f7;
        background: #faf5ff;
      }
      .tap-slot-btn.ativo {
        border: 2px solid #7e22ce;
        background: #faf5ff;
        color: #7e22ce;
        font-weight: 700;
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
        box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15);
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
        transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        box-shadow: 0 4px 14px rgba(200, 162, 74, 0.3);
      }
      .tap-btn-confirmar:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(200, 162, 74, 0.4);
      }
      .tap-btn-confirmar:disabled {
        opacity: 0.7;
        cursor: wait;
      }

      .tap-btn-acompanhar {
        width: 100%;
        font-family: 'Cinzel', serif;
        background: linear-gradient(135deg, rgba(200, 162, 74, 0.12) 0%, rgba(168, 85, 247, 0.10) 100%);
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
        box-shadow: 0 3px 10px rgba(126, 34, 206, 0.15);
        transition: all 0.25s ease;
        min-height: 48px;
        box-sizing: border-box;
      }
      .tap-btn-acompanhar:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(126, 34, 206, 0.3);
      }

      .tap-btn-secundario {
        width: 100%;
        font-family: 'Cinzel', serif;
        background: transparent;
        color: #55286f;
        border: 1.5px solid rgba(85, 40, 111, 0.35);
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
        background: rgba(85, 40, 111, 0.06);
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
        background: linear-gradient(135deg, rgba(200, 162, 74, 0.22) 0%, rgba(168, 85, 247, 0.18) 100%) !important;
        box-shadow: 0 6px 18px rgba(200, 162, 74, 0.35) !important;
        border-color: #a8852f !important;
      }
      .btn-voltar-lista:active {
        transform: translateX(-1px) scale(0.98);
      }

      /* ====== RESPONSIVO ====== */
      @media (min-width: 768px) {
        .tap-tela { padding: 40px 24px; }
        .tap-card { padding: 32px; }
        .tap-slots-grid {
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 10px;
        }
      }

      @media (max-width: 640px) {
        .tap-tela { padding: 18px 12px; }
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
      }

      @media (max-width: 380px) {
        .tap-tela { padding: 12px 8px; }
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
      }

      .tap-target {
        min-height: 40px;
      }

      @media (max-height: 500px) and (orientation: landscape) {
        .tap-tela { padding: 12px; }
        .tap-card { padding: 16px; }
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