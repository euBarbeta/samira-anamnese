// src/components/AnamneseFicha.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TelaInicial from './TelaInicial';
import TelaInicialMobile from './TelaInicialMobile';
import TelaSemInternet from './TelaSemInternet';
import FichaDesktop from './FichaDesktop';
import FichaMobile from './FichaMobile';
import { logWarn } from '../utils/log';
import ModalSairApp from './ModalSairApp';
import { useBackButtonExit, fecharAppNativo } from './useBackButtonExit';
import FichaEvoDesktop from './FichaEvoDesktop';
import FichaEvoMobile from './FichaEvoMobile';
import PainelEsteticista from './PainelEsteticista';
import PainelEsteticistaMobile from './PainelEsteticistaMobile';
import PainelPaciente from './PainelPaciente';
import TelaAgendamentoPublico from './agendamento/TelaAgendamentoPublico';
import PaginaNaoEncontrada from './PaginaNaoEncontrada';
import TelaAcessoSuspenso from './TelaAcessoSuspenso';
import { validarUIDPaciente } from '../utils/validarUID';
import { EMAILS_ESTETICISTAS, UID_ESTETICISTA_PADRAO } from './constantes';
import { secondaryAuth } from './firebaseSecondary';
import { Preferences } from '@capacitor/preferences';
import { isNativo } from './push-notifications-native';
import LoadingElegante from './LoadingElegante';
import ConsultaAgendamento from './agendamento/ConsultaAgendamento';
import ModalAvisoLocalizacao from './ModalAvisoLocalizacao';
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, collection,
  query, where, onSnapshot
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';
import { MdWarning } from 'react-icons/md';

const lerSessao = (k) => {
  try {
    return localStorage.getItem(k) || sessionStorage.getItem(k) || null;
  } catch { return null; }
};

const signOutSafe = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    const msg = String(e?.message || '');
    if (!msg.includes('closing') && !msg.includes('hidden')) {
      logWarn('Erro ao sair:', e);
    }
  }
};

