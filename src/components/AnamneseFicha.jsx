import React, { useState, useEffect, useCallback, useRef } from 'react';
import TelaInicial from './TelaInicial';
import TelaInicialMobile from './TelaInicialMobile';
import TelaSemInternet from './TelaSemInternet';
import FichaDesktop from './FichaDesktop';
import FichaMobile from './FichaMobile';
import FichaEvoDesktop from './FichaEvoDesktop';
import FichaEvoMobile from './FichaEvoMobile';
import PainelEsteticista from './PainelEsteticista';
import PainelEsteticistaMobile from './PainelEsteticistaMobile';
import PainelPaciente from './PainelPaciente';
import TelaAgendamentoPublico from './agendamento/TelaAgendamentoPublico';
import PaginaNaoEncontrada from './PaginaNaoEncontrada';
import { validarUIDPaciente } from '../utils/validarUID';
import { EMAILS_ESTETICISTAS, UID_ESTETICISTA_PADRAO } from './constantes';
import { secondaryAuth } from './firebaseSecondary';
import { Preferences } from '@capacitor/preferences';
import { isNativo } from './push-notifications-native';
import LoadingElegante from './LoadingElegante';
import ConsultaAgendamento from './agendamento/ConsultaAgendamento';
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, collection,
  query, where, onSnapshot
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';

const lerSessao = (k) => {
  try {
    return localStorage.getItem(k) || sessionStorage.getItem(k) || null;
  } catch { return null; }
};

