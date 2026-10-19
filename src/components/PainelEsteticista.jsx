import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { sanitizarFichaAnamnese, sanitizarTexto } from '../utils/sanitizar';
import {
  anonimizarPaciente,
  reativarPaciente,
  estaAnonimizado,
  reativarPorEdicao,
} from '../utils/lgpdExclusao';
import {
  MdSearch, MdPhotoLibrary, MdArrowBack, MdDescription, MdAssignment,
  MdCalendarMonth, MdSecurity, MdAttachMoney, MdFolder, MdFolderOpen,
} from 'react-icons/md';
import CardSegurancaPaciente from './CardSegurancaPaciente';
import PainelSeguranca from './PainelSeguranca';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore, query, where, updateDoc, collection, doc,
  getDoc, setDoc, getDocs, deleteDoc, onSnapshot, orderBy, limit,
  collectionGroup,
} from 'firebase/firestore';
import HistoricoAgendamentosPaciente from './HistoricoAgendamentosPaciente';
import ModalAgendarParaPaciente from './agendamento/ModalAgendarParaPaciente';
import FichaDesktop from './FichaDesktop';
import FichaEvoDesktop from './FichaEvoDesktop';
import { log, logWarn, logError } from '../utils/log';
import GaleriaPaciente from './GaleriaPaciente';
import BotaoInstalarApp from './BotaoInstalarApp';
import AvisoNotificacoesEsteticista from './AvisoNotificacoesEsteticista';
import { secondaryAuth } from './firebaseSecondary';
import TermoConsentimentoPDF from './TermoConsentimentoPDF';
import {
  registrarLinkPaciente, gerarUidDeterministico, limparUndefined,
} from '../utils/validarUID';
import LinkAcessoPaciente from './LinkAcessoPaciente';
import PainelAgendamentosEsteticista from './agendamento/PainelAgendamentosEsteticista';
import PainelFinanceiro from './financeiro/PainelFinanceiro';
import ModalEscolherServico from './agendamento/ModalEscolherServico';

// ⚠️ UID padrão da esteta (mantém o mesmo que você usa)
import { UID_ESTETICISTA_PADRAO } from './constantes';

const MODAL_FECHADO = {
  isOpen: false,
  tipo: null,
  idAlvo: null,
  titulo: '',
  senhaInput: '',
  mostrarSenhaModal: false,
  erroSenha: '',
};

const SpinnerLoading = ({ texto = 'Carregando…' }) => (
  <div style={{
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '60px 20px',
    background: 'rgba(255, 255, 255, 0.92)',
    borderRadius: '16px', border: '1px solid #e2d2f5',
    boxShadow: '0 4px 16px rgba(44, 22, 58, 0.05)',
  }}>
    <div style={{
      width: '42px', height: '42px',
      border: '4px solid #e2d2f5',
      borderTop: '4px solid #C8A24A',
      borderRadius: '50%',
      animation: 'spinCarga 0.8s linear infinite',
      marginBottom: '14px',
    }} />
    <span style={{
      fontFamily: "'Cinzel', serif",
      color: '#55286f', fontSize: '12px', fontWeight: 700,
      letterSpacing: '0.3px',
    }}>{texto}</span>
    <style>{`@keyframes spinCarga { to { transform: rotate(360deg); } }`}</style>
  </div>
);

/* ============================================================
   MODAL DE FEEDBACK
   ============================================================ */
