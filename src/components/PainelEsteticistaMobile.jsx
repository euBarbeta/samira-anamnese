import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import {
  MdSearch, MdPhotoLibrary, MdArrowBack, MdDescription, MdCalendarMonth,
  MdAssignment, MdSecurity, MdAttachMoney, MdFolder, MdFolderOpen,
} from 'react-icons/md';
import PainelSeguranca from './PainelSeguranca';
import { sanitizarFichaAnamnese, sanitizarTexto } from '../utils/sanitizar';

// 🔧 CORRIGIDO: import único do helper (antes tinha 2)
import {
  anonimizarPaciente,
  reativarPaciente,
  estaAnonimizado,
  reativarPorEdicao,
} from '../utils/lgpdExclusao';

import CardSegurancaPaciente from './CardSegurancaPaciente';
import { log, logWarn, logError } from '../utils/log';
import ModalEscolherServico from './agendamento/ModalEscolherServico';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,  EmailAuthProvider, reauthenticateWithCredential
} from 'firebase/auth';
import HistoricoAgendamentosPaciente from './HistoricoAgendamentosPaciente';
import {
  getFirestore, query, where, updateDoc, collection, doc,
  getDoc, setDoc, getDocs, deleteDoc, onSnapshot, orderBy, limit,
  collectionGroup,
} from 'firebase/firestore';
import ModalAgendarParaPaciente from './agendamento/ModalAgendarParaPaciente';
import { db } from './firebase';
import { secondaryAuth } from './firebaseSecondary';
import FichaMobile from './FichaMobile';
import FichaEvoMobile from './FichaEvoMobile';
import GaleriaPaciente from './GaleriaPaciente';
import BotaoInstalarApp from './BotaoInstalarApp';
import AvisoNotificacoesEsteticista from './AvisoNotificacoesEsteticista';
import TermoConsentimentoPDF from './TermoConsentimentoPDF';
import {
  registrarLinkPaciente, gerarUidDeterministico, limparUndefined,
} from '../utils/validarUID';
import LinkAcessoPaciente from './LinkAcessoPaciente';
import PainelAgendamentosEsteticista from './agendamento/PainelAgendamentosEsteticista';
import PainelFinanceiro from './financeiro/PainelFinanceiro';

// ⚠️ UID padrão (você já tem isso em algum lugar — mantém igual)
const UID_ESTETICISTA_PADRAO = 'MZ5j3NpjlxY67yLRiEfg13TbPE32';

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
   MODAL DE FEEDBACK — substitui alert() nativo
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

