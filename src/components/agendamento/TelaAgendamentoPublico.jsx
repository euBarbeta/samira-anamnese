// src/components/agendamento/TelaAgendamentoPublico.jsx
import React, { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs, addDoc, doc, getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  gerarSlotsDisponiveis, gerarCodigoAutenticidade, validarCPF,
} from '../../utils/agenda';
import { notificarAgendamento } from '../../utils/agendamentoNotify';
import { MdCheckCircle, MdWarning } from 'react-icons/md';
import ModalConsentimentoAgendamento from './ModalConsentimentoAgendamento';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';


/* ============================================================
   Lista de países suportados (pode ampliar depois)
   ============================================================ */
const PAISES = [
  { code: 'BR', nome: 'Brasil',        ddi: '55',  flag: '🇧🇷', mask: '(##) #####-####' },
  { code: 'PT', nome: 'Portugal',      ddi: '351', flag: '🇵🇹', mask: '### ### ###' },
  { code: 'US', nome: 'Estados Unidos',ddi: '1',   flag: '🇺🇸', mask: '(###) ###-####' },
  { code: 'ES', nome: 'Espanha',       ddi: '34',  flag: '🇪🇸', mask: '### ## ## ##' },
  { code: 'IT', nome: 'Itália',        ddi: '39',  flag: '🇮🇹', mask: '### ### ####' },
  { code: 'FR', nome: 'França',        ddi: '33',  flag: '🇫🇷', mask: '# ## ## ## ##' },
  { code: 'DE', nome: 'Alemanha',      ddi: '49',  flag: '🇩🇪', mask: '#### #######' },
  { code: 'GB', nome: 'Reino Unido',   ddi: '44',  flag: '🇬🇧', mask: '#### ######' },
  { code: 'AR', nome: 'Argentina',     ddi: '54',  flag: '🇦🇷', mask: '## ####-####' },
  { code: 'CL', nome: 'Chile',         ddi: '56',  flag: '🇨🇱', mask: '# #### ####' },
  { code: 'MX', nome: 'México',        ddi: '52',  flag: '🇲🇽', mask: '## #### ####' },
  { code: 'CO', nome: 'Colômbia',      ddi: '57',  flag: '🇨🇴', mask: '### ### ####' },
  { code: 'PY', nome: 'Paraguai',      ddi: '595', flag: '🇵🇾', mask: '### ### ###' },
  { code: 'UY', nome: 'Uruguai',       ddi: '598', flag: '🇺🇾', mask: '## ### ###' },
  { code: 'JP', nome: 'Japão',         ddi: '81',  flag: '🇯🇵', mask: '##-####-####' },
  { code: 'CA', nome: 'Canadá',        ddi: '1',   flag: '🇨🇦', mask: '(###) ###-####' },
];

/* ============================================================
   Detecta país pelo idioma do navegador (fallback simples)
   ============================================================ */
function detectarPaisPadrao() {
  try {
    const lang = (navigator.language || 'pt-BR').toUpperCase();
    const map = {
      'PT': 'PT', 'BR': 'BR', 'US': 'US', 'ES': 'ES', 'IT': 'IT',
      'FR': 'FR', 'DE': 'DE', 'GB': 'GB', 'AR': 'AR', 'CL': 'CL',
      'MX': 'MX', 'CO': 'CO', 'PY': 'PY', 'UY': 'UY', 'JP': 'JP', 'CA': 'CA',
    };
    const regiao = lang.split('-')[1];
    if (regiao && map[regiao]) return map[regiao];
    if (regiao === 'EN') return 'US';
  } catch {}
  return 'BR';
}

