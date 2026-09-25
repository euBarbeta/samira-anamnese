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
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, collection,
  query, where, onSnapshot
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';



export default function AnamneseFicha() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [rota, setRota] = useState('verificando');
const [uidDaURL, setUidDaURL] = useState(null);
const [modoAdmin, setModoAdmin] = useState(false);
const [buscandoPaciente, setBuscandoPaciente] = useState(false);
const [autenticado, setAutenticado] = useState(() => {
  try { return sessionStorage.getItem('af_autenticado') === '1'; } catch { return false; }
});
const [abaAtiva, setAbaAtiva] = useState(() => {
  try { return sessionStorage.getItem('af_abaAtiva') || 'telainicial'; } catch { return 'telainicial'; }
});
const [authVerificado, setAuthVerificado] = useState(() => {
  try { return sessionStorage.getItem('af_authVerificado') === '1'; } catch { return false; }
});
const [dadosPaciente, setDadosPaciente] = useState(() => {
  try {
    const s = sessionStorage.getItem('af_dadosPaciente');
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
    window.history.pushState({ abaAtiva: novaAba }, '', window.location.pathname);
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
useEffect(() => {
  try {
    // ✅ Escreve em AMBOS: localStorage sobrevive ao kill do WebView
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
  } catch {}
}, [abaAtiva, authVerificado, autenticado, dadosPaciente]);

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
  // src/components/AnamneseFicha.jsx

useEffect(() => {
  const path = window.location.pathname;
  const hash = window.location.hash.slice(1);

  // ============================================================
  // 1) /admin → LOGIN DA ESTETICISTA
  // ============================================================
  if (path === '/admin' || path.startsWith('/admin/')) {
    setModoAdmin(true);
    setRota('admin');
    return;
  }

  // ============================================================
  // 2) Sem hash (raiz) → AGENDAMENTO PÚBLICO
  // ============================================================
  if (!hash) {
    setRota('agendamento');
    return;
  }

  // ============================================================
  // 3) #agendar/{uidEsteticista} → agendamento multi-tenant
  // ============================================================
  if (hash.startsWith('agendar/')) {
    setUidDaURL(hash.replace('agendar/', ''));
    setRota('agendamento');
    return;
  }
  if (hash === 'agendar') {
    setRota('agendamento');
    return;
  }

  // ============================================================
  // 4) #{uidPaciente} → validar no Firestore
  // ============================================================
  (async () => {
    const valido = await validarUIDPaciente(hash);
    if (valido) {
      setUidDaURL(hash);
      setRota('login-uid');
    } else {
      setRota('nao-encontrado');
    }
  })();
}, []);

  // ============================================================
  // OBSERVER DE AUTH (login automático ao abrir/refrescar)
  // ============================================================
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
    if (uidDaURL) {
      alert('Acesso não autorizado.');
      await signOut(auth);
      setAutenticado(false);
      setUsuarioLogado(null);
      setUidDaURL(null);
      setRota('nao-encontrado');
      return;
    }
    window.history.replaceState({ abaAtiva: 'painel' }, '', window.location.pathname);
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

    // ✅ NOVO: Se for o app nativo e não tivermos um UID na URL, tenta buscar o paciente salvo.
    if (isNativo() && !uidDaURL) {
      const { value } = await Preferences.get({ key: 'pacienteId' });
      if (value) {
        // Aqui você precisa saber o uidEsteticista. Como o pacienteId é único,
        // podemos tentar encontrá-lo em todos os esteticistas.
        const esteticistasUids = [
          "ZvzIxDhsh7WMZqvG5hcFSOy9I2",
          "ZvzIxDhsh7WMZqvG5hcFQS0yd9I2",
          "MZ5j3NpjlxY67yLRiEfg13TbPE32"
        ];
        for (const estUid of esteticistasUids) {
          const pacienteRef = doc(db, "usuarios", estUid, "pacientes", value);
          const pacienteSnap = await getDoc(pacienteRef);
          if (pacienteSnap.exists()) {
            pacienteEncontrado = { id: pacienteSnap.id, ...pacienteSnap.data() };
            break;
          }
        }
      }
    }

    // Se não encontrou pelo método acima, segue o fluxo normal (por email)
    if (!pacienteEncontrado) {
      const mapRef = doc(db, "mapeamento_emails", emailUsuario);
      const mapSnap = await getDoc(mapRef);
      if (mapSnap.exists()) {
        const { profissionalUid, pacienteId } = mapSnap.data();
        const pacienteRef = doc(db, "usuarios", profissionalUid, "pacientes", pacienteId);
        const pacienteSnap = await getDoc(pacienteRef);
        if (pacienteSnap.exists()) {
          pacienteEncontrado = { id: pacienteSnap.id, ...pacienteSnap.data() };
        }
      }
    }

    // ... (o resto da lógica de busca por esteticistasUids permanece o mesmo)

    if (pacienteEncontrado) {
      // ✅ BLOQUEIO: link não corresponde ao paciente logado (apenas na web)
      if (!isNativo() && uidDaURL && String(uidDaURL) !== String(pacienteEncontrado.id)) {
        alert('Este link não pertence à sua conta. Peça o link correto à profissional.');
        await signOut(auth);
        setAutenticado(false);
        setUsuarioLogado(null);
        setDadosPaciente(null);
        setUidDaURL(null);
        setRota('nao-encontrado');
        return;
      }

      // ✅ NOVO: Salva o ID do paciente para as próximas vezes (apenas no APK).
      if (isNativo()) {
        await Preferences.set({
          key: 'pacienteId',
          value: String(pacienteEncontrado.id),
        });
      }

      setDadosPaciente(pacienteEncontrado);
      // ... (o resto do fluxo continua igual)
    } else {
      // ...
    }
  } catch (error) {
    // ...
  } finally {
    setBuscandoPaciente(false);
  }
};
  // ============================================================
  // LOGOUT
  // ============================================================
  const handleLogout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.error('Erro ao sair:', e);
  }
   if (isNativo()) {
    await Preferences.remove({ key: 'pacienteId' });
  }

  processandoLoginRef.current = false;
  setAutenticado(false);
  setUsuarioLogado(null);
  setDadosPaciente(null);
  setPacienteDocPath(null);
  setFichaSelecionada(null);

  // ✅ Respeita a rota atual
  const estavaEmAdmin = window.location.pathname.startsWith('/admin');
  const hashAtual = window.location.hash.slice(1);

  window.history.replaceState({ abaAtiva: 'telainicial' }, '', window.location.pathname);

  try {
    ['af_autenticado', 'af_abaAtiva', 'af_authVerificado',
     'af_dadosPaciente', 'af_pacienteDocPath', 'pp_telaAtual']
      .forEach(k => {
        sessionStorage.removeItem(k);
        localStorage.removeItem(k);
      });
  } catch {}

  setAbaAtiva('telainicial');

  // ✅ Redefine rota conforme contexto
  if (estavaEmAdmin) {
    setRota('admin');
    setModoAdmin(true);
  } else if (hashAtual) {
    setRota('login-uid');
    setUidDaURL(hashAtual);
  } else {
    setRota('agendamento');
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

  // ============================================================
  // ROTAS PÚBLICAS — não passam por auth
  // ============================================================
  if (rota === 'verificando') {
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
        <span style={{ fontSize: '14px', fontWeight: 700 }}>Verificando link…</span>
        <style>{`@keyframes spinAF { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (rota === 'agendamento') {
    return (
      <TelaAgendamentoPublico
        uidEsteticista={uidDaURL || UID_ESTETICISTA_PADRAO}
        origem="raiz"
      />
    );
  }

  if (rota === 'nao-encontrado') {
    return <PaginaNaoEncontrada />;
  }

  // ============================================================
  // ROTAS DE LOGIN (admin OU paciente por UID)
  // Só mostra o login se ainda não estiver autenticado.
  // Se já estiver autenticado, cai no fluxo normal abaixo.
  // ============================================================
  if (!autenticado) {
    if (rota === 'admin') {
      return isMobile
        ? <TelaInicialMobile onLoginSucesso={handleLoginSucesso} modoEsteticista />
        : <TelaInicial onLoginSucesso={handleLoginSucesso} modoEsteticista />;
    }
    if (rota === 'login-uid') {
      return isMobile
        ? <TelaInicialMobile onLoginSucesso={handleLoginSucesso} />
        : <TelaInicial onLoginSucesso={handleLoginSucesso} />;
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

    // ✅ 2. Buscando paciente
    if (buscandoPaciente) {
      return (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          height: '100vh', backgroundColor: '#d7cee0',
          fontFamily: "'Cinzel', serif", color: '#4a2e7a',
          fontSize: '16px', fontWeight: 700
        }}>
          Carregando seu prontuário...
        </div>
      );
    }

    // ✅ 3. Não autenticado → tela de login
    if (!autenticado || abaAtiva === 'telainicial') {
      return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', boxSizing: 'border-box' }}>
          {isMobile
            ? <TelaInicialMobile onLoginSucesso={handleLoginSucesso} />
            : <TelaInicial onLoginSucesso={handleLoginSucesso} />}
        </div>
      );
    }

    // ✅ 4. Carregando fichas da esteticista
    if (carregandoNuvem && fichasSalvas.length === 0 && abaAtiva === 'painel') {
      return (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          height: '100vh', backgroundColor: '#dfc6fc',
          fontFamily: "'Cinzel', serif", color: '#4a2e7a',
          fontSize: '16px', fontWeight: 700
        }}>
          Carregando dados da nuvem...
        </div>
      );
    }

    // ✅ 5. Painel do Paciente
    if (abaAtiva === 'painelPaciente') {
      return (
        <PainelPaciente
          pacienteData={dadosPaciente}
          onLogout={handleLogout}
          abrirAnamneseInicial={false}
        />
      );
    }

    // ✅ 6. Painel da Esteticista
    if (abaAtiva === 'painel') {
      return isMobile ? (
        <PainelEsteticistaMobile
          fichas={fichasSalvas}
          onSelectFicha={(ficha) => {
            setFichaSelecionada(ficha);
            navegarPara('anamnese');
          }}
          onSelectEvolucao={(ficha) => {
            setFichaSelecionada(ficha);
            navegarPara('evolucao');
          }}
          onExcluirFicha={handleExcluirFicha}
          onLogout={handleLogout}
        />
      ) : (
        <PainelEsteticista
          fichas={fichasSalvas}
          onSelectFicha={(ficha) => {
            setFichaSelecionada(ficha);
            navegarPara('anamnese');
          }}
          onSelectEvolucao={(ficha) => {
            setFichaSelecionada(ficha);
            navegarPara('evolucao');
          }}
          onExcluirFicha={handleExcluirFicha}
          onLogout={handleLogout}
        />
      );
    }

    // ✅ 7. Anamnese (view)
    if (abaAtiva === 'anamnese') {
      const Componente = isMobile ? FichaMobile : FichaDesktop;
      return (
        <Componente
          key={`anamnese-view-${abaAtiva}`}
          fichaSelecionada={fichaSelecionada}
          mode="view"
          onVoltar={() => {
            setFichaSelecionada(null);
            navegarPara('painel');
          }}
          onIrParaEdicao={() => navegarPara('editar-anamnese')}
        />
      );
    }

    // ✅ 8. Editar anamnese
    if (abaAtiva === 'editar-anamnese') {
      const Componente = isMobile ? FichaMobile : FichaDesktop;
      return (
        <Componente
          key={`anamnese-edit-${abaAtiva}`}
          fichaSelecionada={fichaSelecionada}
          mode="edit"
          onVoltar={() => navegarPara('anamnese')}
          onSalvarSucesso={() => {
            setFichaSelecionada(null);
            navegarPara('painel', { forcar: true });
          }}
          onSave={handleSalvarFicha}
        />
      );
    }

    // ✅ 9. Evolução (view)
    if (abaAtiva === 'evolucao') {
      const Componente = isMobile ? FichaEvoMobile : FichaEvoDesktop;
      return (
        <Componente
          key={`evolucao-view-${abaAtiva}`}
          initialData={fichaSelecionada}
          pacienteSelecionado={fichaSelecionada}
          mode="view"
          onVoltar={() => {
            setFichaSelecionada(null);
            navegarPara('painel');
          }}
          onIrParaEdicao={() => navegarPara('editar-evolucao')}
        />
      );
    }

    // ✅ 10. Editar evolução
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