export default function AnamneseFicha() {
  const [uidEsteticistaGlobal, setUidEsteticistaGlobal] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [rota, setRota] = useState('verificando');

  // ✅ Lê o #id também do localStorage (sobrevive ao kill do WebView)
const [uidDaURL, setUidDaURL] = useState(() => {
  try {
    const h = window.location.hash.slice(1);
    // ✅ 'consultar' NÃO é UID
    const hashEhUID =
      h &&
      h !== 'agendar' &&
      h !== 'consultar' &&
      !h.startsWith('agendar/');
    return hashEhUID ? h : null;
  } catch { return null; }
});
  const uidDaURLRef = useRef(null);
  useEffect(() => { uidDaURLRef.current = uidDaURL; }, [uidDaURL]);

  const [modoAdmin, setModoAdmin] = useState(false);
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);
  const [erroLoginExterno, setErroLoginExterno] = useState('');

  // ✅ Todos os estados iniciais leem localStorage PRIMEIRO
  const [autenticado, setAutenticado] = useState(() => lerSessao('af_autenticado') === '1');
  const [abaAtiva, setAbaAtiva] = useState(() => lerSessao('af_abaAtiva') || 'telainicial');
  const [authVerificado, setAuthVerificado] = useState(() => lerSessao('af_authVerificado') === '1');
  const [dadosPaciente, setDadosPaciente] = useState(() => {
    try {
      const s = lerSessao('af_dadosPaciente');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const [fichasSalvas, setFichasSalvas] = useState([]);
  const [carregandoNuvem, setCarregandoNuvem] = useState(false);
  const [fichaSelecionada, setFichaSelecionada] = useState(null);
  const [pacienteDocPath, setPacienteDocPath] = useState(null);
  const [pedidoAbrirAnamnese, setPedidoAbrirAnamnese] = useState(false);

  const processandoLoginRef = useRef(false);

  // ============================================================
  // NAVEGAÇÃO — histórico do navegador
  // ============================================================
 const navegarPara = useCallback((novaAba, opcoes = {}) => {
  if (novaAba === abaAtiva && !opcoes.forcar) return;

  const hashAtual = window.location.hash || '';
  const urlCompleta = window.location.pathname + hashAtual;

  window.history.pushState({ abaAtiva: novaAba }, '', urlCompleta);
  setAbaAtiva(novaAba);
}, [abaAtiva]);
  // Listener do botão VOLTAR (navegador e celular)
  useEffect(() => {
    const handlePopState = (event) => {
      const estado = event.state;
      if (estado && estado.abaAtiva) {
        setAbaAtiva(estado.abaAtiva);
        return;
      }

      if (autenticado) {
        const email = usuarioLogado?.email || '';
        const ehEsteticista = EMAILS_ESTETICISTAS.includes(email)
          || !email.endsWith('@sistema.local');
        setAbaAtiva(ehEsteticista ? 'painel' : 'painelPaciente');
      } else {
        setAbaAtiva('telainicial');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [autenticado, usuarioLogado]);

  const emLogoutRef = useRef(false);
  const ultimoUidRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  // ✅ Rede de segurança: garante que a URL do PACIENTE sempre tenha #id
//    (não mexe na URL do esteticista nem na tela de agendamento)

useEffect(() => {
  try {
    // ✅ NÃO persiste enquanto o auth ainda não foi verificado.
    //    Sem isso, o React roda este efeito antes do onAuthStateChanged
    //    disparar, e sobrescreve o localStorage com '0' — apagando a
    //    sessão salva que sobreviveu ao kill do WebView.
    if (!authVerificado) return;

    const salvar = (k, v) => {
      sessionStorage.setItem(k, v);
      localStorage.setItem(k, v);
    };

    salvar('af_abaAtiva', abaAtiva);
    salvar('af_authVerificado', authVerificado ? '1' : '0');
    salvar('af_autenticado', autenticado ? '1' : '0');
    if (dadosPaciente) {
      salvar('af_dadosPaciente', JSON.stringify(dadosPaciente));
    } else {
      sessionStorage.removeItem('af_dadosPaciente');
      localStorage.removeItem('af_dadosPaciente');
    }

    // ✅ Guarda o último #id do paciente (só quando há um)
    //    Usado pra restaurar em modo PWA standalone quando o
    //    "Abrir no app" corta o hash da URL.
    if (uidDaURL) {
      salvar('af_uidDaURL', String(uidDaURL));
    }
  } catch {}
}, [abaAtiva, authVerificado, autenticado, dadosPaciente, uidDaURL]);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('abrir')) {
        params.delete('abrir');
        const queryLimpa = params.toString();
        const novaURL =
          window.location.pathname + (queryLimpa ? '?' + queryLimpa : '');
        window.history.replaceState(window.history.state, '', novaURL);
      }
    } catch (e) {
      console.warn('Falha ao limpar query string:', e);
    }
  }, []);
  // ✅ Lê o UID ativo da esteticista (doc global)
useEffect(() => {
  let cancelado = false;
  (async () => {
    try {
      const snap = await getDoc(doc(db, 'sistema', 'esteticista_ativa'));
      if (!cancelado && snap.exists()) {
        const uid = snap.data().uid;
        if (uid) setUidEsteticistaGlobal(uid);
      }
    } catch (e) {
      console.warn('Falha lendo UID global:', e);
    }
  })();
  return () => { cancelado = true; };
}, []);
  // src/components/AnamneseFicha.jsx

useEffect(() => {
  const path = window.location.pathname;
  const hash = window.location.hash.slice(1);

  // ✅ Checa se tem sessão salva ANTES de decidir a rota
  const temSessaoSalva = (() => {
    try {
      return (
        sessionStorage.getItem('af_autenticado') === '1' ||
        localStorage.getItem('af_autenticado') === '1'
      );
    } catch { return false; }
  })();
if (hash === 'consultar') {
  setRota('agendamento-consulta'); // Nova rota
  return;
}
  // 0) APP NATIVO
  if (isNativo()) {
    if (hash && !hash.startsWith('agendar')) {
      (async () => {
        const valido = await validarUIDPaciente(hash);
        if (valido) setUidDaURL(hash);
        if (!temSessaoSalva) setRota('login-uid');
      })();
      return;
    }
    if (!temSessaoSalva) setRota('login-uid');
    // Se tem sessão → deixa o observer decidir (rota continua 'verificando')
    return;
  }

  // /admin → sempre mostra a rota (o login decide se entra)
   // /admin → sempre mostra a rota (o login decide se entra)
  if (path === '/admin' || path.startsWith('/admin/')) {
    // ✅ Limpa o uidDaURL do paciente — o esteta não quer ver login de paciente
    try {
      sessionStorage.removeItem('af_uidDaURL');
      localStorage.removeItem('af_uidDaURL');
    } catch {}
    setUidDaURL(null);

    setModoAdmin(true);
    setRota('admin');
    return;
  }
  // Sem hash → agendamento (SÓ se não tiver sessão salva)
   // Sem hash → agendamento SEMPRE (URL é a fonte da verdade)
  // Sem hash → decide pelo contexto
  if (!hash) {
    // ✅ Detecta se está rodando como PWA instalado (standalone)
    const ehStandalone =
      (typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof window !== 'undefined' && window.navigator.standalone === true);

    // ✅ Em PWA: restaura o último #id do paciente.
    //    Motivo: o "Abrir no app" do Android abre o PWA em start_url "/"
    //    e descarta o hash. Sem isso, o paciente cai no agendamento
    //    quando clica no link vindo do WhatsApp.
   if (ehStandalone) {
  const uidSalvo = lerSessao('af_uidDaURL');
  if (uidSalvo) {
    setUidDaURL(uidSalvo);
    uidDaURLRef.current = uidSalvo;
    setRota('login-uid');

    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}#${uidSalvo}`
    );
    return;
  }
}

    // Navegador comum (ou PWA sem uid salvo) → agendamento
    setRota('agendamento');
    return;
  }
  // #agendar/xxx
  if (hash.startsWith('agendar/')) {
    setUidDaURL(hash.replace('agendar/', ''));
    setRota('agendamento');
    return;
  }
  if (hash === 'agendar') {
    setRota('agendamento');
    return;
  }

  // #{uidPaciente}
  // #{uidPaciente}
  const hashEhUID =
    hash &&
    hash !== 'agendar' &&
    !hash.startsWith('agendar/');

  if (hashEhUID) {
    // ✅ Seta síncrono — protege contra race condition
    setUidDaURL(hash);
    uidDaURLRef.current = hash;

    (async () => {
      const valido = await validarUIDPaciente(hash);
      if (!valido) setRota('nao-encontrado');
      else setRota('login-uid');
    })();
  }
}, []);
// ============================================================
// ✅ Re-avalia a rota quando o hash muda em runtime
//    (ex: paciente clica em "Agendar novo horário" → /#agendar)
// ============================================================
useEffect(() => {
  const onHashChange = () => {
    const h = window.location.hash.slice(1);

    // #consultar → tela de consulta por código
    if (h === 'consultar') {
      setRota('agendamento-consulta');
      return;
    }

    // #agendar ou #agendar/UID → tela pública de agendamento
    if (h === 'agendar' || h.startsWith('agendar/')) {
      setUidDaURL(h.startsWith('agendar/') ? h.replace('agendar/', '') : null);
      setRota('agendamento');
      return;
    }

    // Voltou pro #UID (paciente clicou em "Voltar pro meu prontuário")
    // Não força nada — se já está autenticado, o render decide pelo `abaAtiva`
    if (h && h !== 'agendar') {
      setUidDaURL(h);
    }
  };

  window.addEventListener('hashchange', onHashChange);
  return () => window.removeEventListener('hashchange', onHashChange);
}, []);

  // ============================================================
  // OBSERVER DE AUTH (login automático ao abrir/refrescar)
  // ============================================================