export default function TelaAgendamentoPublico({ uidEsteticista }) {
  const [config, setConfig] = useState(null);
  const [slots, setSlots] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [slotSelecionado, setSlotSelecionado] = useState(null);

  // Formulário
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
   const [email, setEmail] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [lgpdAceito, setLgpdAceito] = useState(false);
  const [mostrarModalLgpd, setMostrarModalLgpd] = useState(false);
  const [telefone, setTelefone] = useState(''); // valor E.164, ex: +5511999999999

  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(null);
  const [erro, setErro] = useState('');

 

  // Carrega config + slots (sem mudanças)
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

        const hoje = new Date().toISOString().slice(0, 10);
        const max = new Date();
        max.setDate(max.getDate() + (cfg.diasFuturosMaximo || 60));
        const dataFim = max.toISOString().slice(0, 10);

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

  /* ============================================================
     Validação do documento (flexível, multi-país)
     ============================================================ */
  const validarDocumento = (docStr) => {
    const trimmed = docStr.trim();
    if (trimmed.length < 5) {
      return 'Documento muito curto. Informe pelo menos 5 caracteres.';
    }
    if (trimmed.length > 30) {
      return 'Documento muito longo.';
    }

    // Se for só dígitos e tiver 11 → provavelmente é CPF brasileiro
    const apenasDigitos = trimmed.replace(/\D/g, '');
    if (apenasDigitos.length === 11 && /^\d{11}$/.test(apenasDigitos)) {
      if (!validarCPF(apenasDigitos)) {
        return 'CPF brasileiro inválido. Confira os números ou use outro documento.';
      }
    }
    return null;
  };

  /* ============================================================
     Validação do telefone (flexível, multi-país)
     ============================================================ */
  const validarTelefone = (digits) => {
    if (!digits) return 'Informe seu telefone.';
    if (digits.length < 6) return 'Telefone muito curto.';
    if (digits.length > 15) return 'Telefone muito longo.'; // E.164 max = 15
    return null;
  };

  /* ============================================================
     Formata o telefone conforme a máscara do país (visual)
     ============================================================ */
  const aplicarMascaraTelefone = (valor, mask) => {
    const digits = valor.replace(/\D/g, '');
    let out = '';
    let di = 0;
    for (let i = 0; i < mask.length && di < digits.length; i++) {
      if (mask[i] === '#') {
        out += digits[di++];
      } else {
        out += mask[i];
      }
    }
    // Se sobrar dígito, adiciona no final
    if (di < digits.length) out += digits.slice(di);
    return out;
  };

  const agendar = async () => {
    setErro('');

    // 1) Nome
    if (!nome.trim() || nome.trim().split(/\s+/).length < 2) {
      setErro('Por favor, informe seu nome completo.');
      return;
    }

    // 2) Documento
    const erroDoc = validarDocumento(documento);
    if (erroDoc) {
      setErro(erroDoc);
      return;
    }

   // 3) Telefone
if (!telefone || telefone.length < 8) {
  setErro('Informe um telefone válido com DDI.');
  return;
}

    // 4) LGPD
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

      // ✅ Salva telefone em formato E.164 (+DDI + número)
      const telefoneE164 = `+${paisAtual.ddi}${telDigits}`;

     const docRef = await addDoc(collection(db, 'agendamentos'), {
  uidEsteticista,
  data: slotSelecionado.data,
  horaInicio: slotSelecionado.horaInicio,
  horaFim: slotSelecionado.horaFim,
  duracaoMin: calcularDuracao(slotSelecionado),

  nome: nome.trim(),
  documento: documento.trim(),
  telefone: telefone,             // ✅ já vem em E.164 do PhoneInput

  email: email.trim().toLowerCase(),
  observacoes: observacoes.trim(),
  status: 'pendente',
  canceladoPor: null,
  consentimentoLGPD: consentimento,
  codigoAutenticidade: codigo,
  criadoEm: new Date().toISOString(),
  atualizadoEm: new Date().toISOString(),
});

      // Notifica a esteticista (push + e-mail placeholder)
      notificarAgendamento({
        tipoEvento: 'novo',
        uidEsteticista,
        agendamento: {
          id: docRef.id,
          nome: nome.trim(),
          data: slotSelecionado.data,
          horaInicio: slotSelecionado.horaInicio,
          documento: documento.trim(),
          telefone: telefoneE164,
          paisCodigo: paisAtual.code,
        },
      });

      setSucesso({
        codigo,
        data: slotSelecionado.data,
        hora: slotSelecionado.horaInicio,
      });
    } catch (e) {
      console.error('Erro ao agendar:', e);
      setErro('Erro ao confirmar agendamento. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  /* =================== RENDER =================== */
  if (carregando) return <div style={tela}><p>Carregando agenda…</p></div>;

  if (erro && !config) {
    return (
      <div style={tela}>
        <div style={card}>
          <MdWarning size={40} color="#e65100" />
          <p>{erro}</p>
        </div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div style={tela}>
        <div style={{ ...card, textAlign: 'center', maxWidth: 480 }}>
          <MdCheckCircle size={56} color="#16a34a" />
          <h2 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a' }}>
            Agendamento solicitado!
          </h2>
          <p style={{ fontSize: 14, color: '#444' }}>
            <strong>{sucesso.data}</strong> às <strong>{sucesso.hora}</strong>
          </p>
          <p style={{ fontSize: 12, color: '#666', marginTop: 12 }}>
            Guarde seu código para consultar ou cancelar:
          </p>
          <div
            style={{
              background: '#faf5ff',
              border: '1.5px dashed #a855f7',
              borderRadius: 12,
              padding: '12px 16px',
              fontFamily: 'monospace',
              fontSize: 18,
              fontWeight: 700,
              color: '#7e22ce',
              letterSpacing: 1,
            }}
          >
            {sucesso.codigo}
          </div>
          <p style={{ fontSize: 11, color: '#888', marginTop: 16 }}>
            A profissional vai confirmar em breve. Você receberá um aviso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={tela}>
      <div style={{ ...card, maxWidth: 720 }}>
        <h2
          style={{
            fontFamily: "'Cinzel', serif",
            color: '#2c163a',
            margin: '0 0 8px 0',
            textAlign: 'center',
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

        {/* Grade de slots */}
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
            }}
          >
            ⏳ Agenda ainda não disponível. Tente novamente em alguns dias.
          </div>
        ) : (
          <>
            <h3
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 13,
                color: '#2c163a',
                marginBottom: 10,
              }}
            >
              1. Escolha data e horário
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 8,
                maxHeight: 340,
                overflowY: 'auto',
                padding: 4,
              }}
            >
              {slots.map((s, i) => {
                const ativo =
                  slotSelecionado?.data === s.data &&
                  slotSelecionado?.horaInicio === s.horaInicio;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSlotSelecionado(s)}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: ativo
                        ? '2px solid #7e22ce'
                        : '1.5px solid #d8b4fe',
                      background: ativo ? '#faf5ff' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: ativo ? 700 : 500,
                      color: '#2c163a',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {formatarData(s.data)}
                    </div>
                    <div style={{ color: '#7e22ce', marginTop: 2 }}>
                      {s.horaInicio}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Formulário */}
        {slotSelecionado && (
          <div
            style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: '1px dashed #e2d2f5',
            }}
          >
            <h3
              style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 13,
                color: '#2c163a',
                marginBottom: 12,
              }}
            >
              2. Seus dados
            </h3>

            {/* Nome */}
            <Campo label="Nome completo *">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={input}
                placeholder="Como no documento"
                autoComplete="name"
              />
            </Campo>

            {/* Documento */}
            <Campo label="Documento * (CPF, RG, passaporte, ID…)">
              <input
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                style={input}
                placeholder="Ex: 123.456.789-00 / AB123456 / 12345678Z"
                autoComplete="off"
              />
            </Campo>

            <Campo label="Telefone / WhatsApp *">
  <PhoneInput
    international
    defaultCountry="BR"
    value={telefone}
    onChange={setTelefone}   // agora o estado guarda o E.164 completo (+5511999999999)
    placeholder="Digite seu número"
    style={input}            // você pode passar estilos inline se quiser
  />
  <span style={{ fontSize: 10, color: '#888', marginTop: 4, display: 'block' }}>
    Será salvo como <code style={{ color: '#7e22ce' }}>{telefone || '…'}</code>
  </span>