export default function AnamneseFicha() {
  const [uidEsteticistaGlobal, setUidEsteticistaGlobal] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [rota, setRota] = useState('verificando');
  const [mostrarModalSair, setMostrarModalSair] = useState(false);
  const [motivoSuspensao, setMotivoSuspensao] = useState('');
  const [avisoLocalizacao, setAvisoLocalizacao] = useState(null);
  
  const [aguardandoAprovacao, setAguardandoAprovacao] = useState(false);
  const [erroBloqueio, setErroBloqueio] = useState('');

  useBackButtonExit(() => {
    setMostrarModalSair(true);
  });

  const [uidDaURL, setUidDaURL] = useState(() => {
    try {
      const h = window.location.hash.slice(1);
      const hashEhUID =
        h && h !== 'agendar' && h !== 'consultar' && !h.startsWith('agendar/');
      return hashEhUID ? h : null;
    } catch { return null; }
  });
  const uidDaURLRef = useRef(null);
  useEffect(() => { uidDaURLRef.current = uidDaURL; }, [uidDaURL]);

  const [modoAdmin, setModoAdmin] = useState(false);
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);
  const [erroLoginExterno, setErroLoginExterno] = useState('');

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
      logWarn('Falha ao limpar query string:', e);
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'sistema', 'esteticista_ativa'));
        const uid = snap.exists() ? snap.data().uid : null;
        setUidEsteticistaGlobal(uid || UID_ESTETICISTA_PADRAO);
      } catch (e) {
        logWarn('Falha lendo UID global:', e);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    try {
      const motivoSalvo = sessionStorage.getItem('af_motivo_deslog');
      if (motivoSalvo) {
        setMotivoSuspensao(motivoSalvo);
        setRota('acesso-suspenso');
      }
    } catch {}
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    const hash = window.location.hash.slice(1);
    try {
      const motivoSalvo = sessionStorage.getItem('af_motivo_deslog');
      if (motivoSalvo) return;
    } catch {}
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

    const hashEhUID = hash && hash !== 'agendar' && !hash.startsWith('agendar/');
    if (hashEhUID) {
      setUidDaURL(hash);
      uidDaURLRef.current = hash;
      
      if (autenticado && dadosPaciente && String(dadosPaciente.id) !== String(hash)) {
        setRota('nao-encontrado');
      } else {
        setRota('login-uid');
      }
      return;
    }
    
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
        
        if (autenticado && dadosPaciente && String(dadosPaciente.id) !== String(h)) {
          setRota('nao-encontrado');
        } else {
          setRota('login-uid');
        }
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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
              } catch (e) { logWarn('Falha restaurando path:', e); }
            }
          }

          const abaValida = ['painel', 'painelPaciente', 'telainicial'].includes(abaSalva)
            ? abaSalva
            : (ehPaciente ? 'painelPaciente' : 'painel');

          setAbaAtiva(abaValida);
          setAuthVerificado(true);
          return;
        }

        if (processandoLoginRef.current) {
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
  }, []);

  useEffect(() => {
    if (!dadosPaciente?.id) return;

    let pararMonitor = null;
    let cancelado = false;

    (async () => {
      const { iniciarMonitorLocalizacao } = await import('../utils/monitorLocalizacao');
      const { atualizarEstadoSeguranca } = await import('../utils/segurancaEstado');

      pararMonitor = iniciarMonitorLocalizacao(async (novoEstado, anterior) => {
        if (cancelado) return;

        let estadoNormalizado;
        if (novoEstado === 'ligado' || novoEstado === 'ativa') {
          estadoNormalizado = 'ativa';
        } else if (novoEstado === 'negada') {
          estadoNormalizado = 'negada';
        } else if (novoEstado === 'prompt') {
          return;
        } else {
          estadoNormalizado = 'gps_desligado';
        }

        try {
          if (estadoNormalizado === 'ativa') {
            await atualizarEstadoSeguranca(dadosPaciente.id, {
              incluirLocalizacao: true,
            });
          } else {
            const { doc: dRef, setDoc } = await import('firebase/firestore');
            const { db: dbRef } = await import('./firebase');

            await setDoc(
              dRef(dbRef, 'seguranca_estado', String(dadosPaciente.id)),
              {
                pacienteId: String(dadosPaciente.id),
                localizacaoStatus: estadoNormalizado,
                ultimaVerificacao: new Date().toISOString(),
                atualizadoEm: new Date().toISOString(),
              },
              { merge: true }
            );
          }
        } catch (e) {
          console.warn('Falha atualizando estado GPS:', e);
        }

        const dispensados = (() => {
          try {
            const s = sessionStorage.getItem('af_avisos_loc_dispensados');
            return s ? JSON.parse(s) : {};
          } catch { return {}; }
        })();

        const anteriorNormalizado =
          anterior === 'ligado' ? 'ativa' :
          (anterior === 'timeout' || anterior === 'indisponivel' || anterior === 'nao_suportado')
            ? 'gps_desligado'
            : anterior;

        if (estadoNormalizado === 'gps_desligado' && dispensados.gps !== true) {
          setAvisoLocalizacao({ tipo: 'gps_desligado' });
        } else if (estadoNormalizado === 'negada' && dispensados.perm !== true) {
          setAvisoLocalizacao({ tipo: 'negada' });
        } else if (
          estadoNormalizado === 'ativa' &&
          (anteriorNormalizado === 'gps_desligado' || anteriorNormalizado === 'negada')
        ) {
          setAvisoLocalizacao({ tipo: 'reativada' });
        }
      });
    })();

    return () => {
      cancelado = true;
      if (pararMonitor) pararMonitor();
    };
  }, [dadosPaciente?.id]);

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

  useEffect(() => {
    if (!pacienteDocPath) return;
    const unsubscribe = onSnapshot(
      pacienteDocPath,
      async (docSnap) => {
       if (docSnap.exists()) {
  const dadosAtualizados = { id: docSnap.id, ...docSnap.data() };

  if (dadosAtualizados.anonimizadoEm) {
    logWarn('Paciente foi anonimizado. Encerrando sessão...');
    await signOutSafe();
    if (isNativo()) {
      try { await Preferences.remove({ key: 'pacienteId' }); } catch {}
    }
    setAutenticado(false);
    setUsuarioLogado(null);
    setDadosPaciente(null);
    setPacienteDocPath(null);
    setUidDaURL(null);
    setErroLoginExterno(
      'Sua conta foi excluída. Entre em contato com a profissional.'
    );
    setRota('login-uid');
    try {
      ['af_autenticado', 'af_abaAtiva', 'af_dadosPaciente',
        'af_pacienteDocPath', 'af_uidDaURL']
        .forEach((k) => {
          sessionStorage.removeItem(k);
          localStorage.removeItem(k);
        });
    } catch {}
    return;
  }

  setDadosPaciente(dadosAtualizados);
} else {
  logWarn('Paciente foi excluído. Encerrando sessão...');
  await signOutSafe();

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

  useEffect(() => {
    if (!aguardandoAprovacao) return;

    let unsub = null;

    (async () => {
      const { gerarFingerprintEstavel, chaveDispositivo } = await import('../utils/dispositivos');
      const fingerprint = gerarFingerprintEstavel();
      const pacienteId = uidDaURLRef.current;
      
      if (!pacienteId) return;

      const chave = chaveDispositivo(pacienteId, fingerprint);
      const ref = doc(db, 'dispositivos_autorizados', chave);

      unsub = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.autorizado === true) {
            setAguardandoAprovacao(false);
            // ✅ CORREÇÃO: Não recarrega a página (causa loop infinito). 
            // Apenas re-executa a verificação de login para liberar o paciente.
            setRota('verificando');
            setBuscandoPaciente(true);
            handleLoginSucesso(auth.currentUser, { veioDeRefresh: true });
          } else if (data.autorizado === false && data.motivoBloqueio) {
            unsub();
            setAguardandoAprovacao(false);
            setErroBloqueio(data.motivoBloqueio);
            setRota('dispositivo_bloqueado');
            signOutSafe();
          }
        }
      });
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [aguardandoAprovacao]);

  const handleLoginSucesso = async (user, opcoes = {}) => {
    const { veioDeRefresh = false } = opcoes;
    if (!user || !user.uid) return;

    if (processandoLoginRef.current) return;
    processandoLoginRef.current = true;

    try {
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
        processandoLoginRef.current = false;
        return;
      }

      setBuscandoPaciente(true);

      try {
        // ✅ Timeout no getIdToken para não travar
        await Promise.race([
          user.getIdToken(true),
          new Promise(r => setTimeout(r, 3000))
        ]);
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.warn('Erro ao forçar token:', e);
      }

      let pacienteEncontrado = null;
      let mapSnap2Data = null;
      let estetaUidParaPath = null;

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
              estetaUidParaPath = estUid;
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
            estetaUidParaPath = profissionalUid;
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
              estetaUidParaPath = estUid;
            }
          } else {
            const docMatch = querySnapshot.docs[0];
            pacienteEncontrado = { id: docMatch.id, ...docMatch.data() };
            estetaUidParaPath = estUid;
          }

          if (pacienteEncontrado) break;
        }
      }

      if (pacienteEncontrado) {
        
        // ✅ 1. VERIFICAÇÃO DE LGPD (PRIORIDADE MÁXIMA NO APK)
        // Correção: Garante que a tela de login apareça sem travar o loading
        if (isNativo() && !pacienteEncontrado.consentimentoLGPD?.aceito) {
          await signOutSafe();
          setAutenticado(false);
          setUsuarioLogado(null);
          setDadosPaciente(null);
          setBuscandoPaciente(false);
          setErroLoginExterno(
            'Para usar o app, abra o link no navegador primeiro, faça login e aceite o termo LGPD. Depois volte aqui.'
          );
          setRota('login-uid');
          setAuthVerificado(true);
          processandoLoginRef.current = false;
          return;
        }

        // ✅ 2. VERIFICAÇÃO DE ANONIMIZAÇÃO
        if (pacienteEncontrado.anonimizadoEm) {
          await signOutSafe();
          setAutenticado(false);
          setUsuarioLogado(null);
          setDadosPaciente(null);
          setBuscandoPaciente(false);
          setErroLoginExterno('Sua conta foi excluída. Entre em contato com a profissional.');
          setRota('login-uid');
          setAuthVerificado(true);
          processandoLoginRef.current = false;
          return;
        }

        // ✅ 3. VERIFICAÇÃO DE URL (SOMENTE NO NAVEGADOR)
        if (!isNativo() && uidDaURL && String(uidDaURL) !== String(pacienteEncontrado.id)) {
          setErroLoginExterno('Nome ou Senha incorretos');
          await signOutSafe();
          setAutenticado(false);
          setUsuarioLogado(null);
          setDadosPaciente(null);
          setBuscandoPaciente(false);
          setRota('login-uid');
          setAuthVerificado(true);
          processandoLoginRef.current = false;
          return;
        }

        // ✅ 4. SALVA PREFERÊNCIA (APENAS APK)
        if (isNativo()) {
          await Preferences.set({
            key: 'pacienteId',
            value: String(pacienteEncontrado.id),
          });
        }

        setDadosPaciente(pacienteEncontrado);

        import('../utils/segurancaEstado')
          .then(({ atualizarEstadoSeguranca }) => {
            atualizarEstadoSeguranca(pacienteEncontrado.id).catch(() => {});
          })
          .catch(() => {});

        // ✅ 5. BLOCO DE VERIFICAÇÃO DE DISPOSITIVO
        try {
          const { gerarFingerprintEstavel, rotuloDispositivoCurto } = await import('../utils/dispositivos');
          const fingerprint = gerarFingerprintEstavel();
          const dispositivo = rotuloDispositivoCurto();

          let geo = { cidade: null, pais: null, lat: null, lng: null };
          try {
            const { obterLocalizacao } = await import('../utils/geolocalizacao');
            const loc = await obterLocalizacao();
            if (loc.status === 'ativa') {
              geo = {
                cidade: loc.cidade || null,
                pais: loc.pais || null,
                lat: loc.lat ?? null,
                lng: loc.lng ?? null,
              };
            }
          } catch {}

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const res = await fetch('/.netlify/functions/verificar-dispositivo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pacienteId: String(pacienteEncontrado.id),
              fingerprint,
              dispositivo,
              plataforma: isNativo() ? 'apk' : 'pwa',
              ...geo,
            }),
            signal: controller.signal,
          }).finally(() => clearTimeout(timeoutId));

          const data = await res.json();

          if (data.status === 'bloqueado') {
            if (data.motivo === 'Acesso bloqueado preventivamente. A profissional foi notificada e precisa liberar este dispositivo.') {
              setBuscandoPaciente(false);
              setAguardandoAprovacao(true);
              window._pacientePendente = pacienteEncontrado;
              window._pacienteDocPathPendente = estetaUidParaPath;
              return;
            } else {
              await signOutSafe();
              setAutenticado(false);
              setUsuarioLogado(null);
              setDadosPaciente(null);
              setErroBloqueio(data.motivo || 'Acesso suspenso pela profissional.');
              setBuscandoPaciente(false);
              setRota('dispositivo_bloqueado');
              return;
            }
          }
        } catch (e) {
          console.warn('Falha ao verificar dispositivo ou timeout (segue fluxo):', e);
        }

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
        setBuscandoPaciente(false);
      } else {
        await signOutSafe();
        setAutenticado(false);
        setUsuarioLogado(null);
        setDadosPaciente(null);
        setBuscandoPaciente(false);
        setRota('nao-encontrado');
        setAuthVerificado(true);
      }
    } catch (error) {
      console.error('Erro ao carregar pasta do paciente:', error);
      await signOutSafe();
      setAutenticado(false);
      setUsuarioLogado(null);
      setDadosPaciente(null);
      setBuscandoPaciente(false);
      setRota('nao-encontrado');
      setAuthVerificado(true);
    } finally {
      setTimeout(() => {
        processandoLoginRef.current = false;
      }, 1500);
    }
  };

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
          } catch (e) { logWarn('Falha ao limpar FCM da esteticista:', e); }
        } else if (dadosPaciente?.id) {
          try {
            await updateDoc(
              docRef(dbRef, 'push_subscriptions', String(dadosPaciente.id)),
              { fcmToken: null, atualizadoEm: new Date().toISOString() }
            );
          } catch (e) { logWarn('Falha ao limpar FCM do paciente:', e); }
        }

        try {
          await Preferences.remove({ key: 'push_native_last_paciente_id' });
          await Preferences.remove({ key: 'push_native_last_esteticista_uid' });
        } catch (e) { logWarn('Falha ao limpar Preferences:', e); }
      } catch (e) { logWarn('Falha ao limpar FCM no logout:', e); }
    }

    await signOutSafe();

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
    setAvisoLocalizacao(null);

    window.history.replaceState({ abaAtiva: 'telainicial' }, '', window.location.pathname);

    try {
      ['af_autenticado', 'af_abaAtiva', 'af_authVerificado',
        'af_dadosPaciente', 'af_pacienteDocPath', 'af_uidDaURL',
        'af_avisos_loc_dispensados']
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

  const renderizarConteudo = () => {
    const hashAtual = window.location.hash.slice(1);
    const pathAtual = window.location.pathname;
    const ehAdminUrl = pathAtual === '/admin' || pathAtual.startsWith('/admin/');

    if (aguardandoAprovacao) {
      return (
        <div style={{
          minHeight: '100vh', backgroundColor: '#d7cee0',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Montserrat', sans-serif", padding: 20, boxSizing: 'border-box'
        }}>
          <LoadingElegante texto="Aguardando permissão da esteticista..." />
          <p style={{ fontSize: 12, color: '#666', textAlign: 'center', marginTop: 10, maxWidth: 300, lineHeight: 1.5 }}>
            Por segurança, este novo dispositivo precisa ser autorizado pela profissional. 
            Assim que ela liberar, você entrará automaticamente.
          </p>
        </div>
      );
    }

    if (rota === 'dispositivo_bloqueado') {
      return (
        <div style={{
          minHeight: '100vh', backgroundColor: '#d7cee0',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: 20, boxSizing: 'border-box', fontFamily: "'Montserrat', sans-serif"
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: '36px 28px', maxWidth: 400, width: '100%',
            textAlign: 'center', boxShadow: '0 15px 40px rgba(44, 22, 58, 0.25)', border: '1.5px solid #fca5a5'
          }}>
            <div style={{
              width: 72, height: 72, margin: '0 auto 16px', borderRadius: '50%',
              background: '#fde8e8', border: '2px solid #ef9a9a',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <MdWarning size={34} color="#c62828" />
            </div>
            <h2 style={{ fontFamily: "'Cinzel', serif", color: '#c62828', fontSize: 18, margin: '0 0 12px 0' }}>
              Acesso bloqueado
            </h2>
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, margin: '0 0 24px 0' }}>
              {erroBloqueio || 'Sua conta foi suspensa pela profissional. Entre em contato para mais informações.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setErroBloqueio('');
                setRota('login-uid');
              }}
              style={{
                fontFamily: "'Cinzel', serif", background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                color: '#fff', border: '1.5px solid #9c7826', padding: '12px 20px', borderRadius: '24px',
                fontSize: '12px', fontWeight: 700, width: '100%', cursor: 'pointer'
              }}
            >
              VOLTAR AO LOGIN
            </button>
          </div>
        </div>
      );
    }

    if (rota === 'acesso-suspenso') {
      return (
        <TelaAcessoSuspenso
          motivo={motivoSuspensao}
          onVoltarLogin={() => {
            try {
              sessionStorage.removeItem('af_motivo_deslog');
            } catch {}
            setMotivoSuspensao('');
            setRota('login-uid');
          }}
        />
      );
    }

    if (rota === 'nao-encontrado') {
      return <PaginaNaoEncontrada />;
    }

    const hashEhUID =
      hashAtual &&
      hashAtual !== 'agendar' &&
      hashAtual !== 'consultar' &&
      !hashAtual.startsWith('agendar/');

    if (hashEhUID) {
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

    if (!isNativo() && !hashAtual && !ehAdminUrl && !ehStandalone) {
      return (
        <TelaAgendamentoPublico
          uidEsteticista={uidEsteticistaGlobal || UID_ESTETICISTA_PADRAO}
          origem="raiz"
        />
      );
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

      {mostrarModalSair && (
        <ModalSairApp
          onCancelar={() => setMostrarModalSair(false)}
          onConfirmar={() => {
            setMostrarModalSair(false);
            fecharAppNativo();
          }}
        />
      )}

      {avisoLocalizacao && (
        <ModalAvisoLocalizacao
          tipo={avisoLocalizacao.tipo}
          onFechar={() => {
            try {
              const dispensados = (() => {
                try {
                  const s = sessionStorage.getItem('af_avisos_loc_dispensados');
                  return s ? JSON.parse(s) : {};
                } catch { return {}; }
              })();

              if (avisoLocalizacao.tipo === 'gps_desligado') dispensados.gps = true;
              if (avisoLocalizacao.tipo === 'negada') dispensados.perm = true;

              sessionStorage.setItem(
                'af_avisos_loc_dispensados',
                JSON.stringify(dispensados)
              );
            } catch {}

            setAvisoLocalizacao(null);
          }}
        />
      )}
    </>
  );
}