const restaurandoRef = useRef(false);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (emLogoutRef.current) {
      setAuthVerificado(true);
      return;
    }

    if (user) {
      if (ultimoUidRef.current === user.uid) {
        setAuthVerificado(true);
        return;
      }

      // ✅ Lê de localStorage PRIMEIRO (sobrevive ao kill), depois session
      const get = (k) => {
        try {
          return localStorage.getItem(k) || sessionStorage.getItem(k) || null;
        } catch { return null; }
      };

      let tinhaSessao = false;
      let dadosSalvos = null;
      let abaSalva = 'telainicial';
      let docPathSalvo = null;

      try {
        tinhaSessao = get('af_autenticado') === '1';
        abaSalva = get('af_abaAtiva') || 'telainicial';
        const d = get('af_dadosPaciente');
        if (d) dadosSalvos = JSON.parse(d);
        docPathSalvo = get('af_pacienteDocPath');
      } catch {}

      ultimoUidRef.current = user.uid;

      // 🚀 Restaura INSTANTÂNEO se tínhamos sessão
  if (tinhaSessao && !restaurandoRef.current) {
  restaurandoRef.current = true;

  // ✅ Usa o REF (sempre atual) em vez do state (congelado no closure)
  const uidAtual = uidDaURLRef.current;

// ✅ ESTETICISTA logada → ignora uidDaURL, vai pro painel dela
const emailLogado = user.email ? user.email.toLowerCase().trim() : '';
const ehEsteticistaLogada =
  EMAILS_ESTETICISTAS.includes(emailLogado) ||
  !emailLogado.endsWith('@sistema.local');

if (ehEsteticistaLogada) {
  // Limpa resquício de paciente
  setUidDaURL(null);
  try {
    sessionStorage.removeItem('af_uidDaURL');
    localStorage.removeItem('af_uidDaURL');
  } catch {}

  // Remove o #uid da URL
  window.history.replaceState(
    { abaAtiva: 'painel' },
    '',
    window.location.pathname
  );

  setUsuarioLogado(user);
  setAutenticado(true);
  setRota('autenticado');
  setModoAdmin(false);
  setAbaAtiva('painel');
  setAuthVerificado(true);
  return;
}

// ✅ PACIENTE logado — só aqui faz sentido validar o uidDaURL
if (uidAtual && String(user.uid) !== String(uidAtual)) {
  emLogoutRef.current = true;
  try { await signOut(auth); } catch {}
  setAutenticado(false);
  setUsuarioLogado(null);
  setDadosPaciente(null);
  setPacienteDocPath(null);
  setAbaAtiva('telainicial');
  setRota('login-uid');
  setAuthVerificado(true);
  setTimeout(() => { emLogoutRef.current = false; }, 500);
  return;
}

  setUsuarioLogado(user);
  setAutenticado(true);

        // Restaura dados do paciente (se houver)
        if (dadosSalvos) setDadosPaciente(dadosSalvos);

        // Reconstrói o path do doc do paciente (do cache OU via Firestore)
        const emailUsuario = user.email ? user.email.toLowerCase().trim() : '';
        const ehPaciente = emailUsuario.endsWith('@sistema.local')
          && !EMAILS_ESTETICISTAS.includes(emailUsuario);

        if (ehPaciente) {
          if (docPathSalvo) {
            // ✅ Restaura direto do cache (sem esperar Firestore)
            const [uid, pacId] = docPathSalvo.split('::');
            if (uid && pacId) {
              setPacienteDocPath(doc(db, 'usuarios', uid, 'pacientes', pacId));
            }
          } else {
            // Sem cache: busca no Firestore
            try {
              const mapSnap = await getDoc(doc(db, 'mapeamento_emails', emailUsuario));
              if (mapSnap.exists()) {
                const { profissionalUid, pacienteId } = mapSnap.data();
                setPacienteDocPath(doc(db, 'usuarios', profissionalUid, 'pacientes', pacienteId));
              }
            } catch (e) { console.warn('Falha restaurando path:', e); }
          }
        }

        // ✅ Restaura a aba em que o usuário estava
        const abaValida = ['painel', 'painelPaciente', 'telainicial'].includes(abaSalva)
          ? abaSalva
          : (ehPaciente ? 'painelPaciente' : 'painel');

        setAbaAtiva(abaValida);
        setAuthVerificado(true);
        return;
      }

      await handleLoginSucesso(user, { veioDeRefresh: true });
    } else {
      ultimoUidRef.current = null;
      setAutenticado(false);
      setUsuarioLogado(null);
      setDadosPaciente(null);
      setPacienteDocPath(null);
      setAbaAtiva('telainicial');
    }
    setAuthVerificado(true);
  });
  return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
