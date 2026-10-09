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
  const [authVerificado, setAuthVerificado] = useState(() => {
    if (isNativo()) return false;
    return lerSessao('af_authVerificado') === '1';
  });
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
  // NAVEGAÇÃO
  // ============================================================
  const navegarPara = useCallback((novaAba, opcoes = {}) => {
    if (novaAba === abaAtiva && !opcoes.forcar) return;
    const hashAtual = window.location.hash || '';
    const urlCompleta = window.location.pathname + hashAtual;
    window.history.pushState({ abaAtiva: novaAba }, '', urlCompleta);
    setAbaAtiva(novaAba);
  }, [abaAtiva]);

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
  const jaTeveUserRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    try {
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
        const novaURL = window.location.pathname + (queryLimpa ? '?' + queryLimpa : '');
        window.history.replaceState(window.history.state, '', novaURL);
      }
    } catch (e) {
      console.warn('Falha ao limpar query string:', e);
    }
  }, []);

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

  // ============================================================
  // ROTEAMENTO INICIAL — prioriza hash #UID
  // ============================================================
  useEffect(() => {
    const path = window.location.pathname;
    const hash = window.location.hash.slice(1);

    const temSessaoSalva = (() => {
      try {
        return (
          sessionStorage.getItem('af_autenticado') === '1' ||
          localStorage.getItem('af_autenticado') === '1'
        );
      } catch { return false; }
    })();

    if (hash === 'consultar') {
      setRota('agendamento-consulta');
      return;
    }

    // ✅ PRIORIDADE 1: hash #UID (paciente)
    const hashEhUID =
      hash &&
      hash !== 'agendar' &&
      !hash.startsWith('agendar/');
if (hashEhUID) {
  setUidDaURL(hash);
  uidDaURLRef.current = hash;

  // ✅ Sempre tenta restaurar sessão se ela for desse paciente
  //    Se não for, cai em login-uid de qualquer forma.
  (async () => {
    const valido = await validarUIDPaciente(hash);
    if (!valido) {
      setRota('nao-encontrado');
    } else {
      setRota('login-uid');
    }
  })();
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
      return;
    }

    // /admin
    if (path === '/admin' || path.startsWith('/admin/')) {
      try {
        sessionStorage.removeItem('af_uidDaURL');
        localStorage.removeItem('af_uidDaURL');
      } catch {}
      setUidDaURL(null);
      setModoAdmin(true);
      setRota('admin');
      return;
    }

    // Sem hash → decide pelo contexto
    if (!hash) {
      const ehStandalone =
        (typeof window !== 'undefined' &&
          window.matchMedia &&
          window.matchMedia('(display-mode: standalone)').matches) ||
        (typeof window !== 'undefined' && window.navigator.standalone === true);

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
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.slice(1);
      if (h === 'consultar') {
        setRota('agendamento-consulta');
        return;
      }
      if (h === 'agendar' || h.startsWith('agendar/')) {
        setUidDaURL(h.startsWith('agendar/') ? h.replace('agendar/', '') : null);
        setRota('agendamento');
        return;
      }
if (h && h !== 'agendar') {
  setUidDaURL(h);
  uidDaURLRef.current = h;

  (async () => {
    const valido = await validarUIDPaciente(h);
    if (!valido) {
      // ✅ Só marca 'nao-encontrado' se o usuário NÃO acabou de tentar logar
      setRota((rotaAtual) =>
        rotaAtual === 'autenticado' ? rotaAtual : 'nao-encontrado'
      );
    } else {
      setRota('login-uid');
    }
  })();
}
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // ============================================================
  // OBSERVER DE AUTH
  // ============================================================
  const restaurandoRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (emLogoutRef.current) {
        setAuthVerificado(true);
        return;
      }

      if (user) {
        jaTeveUserRef.current = true;
        if (ultimoUidRef.current === user.uid) {
          setAuthVerificado(true);
          return;
        }

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

        if (tinhaSessao && !restaurandoRef.current) {
          restaurandoRef.current = true;
          const uidAtual = uidDaURLRef.current;

          const emailLogado = user.email ? user.email.toLowerCase().trim() : '';
          const ehEsteticistaLogada =
            EMAILS_ESTETICISTAS.includes(emailLogado) ||
            !emailLogado.endsWith('@sistema.local');

          if (ehEsteticistaLogada) {
            setUidDaURL(null);
            try {
              sessionStorage.removeItem('af_uidDaURL');
              localStorage.removeItem('af_uidDaURL');
            } catch {}
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
          if (dadosSalvos) setDadosPaciente(dadosSalvos);

          const emailUsuario = user.email ? user.email.toLowerCase().trim() : '';
          const ehPaciente = emailUsuario.endsWith('@sistema.local')
            && !EMAILS_ESTETICISTAS.includes(emailUsuario);

          if (ehPaciente) {
            if (docPathSalvo) {
              const [uid, pacId] = docPathSalvo.split('::');
              if (uid && pacId) {
                setPacienteDocPath(doc(db, 'usuarios', uid, 'pacientes', pacId));
              }
            } else {
              try {
                const mapSnap = await getDoc(doc(db, 'mapeamento_emails', emailUsuario));
                if (mapSnap.exists()) {
                  const { profissionalUid, pacienteId } = mapSnap.data();
                  setPacienteDocPath(doc(db, 'usuarios', profissionalUid, 'pacientes', pacienteId));
                }
              } catch (e) { console.warn('Falha restaurando path:', e); }
            }
          }

          const abaValida = ['painel', 'painelPaciente', 'telainicial'].includes(abaSalva)
            ? abaSalva
            : (ehPaciente ? 'painelPaciente' : 'painel');

          setAbaAtiva(abaValida);
          setAuthVerificado(true);
          return;
        }

        await handleLoginSucesso(user, { veioDeRefresh: true });
      } else {
        const temSessaoSalva = (() => {
          try {
            return (
              localStorage.getItem('af_autenticado') === '1' ||
              sessionStorage.getItem('af_autenticado') === '1'
            );
          } catch { return false; }
        })();

        if (!jaTeveUserRef.current && temSessaoSalva) {
          setTimeout(() => {
            if (!auth.currentUser) {
              ultimoUidRef.current = null;
              setAutenticado(false);
              setUsuarioLogado(null);
              setDadosPaciente(null);
              setPacienteDocPath(null);
              setAbaAtiva('telainicial');
              setAuthVerificado(true);
            }
          }, 4000);
          return;
        }

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
        const path = pacienteDocPath.path;
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
      async (docSnap) => {
        if (docSnap.exists()) {
          const dadosAtualizados = { id: docSnap.id, ...docSnap.data() };
          setDadosPaciente(dadosAtualizados);
        } else {
          // ✅ Doc foi APAGADO (esteticista excluiu a pasta OU o próprio
          // paciente excluiu a conta em outro dispositivo).
          // Força logout imediato — o paciente perde acesso na hora.
          console.warn('Paciente foi excluído. Encerrando sessão...');
          try { await signOut(auth); } catch {}
          // ✅ Limpa o Preferences do APK
if (isNativo()) {
  try { await Preferences.remove({ key: 'pacienteId' }); } catch {}
}
          setAutenticado(false);
          setUsuarioLogado(null);
          setDadosPaciente(null);
          setPacienteDocPath(null);
          setUidDaURL(null);
          setRota('nao-encontrado');
          try {
            ['af_autenticado', 'af_abaAtiva', 'af_dadosPaciente',
             'af_pacienteDocPath', 'af_uidDaURL']
              .forEach((k) => {
                sessionStorage.removeItem(k);
                localStorage.removeItem(k);
              });
          } catch {}
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
    if (autenticado && usuarioLogado) {
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
  }, [autenticado, usuarioLogado]);

  // ============================================================
  // LOGIN
  // ============================================================
  const handleLoginSucesso = async (user, opcoes = {}) => {
    const { veioDeRefresh = false } = opcoes;
    if (!user || !user.uid) return;

    setRota('autenticado');
    setUsuarioLogado(user);
    const emailUsuario = user.email ? user.email.toLowerCase().trim() : '';

    if (EMAILS_ESTETICISTAS.includes(emailUsuario) || !emailUsuario.endsWith('@sistema.local')) {
      setUidDaURL(null);
      setModoAdmin(true);
      setRota('admin');
      window.history.replaceState({ abaAtiva: 'painel' }, '', '/admin');
      setAbaAtiva('painel');
      setAutenticado(true);
      return;
    }



       setBuscandoPaciente(true);

    try {
      let pacienteEncontrado = null;

      // ✅ Variável guarda o dado do mapa de e-mails (usada como fallback
      //    se `criadoPorUid` estiver vazio em pacientes antigos).
      let mapSnap2Data = null;

      if (isNativo() && !uidDaURL) {
        const { value } = await Preferences.get({ key: 'pacienteId' });
        if (value) {
          const esteticistasUids = [
            'ZvzIxDhsh7WMZqvG5hcFSOy9I2',
            'ZvzIxDhsh7WMZqvG5hcFQS0yd9I2',
            'MZ5j3NpjlxY67yLRiEfg13TbPE32',
          ];
          let achou = false;
          for (const estUid of esteticistasUids) {
            const pacienteRef = doc(db, 'usuarios', estUid, 'pacientes', value);
            const pacienteSnap = await getDoc(pacienteRef);
            if (pacienteSnap.exists()) {
              pacienteEncontrado = { id: pacienteSnap.id, ...pacienteSnap.data() };
              achou = true;
              break;
            }
          }
          if (!achou) {
            try { await Preferences.remove({ key: 'pacienteId' }); } catch {}
          }
        }
      }

      const mapRef = doc(db, 'mapeamento_emails', emailUsuario);

      if (!pacienteEncontrado) {
        const mapSnap = await getDoc(mapRef);
        if (mapSnap.exists()) {
          mapSnap2Data = mapSnap.data();
          const { profissionalUid, pacienteId } = mapSnap2Data;
          const pacienteRef = doc(db, 'usuarios', profissionalUid, 'pacientes', pacienteId);
          const pacienteSnap = await getDoc(pacienteRef);
          if (pacienteSnap.exists()) {
            pacienteEncontrado = { id: pacienteSnap.id, ...pacienteSnap.data() };
          }
        }
      }

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
          setErroLoginExterno('Nome ou Senha incorretos');
          await signOut(auth);
          setAutenticado(false);
          setUsuarioLogado(null);
          setDadosPaciente(null);
          setBuscandoPaciente(false);
          setRota('login-uid');
          setAuthVerificado(true);
          return;
        }

        if (isNativo()) {
          await Preferences.set({
            key: 'pacienteId',
            value: String(pacienteEncontrado.id),
          });
        }

        setDadosPaciente(pacienteEncontrado);

        // ✅ SEMPRE seta o pacienteDocPath usando `criadoPorUid` do próprio
        //    documento do paciente (fonte mais confiável). Se por algum
        //    motivo estiver vazio, cai no `mapSnap2Data` (mapa de e-mails).
        const estetaUidParaPath =
          pacienteEncontrado.criadoPorUid ||
          (mapSnap2Data?.profissionalUid) ||
          null;

        if (estetaUidParaPath) {
          setPacienteDocPath(
            doc(
              db,
              'usuarios',
              estetaUidParaPath,
              'pacientes',
              String(pacienteEncontrado.id)
            )
          );
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
        // ✅ Erro genérico — NÃO revela se a ficha existiu ou não.
        setErroLoginExterno('Nome ou Senha incorretos');
        await signOut(auth);
        setAutenticado(false);
        setUsuarioLogado(null);
        setDadosPaciente(null);
        setBuscandoPaciente(false);
        setRota('login-uid');
        setAuthVerificado(true);
      }
    } catch (error) {
      console.error('Erro ao carregar pasta do paciente:', error);
      setErroLoginExterno('Nome ou Senha incorretos');
      await signOut(auth);
      setAutenticado(false);
      setUsuarioLogado(null);
      setDadosPaciente(null);
      setBuscandoPaciente(false);
      setRota('login-uid');
      setAuthVerificado(true);
    } finally {
      setBuscandoPaciente(false);
    }
 };  
  // ============================================================
  // LOGOUT
  // ============================================================
  const handleLogout = async () => {
    const eraEsteticista =
      usuarioLogado?.email &&
      (EMAILS_ESTETICISTAS.includes(usuarioLogado.email.toLowerCase().trim()) ||
        !usuarioLogado.email.toLowerCase().trim().endsWith('@sistema.local'));

    const uidPacienteAtual = uidDaURL || dadosPaciente?.id;

    if (isNativo()) {
      try {
        const { doc: docRef, updateDoc } = await import('firebase/firestore');
        const { db: dbRef } = await import('./firebase');

        if (eraEsteticista && usuarioLogado?.uid) {
          try {
            await updateDoc(
              docRef(dbRef, 'push_subscriptions_esteticistas', usuarioLogado.uid),
              { fcmToken: null, atualizadoEm: new Date().toISOString() }
            );
          } catch (e) { console.warn('Falha ao limpar FCM da esteticista:', e); }
        } else if (dadosPaciente?.id) {
          try {
            await updateDoc(
              docRef(dbRef, 'push_subscriptions', String(dadosPaciente.id)),
              { fcmToken: null, atualizadoEm: new Date().toISOString() }
            );
          } catch (e) { console.warn('Falha ao limpar FCM do paciente:', e); }
        }

        try {
          await Preferences.remove({ key: 'push_native_last_paciente_id' });
          await Preferences.remove({ key: 'push_native_last_esteticista_uid' });
        } catch (e) { console.warn('Falha ao limpar Preferences:', e); }
      } catch (e) { console.warn('Falha ao limpar FCM no logout:', e); }
    }

    try {
      await signOut(auth);
    } catch (e) { console.error('Erro ao sair:', e); }

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
        'af_dadosPaciente', 'af_pacienteDocPath', 'af_uidDaURL']
        .forEach(k => {
          sessionStorage.removeItem(k);
          localStorage.removeItem(k);
        });
    } catch {}

    setAbaAtiva('telainicial');

    if (eraEsteticista) {
      setRota('admin');
      setModoAdmin(true);
      window.history.replaceState({ abaAtiva: 'telainicial' }, '', window.location.pathname);
    } else if (uidPacienteAtual) {
      setUidDaURL(uidPacienteAtual);
      setRota('login-uid');
      window.history.replaceState(
        { abaAtiva: 'telainicial' },
        '',
        `${window.location.pathname}#${uidPacienteAtual}`
      );
    } else {
      setRota(isNativo() ? 'login-uid' : 'agendamento');
      window.history.replaceState({ abaAtiva: 'telainicial' }, '', window.location.pathname);
    }

    setTimeout(() => { emLogoutRef.current = false; }, 800);
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
  // RENDER
  // ============================================================
  const renderizarConteudo = () => {
    const hashAtual = window.location.hash.slice(1);
    const pathAtual = window.location.pathname;
    const ehAdminUrl = pathAtual === '/admin' || pathAtual.startsWith('/admin/');

    // ✅ PRIORIDADE MÁXIMA: hash #UID
    const hashEhUID =
      hashAtual &&
      hashAtual !== 'agendar' &&
      hashAtual !== 'consultar' &&
      !hashAtual.startsWith('agendar/');

    if (hashEhUID) {
      // Se NÃO estiver autenticado como esse paciente, força tela de login
      const pacienteLogadoValido =
        autenticado &&
        dadosPaciente &&
        String(dadosPaciente.id) === String(hashAtual);

      if (!pacienteLogadoValido) {
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
    }

    // 1) #consultar
    if (hashAtual === 'consultar') {
      return (
        <ConsultaAgendamento
          onVoltar={() => { window.location.href = '/'; }}
        />
      );
    }

    // 2) #agendar
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

    const ehStandalone =
      (typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof window !== 'undefined' && window.navigator.standalone === true);

    if (ehStandalone && !hashAtual && !ehAdminUrl) {
      const uidSalvo = lerSessao('af_uidDaURL');
      if (uidSalvo) {
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
    }
    // ✅ Se hash é UID válido, JAMAIS cai em agenda pública
const hashEhUIDRender =
  hashAtual &&
  hashAtual !== 'agendar' &&
  hashAtual !== 'consultar' &&
  !hashAtual.startsWith('agendar/');

if (hashEhUIDRender) {
  // Cai no fluxo normal (login-uid já foi tratado acima)
  // Não retorna nada aqui — deixa passar pra lógica de autenticação.
}

    if (!isNativo() && !hashAtual && !ehAdminUrl && !ehStandalone) {
      return (
        <TelaAgendamentoPublico
          uidEsteticista={uidEsteticistaGlobal || UID_ESTETICISTA_PADRAO}
          origem="raiz"
        />
      );
    }

    if (!autenticado) {
      if (rota === 'nao-encontrado') {
        return <PaginaNaoEncontrada />;
      }
    }

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

  return (
    <>
      <TelaSemInternet />
      {renderizarConteudo()}
    </>
  );
  }