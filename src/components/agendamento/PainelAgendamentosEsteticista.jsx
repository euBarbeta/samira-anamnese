// src/components/agendamento/PainelAgendamentosEsteticista.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import GerenciarServicos from './GerenciarServicos';
import ModalAgendarParaPaciente from './ModalAgendarParaPaciente';
import ModalEscolherServico from './ModalEscolherServico';
import ConfiguradorAgenda from './ConfiguradorAgenda';
import FichaDesktop from '../FichaDesktop';
import FichaMobile from '../FichaMobile';

import {
  collection, query, where, onSnapshot, doc, getDoc, setDoc,
  updateDoc, deleteDoc, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import { secondaryAuth } from '../firebaseSecondary';
import { registrarLinkPaciente, gerarUidDeterministico, limparUndefined } from '../../utils/validarUID';
import { formatPhoneNumberIntl } from 'react-phone-number-input';

import {
  MdCheckCircle, MdCancel, MdWarning, MdSearch,
  MdCalendarMonth, MdSettings, MdPhone, MdBadge,
  MdEmail, MdChatBubbleOutline, MdClear, MdHourglassEmpty,
  MdContentCopy, MdCheck, MdDelete, MdAssignment, MdEvent,
  MdPersonOff, MdRefresh,
} from 'react-icons/md';

const DIAS_HISTORICO = 30;

// ============================================================
// ✅ O e-mail do agendamento pode ser @sistema.local (login) ou vazio.
//    Só devolve como e-mail de CONTATO se for um e-mail real.
// ============================================================
function emailContatoDoAgendamento(emailBruto) {
  const email = (emailBruto || '').trim().toLowerCase();
  if (!email) return '';
  if (email.endsWith('@sistema.local')) return '';
  return email;
}

// ============================================================
// ✅ A ficha pode salvar emailContato/telefone na RAIZ do doc OU
//    dentro de `anamnese`. Estes helpers leem dos dois.
// ============================================================
function getEmailContatoDoPaciente(pac) {
  if (!pac) return '';
  const emailRaiz = (pac.emailContato || '').trim();
  if (emailRaiz) return emailRaiz;
  return (pac.anamnese?.emailContato || '').trim();
}

function getTelefoneDoPaciente(pac) {
  if (!pac) return '';
  const telRaiz = (pac.telefone || '').trim();
  if (telRaiz) return telRaiz;
  return (pac.anamnese?.telefone || '').trim();
}

function normalizarNome(str) {
  return (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizarDoc(str) {
  return (str || '').replace(/\D/g, '');
}

// ============================================================
// ✅ Chave única por agendamento + campo.
//    E-mail e telefone são resolvidos INDEPENDENTEMENTE.
//    Ex: "abc123|emailContato"  /  "abc123|telefone"
//    String() defensivo contra IDs numéricos.
// ============================================================
const chaveDivergencia = (agId, campo) => `${String(agId)}|${campo}`;

function formatarTelefoneInternacional(tel) {
  if (!tel) return '—';
  try {
    const f = formatPhoneNumberIntl(String(tel));
    return f || String(tel);
  } catch {
    return String(tel);
  }
}

function BotaoCopiar({ valor, rotulo, title }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async (e) => {
    e?.stopPropagation?.();
    const texto = String(valor || '');
    if (!texto) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
      } else {
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch (err) {
      console.warn('Falha ao copiar:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={copiar}
      title={copiado ? 'Copiado!' : (title || `Copiar ${rotulo || ''}`)}
      aria-label={copiado ? 'Copiado' : `Copiar ${rotulo || ''}`}
      style={{
        background: copiado ? '#f0fdf4' : '#faf5ff',
        border: copiado ? '1px solid #86efac' : '1px solid #d8b4fe',
        color: copiado ? '#166534' : '#7e22ce',
        width: 22,
        height: 22,
        borderRadius: 6,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        flexShrink: 0,
        transition: 'all 0.18s ease',
        marginLeft: 4,
        verticalAlign: 'middle',
      }}
    >
      {copiado ? <MdCheck size={12} /> : <MdContentCopy size={11} />}
    </button>
  );
}

/* ============================================================
   MODAL DE CONFIRMAÇÃO DE CANCELAMENTO
   ============================================================ */
function ModalConfirmarCancelamento({
  agendamento,
  carregando,
  onConfirmar,
  onFechar,
}) {
  // ✅ Atalhos de teclado: Enter = confirmar | Esc = cancelar
  useEffect(() => {
    if (carregando) return;

    const handler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirmar?.();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onFechar?.();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [carregando, onConfirmar, onFechar]);

  return (
    <div
      onClick={carregando ? undefined : onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
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
          padding: '28px 24px 24px 24px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
          border: '1.5px solid #e2d2f5',
          fontFamily: "'Montserrat', sans-serif",
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            margin: '0 auto 16px auto',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ffebee 0%, #fde8e8 100%)',
            border: '2px solid #ef9a9a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(198, 40, 40, 0.18)',
          }}
        >
          <MdCancel size={32} color="#c62828" />
        </div>

        <h3
          style={{
            fontFamily: "'Cinzel', serif",
            color: '#c62828',
            fontSize: 17,
            fontWeight: 700,
            margin: '0 0 10px 0',
            letterSpacing: '0.4px',
          }}
        >
          Cancelar agendamento?
        </h3>

        <p
          style={{
            fontSize: 13,
            color: '#2c163a',
            margin: '0 0 6px 0',
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          {agendamento?.nome || 'Paciente'}
        </p>

        <p
          style={{
            fontSize: 12,
            color: '#555',
            margin: '0 0 18px 0',
            lineHeight: 1.6,
          }}
        >
          {formatarDataBR(agendamento?.data)} às {agendamento?.horaInicio}
          <br />
          <span
            style={{
              fontSize: 11,
              color: '#888',
              display: 'block',
              marginTop: 6,
            }}
          >
            O paciente será notificado (se tiver app). Esta ação não pode ser desfeita.
          </span>
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={onFechar}
            disabled={carregando}
            style={{
              flex: 1,
              background: '#f0f0f0',
              color: '#333',
              border: 'none',
              padding: '12px 16px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: carregando ? 'not-allowed' : 'pointer',
              fontFamily: "'Cinzel', serif",
              opacity: carregando ? 0.6 : 1,
              minHeight: 44,
            }}
          >
            VOLTAR
          </button>

          <button
            type="button"
            onClick={onConfirmar}
            disabled={carregando}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
              color: '#fff',
              border: 'none',
              padding: '12px 16px',
              borderRadius: 22,
              fontSize: 12,
              fontWeight: 700,
              cursor: carregando ? 'wait' : 'pointer',
              fontFamily: "'Cinzel', serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(198, 40, 40, 0.35)',
              opacity: carregando ? 0.7 : 1,
              minHeight: 44,
            }}
          >
            {carregando ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: 13,
                    height: 13,
                    border: '2px solid #fff',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spinCancel 0.8s linear infinite',
                  }}
                />
                CANCELANDO…
              </>
            ) : (
              <>
                <MdDelete size={14} />
                CANCELAR
              </>
            )}
          </button>
        </div>

        <style>{`
          @keyframes spinCancel { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}

export default function PainelAgendamentosEsteticista({
  uidEsteticista,
  onCampoSubstituido,
}) {
  const [aba, setAba] = useState('agenda');
  const [agendamentos, setAgendamentos] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [fichaPreenchida, setFichaPreenchida] = useState(null);

  const [agendamentoParaConfirmar, setAgendamentoParaConfirmar] = useState(null);
  const [agendamentoParaCancelar, setAgendamentoParaCancelar] = useState(null);
  const [cancelando, setCancelando] = useState(false);

  const [pacientesExistentes, setPacientesExistentes] = useState(new Set());
  const [pacientesPorId, setPacientesPorId] = useState({});
  const [substituindo, setSubstituindo] = useState(null);
  const [divergenciasMantidas, setDivergenciasMantidas] = useState(new Set());
  const autoSyncRef = useRef(new Set());

  // ✅ Contador que FORÇA re-render depois de marcar/limpar uma divergência.
  //    Garante que o painel desapareça mesmo se o React batching segurar o Set.
  const [divergenciasVersion, setDivergenciasVersion] = useState(0);

  const [agendamentoParaReagendar, setAgendamentoParaReagendar] = useState(null);
  const [pacienteReagendar, setPacienteReagendar] = useState(null);
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);

  const [agendamentoParaExcluir, setAgendamentoParaExcluir] = useState(null);
  const [excluindoAg, setExcluindoAg] = useState(false);

  // ============================================================
  // ✅ Resolve uma divergência: adiciona a chave ao Set E força
  //    re-render via contador. Uma única função para os 2 botões.
  // ============================================================
 // ============================================================
// ✅ Resolve uma divergência de forma PERSISTENTE:
//    1. Atualização otimista (esconde na hora)
//    2. Grava no Firestore no doc do agendamento
//    → Sobrevive a reload, troca de aba e troca de dispositivo.
// ============================================================
const resolverDivergencia = async (agId, campo) => {
  const chave = chaveDivergencia(agId, campo);

  // Otimista: esconde já
  setDivergenciasMantidas((prev) => {
    const novo = new Set(prev);
    novo.add(chave);
    return novo;
  });
  setDivergenciasVersion((v) => v + 1);

  // Persiste no Firestore
  try {
    await updateDoc(doc(db, 'agendamentos', agId), {
      [`divergenciasResolvidas.${campo}`]: true,
      atualizadoEm: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Erro ao persistir divergência:', e);
  }
};
  // ============================================================
  // Listener 1 — AGENDAMENTOS em tempo real
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;

    const q = query(
      collection(db, 'agendamentos'),
      where('uidEsteticista', '==', uidEsteticista),
      orderBy('data', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgendamentos(lista);
      setCarregando(false);
    }, (err) => {
      console.error('Erro agendamentos:', err);
      setCarregando(false);
    });

    return () => unsub();
  }, [uidEsteticista]);

  // ============================================================
  // ✅ Listener 2 — PACIENTES existentes
  // ============================================================
  useEffect(() => {
    if (!uidEsteticista) return;

    const unsub = onSnapshot(
      collection(db, `usuarios/${uidEsteticista}/pacientes`),
      (snap) => {
        const set = new Set();
        const map = {};
        snap.docs.forEach((d) => {
          set.add(`id:${d.id}`);

          const p = d.data();
          const nomeNorm = normalizarNome(p.nome);
          const docNorm = normalizarDoc(p.documento);
          if (nomeNorm && docNorm) {
            set.add(`nome:${nomeNorm}|${docNorm}`);
          }

          map[d.id] = { id: d.id, ...p };
        });
        setPacientesExistentes(set);
        setPacientesPorId(map);
      },
      (err) => console.warn('Erro listener pacientes:', err)
    );

    return () => unsub();
  }, [uidEsteticista]);

  // ============================================================
  // ✅ Helper — encontra paciente por ID ou por nome+doc
  // ============================================================
  const acharPacienteDoAgendamento = (ag) => {
    if (ag.pacienteId && pacientesPorId[ag.pacienteId]) {
      return pacientesPorId[ag.pacienteId];
    }

    const agNome = normalizarNome(ag.nome);
    const agDoc = normalizarDoc(ag.documento);
    if (!agNome || !agDoc) return null;

    return (
      Object.values(pacientesPorId).find((p) => {
        return (
          normalizarNome(p.nome) === agNome &&
          normalizarDoc(p.documento) === agDoc
        );
      }) || null
    );
  };

  // ============================================================
  // ✅ AUTO-SYNC — copia email/tel vazios da ficha a partir do agendamento
  // ============================================================
  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    Object.values(pacientesPorId).forEach((pac) => {
      const pacNomeNorm = normalizarNome(pac.nome);
      const pacDocNorm = normalizarDoc(pac.documento);

      const agsDoPaciente = agendamentos.filter((a) => {
        if (a.pacienteId && a.pacienteId === pac.id) return true;

        if (!a.pacienteId) {
          return (
            normalizarNome(a.nome) === pacNomeNorm &&
            normalizarDoc(a.documento) === pacDocNorm
          );
        }
        return false;
      });

      if (agsDoPaciente.length === 0) return;

      const ag = agsDoPaciente[0];

      const emailFicha = getEmailContatoDoPaciente(pac);
      const emailRealAg = emailContatoDoAgendamento(ag.email);
      const chaveEmail = `${pac.id}|email|${emailRealAg}`;

      if (
        !emailFicha &&
        emailRealAg &&
        !autoSyncRef.current.has(chaveEmail)
      ) {
        autoSyncRef.current.add(chaveEmail);
        updateDoc(
          doc(db, `usuarios/${user.uid}/pacientes`, pac.id),
          {
            emailContato: emailRealAg,
            'anamnese.emailContato': emailRealAg,
            atualizadoEm: new Date().toISOString(),
          }
        ).catch((e) => console.warn('Auto-sync email falhou:', e));
      }

      const telFicha = getTelefoneDoPaciente(pac);
      const telAg = (ag.telefone || '').trim();
      const chaveTel = `${pac.id}|tel|${telAg}`;

      if (!telFicha && telAg && !autoSyncRef.current.has(chaveTel)) {
        autoSyncRef.current.add(chaveTel);
        updateDoc(
          doc(db, `usuarios/${user.uid}/pacientes`, pac.id),
          {
            telefone: telAg,
            'anamnese.telefone': telAg,
            atualizadoEm: new Date().toISOString(),
          }
        ).catch((e) => console.warn('Auto-sync tel falhou:', e));
      }
    });
  }, [pacientesPorId, agendamentos]);

  const solicitarEscolhaServico = (ag) => {
    setAgendamentoParaConfirmar(ag);
  };

  const solicitarCancelamento = (ag) => {
    setAgendamentoParaCancelar(ag);
  };

  const confirmarCancelamento = async () => {
    if (!agendamentoParaCancelar) return;
    const ag = agendamentoParaCancelar;
    setCancelando(true);
    try {
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        status: 'cancelado',
        canceladoPor: 'esteticista',
        atualizadoEm: new Date().toISOString(),
      });

      if (ag.pacienteId) {
        fetch('/.netlify/functions/notificar-paciente-agendamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pacienteId: ag.pacienteId,
            agendamento: ag,
            tipoEvento: 'cancelado',
          }),
        }).catch((e) => console.warn('Falha ao notificar paciente (cancelado):', e));
      }

      setAgendamentoParaCancelar(null);
    } catch (e) {
      alert('Erro ao cancelar: ' + e.message);
    } finally {
      setCancelando(false);
    }
  };

  // ============================================================
  // ✅ Cria ficha automaticamente ao concluir consulta
  // ============================================================
  const criarFichaAutomatica = async (ag) => {
    const user = getAuth().currentUser;
    if (!user) return;

    if (ag.pacienteId) {
      try {
        const snap = await getDoc(
          doc(db, `usuarios/${user.uid}/pacientes`, String(ag.pacienteId))
        );
        if (snap.exists()) return;
      } catch {}
    }

    const nome = ag.nome || 'Paciente';
    const partes = nome.split(/\s+/);
    const pNome = (partes[0] || 'usuario').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const sNome = (partes[partes.length - 1] || 'paciente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const emailFicticio = `${pNome}.${sNome}@sistema.local`;
    const docLimpo = (ag.documento || '').replace(/\D/g, '');
    const senha = (docLimpo.length >= 6 ? docLimpo.slice(-6) : '123456').padEnd(6, '0');

    // ============================================================
    // ✅ O1: UID determinístico como fallback — nunca mais "pac_".
    // O mesmo nome+email SEMPRE produz o mesmo UID, então tentar
    // criar a ficha duas vezes não duplica o paciente.
    // ============================================================
    let pacienteUid = '';
    try {
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, emailFicticio, senha);
        pacienteUid = cred.user.uid;
        await signOut(secondaryAuth);
      } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
          try {
            const cred = await signInWithEmailAndPassword(secondaryAuth, emailFicticio, senha);
            pacienteUid = cred.user.uid;
            await signOut(secondaryAuth);
          } catch {
            pacienteUid = gerarUidDeterministico(`${emailFicticio}|${docLimpo}`);
          }
        } else {
          pacienteUid = gerarUidDeterministico(`${emailFicticio}|${docLimpo}`);
        }
      }
    } catch {
      pacienteUid = gerarUidDeterministico(`${emailFicticio}|${docLimpo}`);
    }

    const agora = new Date();
    const dataHora = agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const emailContatoReal = emailContatoDoAgendamento(ag.email);

    // ============================================================
    // ✅ O3: herda o consentimento LGPD do agendamento (quando existir).
    // - Se o paciente aceitou ao agendar → painel dele abre direto.
    // - Se não existe (agendamento antigo) → modal de consentimento
    //   aparece no primeiro login (comportamento correto).
    // ============================================================
    const novaFicha = {
      id: pacienteUid,
      nome,
      documento: ag.documento || '',
      telefone: ag.telefone || '',
      email: emailFicticio,
      emailAcesso: emailFicticio,
      emailContato: emailContatoReal,
      criadoPorUid: user.uid,
      dataCriacao: dataHora,
      dataUltimaEdicao: dataHora,
      anamnese: {
        nome,
        telefone: ag.telefone || '',
        emailContato: emailContatoReal,
        numeroDocumento: ag.documento || '',
        dataRealizacao: new Date().toLocaleDateString('pt-BR'),
        observacoes: `Ficha criada automaticamente ao concluir o agendamento.\nServiço: ${ag.servicoNome || 'Não informado'}${ag.observacoes ? `\nObservações do paciente: ${ag.observacoes}` : ''}`,
      },
      evolucoes: [{
        id: Date.now(),
        dataCriacao: dataHora,
        textoLivre: `Atendimento realizado em ${formatarDataBR(ag.data)} às ${ag.horaInicio}.\nServiço: ${ag.servicoNome || 'Não informado'}${ag.observacoes ? `\nObservações: ${ag.observacoes}` : ''}`,
      }],
      agendamentoOrigemId: ag.id,

      // ✅ O3: propaga o consentimento do agendamento (se houver)
      ...(ag.consentimentoLGPD?.aceito
        ? { consentimentoLGPD: ag.consentimentoLGPD }
        : {}),
    };

   await setDoc(
  doc(db, `usuarios/${user.uid}/pacientes`, pacienteUid),
  limparUndefined(novaFicha)
);
    await registrarLinkPaciente(pacienteUid, user.uid);

    // ✅ O2: escreve o mapa de e-mail → (profissionalUid, pacienteId)
    // Sem isso, quando o paciente logar pela primeira vez o sistema
    // precisa cair no fallback (query por emailAcesso).
    await setDoc(
      doc(db, 'mapeamento_emails', emailFicticio),
      {
        profissionalUid: user.uid,
        pacienteId: pacienteUid,
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );

    await updateDoc(doc(db, 'agendamentos', ag.id), { pacienteId: pacienteUid });
  };

  const concluirManual = async (ag) => {
    try {
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        status: 'concluido',
        concluidoPor: 'esteticista',
        concluidoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });

      
    } catch (e) {
      alert('Erro ao concluir: ' + e.message);
    }
  };

  const marcarFaltou = async (ag) => {
    try {
      await updateDoc(doc(db, 'agendamentos', ag.id), {
        status: 'faltou',
        faltouPor: 'paciente',
        faltouEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });
    } catch (e) {
      alert('Erro ao marcar falta: ' + e.message);
    }
  };

  const abrirReagendamento = async (ag) => {
    if (ag.pacienteId) {
      setBuscandoPaciente(true);
      try {
        const snap = await getDoc(
          doc(db, `usuarios/${uidEsteticista}/pacientes`, String(ag.pacienteId))
        );

        if (snap.exists()) {
          setPacienteReagendar({ id: snap.id, ...snap.data() });
          setAgendamentoParaReagendar(ag);
          setBuscandoPaciente(false);
          return;
        }
      } catch (e) {
        console.error('Erro ao buscar paciente:', e);
      } finally {
        setBuscandoPaciente(false);
      }
    }

    setPacienteReagendar({
      id: ag.pacienteId || null,
      nome: ag.nome,
      documento: ag.documento,
      telefone: ag.telefone,
      email: ag.email,
      emailAcesso: ag.email,
      consentimentoLGPD: ag.consentimentoLGPD,
    });
    setAgendamentoParaReagendar(ag);
  };

  const fecharReagendamento = () => {
    setPacienteReagendar(null);
    setAgendamentoParaReagendar(null);
  };

  const solicitarExclusaoAgendamento = (ag) => {
    setAgendamentoParaExcluir(ag);
  };

  const confirmarExclusaoAgendamento = async () => {
    if (!agendamentoParaExcluir) return;
    setExcluindoAg(true);
    try {
      await deleteDoc(doc(db, 'agendamentos', agendamentoParaExcluir.id));
      setAgendamentoParaExcluir(null);
    } catch (e) {
      console.error('Erro ao excluir agendamento:', e);
      alert('Erro ao excluir. Tente novamente.');
    } finally {
      setExcluindoAg(false);
    }
  };

  // ============================================================
  // ✅ Atalhos de teclado do modal de exclusão: Enter / Esc
  // ============================================================
  useEffect(() => {
    if (!agendamentoParaExcluir || excluindoAg) return;

    const handler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmarExclusaoAgendamento();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setAgendamentoParaExcluir(null);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentoParaExcluir, excluindoAg]);

  const contagens = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() - DIAS_HISTORICO);

    const cont = {
      pendente: 0,
      confirmado: 0,
      cancelado: 0,
      concluido: 0,
      faltou: 0,
    };
    for (const a of agendamentos) {
      if (!(a.status in cont)) continue;
      if (
        a.status === 'cancelado' ||
        a.status === 'concluido' ||
        a.status === 'faltou'
      ) {
        const d = new Date((a.data || '') + 'T12:00:00');
        if (d < limite) continue;
      }
      cont[a.status]++;
    }
    return cont;
  }, [agendamentos]);

  const filtrados = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() - DIAS_HISTORICO);

    const termo = busca.toLowerCase().trim();

    return agendamentos.filter((a) => {
      if (a.status !== filtroStatus) return false;

      if (
        a.status === 'cancelado' ||
        a.status === 'concluido' ||
        a.status === 'faltou'
      ) {
        const d = new Date((a.data || '') + 'T12:00:00');
        if (d < limite) return false;
      }

      if (!termo) return true;
      const nome = (a.nome || '').toLowerCase();
      const doc_ = (a.documento || a.cpf || '').toLowerCase();
      const dataBR = formatarDataBR(a.data);
      const email = (a.email || '').toLowerCase();

      return (
        nome.includes(termo) ||
        doc_.includes(termo) ||
        dataBR.includes(termo) ||
        email.includes(termo)
      );
    });
  }, [agendamentos, filtroStatus, busca]);

  const pacienteJaExiste = (ag) => {
    if (ag.pacienteId && pacientesExistentes.has(`id:${ag.pacienteId}`)) {
      return true;
    }

    const nomeNorm = normalizarNome(ag.nome);
    const docNorm = normalizarDoc(ag.documento);
    if (!nomeNorm || !docNorm) return false;

    return pacientesExistentes.has(`nome:${nomeNorm}|${docNorm}`);
  };

  const substituirCampo = async (pacId, campo, valor) => {
    const user = getAuth().currentUser;
    if (!user) return;

    const chave = `${pacId}|${campo}`;
    setSubstituindo(chave);

    try {
      await updateDoc(
        doc(db, `usuarios/${user.uid}/pacientes`, pacId),
        {
          [campo]: valor,
          [`anamnese.${campo}`]: valor,
          atualizadoEm: new Date().toISOString(),
        }
      );

      onCampoSubstituido?.(pacId, campo, valor);
    } catch (e) {
      console.error('Erro ao substituir campo:', e);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSubstituindo(null);
    }
  };

  // ============================================================
  // ✅ DIVERGÊNCIAS — cada campo resolvido de forma INDEPENDENTE.
  //    Se a esteta clica MANTER/SUBSTITUIR no e-mail, isso NÃO
  //    esconde o bloco do telefone (e vice-versa).
  //    O `divergenciasVersion` é lido para garantir que o React
  //    recalcule este bloco a cada clique.
  // ============================================================
 // ============================================================
// ✅ DIVERGÊNCIAS — cada campo resolvido de forma INDEPENDENTE.
//    Lê de DUAS fontes:
//      1. Firestore (`ag.divergenciasResolvidas`) → persistente
//      2. Set local (`divergenciasMantidas`)      → otimista
// ============================================================
const divergenciasDoAgendamento = (ag) => {
  // eslint-disable-next-line no-unused-vars
  const _v = divergenciasVersion;

  const pac = acharPacienteDoAgendamento(ag);
  if (!pac) return [];

  const lista = [];
  const resolvidas = ag.divergenciasResolvidas || {};

  // ─── E-MAIL ───────────────────────────────────────────
  const emailResolvido =
    resolvidas.emailContato === true ||
    divergenciasMantidas.has(chaveDivergencia(ag.id, 'emailContato'));

  if (!emailResolvido) {
    const emailFichaAtual = getEmailContatoDoPaciente(pac);
    const emailFicha = emailFichaAtual.toLowerCase();
    const emailRealAg = emailContatoDoAgendamento(ag.email);

    if (emailFicha && emailRealAg && emailFicha !== emailRealAg) {
      lista.push({
        campo: 'emailContato',
        label: 'E-mail',
        atual: emailFichaAtual,
        novo: emailRealAg,
        pacId: pac.id,
      });
    }
  }

  // ─── TELEFONE (independente do e-mail) ────────────────
  const telResolvido =
    resolvidas.telefone === true ||
    divergenciasMantidas.has(chaveDivergencia(ag.id, 'telefone'));

  if (!telResolvido) {
    const telFicha = getTelefoneDoPaciente(pac);
    const telAg = (ag.telefone || '').trim();

    if (telFicha && telAg && telFicha !== telAg) {
      lista.push({
        campo: 'telefone',
        label: 'Telefone',
        atual: telFicha,
        novo: telAg,
        pacId: pac.id,
      });
    }
  }

  return lista;
};

  const abrirFichaPreenchida = (ag) => {
    setFichaPreenchida({
      _agendamentoOrigemId: ag.id,
      _agendamentoStatusOriginal: ag.status,
      nome: ag.nome || '',
      telefone: ag.telefone || '',
      emailContato: emailContatoDoAgendamento(ag.email),
      numeroDocumento: ag.documento || '',
      dataNascimento: '',
      endereco: '',
      dataRealizacao: new Date().toLocaleDateString('pt-BR'),
      observacoes: '',
    });
  };

  const handleSalvarFichaDoAgendamento = async (dadosAnamnese) => {
    const user = getAuth().currentUser;
    if (!user) return;

    const nomeOriginal = (dadosAnamnese.nome || '').trim();
    const partes = nomeOriginal.split(/\s+/);
    const pNome = (partes[0] || 'usuario')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const sNome = (partes[partes.length - 1] || 'paciente')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const emailFicticio = `${pNome}.${sNome}@sistema.local`;
    const docLimpo = (dadosAnamnese.numeroDocumento || '').replace(/\D/g, '');
    const senha = (docLimpo.length >= 6 ? docLimpo.slice(-6) : '123456').padEnd(6, '0');

    // ============================================================
    // ✅ PASSO 1: já existe paciente com esse nome+doc?
    // Se sim, ATUALIZA o existente em vez de criar outro.
    // Isso evita a duplicação quando a ficha é criada 2x.
    // ============================================================
    const nomeNorm = normalizarNome(nomeOriginal);
    const docNorm = normalizarDoc(dadosAnamnese.numeroDocumento);
    const existente = Object.values(pacientesPorId).find((p) =>
      normalizarNome(p.nome || p.anamnese?.nome) === nomeNorm &&
      normalizarDoc(p.documento || p.anamnese?.numeroDocumento) === docNorm
    );

    let pacienteUid = existente?.id || '';
    

    // ============================================================
    // ✅ PASSO 2: só cria Auth se realmente for novo.
    // Se falhar, usa UID DETERMINÍSTICO via helper centralizado.
    // ============================================================
    if (!pacienteUid) {
      try {
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, emailFicticio, senha);
          pacienteUid = cred.user.uid;
          await signOut(secondaryAuth);
        } catch (e) {
          if (e.code === 'auth/email-already-in-use') {
            try {
              const cred = await signInWithEmailAndPassword(secondaryAuth, emailFicticio, senha);
              pacienteUid = cred.user.uid;
              await signOut(secondaryAuth);
            } catch {
              // Cai no fallback determinístico abaixo
            }
          }
        }
      } catch { /* cai no fallback */ }

      if (!pacienteUid) {
        // ✅ O1: helper centralizado (mesmo padrão do criarFichaAutomatica)
        pacienteUid = gerarUidDeterministico(`${emailFicticio}|${docLimpo}`);
      }
    }

    const agora = new Date();
    const dataHora =
      agora.toLocaleDateString('pt-BR') + ' às ' +
      agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const novoPaciente = {
      ...(existente || {}),
      id: pacienteUid,
      nome: dadosAnamnese.nome,
      documento: dadosAnamnese.numeroDocumento || '',
      telefone: dadosAnamnese.telefone || '',
      email: emailFicticio,
      emailAcesso: emailFicticio,
      emailContato: dadosAnamnese.emailContato || '',
      criadoPorUid: user.uid,
      dataCriacao: existente?.dataCriacao || dataHora,
      dataUltimaEdicao: dataHora,
      anamnese: dadosAnamnese,
      evolucoes: existente?.evolucoes || [],
      agendamentoOrigemId: fichaPreenchida?._agendamentoOrigemId || existente?.agendamentoOrigemId || null,
    };

    await setDoc(
  doc(db, `usuarios/${user.uid}/pacientes`, pacienteUid),
  limparUndefined(novoPaciente),
  { merge: true }
);
    await registrarLinkPaciente(pacienteUid, user.uid);

    // ✅ Sempre reescreve o mapeamento de e-mail
    await setDoc(
      doc(db, 'mapeamento_emails', emailFicticio),
      {
        profissionalUid: user.uid,
        pacienteId: pacienteUid,
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );

    if (fichaPreenchida?._agendamentoOrigemId) {
      const patch = {
        pacienteId: pacienteUid,
        atualizadoEm: new Date().toISOString(),
      };
      if (fichaPreenchida._agendamentoStatusOriginal === 'confirmado') {
        patch.status = 'concluido';
        patch.concluidoPor = 'esteticista';
        patch.concluidoEm = new Date().toISOString();
      }
      await updateDoc(doc(db, 'agendamentos', fichaPreenchida._agendamentoOrigemId), patch);
    }

    setFichaPreenchida(null);
  };

  if (fichaPreenchida) {
    const isMobileView = window.innerWidth <= 768;
    const Comp = isMobileView ? FichaMobile : FichaDesktop;
    return (
      <Comp
        mode="create"
        fichaSelecionada={fichaPreenchida}
        onSave={handleSalvarFichaDoAgendamento}
        onVoltar={() => setFichaPreenchida(null)}
        onSalvarSucesso={() => setFichaPreenchida(null)}
      />
    );
  }

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Abas */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setAba('agenda')} style={abaBtn(aba === 'agenda')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MdCalendarMonth size={14} /> Agendamentos
          </span>
        </button>
        <button type="button" onClick={() => setAba('config')} style={abaBtn(aba === 'config')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MdSettings size={14} /> Configurar horários
          </span>
        </button>
        <button type="button" onClick={() => setAba('servicos')} style={abaBtn(aba === 'servicos')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <MdAssignment size={14} /> Meus Serviços
          </span>
        </button>
      </div>

      {aba === 'servicos' && (
        <GerenciarServicos uidEsteticista={uidEsteticista} />
      )}

      {aba === 'config' && <ConfiguradorAgenda uidEsteticista={uidEsteticista} />}

      {aba === 'agenda' && (
        <>
          {/* Busca */}
          <div style={{
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '8px 16px',
            marginTop: '-4px',
            marginBottom: '20px',
            boxShadow: '0 4px 16px rgba(44, 22, 58, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            boxSizing: 'border-box',
          }}>
            <MdSearch
              size={18}
              color="#C8A24A"
              style={{ flexShrink: 0 }}
              aria-hidden="true"
            />

            <label
              htmlFor="busca-agendamentos"
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0,0,0,0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              Buscar agendamentos por nome, documento ou data
            </label>

            <input
              id="busca-agendamentos"
              name="busca_agendamentos"
              type="text"
              placeholder="Buscar por nome, documento ou data (DD/MM/AAAA)…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoComplete="off"
              aria-label="Buscar agendamentos por nome, documento ou data"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 12,
                color: '#2c163a',
                fontFamily: "'Montserrat', sans-serif",
                minWidth: 0,
              }}
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                aria-label="Limpar busca"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: 0,
                  fontWeight: 600,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <MdClear size={14} /> Limpar
              </button>
            )}
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { key: 'pendente',   label: 'Pendente'   },
              { key: 'confirmado', label: 'Confirmado' },
              { key: 'concluido',  label: 'Concluído'  },
              { key: 'faltou',     label: 'Faltou'     },
              { key: 'cancelado',  label: 'Cancelado'  },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFiltroStatus(key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 16,
                  border: '1.5px solid #C8A24A',
                  background: filtroStatus === key ? '#C8A24A' : 'transparent',
                  color: filtroStatus === key ? '#fff' : '#C8A24A',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', serif",
                }}
              >
                {label} ({contagens[key] || 0})
              </button>
            ))}
          </div>

          {(filtroStatus === 'cancelado' || filtroStatus === 'concluido' || filtroStatus === 'faltou') && (
            <div style={{
              fontSize: 10.5,
              color: '#888',
              marginBottom: 10,
              fontStyle: 'italic',
            }}>
              Exibindo apenas os últimos {DIAS_HISTORICO} dias.
            </div>
          )}

          {/* Lista */}
          {carregando ? (
            <p style={{ color: '#666' }}>Carregando…</p>
          ) : filtrados.length === 0 ? (
            <div style={vazio}>
              {busca
                ? `Nenhum resultado para "${busca}".`
                : `Nenhum agendamento ${labelDe(filtroStatus)}.`}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtrados.map((ag) => (
                <div key={ag.id} style={cardAg}>
                  <h4 style={{
                    fontFamily: "'Cinzel', serif",
                    margin: '0 0 8px 0',
                    color: '#2c163a',
                    fontSize: 15,
                    lineHeight: 1.3,
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word',
                  }}>
                    {ag.nome}
                  </h4>

                  <div style={{ fontSize: 12, color: '#555', lineHeight: 1.9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <MdCalendarMonth size={13} color="#C8A24A" style={{ flexShrink: 0 }} />
                      <span>
                        {formatarDataBR(ag.data)} às {ag.horaInicio}
                        {ag.horaFim ? `–${ag.horaFim}` : ''}
                        {ag.duracaoMin ? ` (${ag.duracaoMin}min)` : ''}
                      </span>
                      {ag.servicoNome && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#7e22ce',
                          background: '#faf5ff',
                          border: '1px solid #d8b4fe',
                          borderRadius: 10,
                          padding: '1px 8px',
                          marginLeft: 2,
                        }}>
                          <MdEvent size={11} /> {ag.servicoNome}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MdPhone size={13} color="#C8A24A" style={{ flexShrink: 0 }} />
                      <span>{formatarTelefoneInternacional(ag.telefone)}</span>
                      {ag.telefone && (
                        <BotaoCopiar valor={ag.telefone} rotulo="telefone" title="Copiar telefone" />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MdBadge size={13} color="#C8A24A" style={{ flexShrink: 0 }} />
                      <span>{ag.documento || ag.cpf || '—'}</span>
                      {(ag.documento || ag.cpf) && (
                        <BotaoCopiar valor={ag.documento || ag.cpf} rotulo="documento" title="Copiar documento" />
                      )}
                    </div>

                    {(() => {
                      const pac = acharPacienteDoAgendamento(ag);
                      const emailContato =
                        getEmailContatoDoPaciente(pac) ||
                        emailContatoDoAgendamento(ag.email);

                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <MdEmail size={13} color="#C8A24A" style={{ flexShrink: 0 }} />
                          <span style={{ wordBreak: 'break-all' }}>
                            {emailContato || '—'}
                          </span>
                          {emailContato && (
                            <BotaoCopiar valor={emailContato} rotulo="e-mail" title="Copiar e-mail" />
                          )}
                        </div>
                      );
                    })()}

                    {ag.observacoes && (
                      <div style={{
                        marginTop: 6,
                        fontStyle: 'italic',
                        color: '#7e22ce',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 6,
                      }}>
                        <MdChatBubbleOutline size={13} style={{ marginTop: 3, flexShrink: 0 }} />
                        {ag.observacoes}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {ag.aguardandoConsentimento && (
                      <span style={badgeAguardando}>
                        <MdHourglassEmpty size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        Aguardando consentimento do paciente
                      </span>
                    )}
                    {ag.consentimentoLGPD?.aceito ? (
                      <span style={badgeOk}>
                        <MdCheckCircle size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        LGPD aceito
                      </span>
                    ) : (
                      <span style={badgeWarn}>
                        <MdWarning size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        Sem LGPD
                      </span>
                    )}
                    {ag.status === 'faltou' && (
                      <span style={badgeFaltou}>
                        <MdPersonOff size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        Paciente não compareceu
                      </span>
                    )}
                  </div>

                  {/* ✅ Painel de divergências — MANTER/SUBSTITUIR independentes */}
                  {(() => {
                    const divs = divergenciasDoAgendamento(ag);
                    if (divs.length === 0) return null;

                    return (
                      <div style={{
                        marginTop: 12,
                        background: 'linear-gradient(135deg, #fff8e1 0%, #fef3c7 100%)',
                        border: '1.5px solid #fcd34d',
                        borderRadius: 12,
                        padding: '12px 14px',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 10,
                        }}>
                          <MdWarning size={16} color="#92400e" />
                          <span style={{
                            fontFamily: "'Cinzel', serif",
                            color: '#92400e',
                            fontSize: 12,
                            fontWeight: 700,
                          }}>
                            Dados diferentes do cadastro do paciente
                          </span>
                        </div>

                        {divs.map((d) => {
                          const chave = `${d.pacId}|${d.campo}`;
                          const carregandoEste = substituindo === chave;

                          return (
                            <div
                              key={d.campo}
                              style={{
                                background: '#fff',
                                border: '1px solid #fcd34d',
                                borderRadius: 8,
                                padding: '10px 12px',
                                marginBottom: 8,
                              }}
                            >
                              <div style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#2c163a',
                                marginBottom: 6,
                              }}>
                                {d.label}
                              </div>

                              <div style={{ fontSize: 11, color: '#666', lineHeight: 1.6, marginBottom: 8 }}>
                                <div>
                                  <strong style={{ color: '#888' }}>Cadastro:</strong>{' '}
                                  <span style={{ wordBreak: 'break-all' }}>{d.atual}</span>
                                </div>
                                <div>
                                  <strong style={{ color: '#7e22ce' }}>Agendamento:</strong>{' '}
                                  <span style={{ wordBreak: 'break-all', color: '#7e22ce', fontWeight: 600 }}>
                                    {d.novo}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  type="button"
                                  disabled={carregandoEste}
                                 onClick={() => {
  // ✅ Resolve SÓ este campo + persiste no Firestore
  resolverDivergencia(ag.id, d.campo);
}}
                                  style={{
                                    flex: 1,
                                    background: '#f5f5f5',
                                    color: '#555',
                                    border: '1.5px solid #ddd',
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: carregandoEste ? 'not-allowed' : 'pointer',
                                    fontFamily: "'Cinzel', serif",
                                    opacity: carregandoEste ? 0.6 : 1,
                                    minHeight: 40,
                                  }}
                                >
                                  MANTER
                                </button>

                                <button
                                  type="button"
                                  disabled={carregandoEste}
                                  onClick={async () => {
                                    await substituirCampo(d.pacId, d.campo, d.novo);
                                    // ✅ Resolve SÓ este campo + força re-render
                                    await resolverDivergencia(ag.id, d.campo);
                                  }}
                                  style={{
                                    flex: 1,
                                    background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                                    color: '#fff',
                                    border: '1.5px solid #9c7826',
                                    padding: '10px 12px',
                                    borderRadius: 12,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: carregandoEste ? 'wait' : 'pointer',
                                    fontFamily: "'Cinzel', serif",
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 4,
                                    boxShadow: '0 3px 10px rgba(200, 162, 74, 0.3)',
                                    opacity: carregandoEste ? 0.7 : 1,
                                    minHeight: 40,
                                  }}
                                >
                                  {carregandoEste ? 'SALVANDO…' : 'SUBSTITUIR'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* ✅ BOTÕES */}
                  <div style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px dashed #f0e6fa',
                  }}>
                    {(ag.status === 'confirmado' || ag.status === 'concluido') && !pacienteJaExiste(ag) && (
                      <button
                        type="button"
                        onClick={() => abrirFichaPreenchida(ag)}
                        style={{ ...btnFicha, flex: '1 1 140px' }}
                        title="Abrir ficha de anamnese pré-preenchida com os dados deste agendamento"
                      >
                        <MdAssignment size={14} /> Ficha de Anamnese
                      </button>
                    )}

                    {ag.status === 'pendente' && (
                      <>
                        <button
                          type="button"
                          onClick={() => solicitarEscolhaServico(ag)}
                          style={{ ...btnOk, flex: '1 1 140px' }}
                        >
                          <MdCheckCircle size={14} /> Escolher serviço
                        </button>
                        <button
                          type="button"
                          onClick={() => solicitarCancelamento(ag)}
                          style={{ ...btnDanger, flex: '1 1 100px' }}
                        >
                          <MdCancel size={14} /> Cancelar
                        </button>
                      </>
                    )}

                    {ag.status === 'confirmado' && (
                      <>
                        <button
                          type="button"
                          onClick={() => concluirManual(ag)}
                          style={{ ...btnOk, flex: '1 1 100px' }}
                          title="Paciente veio e foi atendido"
                        >
                          <MdCheckCircle size={14} /> Concluir
                        </button>
                        <button
                          type="button"
                          onClick={() => marcarFaltou(ag)}
                          style={{ ...btnFaltou, flex: '1 1 100px' }}
                          title="Paciente não compareceu"
                        >
                          <MdPersonOff size={14} /> Faltou
                        </button>
                        <button
                          type="button"
                          onClick={() => solicitarCancelamento(ag)}
                          style={{ ...btnDanger, flex: '1 1 100px' }}
                        >
                          <MdCancel size={14} /> Cancelar
                        </button>
                      </>
                    )}

                    {ag.status === 'faltou' && (
                      <>
                        <button
                          type="button"
                          onClick={() => abrirReagendamento(ag)}
                          disabled={buscandoPaciente}
                          style={{
                            ...btnReagendar,
                            flex: '1 1 140px',
                            opacity: buscandoPaciente ? 0.6 : 1,
                            cursor: buscandoPaciente ? 'wait' : 'pointer',
                          }}
                          title="Criar novo agendamento para este paciente"
                        >
                          <MdRefresh size={14} />
                          {buscandoPaciente ? 'Carregando…' : 'Reagendar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => solicitarCancelamento(ag)}
                          style={{ ...btnDanger, flex: '1 1 100px' }}
                        >
                          <MdCancel size={14} /> Cancelar
                        </button>
                      </>
                    )}
                    {/* ✅ NOVO: Reagendar quando CANCELADO — mesma lógica do faltou */}
{ag.status === 'cancelado' && (
  <button
    type="button"
    onClick={() => abrirReagendamento(ag)}
    disabled={buscandoPaciente}
    style={{
      ...btnReagendar,
      flex: '1 1 140px',
      opacity: buscandoPaciente ? 0.6 : 1,
      cursor: buscandoPaciente ? 'wait' : 'pointer',
    }}
    title="Criar novo agendamento para este paciente"
  >
    <MdRefresh size={14} />
    {buscandoPaciente ? 'Carregando…' : 'Reagendar'}
  </button>
)}

                    {(ag.status === 'cancelado' ||
                      ag.status === 'faltou' ||
                      ag.status === 'concluido') && (
                      <button
                        type="button"
                        onClick={() => solicitarExclusaoAgendamento(ag)}
                        title="Excluir permanentemente da lista"
                        style={{
                          flex: '1 1 100%',
                          background: '#ffebee',
                          color: '#c62828',
                          border: '1.5px solid #ef9a9a',
                          padding: '8px 12px',
                          borderRadius: 16,
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: "'Cinzel', serif",
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          minHeight: 36,
                          marginTop: 4,
                        }}
                      >
                        <MdDelete size={13} /> EXCLUIR DA LISTA
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal de confirmação de cancelamento */}
      {agendamentoParaCancelar && (
        <ModalConfirmarCancelamento
          agendamento={agendamentoParaCancelar}
          carregando={cancelando}
          onConfirmar={confirmarCancelamento}
          onFechar={() => {
            if (!cancelando) setAgendamentoParaCancelar(null);
          }}
        />
      )}

      {/* Modal de escolher serviço */}
      {agendamentoParaConfirmar && (
        <ModalEscolherServico
          agendamento={agendamentoParaConfirmar}
          uidEsteticista={uidEsteticista}
          onFechar={() => setAgendamentoParaConfirmar(null)}
          onConfirmado={() => setAgendamentoParaConfirmar(null)}
        />
      )}

      {/* ✅ Modal de confirmação de exclusão de agendamento */}
      {agendamentoParaExcluir && (
        <div
          onClick={excluindoAg ? undefined : () => setAgendamentoParaExcluir(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(44, 22, 58, 0.65)',
            backdropFilter: 'blur(4px)',
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
              padding: '28px 24px 24px 24px',
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
              border: '1.5px solid #e2d2f5',
              fontFamily: "'Montserrat', sans-serif",
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                margin: '0 auto 16px auto',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ffebee 0%, #fde8e8 100%)',
                border: '2px solid #ef9a9a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 18px rgba(198, 40, 40, 0.18)',
              }}
            >
              <MdDelete size={30} color="#c62828" />
            </div>

            <h3
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#c62828',
                fontSize: 17,
                fontWeight: 700,
                margin: '0 0 10px 0',
              }}
            >
              Excluir da lista?
            </h3>

            <p
              style={{
                fontSize: 13,
                color: '#2c163a',
                margin: '0 0 6px 0',
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              {agendamentoParaExcluir.nome}
            </p>

            <p
              style={{
                fontSize: 12,
                color: '#555',
                margin: '0 0 18px 0',
                lineHeight: 1.6,
              }}
            >
              {formatarDataBR(agendamentoParaExcluir.data)} às {agendamentoParaExcluir.horaInicio}
              <br />
              <span style={{ fontSize: 11, color: '#888', display: 'block', marginTop: 6 }}>
                Esta ação não pode ser desfeita.
              </span>
            </p>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setAgendamentoParaExcluir(null)}
                disabled={excluindoAg}
                style={{
                  flex: 1,
                  background: '#f0f0f0',
                  color: '#333',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: 22,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: excluindoAg ? 'not-allowed' : 'pointer',
                  fontFamily: "'Cinzel', serif",
                  opacity: excluindoAg ? 0.6 : 1,
                  minHeight: 44,
                }}
              >
                CANCELAR
              </button>

              <button
                type="button"
                onClick={confirmarExclusaoAgendamento}
                disabled={excluindoAg}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: 22,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: excluindoAg ? 'wait' : 'pointer',
                  fontFamily: "'Cinzel', serif",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 4px 14px rgba(198, 40, 40, 0.35)',
                  opacity: excluindoAg ? 0.7 : 1,
                  minHeight: 44,
                }}
              >
                {excluindoAg ? 'EXCLUINDO…' : (
                  <>
                    <MdDelete size={14} /> EXCLUIR
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de reagendamento */}
      {pacienteReagendar && agendamentoParaReagendar && (
        <ModalAgendarParaPaciente
          paciente={pacienteReagendar}
          uidEsteticista={uidEsteticista}
          origem="esteticista"
          tipoNotificacao="remarcado"
          onFechar={fecharReagendamento}
          onSucesso={async (novoAg) => {
            try {
              await updateDoc(doc(db, 'agendamentos', novoAg.id), {
                reagendamentoDe: agendamentoParaReagendar.id,
                reagendamentoDeData: agendamentoParaReagendar.data,
                reagendamentoDeHora: agendamentoParaReagendar.horaInicio,
              });

              await updateDoc(
                doc(db, 'agendamentos', agendamentoParaReagendar.id),
                
                {
                  status: 'reagendado',
                  reagendadoPara: novoAg.id,
                  reagendadoEm: new Date().toISOString(),
                  atualizadoEm: new Date().toISOString(),
                }
              );
            } catch (e) {
              console.warn('Falha ao marcar reagendamento:', e);
            }
            fecharReagendamento();
          }}
        />
      )}
    </div>
  );
}

/* ============================================================
   Helpers
   ============================================================ */
function formatarDataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function labelDe(status) {
  return {
    pendente: 'pendente',
    confirmado: 'confirmado',
    cancelado: 'cancelado',
    concluido: 'concluído',
    faltou: 'com falta',
  }[status] || status;
}

/* ============================================================
   Estilos
   ============================================================ */
const abaBtn = (ativo) => ({
  padding: '10px 18px',
  borderRadius: 20,
  border: 'none',
  background: ativo ? 'linear-gradient(135deg, #C8A24A, #e2be64)' : '#f0e8fa',
  color: ativo ? '#fff' : '#2c163a',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "'Cinzel', serif",
  cursor: 'pointer',
});

const cardAg = {
  background: '#fff',
  border: '1.5px solid #e2d2f5',
  borderRadius: 12,
  padding: 16,
  overflow: 'hidden',
};

const vazio = {
  textAlign: 'center',
  padding: 40,
  color: '#888',
  background: '#fff',
  borderRadius: 12,
  border: '1px dashed #ddd',
};

const btnOk = {
  background: '#16a34a',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  minHeight: 40,
};

const btnFaltou = {
  background: '#f97316',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  minHeight: 40,
};

const btnReagendar = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  minHeight: 40,
};

const btnDanger = {
  background: '#c62828',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  minHeight: 40,
};

const btnFicha = {
  background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
  color: '#fff',
  border: '1.5px solid #9c7826',
  padding: '10px 14px',
  borderRadius: 16,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  minHeight: 40,
  boxShadow: '0 3px 10px rgba(200, 162, 74, 0.3)',
};

const badgeOk = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#f0fdf4',
  color: '#16a34a',
  border: '1px solid #86efac',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
};

const badgeWarn = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#fff8e1',
  color: '#92400e',
  border: '1px solid #fcd34d',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
};

const badgeAguardando = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#fff8e1',
  color: '#92400e',
  border: '1px solid #fcd34d',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
};

const badgeFaltou = {
  display: 'inline-flex',
  alignItems: 'center',
  background: '#fff7ed',
  color: '#c2410c',
  border: '1px solid #fdba74',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
};