function ModalFeedback({ tipo = 'sucesso', titulo, mensagem, onFechar }) {
  const config = {
    sucesso: { cor: '#166534', bg: '#f0fdf4', borda: '#86efac', icone: '✅' },
    info:    { cor: '#7e22ce', bg: '#faf5ff', borda: '#d8b4fe', icone: 'ℹ️' },
    aviso:   { cor: '#92400e', bg: '#fff8e1', borda: '#fcd34d', icone: '⚠️' },
    erro:    { cor: '#991b1b', bg: '#fef2f2', borda: '#fca5a5', icone: '❌' },
  }[tipo] || { cor: '#7e22ce', bg: '#faf5ff', borda: '#d8b4fe', icone: 'ℹ️' };

  const { cor, bg, borda, icone } = config;

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 22, 58, 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999999,
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '28px 24px 22px',
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 20px 60px rgba(44, 22, 58, 0.4)',
          border: '1.5px solid #e2d2f5',
          fontFamily: "'Montserrat', sans-serif",
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64, height: 64,
            margin: '0 auto 14px auto',
            borderRadius: '50%',
            background: bg,
            border: `2px solid ${borda}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30,
            boxShadow: `0 4px 14px ${cor}22`,
          }}
        >
          {icone}
        </div>

        {titulo && (
          <h3 style={{
            fontFamily: "'Cinzel', serif",
            color: cor,
            fontSize: 17, fontWeight: 700,
            margin: '0 0 10px 0',
            letterSpacing: '0.4px',
          }}>
            {titulo}
          </h3>
        )}

        {mensagem && (
          <p style={{
            fontSize: 13,
            color: '#2c163a',
            margin: '0 0 20px 0',
            lineHeight: 1.6,
            whiteSpace: 'pre-line',
          }}>
            {mensagem}
          </p>
        )}

        <button
          type="button"
          onClick={onFechar}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
            color: '#fff',
            border: '1.5px solid #9c7826',
            padding: '13px 16px',
            borderRadius: 22,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Cinzel', serif",
            boxShadow: '0 4px 14px rgba(200, 162, 74, 0.35)',
            letterSpacing: '0.6px',
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}

export default function PainelEsteticista({ onLogout }) {
  const TAMANHO_PAGINA = 50;
  const [limitePagina, setLimitePagina] = useState(TAMANHO_PAGINA);
  const [temMais, setTemMais] = useState(true);

  const [carregandoNuvem, setCarregandoNuvem] = useState(true);
  const [jaCarregou, setJaCarregou] = useState(false);
  const [pacientes, setPacientes] = useState([]);

  const [abaPacientes, setAbaPacientes] = useState('ativos');

  const [resultadosBusca, setResultadosBusca] = useState(null);
  const [buscandoGlobal, setBuscandoGlobal] = useState(false);
  const cacheBuscaRef = useRef(null);

  const [telaAtual, setTelaAtual] = useState('lista');
  const [termoBusca, setTermoBusca] = useState('');
  const [termoBuscaEvolucao, setTermoBuscaEvolucao] = useState('');

  const [pacienteSelecionado, setPacienteSelecionado] = useState(null);
  const [evolucaoSelecionada, setEvolucaoSelecionada] = useState(null);
  const [mostrarTermoPDF, setMostrarTermoPDF] = useState(false);
  const [mostrarModalAgendar, setMostrarModalAgendar] = useState(false);
  const [modalFeedback, setModalFeedback] = useState(null);
  const [agendamentoRecemCriado, setAgendamentoRecemCriado] = useState(null);

  const [modalExclusao, setModalExclusao] = useState(MODAL_FECHADO);

  const db = getFirestore();
  const auth = getAuth();

  const pacRef = useRef(null);
  const evoRef = useRef(null);
  const modalOpenRef = useRef(false);
  const [fotosPendentes, setFotosPendentes] = useState([]);
  const [mostrarBannerFotos, setMostrarBannerFotos] = useState(true);

  useEffect(() => { pacRef.current = pacienteSelecionado; }, [pacienteSelecionado]);
  useEffect(() => { evoRef.current = evolucaoSelecionada; }, [evolucaoSelecionada]);
  useEffect(() => { modalOpenRef.current = modalExclusao.isOpen; }, [modalExclusao.isOpen]);

  const [agendamentosPendentesCount, setAgendamentosPendentesCount] = useState(0);
  const [segurancaAlertaCount, setSegurancaAlertaCount] = useState(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'agendamentos'),
      where('uidEsteticista', '==', user.uid),
      where('status', '==', 'pendente')
    );

    const unsub = onSnapshot(
      q,
      (snap) => setAgendamentosPendentesCount(snap.size),
      (e) => logWarn('Erro contagem pendentes:', e)
    );

    return () => unsub();
  }, []);

  const [tentativasAlertaCount, setTentativasAlertaCount] = useState(0);
  const [dispositivosAlertaCount, setDispositivosAlertaCount] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, 'tentativas_login'),
      where('requerBloqueio', '==', true)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setTentativasAlertaCount(snap.size),
      (e) => logWarn('Erro contagem segurança:', e)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'alertas_dispositivo'),
      where('status', '==', 'pendente')
    );
    const unsub = onSnapshot(
      q,
      (snap) => setDispositivosAlertaCount(snap.size),
      (e) => logWarn('Erro contagem dispositivos:', e)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setSegurancaAlertaCount(tentativasAlertaCount + dispositivosAlertaCount);
  }, [tentativasAlertaCount, dispositivosAlertaCount]);

  // ============================================================
  // Sincroniza pacienteSelecionado com a lista
  // ============================================================
  useEffect(() => {
    if (!jaCarregou) return;
    if (!pacienteSelecionado) return;

    const atual = pacientes.find(
      (p) => String(p.id) === String(pacienteSelecionado.id)
    );

    // Caso 1: paciente SUMIU da lista
    if (!atual) {
      setPacienteSelecionado(null);
      setEvolucaoSelecionada(null);
      setTelaAtual('lista');
      window.history.replaceState(
        { painelEsteticista: 'lista' },
        '',
        window.location.pathname
      );
      return;
    }

    // Caso 2: paciente foi ANONIMIZADO em outro device
   // Caso 2: paciente foi ANONIMIZADO em outro device
const foiAnonimizadoAgora =
  estaAnonimizado(atual) && !estaAnonimizado(pacienteSelecionado);

if (foiAnonimizadoAgora) {
  setPacienteSelecionado(null);
  setEvolucaoSelecionada(null);
  setTelaAtual('lista');
  setAbaPacientes('ativos');  // ← força voltar pra aba Ativos
  window.history.replaceState(
    { painelEsteticista: 'lista' },
    '',
    window.location.pathname
  );
  return;
}

    if (atual !== pacienteSelecionado) {
      setPacienteSelecionado(atual);
    }
  }, [pacientes, jaCarregou, pacienteSelecionado]);

  const agendarLembretesNoOneSignal = async (pacienteId, lembretes) => {
    if (!Array.isArray(lembretes)) return;

    try {
      const offsetMin = new Date().getTimezoneOffset() * -1;

      const response = await fetch('/.netlify/functions/agendar-lembretes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pacienteId, lembretes, offsetMin }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Falha ao agendar lembretes:', data);
      }
    } catch (err) {
      console.error('❌ Erro ao agendar lembretes:', err);
    }
  };

  const navegarPara = useCallback((novaTela, dados = {}) => {
    const pacId = 'paciente' in dados ? (dados.paciente?.id ?? null) : (pacRef.current?.id ?? null);
    const evoId = 'evolucao' in dados ? (dados.evolucao?.id ?? null) : (evoRef.current?.id ?? null);

    window.history.pushState(
      { painelEsteticista: novaTela, pacienteId: pacId, evolucaoId: evoId },
      '',
      window.location.pathname
    );
    setTelaAtual(novaTela);
    if ('paciente' in dados) setPacienteSelecionado(dados.paciente);
    if ('evolucao' in dados) setEvolucaoSelecionada(dados.evolucao);
  }, []);

  const substituirTela = useCallback((novaTela, dados = {}) => {
    const pacId = 'paciente' in dados ? (dados.paciente?.id ?? null) : (pacRef.current?.id ?? null);
    const evoId = 'evolucao' in dados ? (dados.evolucao?.id ?? null) : (evoRef.current?.id ?? null);

    window.history.replaceState(
      { painelEsteticista: novaTela, pacienteId: pacId, evolucaoId: evoId },
      '',
      window.location.pathname
    );
    setTelaAtual(novaTela);
    if ('paciente' in dados) setPacienteSelecionado(dados.paciente);
    if ('evolucao' in dados) setEvolucaoSelecionada(dados.evolucao);
  }, []);

  useEffect(() => {
    const onPop = (e) => {
      const st = e.state;

      if (modalOpenRef.current && !st?.modalAberto) {
        setModalExclusao(MODAL_FECHADO);
      }

      if (st?.painelEsteticista) {
        if (st.painelEsteticista === 'detalhe_pasta' && st.pacienteId) {
          const pac = pacientes.find(p => String(p.id) === String(st.pacienteId));
          if (!pac) {
            window.history.replaceState({ painelEsteticista: 'lista' }, '', window.location.pathname);
            setTelaAtual('lista');
            setPacienteSelecionado(null);
            setEvolucaoSelecionada(null);
            return;
          }
          setPacienteSelecionado(pac);
        } else if (st.pacienteId) {
          const pac = pacientes.find(p => String(p.id) === String(st.pacienteId));
          setPacienteSelecionado(pac || null);
        } else {
          setPacienteSelecionado(null);
        }

        setTelaAtual(st.painelEsteticista);

        const pacAtual = pacRef.current;
        if (st.evolucaoId && pacAtual?.evolucoes) {
          const evo = pacAtual.evolucoes.find(x => String(x.id) === String(st.evolucaoId));
          setEvolucaoSelecionada(evo || null);
        } else {
          setEvolucaoSelecionada(null);
        }
      } else {
        setTelaAtual('lista');
        setPacienteSelecionado(null);
        setEvolucaoSelecionada(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [pacientes]);

  useEffect(() => {
    if (!window.history.state?.painelEsteticista) {
      window.history.replaceState(
        { painelEsteticista: 'lista' },
        '',
        window.location.pathname
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    import('./push-notifications').then(({ inscreverPushEsteticistaWeb }) => {
      inscreverPushEsteticistaWeb(user.uid).catch(() => {});
    });
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    let cancelado = false;

    const q = query(
      collectionGroup(db, 'fotos'),
      where('uidEsteticista', '==', uid),
      where('notificado', '==', false)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (cancelado) return;

        const mapa = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          let pid = data.pacienteId;
          if (!pid) {
            const partes = d.ref.path.split('/');
            pid = partes[3] || null;
          }
          if (!pid) return;

          if (!mapa[pid]) {
            mapa[pid] = {
              pacienteId: pid,
              pacienteNome: data.pacienteNome || 'Paciente',
              count: 0,
            };
          }
          mapa[pid].count++;
        });

        setFotosPendentes(Object.values(mapa));
      },
      (err) => {
        console.error('Erro listener fotos pendentes:', err);
      }
    );

    return () => {
      cancelado = true;
      unsub();
    };
  }, []);

  const marcarFotosComoNotificadas = async (pacienteId) => {
    try {
      const uid = auth.currentUser.uid;
      const snap = await getDocs(query(
        collection(db, `usuarios/${uid}/pacientes/${pacienteId}/fotos`),
        where('notificado', '==', false)
      ));
      const batch = snap.docs.map((d) => updateDoc(d.ref, { notificado: true }));
      await Promise.all(batch);
      setFotosPendentes((prev) => prev.filter((f) => f.pacienteId !== pacienteId));
    } catch (e) {
      logWarn('Falha ao marcar como notificadas:', e);
    }
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const ref = doc(db, 'sistema', 'esteticista_ativa');
    getDoc(ref).then((snap) => {
      if (!snap.exists()) {
        setDoc(ref, {
          uid: UID_ESTETICISTA_PADRAO,
          email: 'samira.ferreira@sistema.local',
          atualizadoEm: new Date().toISOString(),
        });
      }
    }).catch((e) => logWarn('Falha checando UID global:', e));
  }, []);

  // ============================================================
  // BUSCA GLOBAL
  // ============================================================
  useEffect(() => {
    const termo = termoBusca.trim();

    if (termo.length < 2) {
      setResultadosBusca(null);
      setBuscandoGlobal(false);
      return;
    }

    const timer = setTimeout(async () => {
      const user = auth.currentUser;
      if (!user) return;

      setBuscandoGlobal(true);
      try {
        let todos = cacheBuscaRef.current;

        if (!todos) {
          const snap = await getDocs(
            collection(db, `usuarios/${user.uid}/pacientes`)
          );
          todos = snap.docs.map((d) => d.data());
          cacheBuscaRef.current = todos;
        }

        const norm = (s) =>
          (s || '')
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        const termoNorm = norm(termo);

        const filtrados = todos.filter((p) => {
          const nomeNorm = norm(p.nome);
          const docNorm = norm(p.documento);
          return nomeNorm.includes(termoNorm) || docNorm.includes(termoNorm);
        });

        setResultadosBusca(filtrados);
      } catch (e) {
        console.error('Erro na busca global:', e);
        setResultadosBusca([]);
      } finally {
        setBuscandoGlobal(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [termoBusca]);

  // ============================================================
  // LISTENER — pacientes
  // ============================================================
  useEffect(() => {
    let unsubAuth = null;
    let unsubSnapshot = null;

    const iniciarListener = (user) => {
      if (!user) return;

      const base = collection(db, `usuarios/${user.uid}/pacientes`);
      const q = query(base, orderBy('nome'), limit(limitePagina));

      if (unsubSnapshot) unsubSnapshot();

      unsubSnapshot = onSnapshot(
        q,
        (snap) => {
          const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setPacientes(lista);
          setTemMais(snap.size === limitePagina);
          setCarregandoNuvem(false);
          setJaCarregou(true);

          Promise.allSettled(
            lista.map((p) => registrarLinkPaciente(p.id, user.uid).catch(() => {}))
          );
        },
        (e) => {
          console.error('Erro listener pacientes:', e);
          setCarregandoNuvem(false);
          setJaCarregou(true);
        }
      );
    };

    unsubAuth = onAuthStateChanged(auth, (user) => {
      iniciarListener(user);
    });

    return () => {
      if (unsubAuth) unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [db, auth, limitePagina]);

  // ============================================================
  // Filtros (ativos vs. arquivados)
  // ============================================================
  const pacientesAtivos = useMemo(
    () => pacientes.filter((p) => !estaAnonimizado(p)),
    [pacientes]
  );

  const pacientesArquivados = useMemo(
    () => pacientes.filter((p) => estaAnonimizado(p)),
    [pacientes]
  );

  const listaParaRender = useMemo(() => {
    return abaPacientes === 'arquivados' ? pacientesArquivados : pacientesAtivos;
  }, [abaPacientes, pacientesAtivos, pacientesArquivados]);

  const excluirPacienteDaNuvem = async (idPaciente) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await anonimizarPaciente({
        pacienteId: idPaciente,
        uidEsteticista: user.uid,
        motivo: 'esteta-excluiu',
      });

      cacheBuscaRef.current = null;
    } catch (e) {
      console.error('Erro ao anonimizar paciente:', e);
      throw e;
    }
  };

  const extrairDocumento = (dados) => {
    if (!dados) return 'Não informado';
    return (
      dados.nDocumento ||
      dados.numeroDocumento ||
      dados.documento ||
      dados.cpf ||
      dados.rg ||
      'Não informado'
    );
  };

  const salvarPacienteNaNuvem = async (pacienteObj) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await setDoc(
        doc(db, `usuarios/${user.uid}/pacientes`, String(pacienteObj.id)),
        limparUndefined(pacienteObj)
      );
      cacheBuscaRef.current = null;
    } catch (e) {
      console.error('Erro ao salvar paciente na nuvem:', e);
    }
  };

  // ============================================================
  // handleSalvarAnamnese (com reativação automática)
  // ============================================================
  const handleSalvarAnamnese = async (dadosAnamnese) => {
  const userEsteticista = auth.currentUser;
  if (!userEsteticista) {
    alert("Erro: Sessão da esteticista não encontrada. Faça login novamente.");
    return;
  }

  // ✅ Sanitização defensiva (front já sanitiza, mas reforçamos aqui)
  const dadosLimpos = sanitizarFichaAnamnese(dadosAnamnese);
  dadosAnamnese = {
    ...dadosLimpos,
    nome: sanitizarTexto(dadosLimpos.nome, { maxLength: 100 }),
    observacoes: sanitizarTexto(dadosLimpos.observacoes, {
      maxLength: 5000,
      permitirQuebraLinha: true,
    }),
    endereco: sanitizarTexto(dadosLimpos.endereco, { maxLength: 200 }),
  };

  try {
    const nomeOriginal = dadosAnamnese.nome ? dadosAnamnese.nome.trim() : '';
    let partes = nomeOriginal.split(/\s+/);

    let primeiroNome = 'usuario';
    let sobrenome = 'paciente';

    if (partes.length >= 2) {
      primeiroNome = partes[0];
      sobrenome = partes[partes.length - 1];
    } else if (partes.length === 1 && partes[0].length > 0) {
      primeiroNome = partes[0];
    }

    const pNomeLimpo = primeiroNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const sSobrenomeLimpo = sobrenome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const emailFicticio = `${pNomeLimpo}.${sSobrenomeLimpo}@sistema.local`;

    const docFormatado = extrairDocumento(dadosAnamnese);
    const documentoLimpo = docFormatado.replace(/\D/g, '');
    const senhaFicticia = (documentoLimpo.length >= 6
      ? documentoLimpo.slice(-6)
      : '123456'
    ).padEnd(6, '0');

    let pacienteUid = '';

    try {
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, emailFicticio, senhaFicticia
      );
      pacienteUid = userCredential.user.uid;
      await signOut(secondaryAuth);
    } catch (authError) {
      if (authError.code === 'auth/email-already-in-use') {
        try {
          const tempCredential = await signInWithEmailAndPassword(
            secondaryAuth, emailFicticio, senhaFicticia
          );
          pacienteUid = tempCredential.user.uid;
          await signOut(secondaryAuth);
        } catch (signInErr) {
          pacienteUid = gerarUidDeterministico(`${emailFicticio}|${documentoLimpo}`);
        }
      } else {
        alert(`Erro ao criar o acesso do paciente: ${authError.message}`);
        return;
      }
    }

    if (!pacienteUid) {
      pacienteUid = String(Date.now());
    }

    let pastaExistente = null;
    try {
      const pacRef = doc(db, `usuarios/${userEsteticista.uid}/pacientes`, String(pacienteUid));
      const pacSnap = await getDoc(pacRef);
      if (pacSnap.exists()) {
        pastaExistente = { id: pacSnap.id, ...pacSnap.data() };
      }
    } catch (e) {
      logWarn('Falha ao checar pasta existente:', e);
    }

    if (pastaExistente && estaAnonimizado(pastaExistente)) {
      // ⚖️ REATIVA
      await reativarPaciente({
        pacienteId: pacienteUid,
        uidEsteticista: userEsteticista.uid,
        nome: dadosAnamnese.nome,
        documento: docFormatado,
      });

      const dadosReativados = {
        ...pastaExistente,
        id: pacienteUid,
        nome: dadosAnamnese.nome,
        documento: docFormatado,
        telefone: dadosAnamnese.telefone || '',
        emailContato: dadosAnamnese.emailContato || '',
        emailAcesso: pastaExistente.emailAcesso || emailFicticio,
        email: pastaExistente.emailAcesso || emailFicticio,
        criadoPorUid: userEsteticista.uid,
        dataCriacao: pastaExistente.dataCriacaoOriginal || pastaExistente.dataCriacao,
        dataUltimaEdicao: new Date().toLocaleDateString('pt-BR') +
          ' às ' + new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit', minute: '2-digit'
          }),
        anamnese: dadosAnamnese,
        evolucoes: pastaExistente.evolucoes || [],
      };

      await salvarPacienteNaNuvem(dadosReativados);

      if (dadosAnamnese.lembretes) {
        await agendarLembretesNoOneSignal(pacienteUid, dadosAnamnese.lembretes);
      }

      await registrarLinkPaciente(pacienteUid, userEsteticista.uid);

      await setDoc(
        doc(db, 'mapeamento_emails', emailFicticio),
        {
          profissionalUid: userEsteticista.uid,
          pacienteId: pacienteUid,
          atualizadoEm: new Date().toISOString(),
        },
        { merge: true }
      );

      return;
    }

    // Paciente NOVO
    const agora = new Date();
    const dataHoraFormatada = agora.toLocaleDateString('pt-BR') + ' às ' +
      agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const novoPaciente = {
      id: pacienteUid,
      nome: dadosAnamnese.nome || 'Paciente sem nome',
      documento: docFormatado,
      email: emailFicticio,
      emailAcesso: emailFicticio,
      telefone: dadosAnamnese.telefone || '',
      emailContato: dadosAnamnese.emailContato || '',
      criadoPorUid: userEsteticista.uid,
      dataCriacao: pastaExistente?.dataCriacao || dataHoraFormatada,
      dataUltimaEdicao: dataHoraFormatada,
      anamnese: dadosAnamnese,
      evolucoes: pastaExistente?.evolucoes || [],
    };

    const novaLista = [novoPaciente, ...pacientes].sort((a, b) =>
      (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
    );

    setPacientes(novaLista);
    await salvarPacienteNaNuvem(novoPaciente);

    if (dadosAnamnese.lembretes) {
      await agendarLembretesNoOneSignal(pacienteUid, dadosAnamnese.lembretes);
    }

    await registrarLinkPaciente(pacienteUid, userEsteticista.uid);

    await setDoc(
      doc(db, 'mapeamento_emails', emailFicticio),
      {
        profissionalUid: userEsteticista.uid,
        pacienteId: pacienteUid,
        atualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Erro geral ao salvar ficha:", error);
    alert("Erro ao salvar ficha na nuvem.");
  }
};

 const handleAtualizarAnamnese = async (dadosAtualizados) => {
  // ✅ Sanitização defensiva (antes de qualquer coisa)
  const dadosLimpos = sanitizarFichaAnamnese(dadosAtualizados);
  dadosAtualizados = {
    ...dadosLimpos,
    nome: sanitizarTexto(dadosLimpos.nome, { maxLength: 100 }),
    observacoes: sanitizarTexto(dadosLimpos.observacoes, {
      maxLength: 5000,
      permitirQuebraLinha: true,
    }),
    endereco: sanitizarTexto(dadosLimpos.endereco, { maxLength: 200 }),
  };

  // ⚖️ LGPD — Verifica se o paciente estava ARQUIVADO
  const estavaArquivado = Boolean(pacienteSelecionado?.anonimizadoEm);

  if (estavaArquivado) {
    const userEst = auth.currentUser;
    if (userEst) {
      // ============================================================
      // 1) Recria a conta do Firebase Auth do paciente
      //    (a conta original pode ter sido DELETADA quando ele excluiu a conta)
      // ============================================================
      const nomeOriginal = dadosAtualizados.nome ? dadosAtualizados.nome.trim() : '';
      const partes = nomeOriginal.split(/\s+/);
      const pNome = (partes[0] || 'usuario')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const sNome = (partes[partes.length - 1] || 'paciente')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const emailFicticio = `${pNome}.${sNome}@sistema.local`;

      const docLimpo = extrairDocumento(dadosAtualizados).replace(/\D/g, '');
      const senhaFicticia = (docLimpo.length >= 6 ? docLimpo.slice(-6) : '123456')
        .padEnd(6, '0');

      try {
        // Tenta criar de novo
        await createUserWithEmailAndPassword(secondaryAuth, emailFicticio, senhaFicticia);
        await signOut(secondaryAuth);
      } catch (authErr) {
        // Se já existe, tenta logar em silêncio (só pra validar que ainda funciona)
        if (authErr.code === 'auth/email-already-in-use') {
          try {
            await signInWithEmailAndPassword(secondaryAuth, emailFicticio, senhaFicticia);
            await signOut(secondaryAuth);
          } catch (e) {
            console.warn('Conta Auth existe, mas senha mudou:', e);
          }
        } else {
          console.warn('Erro ao recriar conta Auth:', authErr);
        }
      }

      // ============================================================
      // 2) Reconstrói o mapeamento de email → (uid, pacienteId)
      // ============================================================
      try {
        await setDoc(
          doc(db, 'mapeamento_emails', emailFicticio),
          {
            profissionalUid: userEst.uid,
            pacienteId: pacienteSelecionado.id,
            atualizadoEm: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Falha ao recriar mapeamento de email:', e);
      }

      // ============================================================
      // 3) Reativa no Firestore (remove anonimizadoEm, atualiza dados)
      // ============================================================
      await reativarPorEdicao({
        pacienteId: pacienteSelecionado.id,
        uidEsteticista: userEst.uid,
        nome: dadosAtualizados.nome,
        documento: extrairDocumento(dadosAtualizados),
        telefone: dadosAtualizados.telefone,
        emailContato: dadosAtualizados.emailContato,
        endereco: dadosAtualizados.endereco,
      });

      cacheBuscaRef.current = null;
    }
  }

  const agora = new Date();
  const dataHoraFormatada = agora.toLocaleDateString('pt-BR') + ' às ' +
    agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const novoDoc = extrairDocumento(dadosAtualizados);

  if (dadosAtualizados.lembretes) {
    await agendarLembretesNoOneSignal(pacienteSelecionado.id, dadosAtualizados.lembretes);
  }

  let pacienteAtualizadoSalvar = null;

  const atualizados = pacientes.map(p => {
    if (p.id === pacienteSelecionado.id) {
      pacienteAtualizadoSalvar = {
        ...p,
        nome: dadosAtualizados.nome || p.nome,
        documento: novoDoc !== 'Não informado' ? novoDoc : p.documento,
        telefone: dadosAtualizados.telefone || p.telefone || '',
        emailContato: dadosAtualizados.emailContato || p.emailContato || '',
        dataUltimaEdicao: dataHoraFormatada,
        anamnese: dadosAtualizados,
        // 🔧 Remove marcadores de anonimização (o state local reflete isso NA HORA)
        ...(estavaArquivado ? {
          anonimizadoEm: null,
          anonimizadoPor: null,
          reativadoEm: new Date().toISOString(),
        } : {}),
      };

      return pacienteAtualizadoSalvar;
    }

    return p;
  }).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));

  setPacientes(atualizados);
  if (pacienteAtualizadoSalvar) {
    await salvarPacienteNaNuvem(pacienteAtualizadoSalvar);
  }
  const pacAtualizado = atualizados.find(p => p.id === pacienteSelecionado.id);
  setPacienteSelecionado(pacAtualizado);
};

  const handleCampoSubstituido = (pacId, campo, valor) => {
    const atualizados = pacientes.map((p) => {
      if (String(p.id) !== String(pacId)) return p;

      const anamneseAtualizada = p.anamnese
        ? { ...p.anamnese, [campo]: valor }
        : p.anamnese;

      return {
        ...p,
        [campo]: valor,
        anamnese: anamneseAtualizada,
      };
    });

    setPacientes(atualizados);

    if (pacienteSelecionado && String(pacienteSelecionado.id) === String(pacId)) {
      const anamneseAtualizada = pacienteSelecionado.anamnese
        ? { ...pacienteSelecionado.anamnese, [campo]: valor }
        : pacienteSelecionado.anamnese;

      setPacienteSelecionado({
        ...pacienteSelecionado,
        [campo]: valor,
        anamnese: anamneseAtualizada,
      });
    }

    cacheBuscaRef.current = null;
  };

  const solicitarExclusaoPasta = (idPaciente) => {
    window.history.pushState(
      {
        painelEsteticista: telaAtual,
        pacienteId: pacRef.current?.id ?? null,
        modalAberto: 'exclusao'
      },
      '',
      window.location.pathname
    );
    setModalExclusao({
      isOpen: true,
      tipo: 'pasta',
      idAlvo: idPaciente,
      titulo: 'Tem certeza que deseja excluir esta pasta e todas as suas evoluções?',
      senhaInput: '',
      mostrarSenhaModal: false,
      erroSenha: ''
    });
  };

  const solicitarExclusaoEvolucao = (idEvolucao) => {
    window.history.pushState(
      {
        painelEsteticista: telaAtual,
        pacienteId: pacRef.current?.id ?? null,
        modalAberto: 'exclusao'
      },
      '',
      window.location.pathname
    );
    setModalExclusao({
      isOpen: true,
      tipo: 'evolucao',
      idAlvo: idEvolucao,
      titulo: 'Tem certeza que deseja excluir esta ficha de evolução?',
      senhaInput: '',
      mostrarSenhaModal: false,
      erroSenha: ''
    });
  };

  const confirmarExclusao = async () => {
    const user = auth.currentUser;

    if (!user || !user.email) {
      setModalExclusao(prev => ({
        ...prev,
        erroSenha: 'Sessão expirada. Faça login novamente.'
      }));
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, user.email, modalExclusao.senhaInput);

      if (modalExclusao.tipo === 'pasta') {
        await excluirPacienteDaNuvem(modalExclusao.idAlvo);

        const filtrados = pacientes.filter(p => p.id !== modalExclusao.idAlvo);
        setPacientes(filtrados);
        setPacienteSelecionado(null);
        setEvolucaoSelecionada(null);

        window.history.replaceState(
          { painelEsteticista: 'lista' },
          '',
          window.location.pathname
        );
        setTelaAtual('lista');
        setModalExclusao(MODAL_FECHADO);
        return;
      }

      if (modalExclusao.tipo === 'evolucao') {
        let pacienteAtualizadoSalvar = null;
        const novasEvolucoes = pacienteSelecionado.evolucoes.filter(evo => evo.id !== modalExclusao.idAlvo);
        const atualizados = pacientes.map(p => {
          if (p.id === pacienteSelecionado.id) {
            pacienteAtualizadoSalvar = { ...p, evolucoes: novasEvolucoes };
            return pacienteAtualizadoSalvar;
          }
          return p;
        });

        setPacientes(atualizados);
        if (pacienteAtualizadoSalvar) {
          await salvarPacienteNaNuvem(pacienteAtualizadoSalvar);
        }
        setPacienteSelecionado({ ...pacienteSelecionado, evolucoes: novasEvolucoes });

        window.history.replaceState(
          { painelEsteticista: 'detalhe_pasta', pacienteId: String(pacienteSelecionado.id) },
          '',
          window.location.pathname
        );
        setTelaAtual('detalhe_pasta');
        setModalExclusao(MODAL_FECHADO);
      }

    } catch (error) {
      console.error("Erro ao validar senha:", error);
      setModalExclusao(prev => ({
        ...prev,
        erroSenha: 'Senha incorreta. Tente novamente.'
      }));
    }
  };

  const fecharModalExclusao = () => {
    if (window.history.state?.modalAberto) {
      window.history.back();
    } else {
      setModalExclusao(MODAL_FECHADO);
    }
  };

  const handleSalvarEvolucao = async (dadosEvolucao) => {
    const agora = new Date();
    const dataEvo = agora.toLocaleDateString('pt-BR') + ' às ' +
      agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const novaEvolucaoObj = {
      id: Date.now(),
      dataCriacao: dataEvo,
      ...dadosEvolucao
    };

    let pacienteAtualizadoSalvar = null;
    const atualizados = pacientes.map(p => {
      if (p.id === pacienteSelecionado.id) {
        pacienteAtualizadoSalvar = {
          ...p,
          evolucoes: [novaEvolucaoObj, ...p.evolucoes]
        };
        return pacienteAtualizadoSalvar;
      }
      return p;
    });

    setPacientes(atualizados);
    if (pacienteAtualizadoSalvar) {
      await salvarPacienteNaNuvem(pacienteAtualizadoSalvar);
    }
    const pacAtualizado = atualizados.find(p => p.id === pacienteSelecionado.id);
    setPacienteSelecionado(pacAtualizado);

    substituirTela('detalhe_pasta');
  };

  const handleAtualizarEvolucao = async (dadosAtualizados) => {
    const novasEvolucoes = pacienteSelecionado.evolucoes.map(evo => {
      if (evo.id === evolucaoSelecionada.id) {
        return { ...evo, ...dadosAtualizados };
      }
      return evo;
    });

    let pacienteAtualizadoSalvar = null;
    const atualizados = pacientes.map(p => {
      if (p.id === pacienteSelecionado.id) {
        pacienteAtualizadoSalvar = { ...p, evolucoes: novasEvolucoes };
        return pacienteAtualizadoSalvar;
      }
      return p;
    });

    setPacientes(atualizados);
    if (pacienteAtualizadoSalvar) {
      await salvarPacienteNaNuvem(pacienteAtualizadoSalvar);
    }
    setPacienteSelecionado({ ...pacienteSelecionado, evolucoes: novasEvolucoes });

    substituirTela('detalhe_pasta');
  };

  const formatarMascaraData = (valor) => {
    const apenasDigitos = valor.replace(/\D/g, '').slice(0, 8);
    if (apenasDigitos.length <= 2) {
      return apenasDigitos;
    }
    if (apenasDigitos.length <= 4) {
      return `${apenasDigitos.slice(0, 2)}/${apenasDigitos.slice(2)}`;
    }
    return `${apenasDigitos.slice(0, 2)}/${apenasDigitos.slice(2, 4)}/${apenasDigitos.slice(4, 8)}`;
  };

  const handleMudancaBuscaEvolucao = (e) => {
    const valorFormatado = formatarMascaraData(e.target.value);
    setTermoBuscaEvolucao(valorFormatado);
  };

  const evolucoesFiltradas = pacienteSelecionado?.evolucoes?.filter(evo => {
    const termo = termoBuscaEvolucao.toLowerCase().trim();
    if (!termo) return true;
    const dataEvo = (evo.dataCriacao || '').toLowerCase();
    return dataEvo.includes(termo);
  }) || [];

  if (telaAtual === 'criar_anamnese') {
    return (
      <FichaDesktop
        mode="create"
        onSave={handleSalvarAnamnese}
        onVoltar={() => navegarPara('lista', { paciente: null, evolucao: null })}
      />
    );
  }

  if (telaAtual === 'editar_anamnese' && pacienteSelecionado) {
    return (
      <FichaDesktop
        mode="edit"
        fichaSelecionada={pacienteSelecionado.anamnese}
        onSave={handleAtualizarAnamnese}
        onVoltar={() => navegarPara('detalhe_pasta')}
      />
    );
  }

  if (telaAtual === 'ver_anamnese' && pacienteSelecionado) {
    return (
      <FichaDesktop
        mode="view"
        fichaSelecionada={pacienteSelecionado.anamnese}
        onVoltar={() => navegarPara('detalhe_pasta')}
        onIrParaEdicao={() => navegarPara('editar_anamnese')}
      />
    );
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#d7cee0',
      fontFamily: "'Montserrat', sans-serif",
      paddingBottom: '40px',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        pointerEvents: 'none',
        zIndex: 0
      }}>
        <img
          src="/imagens/logo-telainicial.jpeg"
          alt="Marca d'água"
          style={{
            width: '850px',
            height: 'auto',
            marginTop: '-98px',
            opacity: 0.15,
            objectFit: 'contain'
          }}
        />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600&display=swap');

        .btn-efeito-hover {
          transition: all 0.25s ease-in-out !important;
        }
        .btn-efeito-hover:hover {
          transform: translateY(-2px);
          filter: brightness(1.05);
          box-shadow: 0 6px 18px rgba(200, 162, 74, 0.45) !important;
        }

        .btn-efeito-hover-perigo {
          transition: all 0.25s ease-in-out !important;
        }
        .btn-efeito-hover-perigo:hover {
          transform: translateY(-2px);
          background-color: #f7d7d9 !important;
          box-shadow: 0 6px 16px rgba(198, 40, 40, 0.25) !important;
        }

        .btn-efeito-hover-escuro {
          transition: all 0.25s ease-in-out !important;
        }
        .btn-efeito-hover-escuro:hover {
          transform: translateY(-2px);
          background-color: #3b1d4e !important;
          box-shadow: 0 6px 16px rgba(44, 22, 58, 0.35) !important;
        }

        .card-pasta-hover {
          transition: all 0.25s ease-in-out !important;
        }
        .card-pasta-hover:hover {
          transform: translateY(-3px);
          border-color: #C8A24A !important;
          box-shadow: 0 8px 22px rgba(44, 22, 58, 0.12) !important;
          background: rgba(255, 255, 255, 0.98) !important;
        }

        .tab-pacientes {
          padding: 10px 20px;
          border-radius: 20px;
          border: 1.5px solid #C8A24A;
          background: transparent;
          color: #C8A24A;
          font-family: 'Cinzel', serif;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }
        .tab-pacientes.ativo {
          background: linear-gradient(135deg, #C8A24A 0%, #e2be64 100%);
          color: #fff;
          box-shadow: 0 4px 14px rgba(200, 162, 74, 0.35);
        }
        .tab-pacientes:hover:not(.ativo) {
          background: rgba(200, 162, 74, 0.10);
        }
        .tab-pacientes .tab-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          padding: 0 7px;
          border-radius: 11px;
          background: rgba(44, 22, 58, 0.10);
          color: #2c163a;
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          font-weight: 800;
        }
        .tab-pacientes.ativo .tab-badge {
          background: rgba(255, 255, 255, 0.30);
          color: #fff;
        }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {auth.currentUser && (
          <AvisoNotificacoesEsteticista uidEsteticista={auth.currentUser.uid} />
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '25px 40px 10px 40px',
          maxWidth: '1200px',
          margin: '0 auto',
          gap: '15px',
          flexWrap: 'wrap'
        }}>
          <div>
            <h1 style={{
              fontFamily: "'Cinzel', serif",
              color: '#2c163a',
              fontSize: '22px',
              margin: 0,
              textShadow: '0 1px 2px rgba(255,255,255,0.8)'
            }}>
              Painel da Esteticista
            </h1>
            <span style={{
              fontSize: '12px',
              color: '#55286f',
              fontWeight: 600
            }}>
              Samira Ferreira Estética & Cosmetóloga
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <BotaoInstalarApp />

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                style={{
                  fontFamily: "'Cinzel', serif",
                  background: 'transparent',
                  color: '#e74c3c',
                  border: '1.5px solid #e74c3c',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                Sair do Sistema
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '20px 40px', maxWidth: '1200px', margin: '0 auto' }}>

          {telaAtual === 'lista' && (
            <div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.92)',
                borderRadius: '16px',
                border: '1px solid #e2d2f5',
                padding: '20px 30px',
                marginBottom: '20px',
                boxShadow: '0 4px 16px rgba(44, 22, 58, 0.05)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '15px'
              }}>
                <h2 style={{
                  fontFamily: "'Cinzel', serif",
                  color: '#2c163a',
                  fontSize: '18px',
                  margin: 0
                }}>
                  Pastas de Pacientes
                </h2>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => navegarPara('criar_anamnese')}
                    className="btn-efeito-hover"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '25px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 15px rgba(200, 162, 74, 0.4)'
                    }}
                  >
                    <MdAssignment size={16} />
                    Ficha de anamnese
                  </button>

                  <button
                    type="button"
                    onClick={() => navegarPara('agendamentos')}
                    className="btn-efeito-hover"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '25px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)'
                    }}
                  >
                    <MdCalendarMonth size={16} />
                    Agendamentos
                    {agendamentosPendentesCount > 0 && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 20,
                        height: 20,
                        padding: '0 6px',
                        borderRadius: 10,
                        background: '#dc2626',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 800,
                        fontFamily: "'Montserrat', sans-serif",
                        marginLeft: 2,
                        boxShadow: '0 0 0 2px rgba(255,255,255,0.9)',
                      }}>
                        {agendamentosPendentesCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => navegarPara('seguranca')}
                    className="btn-efeito-hover"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '25px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 15px rgba(126, 34, 206, 0.4)',
                    }}
                  >
                    <MdSecurity size={16} />
                    Segurança
                    {segurancaAlertaCount > 0 && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 20,
                        height: 20,
                        padding: '0 6px',
                        borderRadius: 10,
                        background: '#dc2626',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 800,
                        fontFamily: "'Montserrat', sans-serif",
                        marginLeft: 2,
                        boxShadow: '0 0 0 2px rgba(255,255,255,0.9)',
                      }}>
                        {segurancaAlertaCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => navegarPara('financeiro')}
                    className="btn-efeito-hover"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 45%, #C8A24A 100%)',
                      color: '#fff',
                      border: '1.5px solid #9c7826',
                      padding: '12px 24px',
                      borderRadius: '25px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(200, 162, 74, 0.35)',
                    }}
                  >
                    <MdAttachMoney size={16} />
                    Financeiro
                  </button>
                </div>
              </div>

              {pacientes.length > 0 && (
                <div style={{
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
                  boxSizing: 'border-box'
                }}>
                  <MdSearch size={18} color="#C8A24A" style={{ flexShrink: 0 }} />
                  <input
                    id="termoBusca"
                    name="termoBusca"
                    type="text"
                    placeholder="Pesquisar por nome ou documento..."
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: '12px',
                      color: '#2c163a',
                      fontFamily: "'Montserrat', sans-serif"
                    }}
                  />
                  {termoBusca && (
                    <button
                      type="button"
                      onClick={() => setTermoBusca('')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#888',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: 0,
                        fontWeight: 600,
                        flexShrink: 0
                      }}
                    >
                      Limpar
                    </button>
                  )}
                </div>
              )}

              {fotosPendentes.length > 0 && mostrarBannerFotos && (
                <div style={{
                  marginTop: 4,
                  marginBottom: 20,
                  background: 'linear-gradient(135deg, #ede9fe 0%, #f3e8ff 100%)',
                  border: '1.5px solid #a855f7',
                  borderRadius: 12,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <MdPhotoLibrary size={24} color="#7e22ce" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Cinzel', serif",
                      color: '#2c163a',
                      fontSize: 13,
                      fontWeight: 700,
                      marginBottom: 4,
                    }}>
                      {fotosPendentes.length === 1
                        ? `Nova foto de ${fotosPendentes[0].pacienteNome}`
                        : `${fotosPendentes.length} pacientes enviaram fotos`}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: '#555',
                      fontFamily: "'Montserrat', sans-serif",
                    }}>
                      {fotosPendentes.map((f) => f.pacienteNome).join(' · ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const primeiro = fotosPendentes[0];
                      const pac = pacientes.find((p) => p.id === primeiro.pacienteId);
                      if (pac) {
                        marcarFotosComoNotificadas(pac.id);
                        navegarPara('galeria', { paciente: pac });
                      }
                    }}
                    style={{
                      background: '#7e22ce', color: '#fff', border: 'none',
                      padding: '8px 14px', borderRadius: 16,
                      fontFamily: "'Cinzel', serif",
                      fontSize: 10, fontWeight: 700, cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    VER
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarBannerFotos(false)}
                    style={{
                      background: 'transparent', border: 'none', color: '#888',
                      fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1,
                      flexShrink: 0,
                    }}
                    title="Fechar"
                  >
                    ×
                  </button>
                </div>
              )}

              {!termoBusca.trim() && pacientes.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: 10,
                  marginBottom: 20,
                  flexWrap: 'wrap',
                }}>
                  <button
                    type="button"
                    onClick={() => setAbaPacientes('ativos')}
                    className={`tab-pacientes ${abaPacientes === 'ativos' ? 'ativo' : ''}`}
                  >
                    <MdFolderOpen size={14} />
                    Ativos
                    <span className="tab-badge">{pacientesAtivos.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAbaPacientes('arquivados')}
                    className={`tab-pacientes ${abaPacientes === 'arquivados' ? 'ativo' : ''}`}
                  >
                    <MdFolder size={14} />
                    Arquivadas
                    <span className="tab-badge">{pacientesArquivados.length}</span>
                  </button>
                </div>
              )}

              {!jaCarregou ? (
                <SpinnerLoading texto="Carregando pastas de pacientes…" />
              ) : termoBusca.trim().length >= 2 ? (
                buscandoGlobal ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 14, padding: '40px 20px',
                    background: 'rgba(255, 255, 255, 0.92)',
                    borderRadius: '16px', border: '1px solid #e2d2f5',
                    boxShadow: '0 4px 12px rgba(44, 22, 58, 0.05)',
                  }}>
                    <div style={{
                      width: '40px', height: '40px',
                      border: '4px solid #e2d2f5',
                      borderTop: '4px solid #C8A24A',
                      borderRadius: '50%',
                      animation: 'spinBusca 0.8s linear infinite',
                    }} />
                    <span style={{
                      fontFamily: "'Cinzel', serif",
                      color: '#55286f',
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.3px',
                    }}>
                      BUSCANDO…
                    </span>
                    <style>{`
                      @keyframes spinBusca { to { transform: rotate(360deg); } }
                    `}</style>
                  </div>
                ) : !resultadosBusca || resultadosBusca.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '40px 20px',
                    background: 'rgba(255, 255, 255, 0.92)',
                    borderRadius: '16px', border: '1px solid #e2d2f5',
                  }}>
                    <p style={{ color: '#666', fontSize: '13px', marginBottom: '10px' }}>
                      Nenhum paciente encontrado para "{termoBusca}".
                    </p>
                    <button
                      type="button"
                      onClick={() => setTermoBusca('')}
                      style={{
                        background: 'transparent', border: 'none',
                        color: '#C8A24A', fontSize: '12px',
                        fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      Limpar busca
                    </button>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '20px'
                  }}>
                    {resultadosBusca.map((pac) => (
                      <CardPaciente
                        key={pac.id}
                        pac={pac}
                        onClick={(pacArg, acao) => {
                          if (acao === 'reativar') {
                            setPacienteSelecionado(pacArg);
                            navegarPara('editar_anamnese');
                          } else {
                            navegarPara('detalhe_pasta', { paciente: pacArg });
                          }
                        }}
                        arquivado={estaAnonimizado(pac)}
                      />
                    ))}
                  </div>
                )
              ) : listaParaRender.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  background: 'rgba(255, 255, 255, 0.92)',
                  borderRadius: '16px',
                  border: '1px solid #e2d2f5'
                }}>
                  {abaPacientes === 'arquivados' ? (
                    <>
                      <MdFolder size={42} color="#a855f7" style={{ marginBottom: 12 }} />
                      <p style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>
                        Nenhuma pasta arquivada.
                      </p>
                      <span style={{ color: '#999', fontSize: '12px' }}>
                        Pastas de pacientes que excluíram a conta aparecem aqui.
                      </span>
                    </>
                  ) : (
                    <>
                      <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
                        Nenhum paciente cadastrado ainda.
                      </p>
                      <span style={{ color: '#C8A24A', fontSize: '12px', fontWeight: 600 }}>
                        Clique em "Ficha de anamnese" para começar.
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '20px'
                  }}>
                    {listaParaRender.map((pac) => (
                      <CardPaciente
                        key={pac.id}
                        pac={pac}
                        onClick={(pacArg, acao) => {
                          if (acao === 'reativar') {
                            setPacienteSelecionado(pacArg);
                            navegarPara('editar_anamnese');
                          } else {
                            navegarPara('detalhe_pasta', { paciente: pacArg });
                          }
                        }}
                        arquivado={abaPacientes === 'arquivados'}
                      />
                    ))}
                  </div>

                  {temMais && abaPacientes === 'ativos' && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
                      <button
                        type="button"
                        onClick={() => setLimitePagina((prev) => prev + TAMANHO_PAGINA)}
                        style={{
                          fontFamily: "'Cinzel', serif",
                          background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                          color: '#fff',
                          border: 'none',
                          padding: '12px 28px',
                          borderRadius: '24px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 3px 12px rgba(200, 162, 74, 0.3)',
                        }}
                      >
                        CARREGAR MAIS PACIENTES
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {telaAtual === 'seguranca' && (
            <div>
              <button
                type="button"
                onClick={() => navegarPara('lista')}
                className="btn-voltar-lista"
                style={{
                  fontFamily: "'Cinzel', serif",
                  background: 'linear-gradient(135deg, rgba(200, 162, 74, 0.12) 0%, rgba(168, 85, 247, 0.10) 100%)',
                  color: '#2c163a',
                  border: '1.5px solid #C8A24A',
                  padding: '10px 22px',
                  borderRadius: '25px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '20px',
                }}
              >
                <MdArrowBack size={16} color="#C8A24A" />
                Voltar para lista de pacientes
              </button>
              <PainelSeguranca />
            </div>
          )}

          {telaAtual === 'financeiro' && (
            <div>
              <button
                type="button"
                onClick={() => navegarPara('lista')}
                className="btn-voltar-lista"
                style={{
                  fontFamily: "'Cinzel', serif",
                  background: 'linear-gradient(135deg, rgba(200, 162, 74, 0.12) 0%, rgba(168, 85, 247, 0.10) 100%)',
                  color: '#2c163a',
                  border: '1.5px solid #C8A24A',
                  padding: '10px 22px',
                  borderRadius: '25px',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '20px',
                  boxShadow: '0 3px 10px rgba(200, 162, 74, 0.15)',
                  transition: 'all 0.25s ease',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <MdArrowBack size={16} color="#C8A24A" />
                Voltar para lista de pacientes
              </button>

              <PainelFinanceiro uidEsteticista={auth.currentUser?.uid} />
            </div>
          )}

          {telaAtual === 'agendamentos' && (
            <div>
              <button
                type="button"
                onClick={() => navegarPara('lista')}
                className="btn-voltar-lista"
                style={{
                  fontFamily: "'Cinzel', serif",
                  background: 'linear-gradient(135deg, rgba(200, 162, 74, 0.12) 0%, rgba(168, 85, 247, 0.10) 100%)',
                  color: '#2c163a',
                  border: '1.5px solid #C8A24A',
                  padding: '10px 22px',
                  borderRadius: '25px',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '20px',
                  boxShadow: '0 3px 10px rgba(200, 162, 74, 0.15)',
                  transition: 'all 0.25s ease',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <MdArrowBack size={16} color="#C8A24A" />
                Voltar para lista de pacientes
              </button>

              <PainelAgendamentosEsteticista
                uidEsteticista={auth.currentUser?.uid}
                onCampoSubstituido={handleCampoSubstituido}
              />
            </div>
          )}

          {telaAtual === 'detalhe_pasta' && pacienteSelecionado && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '25px',
                flexWrap: 'wrap',
                gap: '15px'
              }}>
                <div>
                  <button
                    type="button"
                    onClick={() => navegarPara('lista', { paciente: null, evolucao: null })}
                    className="btn-voltar-lista"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, rgba(200, 162, 74, 0.12) 0%, rgba(168, 85, 247, 0.10) 100%)',
                      color: '#2c163a',
                      border: '1.5px solid #C8A24A',
                      padding: '10px 22px',
                      borderRadius: '25px',
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '14px',
                      boxShadow: '0 3px 10px rgba(200, 162, 74, 0.15)',
                      transition: 'all 0.25s ease',
                      backdropFilter: 'blur(6px)',
                    }}
                  >
                    <MdArrowBack size={16} color="#C8A24A" />
                    Voltar para lista de pacientes
                  </button>

                  <h2 style={{
                    fontFamily: "'Cinzel', serif",
                    color: '#2c163a',
                    fontSize: '22px',
                    margin: 0
                  }}>
                    📁 {pacienteSelecionado.nome}
                    <LinkAcessoPaciente pacienteId={pacienteSelecionado.id} />
                  </h2>
                  <span style={{ fontSize: '11px', color: '#555', display: 'block', marginTop: '3px' }}>
                    Doc: {pacienteSelecionado.documento || 'Não informado'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#555', display: 'block' }}>
                    Pasta criada em: {pacienteSelecionado.dataCriacao}
                  </span>
                  <span style={{ fontSize: '11px', color: '#A6822B', fontWeight: 600, display: 'block' }}>
                    Última edição: {pacienteSelecionado.dataUltimaEdicao || pacienteSelecionado.dataCriacao}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => navegarPara('ver_anamnese')}
                    className="btn-lavanda-hover"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #b8a3c9 0%, #d7cee0 100%)',
                      color: '#2c163a',
                      border: '1.5px solid #8a6fa8',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 3px 10px rgba(138, 111, 168, 0.25)',
                      transition: 'all 0.25s ease'
                    }}
                  >
                    Ver Ficha de Anamnese
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      marcarFotosComoNotificadas(pacienteSelecionado.id);
                      navegarPara('galeria');
                    }}
                    className="btn-efeito-hover"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)',
                      color: '#fff',
                      border: '1.5px solid #7e22ce',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 3px 10px rgba(168, 85, 247, 0.25)',
                      transition: 'all 0.25s ease'
                    }}
                  >
                    <MdPhotoLibrary size={14} color="#fff" />
                    Galeria do Paciente
                  </button>

                  <button
                    type="button"
                    onClick={() => navegarPara('criar_evolucao')}
                    className="btn-efeito-hover"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      background: '#C8A24A',
                      color: '#fdfcfa',
                      border: '1.5px solid #C8A24A',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Adicionar Evolução
                  </button>

                  <button
                    type="button"
                    onClick={() => setMostrarModalAgendar(true)}
                    className="btn-efeito-hover"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 45%, #C8A24A 100%)',
                      color: '#fff',
                      border: '1.5px solid #9c7826',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 3px 10px rgba(200, 162, 74, 0.3)',
                    }}
                  >
                    <MdCalendarMonth size={14} color="#fff" />
                    Agendar Consulta
                  </button>

                  <button
                    type="button"
                    onClick={() => solicitarExclusaoPasta(pacienteSelecionado.id)}
                    className="btn-efeito-hover-perigo"
                    style={{
                      fontFamily: "'Cinzel', serif",
                      background: '#ffebee',
                      color: '#c62828',
                      border: '1.5px solid #ef9a9a',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Excluir Pasta
                  </button>
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.92)',
                padding: '25px',
                borderRadius: '12px',
                border: '1px solid #e2d2f5',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                backdropFilter: 'blur(5px)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  borderBottom: '1px solid #eee',
                  paddingBottom: '10px',
                  flexWrap: 'wrap',
                  gap: '15px'
                }}>
                  <h3 style={{
                    fontFamily: "'Cinzel', serif",
                    color: '#2c163a',
                    fontSize: '16px',
                    margin: 0
                  }}>
                    Histórico de Fichas de Evolução ({pacienteSelecionado.evolucoes?.length || 0})
                  </h3>

                  {(pacienteSelecionado.evolucoes?.length || 0) > 0 && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.4)',
                      backdropFilter: 'blur(8px)',
                      borderRadius: '10px',
                      border: '1px solid rgba(200, 162, 74, 0.4)',
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '320px',
                      maxWidth: '100%'
                    }}>
                      <MdSearch size={18} color="#C8A24A" style={{ flexShrink: 0 }} />
                      <input
                        id="termoBuscaEvolucao"
                        name="termoBuscaEvolucao"
                        type="text"
                        placeholder="Buscar por data (DD/MM/AAAA)..."
                        maxLength={10}
                        value={termoBuscaEvolucao}
                        onChange={handleMudancaBuscaEvolucao}
                        style={{
                          width: '100%',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          fontSize: '12px',
                          color: '#2c163a',
                          fontFamily: "'Montserrat', sans-serif"
                        }}
                      />
                      {termoBuscaEvolucao && (
                        <button
                          type="button"
                          onClick={() => setTermoBuscaEvolucao('')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#888',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {(!pacienteSelecionado.evolucoes || pacienteSelecionado.evolucoes.length === 0) ? (
                  <p style={{ color: '#777', fontSize: '13px' }}>
                    Nenhuma ficha de evolução registrada nesta pasta ainda.
                  </p>
                ) : evolucoesFiltradas.length === 0 ? (
                  <p style={{ color: '#777', fontSize: '13px' }}>
                    Nenhuma evolução encontrada para a data "{termoBuscaEvolucao}".
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {evolucoesFiltradas.map((evo) => (
                      <div
                        key={evo.id}
                        style={{
                          border: '1.5px solid #dfc6fc',
                          borderRadius: '8px',
                          padding: '15px',
                          backgroundColor: 'rgba(250, 246, 253, 0.95)'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px'
                        }}>
                          <span style={{
                            fontFamily: "'Cinzel', serif",
                            color: '#C8A24A',
                            fontSize: '12px',
                            fontWeight: 700
                          }}>
                            Evolução - {evo.dataCriacao}
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => navegarPara('ver_evolucao', { evolucao: evo })}
                              className="btn-efeito-hover"
                              style={{
                                background: '#C8A24A',
                                color: '#fff',
                                border: 'none',
                                padding: '5px 12px',
                                borderRadius: '15px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                fontFamily: "'Cinzel', serif",
                                fontWeight: 700
                              }}
                            >
                              Ver Evolução
                            </button>

                            <button
                              type="button"
                              onClick={() => solicitarExclusaoEvolucao(evo.id)}
                              className="btn-efeito-hover-perigo"
                              style={{
                                background: '#ffebee',
                                color: '#c62828',
                                border: '1.5px solid #ef9a9a',
                                padding: '5px 12px',
                                borderRadius: '15px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                fontFamily: "'Cinzel', serif",
                                fontWeight: 700
                              }}
                            >
                              Excluir Evolução
                            </button>
                          </div>
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#444',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {evo.textoLivre ? evo.textoLivre : (evo.observacoes || evo.procedimentoRealizado || 'Nenhum texto adicional registrado.')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <HistoricoAgendamentosPaciente
                pacienteId={pacienteSelecionado.id}
                pacienteNome={pacienteSelecionado.nome}
                pacienteDocumento={pacienteSelecionado.documento}
                uidEsteticista={auth.currentUser?.uid}
                modo="esteticista"
                colapsavel={true}
                abertoPorPadrao={false}
              />

              <CardSegurancaPaciente pacienteId={pacienteSelecionado.id} />

              <div style={{
                marginTop: '15px',
                background: 'rgba(255, 255, 255, 0.92)',
                padding: '14px 16px',
                borderRadius: '12px',
                border: pacienteSelecionado.consentimentoLGPD?.aceito
                  ? '1.5px solid #86efac'
                  : '1.5px solid #fcd34d',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px' }}>
                    {pacienteSelecionado.consentimentoLGPD?.aceito ? '✅' : '⚠️'}
                  </span>
                  <span style={{
                    fontFamily: "'Cinzel', serif",
                    color: '#2c163a',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>
                    Consentimento LGPD
                  </span>
                </div>

                {pacienteSelecionado.consentimentoLGPD?.aceito ? (
                  <span style={{ fontSize: '10px', color: '#555', display: 'block', marginBottom: '10px' }}>
                    Aceito em {new Date(pacienteSelecionado.consentimentoLGPD.dataAceite).toLocaleString('pt-BR')}
                    {' · '}v{pacienteSelecionado.consentimentoLGPD.versaoTermo}
                  </span>
                ) : (
                  <span style={{ fontSize: '10px', color: '#92400e', display: 'block', marginBottom: '10px' }}>
                    Paciente ainda não autorizou o tratamento de dados.
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setMostrarTermoPDF(true)}
                  className="btn-efeito-hover"
                  style={{
                    width: '100%',
                    fontFamily: "'Cinzel', serif",
                    background: pacienteSelecionado.consentimentoLGPD?.aceito
                      ? 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)'
                      : '#f0f0f0',
                    color: pacienteSelecionado.consentimentoLGPD?.aceito ? '#fff' : '#555',
                    border: pacienteSelecionado.consentimentoLGPD?.aceito
                      ? '1.5px solid #9c7826'
                      : '1.5px solid #ccc',
                    padding: '10px',
                    borderRadius: '15px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <MdDescription size={16} />
                  Ver Termo Assinado
                </button>
              </div>
            </div>
          )}

          {telaAtual === 'galeria' && pacienteSelecionado && (
            <div>
              <button
                type="button"
                onClick={() => navegarPara('detalhe_pasta')}
                className="btn-voltar-lista"
                style={{
                  fontFamily: "'Cinzel', serif",
                  background: 'linear-gradient(135deg, rgba(200, 162, 74, 0.12) 0%, rgba(168, 85, 247, 0.10) 100%)',
                  color: '#2c163a',
                  border: '1.5px solid #C8A24A',
                  padding: '10px 22px',
                  borderRadius: '25px',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '20px',
                  boxShadow: '0 3px 10px rgba(200, 162, 74, 0.15)',
                  transition: 'all 0.25s ease',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <MdArrowBack size={16} color="#C8A24A" />
                Voltar para a pasta do paciente
              </button>
              <GaleriaPaciente
                pacienteId={pacienteSelecionado.id}
                uidEsteticista={auth.currentUser?.uid}
                pacienteNome={pacienteSelecionado.nome}
                modo="esteticista"
                evolucoes={pacienteSelecionado.evolucoes || []}
              />
            </div>
          )}

          {telaAtual === 'ver_evolucao' && evolucaoSelecionada && (
            <div>
              <FichaEvoDesktop
                mode="view"
                initialData={{
                  ...evolucaoSelecionada,
                  onIrParaEdicao: () => navegarPara('editar_evolucao')
                }}
                pacienteSelecionado={pacienteSelecionado}
                uidEsteticista={auth.currentUser?.uid}
                onVoltar={() => navegarPara('detalhe_pasta')}
              />
            </div>
          )}

          {telaAtual === 'criar_evolucao' && (
            <div>
              <FichaEvoDesktop
                mode="create"
                pacienteSelecionado={pacienteSelecionado}
                pacienteNomeProp={pacienteSelecionado?.nome}
                uidEsteticista={auth.currentUser?.uid}
                onSave={handleSalvarEvolucao}
                onVoltar={() => navegarPara('detalhe_pasta')}
              />
            </div>
          )}

          {telaAtual === 'editar_evolucao' && evolucaoSelecionada && (
            <div>
              <FichaEvoDesktop
                mode="edit"
                initialData={evolucaoSelecionada}
                pacienteSelecionado={pacienteSelecionado}
                uidEsteticista={auth.currentUser?.uid}
                onSave={handleAtualizarEvolucao}
                onVoltar={() => navegarPara('detalhe_pasta')}
              />
            </div>
          )}
        </div>
      </div>

      {mostrarModalAgendar && pacienteSelecionado && (
        <ModalAgendarParaPaciente
          paciente={pacienteSelecionado}
          uidEsteticista={auth.currentUser?.uid}
          onFechar={() => setMostrarModalAgendar(false)}
          onSucesso={(ag) => {
            setMostrarModalAgendar(false);
            setAgendamentoRecemCriado(ag);
          }}
        />
      )}

      {agendamentoRecemCriado && (
        <ModalEscolherServico
          agendamento={agendamentoRecemCriado}
          uidEsteticista={auth.currentUser?.uid}
          onFechar={() => setAgendamentoRecemCriado(null)}
          onConfirmado={() => {
            const ag = agendamentoRecemCriado;
            setAgendamentoRecemCriado(null);
            const [a, m, d] = (ag.data || '').split('-');
            const dataBR = d && m && a ? `${d}/${m}/${a}` : ag.data;
            setModalFeedback({
              tipo: 'sucesso',
              titulo: 'Agendamento confirmado!',
              mensagem: `${pacienteSelecionado?.nome || ''}\n${dataBR} às ${ag.horaInicio}`,
            });
          }}
        />
      )}

      {mostrarTermoPDF && pacienteSelecionado && (
        <TermoConsentimentoPDF
          pacienteData={pacienteSelecionado}
          onFechar={() => setMostrarTermoPDF(false)}
        />
      )}

      {modalFeedback && (
        <ModalFeedback
          tipo={modalFeedback.tipo}
          titulo={modalFeedback.titulo}
          mensagem={modalFeedback.mensagem}
          onFechar={() => setModalFeedback(null)}
        />
      )}

      {modalExclusao.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(44, 22, 58, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff',
            padding: '30px',
            borderRadius: '16px',
            maxWidth: '420px',
            width: '90%',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            border: '1px solid #e2d2f5',
            textAlign: 'center',
            fontFamily: "'Montserrat', sans-serif"
          }}>
            <h3 style={{
              fontFamily: "'Cinzel', serif",
              color: '#c62828',
              fontSize: '18px',
              marginBottom: '15px'
            }}>
              ⚠️ Confirmação de Exclusão
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#2c163a',
              marginBottom: '20px',
              fontWeight: 500
            }}>
              {modalExclusao.titulo}
            </p>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
              Para prosseguir, digite sua senha de usuário e pressione Enter:
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              border: '1px solid #ccc',
              borderRadius: '8px',
              padding: '0 10px',
              marginBottom: '8px',
              backgroundColor: '#fff'
            }}>
              <input
                id="senhaConfirmacaoExclusao"
                name="senhaConfirmacaoExclusao"
                autoComplete="current-password"
                type={modalExclusao.mostrarSenhaModal ? 'text' : 'password'}
                placeholder="Digite sua senha"
                value={modalExclusao.senhaInput}
                onChange={(e) => setModalExclusao(prev => ({
                  ...prev,
                  senhaInput: e.target.value,
                  erroSenha: ''
                }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmarExclusao();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  border: 'none',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setModalExclusao(prev => ({
                  ...prev,
                  mostrarSenhaModal: !prev.mostrarSenhaModal
                }))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0 4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={modalExclusao.mostrarSenhaModal ? 'Esconder senha' : 'Ver senha'}
              >
                {modalExclusao.mostrarSenhaModal ? (
                  <FaEye size={17} color="#C8A24A" />
                ) : (
                  <FaEyeSlash size={17} color="#C8A24A" />
                )}
              </button>
            </div>

            {modalExclusao.erroSenha && (
              <span style={{
                color: '#c62828',
                fontSize: '12px',
                display: 'block',
                marginBottom: '15px',
                fontWeight: 600
              }}>
                {modalExclusao.erroSenha}
              </span>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
              <button
                type="button"
                onClick={fecharModalExclusao}
                style={{
                  background: '#f0f0f0',
                  color: '#333',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', serif"
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarExclusao}
                style={{
                  background: '#c62828',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', serif"
                }}
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CARD DE PACIENTE
   ============================================================ */
function CardPaciente({ pac, onClick, arquivado = false }) {
  return (
    <div
      onClick={(e) => {
        // Se clicou no botão Reativar, o botão já tratou (stopPropagation)
        // Se não, chama onClick normal
        if (onClick) onClick(pac);
      }}
      className="card-pasta-hover"
      style={{
        background: 'rgba(255, 255, 255, 0.92)',
        border: arquivado
          ? '1.5px dashed #c4b5d4'
          : '1.5px solid #dfc6fc',
        borderRadius: '12px',
        padding: '20px',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(44, 22, 58, 0.05)',
        backdropFilter: 'blur(5px)',
        opacity: arquivado ? 0.85 : 1,
      }}
    >
      {arquivado ? (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: '#fff8e1',
          color: '#92400e',
          border: '1px solid #fcd34d',
          borderRadius: 8,
          padding: '2px 8px',
          fontSize: 9.5,
          fontWeight: 700,
          fontFamily: "'Cinzel', serif",
          marginBottom: 6,
        }}>
          📂 Arquivada
        </div>
      ) : (
        <div style={{
          fontSize: '10px',
          color: '#888',
          marginBottom: '4px',
          fontFamily: "'Cinzel', serif"
        }}>
          Criado em: {pac.dataCriacao}
        </div>
      )}

      <div style={{
        fontSize: '10px',
        color: '#A6822B',
        marginBottom: '8px',
        fontFamily: "'Cinzel', serif",
        fontWeight: 600
      }}>
        Última edição: {pac.dataUltimaEdicao || pac.dataCriacao}
      </div>

      <h3 style={{
        fontFamily: "'Cinzel', serif",
        color: '#2c163a',
        fontSize: '16px',
        margin: '0 0 4px 0'
      }}>
        📁 {pac.nome}
      </h3>

      <div style={{
        fontSize: '11px',
        color: '#665078',
        fontWeight: 600,
        marginBottom: '10px'
      }}>
        Doc: {pac.documento || 'Não informado'}
      </div>

      {!arquivado && <LinkAcessoPaciente pacienteId={pac.id} compacto />}

      {/* ⚖️ LGPD — Botão Reativar quando arquivado */}
      {arquivado && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 10,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => onClick && onClick(pac, 'reativar')}
            style={{
              fontFamily: "'Cinzel', serif",
              background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
              color: '#fff',
              border: '1.5px solid #9c7826',
              padding: '10px 20px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 3px 10px rgba(200, 162, 74, 0.3)',
              width: '100%',
              justifyContent: 'center',
            }}
          >
            🔄 Reativar paciente
          </button>
        </div>
      )}

      <div style={{
        fontSize: '12px',
        color: '#555',
        display: 'flex',
        justifyContent: 'space-between',
        borderTop: '1px solid #f0e6fa',
        paddingTop: '10px',
        marginTop: '10px'
      }}>
        <span>Fichas de Evolução: <strong>{pac.evolucoes?.length || 0}</strong></span>
        <span style={{ color: '#C8A24A', fontWeight: 700 }}>Abrir Pasta →</span>
      </div>
    </div>
  );
}