export default function PainelEsteticistaMobile({ onLogout }) {
  const TAMANHO_PAGINA = 50;
  const [limitePagina, setLimitePagina] = useState(TAMANHO_PAGINA);
  const [temMais, setTemMais] = useState(true);

  const [agendamentoRecemCriado, setAgendamentoRecemCriado] = useState(null);

  const [resultadosBusca, setResultadosBusca] = useState(null);
  const [buscandoGlobal, setBuscandoGlobal] = useState(false);
  const cacheBuscaRef = useRef(null);

  const [telaAtual, setTelaAtual] = useState('lista');
  const [termoBusca, setTermoBusca] = useState('');
  const [termoBuscaEvolucao, setTermoBuscaEvolucao] = useState('');
  const [mostrarTermoPDF, setMostrarTermoPDF] = useState(false);
  const [mostrarModalAgendar, setMostrarModalAgendar] = useState(false);
  const [modalFeedback, setModalFeedback] = useState(null);
  const [pacientes, setPacientes] = useState([]);
  const [carregandoNuvem, setCarregandoNuvem] = useState(true);
  const [jaCarregou, setJaCarregou] = useState(false);

  const [abaPacientes, setAbaPacientes] = useState('ativos');

  const [pacienteSelecionado, setPacienteSelecionado] = useState(null);
  const [evolucaoSelecionada, setEvolucaoSelecionada] = useState(null);

  const [modalExclusao, setModalExclusao] = useState(MODAL_FECHADO);
  const [excluindo, setExcluindo] = useState(false); 

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

  // ============================================================
  // Contadores
  // ============================================================
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

    // ⚖️ Caso 1: paciente SUMIU da lista
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

    // ⚖️ Caso 2: paciente foi ANONIMIZADO em outro device
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

  // ============================================================
  // Agendar lembretes
  // ============================================================
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

  // ============================================================
  // NAVEGAÇÃO
  // ============================================================
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

  // Handler do botão voltar
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

  // Estado inicial no histórico
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

  // Registra push da esteticista
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    import('./push-notifications').then(({ inscreverPushEsteticistaWeb }) => {
      inscreverPushEsteticistaWeb(user.uid).catch((e) =>
        logWarn('Falha ao registrar push da esteticista:', e)
      );
    });
  }, []);

  // Publica UID global
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
  // Fotos pendentes em tempo real
  // ============================================================
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

  // ============================================================
  // Anonimiza paciente
  // ============================================================
   const excluirPacienteDaNuvem = async (idPaciente) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // ✅ Chama a Function Mestra (ela ignora as regras e nunca dará Permission Denied)
      const res = await fetch('/.netlify/functions/excluir-paciente-completo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pacienteId: idPaciente,
          uidEsteticista: user.uid,
          motivo: 'esteta-excluiu',
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao excluir na nuvem');
      }

      cacheBuscaRef.current = null;
    } catch (e) {
      console.error('Erro ao excluir paciente:', e);
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
  // handleSalvarAnamnese com detecção de reativação
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
    await reativarPacienteCompleto({
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
  if (excluindo) return;   // ⬅️ guard contra duplo clique
  const user = auth.currentUser;

  if (!user || !user.email) {
    setModalExclusao(prev => ({
      ...prev,
      erroSenha: 'Sessão expirada. Faça login novamente.'
    }));
    return;
  }

  setExcluindo(true);   // ⬅️ começa o spinner

  // ✅ 1. Valida a senha SEM deslogar a esteta
  try {
    const credential = EmailAuthProvider.credential(user.email, modalExclusao.senhaInput);
    await reauthenticateWithCredential(user, credential);
  } catch (error) {
    console.error("Erro ao validar senha:", error);
    setModalExclusao(prev => ({
      ...prev,
      erroSenha: 'Senha incorreta. Tente novamente.'
    }));
    setExcluindo(false);   // ⬅️ para o spinner em caso de erro
    return;
  }

  // ✅ 2. Se a senha estiver correta, prossegue com a exclusão
  try {
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
    console.error("Erro ao excluir paciente:", error);
    alert("Erro ao excluir da nuvem. Tente novamente.");
  } finally {
    setExcluindo(false);   // ⬅️ garante que sempre libera o spinner
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
    try {
      const user = auth.currentUser;
      if (!user) return;

      const agora = new Date();
      const dataEvo = agora.toLocaleDateString('pt-BR') + ' às ' +
        agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const novaEvolucaoObj = {
        id: Date.now(),
        dataCriacao: dataEvo,
        ...dadosEvolucao
      };

      const novasEvolucoes = [novaEvolucaoObj, ...pacienteSelecionado.evolucoes];
      const idDocStr = String(pacienteSelecionado.id);
      const pacienteAtualizadoObj = { ...pacienteSelecionado, evolucoes: novasEvolucoes };

      await setDoc(
        doc(db, `usuarios/${user.uid}/pacientes`, idDocStr),
        pacienteAtualizadoObj,
        { merge: true }
      );

      const atualizados = pacientes.map(p => {
        if (p.id === pacienteSelecionado.id) {
          return pacienteAtualizadoObj;
        }
        return p;
      });

      setPacientes(atualizados);
      setPacienteSelecionado(pacienteAtualizadoObj);

      substituirTela('detalhe_pasta');
    } catch (error) {
      console.error("Erro ao salvar evolução:", error);
      alert("Erro ao salvar evolução na nuvem.");
    }
  };

  const handleAtualizarEvolucao = async (dadosAtualizados) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const novasEvolucoes = pacienteSelecionado.evolucoes.map(evo => {
        if (evo.id === evolucaoSelecionada.id) {
          return { ...evo, ...dadosAtualizados };
        }
        return evo;
      });

      const idDocStr = String(pacienteSelecionado.id);
      const pacienteAtualizadoObj = { ...pacienteSelecionado, evolucoes: novasEvolucoes };

      await setDoc(
        doc(db, `usuarios/${user.uid}/pacientes`, idDocStr),
        pacienteAtualizadoObj,
        { merge: true }
      );

      const atualizados = pacientes.map(p => {
        if (p.id === pacienteSelecionado.id) {
          return pacienteAtualizadoObj;
        }
        return p;
      });

      setPacientes(atualizados);
      setPacienteSelecionado(pacienteAtualizadoObj);

      substituirTela('detalhe_pasta');
    } catch (error) {
      console.error("Erro ao atualizar evolução:", error);
      alert("Erro ao atualizar evolução na nuvem.");
    }
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

  if (!jaCarregou) {
    return (
      <div style={{
        width: '100%', minHeight: '100vh',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        backgroundColor: '#d7cee0', padding: '20px', boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 30px',
          background: 'rgba(255, 255, 255, 0.92)',
          borderRadius: '16px', border: '1px solid #e2d2f5',
          boxShadow: '0 4px 16px rgba(44, 22, 58, 0.05)',
        }}>
          <div style={{
            width: '42px', height: '42px',
            border: '4px solid #e2d2f5',
            borderTop: '4px solid #C8A24A',
            borderRadius: '50%',
            animation: 'spinCargaMobile 0.8s linear infinite',
            marginBottom: '14px',
          }} />
          <span style={{
            fontFamily: "'Cinzel', serif",
            color: '#55286f', fontSize: '12px', fontWeight: 700,
          }}>Carregando pastas de pacientes…</span>
          <style>{`@keyframes spinCargaMobile { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (telaAtual === 'criar_anamnese') {
    return (
      <FichaMobile
        mode="create"
        onSave={handleSalvarAnamnese}
        onVoltar={() => navegarPara('lista', { paciente: null, evolucao: null })}
      />
    );
  }

  if (telaAtual === 'ver_anamnese' && pacienteSelecionado) {
    return (
      <FichaMobile
        mode="view"
        fichaSelecionada={pacienteSelecionado.anamnese}
        onVoltar={() => navegarPara('detalhe_pasta')}
        onIrParaEdicao={() => navegarPara('editar_anamnese')}
      />
    );
  }

  if (telaAtual === 'editar_anamnese' && pacienteSelecionado) {
    return (
      <FichaMobile
        mode="edit"
        fichaSelecionada={pacienteSelecionado.anamnese}
        onSave={handleAtualizarAnamnese}
        onVoltar={() => navegarPara('detalhe_pasta')}
      />
    );
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#d7cee0',
      fontFamily: "'Montserrat', sans-serif",
      paddingBottom: '30px',
      position: 'relative',
      overflowX: 'hidden',
      boxSizing: 'border-box'
    }}>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden'
      }}>
        <img
          src="/imagens/logo-telainicial.jpeg"
          alt="Marca d'água"
          style={{
            width: '100%',
            maxWidth: '450px',
            height: 'auto',
            opacity: 0.12,
            objectFit: 'contain'
          }}
        />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600&display=swap');

        .btn-efeito-hover {
          transition: all 0.2s ease-in-out !important;
        }
        .btn-efeito-hover:active, .btn-efeito-hover:hover {
          transform: translateY(-2px);
          filter: brightness(1.05);
          box-shadow: 0 4px 14px rgba(200, 162, 74, 0.4) !important;
        }

        .btn-efeito-hover-perigo {
          transition: all 0.2s ease-in-out !important;
        }
        .btn-efeito-hover-perigo:active, .btn-efeito-hover-perigo:hover {
          transform: translateY(-2px);
          background-color: #f7d7d9 !important;
          box-shadow: 0 4px 12px rgba(198, 40, 40, 0.25) !important;
        }

        .btn-efeito-hover-escuro {
          transition: all 0.2s ease-in-out !important;
        }
        .btn-efeito-hover-escuro:active, .btn-efeito-hover-escuro:hover {
          transform: translateY(-2px);
          background-color: #3b1d4e !important;
          box-shadow: 0 4px 12px rgba(44, 22, 58, 0.35) !important;
        }

        .card-pasta-hover {
          transition: all 0.2s ease-in-out !important;
        }
        .card-pasta-hover:active, .card-pasta-hover:hover {
          transform: translateY(-2px);
          border-color: #C8A24A !important;
          box-shadow: 0 6px 18px rgba(44, 22, 58, 0.1) !important;
          background: rgba(255, 255, 255, 0.98) !important;
        }

        .tab-pacientes-mobile {
          flex: 1;
          padding: 10px 12px;
          border-radius: 18px;
          border: 1.5px solid #C8A24A;
          background: transparent;
          color: #C8A24A;
          font-family: 'Cinzel', serif;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s ease;
          min-height: 44px;
        }
        .tab-pacientes-mobile.ativo {
          background: linear-gradient(135deg, #C8A24A 0%, #e2be64 100%);
          color: #fff;
          box-shadow: 0 4px 14px rgba(200, 162, 74, 0.35);
        }
        .tab-pacientes-mobile .tab-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 10px;
          background: rgba(44, 22, 58, 0.10);
          color: #2c163a;
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          font-weight: 800;
        }
        .tab-pacientes-mobile.ativo .tab-badge {
          background: rgba(255, 255, 255, 0.30);
          color: #fff;
        }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', boxSizing: 'border-box' }}>

        {auth.currentUser && (
          <AvisoNotificacoesEsteticista uidEsteticista={auth.currentUser.uid} />
        )}

        {/* HEADER */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '20px 20px 10px 20px',
          gap: '12px',
          borderBottom: '1px solid rgba(226, 210, 245, 0.6)',
          marginBottom: '15px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
            <h1 style={{
              fontFamily: "'Cinzel', serif",
              color: '#2c163a',
              fontSize: '18px',
              margin: 0,
              textShadow: '0 1px 2px rgba(255,255,255,0.8)'
            }}>
              Painel da Esteticista
            </h1>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <BotaoInstalarApp compacto />

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  style={{
                    fontFamily: "'Cinzel', serif",
                    background: 'transparent',
                    color: '#e74c3c',
                    border: '1.2px solid #e74c3c',
                    padding: '4px 12px',
                    borderRadius: '15px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Sair
                </button>
              )}
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#55286f', fontWeight: 600, marginTop: '-6px' }}>
            Samira Ferreira Estética & Cosmetologia
          </span>
        </div>

        <div style={{ padding: '0 15px', width: '100%', boxSizing: 'border-box' }}>

          {/* TELA 1: LISTAGEM */}
          {telaAtual === 'lista' && (
            <div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.92)',
                borderRadius: '14px',
                border: '1px solid #e2d2f5',
                padding: '16px',
                marginBottom: '15px',
                boxShadow: '0 4px 12px rgba(44, 22, 58, 0.05)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <h2 style={{
                  fontFamily: "'Cinzel', serif",
                  color: '#2c163a',
                  fontSize: '16px',
                  margin: 0
                }}>
                  Prontuários e Pastas de Pacientes
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                  <button
                    type="button"
                    onClick={() => navegarPara('criar_anamnese')}
                    className="btn-efeito-hover"
                    style={{
                      width: '100%',
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '14px 16px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(200, 162, 74, 0.3)',
                      lineHeight: 1.2,
                    }}
                  >
                    <MdAssignment size={16} style={{ flexShrink: 0 }} />
                    Ficha de Anamnese
                  </button>

                  <button
                    type="button"
                    onClick={() => navegarPara('agendamentos')}
                    className="btn-efeito-hover"
                    style={{
                      width: '100%',
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '14px 16px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)',
                      lineHeight: 1.2,
                      position: 'relative',
                    }}
                  >
                    <MdCalendarMonth size={16} style={{ flexShrink: 0 }} />
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
                      width: '100%',
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '14px 16px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 15px rgba(126, 34, 206, 0.4)',
                      lineHeight: 1.2,
                      position: 'relative',
                    }}
                  >
                    <MdSecurity size={16} style={{ flexShrink: 0 }} />
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
                      width: '100%',
                      fontFamily: "'Cinzel', serif",
                      background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 45%, #C8A24A 100%)',
                      color: '#fff',
                      border: '1.5px solid #9c7826',
                      padding: '14px 16px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(200, 162, 74, 0.35)',
                      lineHeight: 1.2,
                    }}
                  >
                    <MdAttachMoney size={16} style={{ flexShrink: 0 }} />
                    Financeiro
                  </button>
                </div>
              </div>

              {/* BARRA DE PESQUISA */}
              {pacientes.length > 0 && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  padding: '8px 14px',
                  marginTop: '-4px',
                  marginBottom: '16px',
                  boxShadow: '0 4px 16px rgba(44, 22, 58, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  boxSizing: 'border-box',
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
                      fontFamily: "'Montserrat', sans-serif",
                      minWidth: 0,
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
                        flexShrink: 0,
                      }}
                    >
                      Limpar
                    </button>
                  )}
                </div>
              )}

              {/* BANNER DE FOTOS */}
              {fotosPendentes.length > 0 && mostrarBannerFotos && (
                <div style={{
                  marginTop: 4,
                  marginBottom: 16,
                  background: 'linear-gradient(135deg, #ede9fe 0%, #f3e8ff 100%)',
                  border: '1.5px solid #a855f7',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <MdPhotoLibrary size={24} color="#7e22ce" style={{ flexShrink: 0 }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Cinzel', serif",
                      color: '#2c163a',
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 3,
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {fotosPendentes.length === 1
                        ? `Nova foto de ${fotosPendentes[0].pacienteNome}`
                        : `${fotosPendentes.length} pacientes enviaram fotos`}
                    </div>
                    <div style={{
                      fontSize: 10.5,
                      color: '#555',
                      fontFamily: "'Montserrat', sans-serif",
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
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
                      padding: '7px 12px', borderRadius: 14,
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
                      fontSize: 18, cursor: 'pointer', padding: 2, lineHeight: 1,
                      flexShrink: 0,
                    }}
                    title="Fechar"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* TABS: ATIVOS / ARQUIVADOS */}
              {!termoBusca.trim() && (
                <div style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 16,
                  width: '100%',
                }}>
                  <button
                    type="button"
                    onClick={() => setAbaPacientes('ativos')}
                    className={`tab-pacientes-mobile ${abaPacientes === 'ativos' ? 'ativo' : ''}`}
                  >
                    <MdFolderOpen size={14} />
                    Ativos
                    <span className="tab-badge">{pacientesAtivos.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAbaPacientes('arquivados')}
                    className={`tab-pacientes-mobile ${abaPacientes === 'arquivados' ? 'ativo' : ''}`}
                  >
                    <MdFolder size={14} />
                    Arquivadas
                    <span className="tab-badge">{pacientesArquivados.length}</span>
                  </button>
                </div>
              )}

              {/* CONTEÚDO */}
              {termoBusca.trim().length >= 2 ? (
                buscandoGlobal ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 12, padding: '30px 15px',
                    background: 'rgba(255, 255, 255, 0.92)',
                    borderRadius: '14px', border: '1px solid #e2d2f5',
                    boxShadow: '0 4px 12px rgba(44, 22, 58, 0.05)',
                    backdropFilter: 'blur(5px)',
                  }}>
                    <div style={{
                      width: '36px', height: '36px',
                      border: '4px solid #e2d2f5',
                      borderTop: '4px solid #C8A24A',
                      borderRadius: '50%',
                      animation: 'spinBuscaMobile 0.8s linear infinite',
                    }} />
                    <span style={{
                      fontFamily: "'Cinzel', serif",
                      color: '#55286f',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.3px',
                    }}>
                      BUSCANDO…
                    </span>
                    <style>{`
                      @keyframes spinBuscaMobile { to { transform: rotate(360deg); } }
                    `}</style>
                  </div>
                ) : !resultadosBusca || resultadosBusca.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '30px 15px',
                    background: 'rgba(255, 255, 255, 0.92)',
                    borderRadius: '14px', border: '1px solid #e2d2f5',
                    boxShadow: '0 4px 12px rgba(44, 22, 58, 0.05)',
                    backdropFilter: 'blur(5px)',
                  }}>
                    <p style={{ color: '#666', fontSize: '13px', marginBottom: '6px' }}>
                      Nenhum paciente encontrado para "{termoBusca}".
                    </p>
                    <button
                      type="button"
                      onClick={() => setTermoBusca('')}
                      style={{
                        background: 'transparent', border: 'none',
                        color: '#C8A24A', fontSize: '11px',
                        fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      Limpar pesquisa
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {resultadosBusca.map((pac) => (
                      <CardPacienteMobile
                        key={pac.id}
                        pac={pac}
                        // 🔧 CORRIGIDO: passa (pac, acao) pro pai
                        onAbrir={(pacArg, acao) => {
                          if (acao === 'reativar') {
                            setPacienteSelecionado(pacArg);
                            navegarPara('editar_anamnese');
                          } else {
                            navegarPara('detalhe_pasta', { paciente: pacArg });
                          }
                        }}
                        onExcluir={() => solicitarExclusaoPasta(pac.id)}
                      />
                    ))}
                  </div>
                )
              ) : listaParaRender.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 15px',
                  background: 'rgba(255, 255, 255, 0.92)',
                  borderRadius: '14px',
                  border: '1px solid #e2d2f5',
                  boxShadow: '0 4px 12px rgba(44, 22, 58, 0.05)',
                  backdropFilter: 'blur(5px)'
                }}>
                  {abaPacientes === 'arquivados' ? (
                    <>
                      <MdFolder size={38} color="#a855f7" style={{ marginBottom: 10 }} />
                      <p style={{ color: '#666', fontSize: '13px', marginBottom: '6px' }}>
                        Nenhuma pasta arquivada.
                      </p>
                      <span style={{ color: '#999', fontSize: '11px' }}>
                        Pastas de pacientes que excluíram a conta aparecem aqui.
                      </span>
                    </>
                  ) : (
                    <>
                      <p style={{ color: '#666', fontSize: '13px', marginBottom: '10px' }}>
                        Nenhum paciente cadastrado na nuvem ainda.
                      </p>
                      <span style={{ color: '#C8A24A', fontSize: '11px', fontWeight: 600 }}>
                        Clique em "Ficha de anamnese" para começar.
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {listaParaRender.map((pac) => (
                      <CardPacienteMobile
                        key={pac.id}
                        pac={pac}
                        // 🔧 CORRIGIDO: passa (pac, acao) pro pai
                        onAbrir={(pacArg, acao) => {
                          if (acao === 'reativar') {
                            setPacienteSelecionado(pacArg);
                            navegarPara('editar_anamnese');
                          } else {
                            navegarPara('detalhe_pasta', { paciente: pacArg });
                          }
                        }}
                        onExcluir={() => solicitarExclusaoPasta(pac.id)}
                        arquivado={abaPacientes === 'arquivados'}
                      />
                    ))}
                  </div>

                  {temMais && abaPacientes === 'ativos' && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
                      <button
                        type="button"
                        onClick={() => setLimitePagina((prev) => prev + TAMANHO_PAGINA)}
                        style={{
                          fontFamily: "'Cinzel', serif",
                          background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                          color: '#fff',
                          border: 'none',
                          padding: '11px 24px',
                          borderRadius: '22px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 3px 12px rgba(200, 162, 74, 0.3)',
                          letterSpacing: '0.5px',
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

          {/* SEGURANÇA */}
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
                  padding: '8px 16px',
                  borderRadius: '22px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '16px',
                }}
              >
                <MdArrowBack size={14} color="#C8A24A" />
                Voltar
              </button>
              <PainelSeguranca />
            </div>
          )}

          {/* FINANCEIRO */}
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
                  padding: '8px 16px',
                  borderRadius: '22px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '16px',
                }}
              >
                <MdArrowBack size={14} color="#C8A24A" />
                Voltar
              </button>

              <PainelFinanceiro uidEsteticista={auth.currentUser?.uid} />
            </div>
          )}

          {/* AGENDAMENTOS */}
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

          {/* DETALHE DA PASTA */}
          {telaAtual === 'detalhe_pasta' && pacienteSelecionado && (
            <div>
              <div style={{ marginBottom: '15px' }}>
                <button
                  type="button"
                  onClick={() => navegarPara('lista', { paciente: null, evolucao: null })}
                  className="btn-voltar-lista"
                  style={{
                    fontFamily: "'Cinzel', serif",
                    background: 'linear-gradient(135deg, rgba(200, 162, 74, 0.12) 0%, rgba(168, 85, 247, 0.10) 100%)',
                    color: '#2c163a',
                    border: '1.5px solid #C8A24A',
                    padding: '8px 16px',
                    borderRadius: '22px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '12px',
                    boxShadow: '0 3px 10px rgba(200, 162, 74, 0.15)',
                    transition: 'all 0.25s ease',
                    backdropFilter: 'blur(6px)',
                  }}
                >
                  <MdArrowBack size={14} color="#C8A24A" />
                  Voltar para lista de pacientes
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{
                    fontFamily: "'Cinzel', serif",
                    color: '#2c163a',
                    fontSize: '18px',
                    margin: 0
                  }}>
                    📁 {pacienteSelecionado.nome}
                  </h2>
                  <button
                    type="button"
                    onClick={() => solicitarExclusaoPasta(pacienteSelecionado.id)}
                    className="btn-efeito-hover-perigo"
                    style={{
                      background: '#ffebee',
                      color: '#c62828',
                      border: '1px solid #ef9a9a',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: "'Cinzel', serif"
                    }}
                  >
                    Excluir
                  </button>
                </div>

                <LinkAcessoPaciente pacienteId={pacienteSelecionado.id} empilhado />

                <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>
                  Doc: {pacienteSelecionado.documento || 'Não informado'}
                </div>
                <div style={{ fontSize: '10px', color: '#555' }}>
                  Criado em: {pacienteSelecionado.dataCriacao}
                </div>
                <div style={{ fontSize: '10px', color: '#A6822B', fontWeight: 600 }}>
                  Última edição: {pacienteSelecionado.dataUltimaEdicao || pacienteSelecionado.dataCriacao}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => navegarPara('ver_anamnese')}
                  className="btn-lavanda-mobile"
                  style={{
                    flex: 1,
                    fontFamily: "'Cinzel', serif",
                    background: 'linear-gradient(135deg, #b8a3c9 0%, #d7cee0 100%)',
                    color: '#2c163a',
                    border: '1.2px solid #8a6fa8',
                    padding: '8px',
                    borderRadius: '15px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 3px 8px rgba(138, 111, 168, 0.25)',
                    transition: 'all 0.25s ease'
                  }}
                >
                  Ver ficha de Anamnese
                </button>

                <button
                  type="button"
                  onClick={() => setMostrarModalAgendar(true)}
                  className="btn-efeito-hover"
                  style={{
                    width: '100%',
                    fontFamily: "'Cinzel', serif",
                    background: 'linear-gradient(135deg, #7e22ce 0%, #a855f7 45%, #C8A24A 100%)',
                    color: '#fff',
                    border: '1.5px solid #9c7826',
                    padding: '10px',
                    borderRadius: '15px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 3px 10px rgba(200, 162, 74, 0.3)',
                  }}
                >
                  <MdCalendarMonth size={14} color="#fff" />
                  Agendar Consulta
                </button>

                <button
                  type="button"
                  onClick={() => {
                    marcarFotosComoNotificadas(pacienteSelecionado.id);
                    navegarPara('galeria');
                  }}
                  className="btn-efeito-hover"
                  style={{
                    width: '100%',
                    fontFamily: "'Cinzel', serif",
                    background: 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '15px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 3px 10px rgba(168, 85, 247, 0.25)'
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
                    width: '100%',
                    fontFamily: "'Cinzel', serif",
                    background: '#C8A24A',
                    color: '#fff',
                    border: 'none',
                    padding: '8px',
                    borderRadius: '15px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  + Adicionar Nova Evolução
                </button>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.92)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e2d2f5'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  borderBottom: '1px solid #eee',
                  paddingBottom: '6px',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <h3 style={{
                    fontFamily: "'Cinzel', serif",
                    color: '#2c163a',
                    fontSize: '14px',
                    margin: 0
                  }}>
                    Fichas de Evolução ({pacienteSelecionado.evolucoes?.length || 0})
                  </h3>

                  {(pacienteSelecionado.evolucoes?.length || 0) > 0 && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.6)',
                      backdropFilter: 'blur(8px)',
                      borderRadius: '8px',
                      border: '1px solid rgba(200, 162, 74, 0.4)',
                      padding: '4px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <MdSearch size={16} color="#C8A24A" style={{ flexShrink: 0 }} />
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
                          fontSize: '11px',
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
                            fontSize: '10px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            flexShrink: 0
                          }}
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {(!pacienteSelecionado.evolucoes || pacienteSelecionado.evolucoes.length === 0) ? (
                  <p style={{ color: '#777', fontSize: '12px' }}>
                    Nenhuma evolução registrada.
                  </p>
                ) : evolucoesFiltradas.length === 0 ? (
                  <p style={{ color: '#777', fontSize: '12px' }}>
                    Nenhuma evolução encontrada para a data "{termoBuscaEvolucao}".
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {evolucoesFiltradas.map((evo) => (
                      <div
                        key={evo.id}
                        style={{
                          border: '1.2px solid #dfc6fc',
                          borderRadius: '8px',
                          padding: '10px',
                          backgroundColor: 'rgba(250, 246, 253, 0.95)'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '6px'
                        }}>
                          <span style={{
                            fontFamily: "'Cinzel', serif",
                            color: '#C8A24A',
                            fontSize: '11px',
                            fontWeight: 700
                          }}>
                            Evolução - {evo.dataCriacao}
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => navegarPara('ver_evolucao', { evolucao: evo })}
                              className="btn-efeito-hover"
                              style={{
                                background: '#C8A24A',
                                color: '#fff',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: '10px',
                                fontSize: '9px',
                                cursor: 'pointer',
                                fontFamily: "'Cinzel', serif",
                                fontWeight: 700
                              }}
                            >
                              Ver
                            </button>

                            <button
                              type="button"
                              onClick={() => solicitarExclusaoEvolucao(evo.id)}
                              className="btn-efeito-hover-perigo"
                              style={{
                                background: '#ffebee',
                                color: '#c62828',
                                border: '1px solid #ef9a9a',
                                padding: '4px 8px',
                                borderRadius: '10px',
                                fontSize: '9px',
                                cursor: 'pointer',
                                fontFamily: "'Cinzel', serif",
                                fontWeight: 700
                              }}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                        <div style={{
                          fontSize: '11px',
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

              {/* Card LGPD */}
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

          {/* GALERIA */}
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
                  padding: '8px 16px',
                  borderRadius: '22px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '16px',
                  boxShadow: '0 3px 10px rgba(200, 162, 74, 0.15)',
                  transition: 'all 0.25s ease',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <MdArrowBack size={14} color="#C8A24A" />
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

          {/* VER EVOLUÇÃO */}
          {telaAtual === 'ver_evolucao' && evolucaoSelecionada && (
            <div>
              <FichaEvoMobile
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

          {/* CRIAR EVOLUÇÃO */}
          {telaAtual === 'criar_evolucao' && (
            <div>
              <FichaEvoMobile
                mode="create"
                pacienteSelecionado={pacienteSelecionado}
                pacienteNomeProp={pacienteSelecionado?.nome}
                uidEsteticista={auth.currentUser?.uid}
                onSave={handleSalvarEvolucao}
                onVoltar={() => navegarPara('detalhe_pasta')}
              />
            </div>
          )}

          {/* EDITAR EVOLUÇÃO */}
          {telaAtual === 'editar_evolucao' && evolucaoSelecionada && (
            <div>
              <FichaEvoMobile
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

      {/* MODAIS */}
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

      {/* MODAL DE EXCLUSÃO DE PASTA/EVOLUÇÃO */}
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
          zIndex: 9999,
          padding: '15px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#fff',
            padding: '24px 20px',
            borderRadius: '16px',
            maxWidth: '380px',
            width: '100%',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            border: '1px solid #e2d2f5',
            textAlign: 'center',
            fontFamily: "'Montserrat', sans-serif"
          }}>
            <h3 style={{
              fontFamily: "'Cinzel', serif",
              color: '#c62828',
              fontSize: '16px',
              marginBottom: '12px'
            }}>
              ⚠️ Confirmação de Exclusão
            </h3>
            <p style={{
              fontSize: '13px',
              color: '#2c163a',
              marginBottom: '15px',
              fontWeight: 500
            }}>
              {modalExclusao.titulo}
            </p>
            <p style={{ fontSize: '11px', color: '#666', marginBottom: '12px' }}>
              Digite sua senha de usuário e pressione Enter:
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
                id="senhaConfirmacaoExclusaoMobile"
                name="senhaConfirmacaoExclusaoMobile"
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
  if (e.key === 'Enter' && !excluindo) {
    confirmarExclusao();
  }
}}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  border: 'none',
                  fontSize: '13px',
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
                fontSize: '11px',
                display: 'block',
                marginBottom: '12px',
                fontWeight: 600
              }}>
                {modalExclusao.erroSenha}
              </span>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
              <button
                type="button"
                onClick={fecharModalExclusao}
                disabled={excluindo} 
                style={{
                  background: '#f0f0f0',
                  color: '#333',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '11px',
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
  disabled={excluindo}
  style={{
    background: excluindo ? '#e5a5a5' : '#c62828',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: excluindo ? 'wait' : 'pointer',
    fontFamily: "'Cinzel', serif",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 110,
  }}
>
  {excluindo ? (
    <>
      <span className="spinner-salvar" />
      EXCLUINDO...
    </>
  ) : (
    'Confirmar'
  )}
</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CARD DE PACIENTE MOBILE
   ============================================================ */
function CardPacienteMobile({ pac, onAbrir, onExcluir, arquivado = false }) {
  return (
    <div
      className="card-pasta-hover"
      style={{
        background: 'rgba(255, 255, 255, 0.92)',
        border: arquivado
          ? '1.5px dashed #c4b5d4'
          : '1.5px solid #dfc6fc',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 4px 10px rgba(44, 22, 58, 0.05)',
        backdropFilter: 'blur(5px)',
        opacity: arquivado ? 0.85 : 1,
      }}
    >
      <div
        onClick={() => onAbrir && onAbrir(pac)}
        style={{ cursor: 'pointer' }}
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
            marginBottom: '2px',
            fontFamily: "'Cinzel', serif"
          }}>
            Criado em: {pac.dataCriacao}
          </div>
        )}

        <div style={{
          fontSize: '10px',
          color: '#A6822B',
          marginBottom: '6px',
          fontFamily: "'Cinzel', serif",
          fontWeight: 600
        }}>
          Última edição: {pac.dataUltimaEdicao || pac.dataCriacao}
        </div>

        <h3 style={{
          fontFamily: "'Cinzel', serif",
          color: '#2c163a',
          fontSize: '15px',
          margin: '0 0 4px 0'
        }}>
          📁 {pac.nome}
        </h3>

        <div style={{
          fontSize: '11px',
          color: '#665078',
          fontWeight: 600,
          marginBottom: '8px'
        }}>
          Doc: {pac.documento || 'Não informado'}
        </div>

        {!arquivado && (
          <LinkAcessoPaciente pacienteId={pac.id} compacto empilhado />
        )}
      </div>

      {/* ⚖️ LGPD — Botão Reativar quando arquivado */}
      {arquivado && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onAbrir) onAbrir(pac, 'reativar');
          }}
          style={{
            marginTop: 10,
            width: '100%',
            fontFamily: "'Cinzel', serif",
            background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
            color: '#fff',
            border: '1.5px solid #9c7826',
            padding: '10px 16px',
            borderRadius: 16,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '0 3px 10px rgba(200, 162, 74, 0.3)',
          }}
        >
          🔄 Reativar paciente
        </button>
      )}

      <div style={{
        fontSize: '11px',
        color: '#555',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #f0e6fa',
        paddingTop: '8px',
        marginTop: '8px'
      }}>
        <span
          onClick={() => onAbrir && onAbrir(pac)}
          style={{ cursor: 'pointer' }}
        >
          Fichas de Evolução: <strong>{pac.evolucoes?.length || 0}</strong>
        </span>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span
            onClick={() => onAbrir && onAbrir(pac)}
            style={{ color: '#C8A24A', fontWeight: 700, cursor: 'pointer' }}
          >
            Abrir Pasta →
          </span>

          {!arquivado && onExcluir && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExcluir();
              }}
              className="btn-efeito-hover-perigo"
              style={{
                background: '#ffebee',
                color: '#c62828',
                border: '1px solid #ef9a9a',
                padding: '4px 8px',
                borderRadius: '10px',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Cinzel', serif"
              }}
            >
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}