useEffect(() => {
  try {
    if (pacienteDocPath && pacienteDocPath.path) {
      // Salva a referência leve como "usuarios/UID/pacientes/PAC_ID"
      const path = pacienteDocPath.path; // "usuarios/XXX/pacientes/YYY"
      const partes = path.split('/');
      if (partes.length >= 4) {
        const valor = `${partes[1]}::${partes[3]}`;
        sessionStorage.setItem('af_pacienteDocPath', valor);
        localStorage.setItem('af_pacienteDocPath', valor);
      }
    } else {
      sessionStorage.removeItem('af_pacienteDocPath');
      localStorage.removeItem('af_pacienteDocPath');
    }
  } catch {}
}, [pacienteDocPath]);

  // ============================================================
  // OBSERVER — PACIENTE EM TEMPO REAL
  // ============================================================
  useEffect(() => {
    if (!pacienteDocPath) return;
    const unsubscribe = onSnapshot(
      pacienteDocPath,
      (docSnap) => {
        if (docSnap.exists()) {
          const dadosAtualizados = { id: docSnap.id, ...docSnap.data() };
          setDadosPaciente(dadosAtualizados);
        }
      },
      (error) => console.error('Erro no listener:', error)
    );
    return () => unsubscribe();
  }, [pacienteDocPath]);

  // ============================================================
  // OBSERVER — FICHAS (esteticista)
  // ============================================================
  useEffect(() => {
    if (autenticado && usuarioLogado && abaAtiva !== 'painelPaciente' && abaAtiva !== 'telainicial') {
      setCarregandoNuvem(true);
      const colRef = collection(db, `usuarios/${usuarioLogado.uid}/pacientes`);
      const unsubscribe = onSnapshot(colRef, (querySnapshot) => {
        const listaFichas = querySnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setFichasSalvas(listaFichas);
        setCarregandoNuvem(false);
      }, (error) => {
        console.error("Erro ao sincronizar:", error);
        setCarregandoNuvem(false);
      });
      return () => unsubscribe();
    }
  }, [autenticado, usuarioLogado, abaAtiva]);

  // ============================================================
  // LOGIN
  // ============================================================