</Campo>
           
            {/* E-mail */}
            <Campo label="E-mail (opcional)">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                style={input}
                placeholder="voce@email.com"
                autoComplete="email"
              />
            </Campo>

            {/* Observações */}
            <Campo label="Observações (opcional)">
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                style={{ ...input, resize: 'vertical' }}
                placeholder="Alguma informação que a profissional precise saber?"
              />
            </Campo>

            {/* LGPD */}
            <label
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                background: lgpdAceito ? '#f0fdf4' : '#faf5ff',
                border: `1.5px solid ${lgpdAceito ? '#86efac' : '#d8b4fe'}`,
                borderRadius: 10,
                padding: 12,
                cursor: 'pointer',
                marginTop: 10,
              }}
            >
              <input
                type="checkbox"
                checked={lgpdAceito}
                onChange={(e) => setLgpdAceito(e.target.checked)}
                style={{ marginTop: 3, width: 18, height: 18 }}
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

            {erro && (
              <div
                style={{
                  background: '#fde8e8',
                  border: '1px solid #f98080',
                  color: '#c81e1e',
                  padding: 10,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  marginTop: 12,
                }}
              >
                {erro}
              </div>
            )}

            <button
              type="button"
              onClick={agendar}
              disabled={enviando}
              style={{
                marginTop: 18,
                width: '100%',
                background: 'linear-gradient(135deg, #C8A24A, #e2be64)',
                color: '#fff',
                border: '1.5px solid #9c7826',
                padding: 14,
                borderRadius: 22,
                fontFamily: "'Cinzel', serif",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 1,
                cursor: enviando ? 'wait' : 'pointer',
                opacity: enviando ? 0.7 : 1,
              }}
            >
              {enviando ? 'ENVIANDO…' : 'CONFIRMAR AGENDAMENTO'}
            </button>
          </div>
        )}
      </div>

      {mostrarModalLgpd && (
        <ModalConsentimentoAgendamento
          onFechar={() => setMostrarModalLgpd(false)}
        />
      )}
    </div>
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
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function formatarData(iso) {
  const [, m, d] = iso.split('-');
  const data = new Date(iso + 'T12:00:00');
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return `${dias[data.getDay()]}, ${d}/${m}`;
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

/* ============================================================
   Estilos
   ============================================================ */
const tela = {
  minHeight: '100vh',
  background: '#f3eef8',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  padding: '30px 16px',
  fontFamily: "'Montserrat', sans-serif",
};

const card = {
  background: '#fff',
  borderRadius: 20,
  border: '1.5px solid #C8A24A',
  padding: 28,
  width: '100%',
  boxShadow: '0 15px 40px rgba(44,22,58,0.15)',
};

const input = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #ccc',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};