const handleLoginSucesso = async (user, opcoes = {}) => {
  const { veioDeRefresh = false } = opcoes;
  if (!user || !user.uid) return;

  setRota('autenticado');
  setUsuarioLogado(user);
  const emailUsuario = user.email ? user.email.toLowerCase().trim() : '';

  // ============================================================
  // ✅ 1. ESTETICISTA
  // ============================================================
  if (EMAILS_ESTETICISTAS.includes(emailUsuario) || !emailUsuario.endsWith('@sistema.local')) {
    // ✅ Esteticista: sempre /admin, ignora qualquer #id que esteja na URL
    setUidDaURL(null);
    setModoAdmin(true);
    setRota('admin');

    window.history.replaceState(
      { abaAtiva: 'painel' },
      '',
      '/admin'
    );

    setAbaAtiva('painel');
    setAutenticado(true);
    return;
  }
  // ============================================================
  // ✅ 2. PACIENTE
  // ============================================================
  setBuscandoPaciente(true);

  try {
    let pacienteEncontrado = null;

    // ✅ NATIVO: tenta buscar pelo pacienteId salvo em Preferences
    if (isNativo() && !uidDaURL) {
      const { value } = await Preferences.get({ key: 'pacienteId' });
      if (value) {
        const esteticistasUids = [
          'ZvzIxDhsh7WMZqvG5hcFSOy9I2',
          'ZvzIxDhsh7WMZqvG5hcFQS0yd9I2',
          'MZ5j3NpjlxY67yLRiEfg13TbPE32',
        ];
        for (const estUid of esteticistasUids) {
          const pacienteRef = doc(db, 'usuarios', estUid, 'pacientes', value);
          const pacienteSnap = await getDoc(pacienteRef);
          if (pacienteSnap.exists()) {
            pacienteEncontrado = { id: pacienteSnap.id, ...pacienteSnap.data() };
            break;
          }
        }
      }
    }

    // ✅ mapRef no escopo certo (fora do if e do for)
    const mapRef = doc(db, 'mapeamento_emails', emailUsuario);

    // ✅ 1ª tentativa: via mapeamento_emails
    if (!pacienteEncontrado) {
      const mapSnap = await getDoc(mapRef);
      if (mapSnap.exists()) {
        const { profissionalUid, pacienteId } = mapSnap.data();
        const pacienteRef = doc(db, 'usuarios', profissionalUid, 'pacientes', pacienteId);
        const pacienteSnap = await getDoc(pacienteRef);
        if (pacienteSnap.exists()) {
          pacienteEncontrado = { id: pacienteSnap.id, ...pacienteSnap.data() };
        }
      }
    }

    // ✅ 2ª tentativa: varredura nas pastas dos esteticistas
    if (!pacienteEncontrado) {
      const esteticistasUids = [
        'ZvzIxDhsh7WMZqvG5hcFSOy9I2',
        'ZvzIxDhsh7WMZqvG5hcFQS0yd9I2',
        'MZ5j3NpjlxY67yLRiEfg13TbPE32',
      ];

      for (const estUid of esteticistasUids) {
        const pacientesRef = collection(db, 'usuarios', estUid, 'pacientes');
        let q = query(pacientesRef, where('emailAcesso', '==', emailUsuario));
        let querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          const pacienteRefAlt = doc(db, 'usuarios', estUid, 'pacientes', user.uid);
          const altSnap = await getDoc(pacienteRefAlt);
          if (altSnap.exists()) {
            pacienteEncontrado = { id: altSnap.id, ...altSnap.data() };
          }
        } else {
          const docMatch = querySnapshot.docs[0];
          pacienteEncontrado = { id: docMatch.id, ...docMatch.data() };
        }

        if (pacienteEncontrado) {
          await setDoc(mapRef, {
            profissionalUid: estUid,
            pacienteId: pacienteEncontrado.id,
            atualizadoEm: new Date(),
          }, { merge: true });
          break;
        }
      }
    }

 
    if (pacienteEncontrado) {

     
      if (!isNativo() && uidDaURL && String(uidDaURL) !== String(pacienteEncontrado.id)) {
  // ✅ Mensagem vai aparecer DENTRO do box de login (via prop erroExterno)
  setErroLoginExterno(
   'Nome ou Senha incorretos'
  );

  await signOut(auth);

  // ✅ NÃO apaga o uidDaURL — o link continua na URL pro paciente ver
  // ✅ NÃO marca autenticado — volta pra tela de login
  setAutenticado(false);
  setUsuarioLogado(null);
  setDadosPaciente(null);
  setBuscandoPaciente(false);

  // ✅ Volta pra rota de login do paciente (não pra 'nao-encontrado')
  setRota('login-uid');
  setAuthVerificado(true);
  return;
}

      // ✅ Salva ID no app nativo pra próximos logins
      if (isNativo()) {
        await Preferences.set({
          key: 'pacienteId',
          value: String(pacienteEncontrado.id),
        });
      }

      // ✅ Popula os estados que fazem o paciente ENTRAR no painel
      setDadosPaciente(pacienteEncontrado);

      const mapSnap2 = await getDoc(mapRef);
      if (mapSnap2.exists()) {
        const { profissionalUid, pacienteId } = mapSnap2.data();
        setPacienteDocPath(doc(db, 'usuarios', profissionalUid, 'pacientes', pacienteId));
      }

    const idPaciente = String(pacienteEncontrado.id);
window.history.replaceState(
  { abaAtiva: 'painelPaciente', pacienteId: idPaciente },
  '',
  `${window.location.pathname}#${idPaciente}`
);
setUidDaURL(idPaciente);
setAbaAtiva('painelPaciente');
setAutenticado(true);
    } else {
      alert('Sua ficha de paciente não foi encontrada nas pastas do sistema.');
      await signOut(auth);
      setAutenticado(false);
      setUsuarioLogado(null);
      setAbaAtiva('telainicial');
    }
  } catch (error) {
    console.error('Erro ao carregar pasta do paciente:', error);
    alert('Erro ao acessar ficha do paciente.');
    await signOut(auth);
    setAutenticado(false);
    setUsuarioLogado(null);
    setAbaAtiva('telainicial');
  } finally {
    setBuscandoPaciente(false);
  }
};
  // ============================================================
  // LOGOUT
  // ============================================================
 const handleLogout = async () => {
  // ✅ Guarda contexto ANTES de limpar
  const eraEsteticista =
    usuarioLogado?.email &&
    (EMAILS_ESTETICISTAS.includes(usuarioLogado.email.toLowerCase().trim()) ||
      !usuarioLogado.email.toLowerCase().trim().endsWith('@sistema.local'));

  const uidPacienteAtual = uidDaURL || dadosPaciente?.id;

  // ⬇️⬇️⬇️ COLA O BLOCO NOVO AQUI ⬇️⬇️⬇️
  if (isNativo()) {
    try {
      const { doc: docRef, updateDoc } = await import('firebase/firestore');
      const { db: dbRef } = await import('./firebase');

      if (eraEsteticista && usuarioLogado?.uid) {
        try {
          await updateDoc(
            docRef(dbRef, 'push_subscriptions_esteticistas', usuarioLogado.uid),
            {
              fcmToken: null,
              atualizadoEm: new Date().toISOString(),
            }
          );
        } catch (e) {
          console.warn('Falha ao limpar FCM da esteticista:', e);
        }
      } else if (dadosPaciente?.id) {
        try {
          await updateDoc(
            docRef(dbRef, 'push_subscriptions', String(dadosPaciente.id)),
            {
              fcmToken: null,
              atualizadoEm: new Date().toISOString(),
            }
          );
        } catch (e) {
          console.warn('Falha ao limpar FCM do paciente:', e);
        }
      }

      try {
        await Preferences.remove({ key: 'push_native_last_paciente_id' });
        await Preferences.remove({ key: 'push_native_last_esteticista_uid' });
      } catch (e) {
        console.warn('Falha ao limpar Preferences:', e);
      }
    } catch (e) {
      console.warn('Falha ao limpar FCM no logout:', e);
    }
  }
  // ⬆️⬆️⬆️ FIM DO BLOCO NOVO ⬆️⬆️⬆️

  try {
    await signOut(auth);
  } catch (e) {
    console.error('Erro ao sair:', e);
  }
 

  if (isNativo()) {
    try { await Preferences.remove({ key: 'pacienteId' }); } catch {}
  }

  processandoLoginRef.current = false;
  setAutenticado(false);
  setUsuarioLogado(null);
  setDadosPaciente(null);
  setPacienteDocPath(null);
  setFichaSelecionada(null);
  setErroLoginExterno('');

  window.history.replaceState({ abaAtiva: 'telainicial' }, '', window.location.pathname);

  try {
   ['af_autenticado', 'af_abaAtiva', 'af_authVerificado',
 'af_dadosPaciente', 'af_pacienteDocPath', 'pp_telaAtual', 'af_uidDaURL']
  .forEach(k => {
    sessionStorage.removeItem(k);
    localStorage.removeItem(k);
  });
  } catch {}

  setAbaAtiva('telainicial');

  // ============================================================
  // ✅ Decide pra onde ir com base em QUEM estava logado
  // ============================================================
if (eraEsteticista) {
  setRota('admin');
  setModoAdmin(true);
  // URL sem hash
  window.history.replaceState(
    { abaAtiva: 'telainicial' },
    '',
    window.location.pathname
  );
} else if (uidPacienteAtual) {
  setUidDaURL(uidPacienteAtual);
  setRota('login-uid');
  // ✅ Mantém o hash #id na URL para o refresh continuar na tela de login do paciente
  window.history.replaceState(
    { abaAtiva: 'telainicial' },
    '',
    `${window.location.pathname}#${uidPacienteAtual}`
  );
} else {
  setRota(isNativo() ? 'login-uid' : 'agendamento');
  window.history.replaceState(
    { abaAtiva: 'telainicial' },
    '',
    window.location.pathname
  );
}

  setTimeout(() => {
    emLogoutRef.current = false;
  }, 800);
};
  // ============================================================
  // Helpers de salvar/excluir ficha
  // ============================================================
  const handleSalvarFicha = async (dadosNovaFicha) => {
    try {
      const nomeOriginal = dadosNovaFicha.nome ? dadosNovaFicha.nome.trim() : '';
      let partes = nomeOriginal.split(/\s+/);
      let primeiroNome = partes[0] || 'usuario';
      let sobrenome = partes[partes.length - 1] || 'paciente';
      const pNomeLimpo = primeiroNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const sSobrenomeLimpo = sobrenome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const emailFicticio = `${pNomeLimpo}.${sSobrenomeLimpo}@sistema.local`;
      const documentoLimpo = dadosNovaFicha.numeroDocumento
        ? dadosNovaFicha.numeroDocumento.replace(/\D/g, '')
        : '123456';
      const senhaFicticia = documentoLimpo.slice(-6).padEnd(6, '0');
      let pacienteUid = dadosNovaFicha.id ? String(dadosNovaFicha.id) : String(Date.now());

      if (senhaFicticia.length >= 6) {
        try {
          const userCredential = await createUserWithEmailAndPassword(
            secondaryAuth, emailFicticio, senhaFicticia
          );
          pacienteUid = userCredential.user.uid;
          await signOut(secondaryAuth);
        } catch (authError) {
          if (authError.code !== 'auth/email-already-in-use') {
            console.error("Erro ao criar usuário:", authError);
          }
        }
      }

      const fichaParaSalvar = {
        ...dadosNovaFicha,
        id: pacienteUid,
        emailAcesso: emailFicticio,
        criadoPorUid: usuarioLogado.uid
      };

      await setDoc(
        doc(db, `usuarios/${usuarioLogado.uid}/pacientes`, pacienteUid),
        fichaParaSalvar,
        { merge: true }
      );
      await setDoc(
        doc(db, "mapeamento_emails", emailFicticio),
        {
          profissionalUid: usuarioLogado.uid,
          pacienteId: pacienteUid,
          atualizadoEm: new Date()
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Erro ao salvar ficha:", error);
      alert('Erro ao salvar na nuvem.');
    }
  };

  const handleExcluirFicha = async (idFicha) => {
    if (window.confirm("Deseja realmente excluir esta pasta/ficha?")) {
      try {
        await deleteDoc(doc(db, `usuarios/${usuarioLogado.uid}/pacientes`, String(idFicha)));
        alert('Excluído com sucesso!');
        setFichaSelecionada(null);
        setAbaAtiva('painel');
      } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir da nuvem.");
      }
    }
  };

  // ============================================================
  // RENDER — Função interna que retorna a tela correta
  // ============================================================
  
const renderizarConteudo = () => {
  const hashAtual = window.location.hash.slice(1);
  const pathAtual = window.location.pathname;
  const ehAdminUrl = pathAtual === '/admin' || pathAtual.startsWith('/admin/');

  // ============================================================
  // 1) #agendar → agendamento público (PRIORIDADE MÁXIMA)
  //    Funciona no navegador E no PWA, logado ou deslogado.
  //    É a porta de saída do painel do paciente pra agendar.
  // ============================================================
    // ============================================================
  // 0) #consultar → consulta de agendamento por código
  //    Funciona no navegador E no PWA, logado ou deslogado.
  // ============================================================
  if (hashAtual === 'consultar') {
    return (
      <ConsultaAgendamento
        onVoltar={() => { window.location.href = '/'; }}
      />
    );
  }
  if (hashAtual === 'agendar' || hashAtual.startsWith('agendar/')) {
  const uidEstetaDoHash = hashAtual.startsWith('agendar/')
    ? hashAtual.replace('agendar/', '')
    : null;

  return (
    <TelaAgendamentoPublico
      uidEsteticista={uidEstetaDoHash || uidEsteticistaGlobal || UID_ESTETICISTA_PADRAO}
      origem="raiz"
    />
  );
}

  // ============================================================
  // 2) Detecta se está rodando como PWA standalone
  // ============================================================
  const ehStandalone =
    (typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    (typeof window !== 'undefined' && window.navigator.standalone === true);

  // ============================================================
  // 3) PWA standalone SEM hash: NÃO cai em agendamento.
  //    Se tem uid salvo, o useEffect de rotas repõe o hash e manda
  //    pro login/painel. Mostramos loading enquanto isso.
  // ============================================================
  if (ehStandalone && !hashAtual && !ehAdminUrl) {
    const uidSalvo = lerSessao('af_uidDaURL');

    if (uidSalvo) {
      // Tem uid salvo → mostra loading (o useEffect vai repor o hash)
      return (
        <div style={{
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
          height: '100vh', backgroundColor: '#d7cee0',
          fontFamily: "'Cinzel', serif", color: '#4a2e7a',
        }}>
          <div style={{
            width: '46px', height: '46px',
            border: '4px solid rgba(200, 162, 74, 0.25)',
            borderTop: '4px solid #C8A24A',
            borderRadius: '50%',
            animation: 'spinAF 0.8s linear infinite',
            marginBottom: '16px',
          }} />
          <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px' }}>
            Reconectando…
          </span>
          <style>{`@keyframes spinAF { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    // Sem uid salvo → cai no fluxo normal (vai pro agendamento abaixo)
  }

  // ============================================================
  // 4) Navegador normal (não-standalone): sem hash e sem /admin → agendamento
  //    Respeita a URL como fonte da verdade.
  // ============================================================
  if (!isNativo() && !hashAtual && !ehAdminUrl && !ehStandalone) {
    return (
     <TelaAgendamentoPublico
  uidEsteticista={uidEsteticistaGlobal || UID_ESTETICISTA_PADRAO}
  origem="raiz"
/>
    );
  }

 
  // 1. Rotas públicas — só aparecem se NÃO estiver autenticado
  if (!autenticado) {
    if (rota === 'nao-encontrado') {
      return <PaginaNaoEncontrada />;
    }
  }
  // 2. Enquanto Firebase ainda verifica → LOADING (evita flash de login/agendamento)
  if (!authVerificado) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        height: '100vh', backgroundColor: '#d7cee0',
        fontFamily: "'Cinzel', serif", color: '#4a2e7a',
      }}>
        <div style={{
          width: '46px', height: '46px',
          border: '4px solid rgba(200, 162, 74, 0.25)',
          borderTop: '4px solid #C8A24A',
          borderRadius: '50%',
          animation: 'spinAF 0.8s linear infinite',
          marginBottom: '16px',
        }} />
        <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px' }}>
          Reconectando…
        </span>
        <style>{`@keyframes spinAF { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 3. Não autenticado → tela de login
// 3. Não autenticado → tela de login
if (!autenticado) {
  if (rota === 'admin') {
    return isMobile
      ? <TelaInicialMobile onLoginSucesso={handleLoginSucesso} modoEsteticista />
      : <TelaInicial onLoginSucesso={handleLoginSucesso} modoEsteticista />;
  }
  return isMobile
    ? (
      <TelaInicialMobile
        onLoginSucesso={handleLoginSucesso}
        erroExterno={erroLoginExterno}
        onLimparErro={() => setErroLoginExterno('')}
      />
    )
    : (
      <TelaInicial
        onLoginSucesso={handleLoginSucesso}
        erroExterno={erroLoginExterno}
        onLimparErro={() => setErroLoginExterno('')}
      />
    );
}

  // 4. Autenticado → painéis
 // 4. Autenticado → painéis
if (buscandoPaciente) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#d7cee0',
    }}>
      <LoadingElegante texto="Carregando painel do paciente..." />
    </div>
  );
}

  if (abaAtiva === 'painelPaciente') {
    return (
      <PainelPaciente
        pacienteData={dadosPaciente}
        onLogout={handleLogout}
        abrirAnamneseInicial={false}
      />
    );
  }

  if (abaAtiva === 'painel') {
    if (carregandoNuvem && fichasSalvas.length === 0) {
      return (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          height: '100vh', backgroundColor: '#dfc6fc',
          fontFamily: "'Cinzel', serif", color: '#4a2e7a',
          fontSize: '16px', fontWeight: 700,
        }}>
          Carregando dados da nuvem...
        </div>
      );
    }
    return isMobile ? (
      <PainelEsteticistaMobile
        fichas={fichasSalvas}
        onSelectFicha={(ficha) => { setFichaSelecionada(ficha); navegarPara('anamnese'); }}
        onSelectEvolucao={(ficha) => { setFichaSelecionada(ficha); navegarPara('evolucao'); }}
        onExcluirFicha={handleExcluirFicha}
        onLogout={handleLogout}
      />
    ) : (
      <PainelEsteticista
        fichas={fichasSalvas}
        onSelectFicha={(ficha) => { setFichaSelecionada(ficha); navegarPara('anamnese'); }}
        onSelectEvolucao={(ficha) => { setFichaSelecionada(ficha); navegarPara('evolucao'); }}
        onExcluirFicha={handleExcluirFicha}
        onLogout={handleLogout}
      />
    );
  }

  if (abaAtiva === 'anamnese') {
    const Componente = isMobile ? FichaMobile : FichaDesktop;
    return (
      <Componente
        key={`anamnese-view-${abaAtiva}`}
        fichaSelecionada={fichaSelecionada}
        mode="view"
        onVoltar={() => { setFichaSelecionada(null); navegarPara('painel'); }}
        onIrParaEdicao={() => navegarPara('editar-anamnese')}
      />
    );
  }

  if (abaAtiva === 'editar-anamnese') {
    const Componente = isMobile ? FichaMobile : FichaDesktop;
    return (
      <Componente
        key={`anamnese-edit-${abaAtiva}`}
        fichaSelecionada={fichaSelecionada}
        mode="edit"
        onVoltar={() => navegarPara('anamnese')}
        onSalvarSucesso={() => { setFichaSelecionada(null); navegarPara('painel', { forcar: true }); }}
        onSave={handleSalvarFicha}
      />
    );
  }

  if (abaAtiva === 'evolucao') {
    const Componente = isMobile ? FichaEvoMobile : FichaEvoDesktop;
    return (
      <Componente
        key={`evolucao-view-${abaAtiva}`}
        initialData={fichaSelecionada}
        pacienteSelecionado={fichaSelecionada}
        mode="view"
        onVoltar={() => { setFichaSelecionada(null); navegarPara('painel'); }}
        onIrParaEdicao={() => navegarPara('editar-evolucao')}
      />
    );
  }

  if (abaAtiva === 'editar-evolucao') {
    const Componente = isMobile ? FichaEvoMobile : FichaEvoDesktop;
    return (
      <Componente
        key={`evolucao-edit-${abaAtiva}`}
        initialData={fichaSelecionada}
        pacienteSelecionado={fichaSelecionada}
        mode="edit"
        onVoltar={() => navegarPara('evolucao')}
        onSave={handleSalvarFicha}
      />
    );
  }

  return null;
};

  // ✅ ÚNICO return — Tela sem internet SEMPRE presente
  return (
    <>
      <TelaSemInternet />
      {renderizarConteudo()}
    </>
  );
}