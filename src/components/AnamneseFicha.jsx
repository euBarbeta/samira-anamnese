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
import { secondaryAuth } from './firebaseSecondary';
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, collection,
  query, where, onSnapshot
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';

const EMAILS_ESTETICISTAS = [
  'samira.ferreira@sistema.local',
  'mbtech@sistema.local'
];

export default function AnamneseFicha() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  

 
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
    sessionStorage.setItem('af_abaAtiva', abaAtiva);
    sessionStorage.setItem('af_authVerificado', authVerificado ? '1' : '0');
    sessionStorage.setItem('af_autenticado', autenticado ? '1' : '0');   // 👈 ADICIONE
    if (dadosPaciente) {
      sessionStorage.setItem('af_dadosPaciente', JSON.stringify(dadosPaciente));
    } else {
      sessionStorage.removeItem('af_dadosPaciente');
    }
  } catch {}
}, [abaAtiva, authVerificado, autenticado, dadosPaciente]);              // 👈 autenticado aqui

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

      // ✅ Se já temos uma sessão persistida e o mesmo uid,
      //    restaura sem re-rodar a busca completa (evita "Verificando sessão")
      let tinhaSessao = false;
      let dadosSalvos = null;
      let abaSalva = 'telainicial';
      try {
        tinhaSessao = sessionStorage.getItem('af_autenticado') === '1';
        abaSalva = sessionStorage.getItem('af_abaAtiva') || 'telainicial';
        const d = sessionStorage.getItem('af_dadosPaciente');
        if (d) dadosSalvos = JSON.parse(d);
      } catch {}

      ultimoUidRef.current = user.uid;

      if (tinhaSessao && dadosSalvos && !restaurandoRef.current) {
        restaurandoRef.current = true;
        setUsuarioLogado(user);
        setDadosPaciente(dadosSalvos);
        setAutenticado(true);

        // Reconstrói o path do doc do paciente para reativar o listener
        const emailUsuario = user.email ? user.email.toLowerCase().trim() : '';
        if (emailUsuario.endsWith('@sistema.local') && !EMAILS_ESTETICISTAS.includes(emailUsuario)) {
          try {
            const mapSnap = await getDoc(doc(db, 'mapeamento_emails', emailUsuario));
            if (mapSnap.exists()) {
              const { profissionalUid, pacienteId } = mapSnap.data();
              setPacienteDocPath(doc(db, 'usuarios', profissionalUid, 'pacientes', pacienteId));
            }
          } catch (e) { console.warn('Falha restaurando path:', e); }
        }

        setAbaAtiva(abaSalva);
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

    setUsuarioLogado(user);
    const emailUsuario = user.email ? user.email.toLowerCase().trim() : '';

    // ✅ 1. ESTETICISTA
    if (EMAILS_ESTETICISTAS.includes(emailUsuario) || !emailUsuario.endsWith('@sistema.local')) {
      window.history.replaceState({ abaAtiva: 'painel' }, '', window.location.pathname);
      setAbaAtiva('painel');
      setAutenticado(true);
      return;
    }

    // ✅ 2. PACIENTE
    setBuscandoPaciente(true);

    try {
      let pacienteEncontrado = null;
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

      if (!pacienteEncontrado) {
        const esteticistasUids = [
          "ZvzIxDhsh7WMZqvG5hcFSOy9I2",
          "ZvzIxDhsh7WMZqvG5hcFQS0yd9I2",
          "MZ5j3NpjlxY67yLRiEfg13TbPE32"
        ];

        for (const estUid of esteticistasUids) {
          const pacientesRef = collection(db, "usuarios", estUid, "pacientes");
          let q = query(pacientesRef, where("emailAcesso", "==", emailUsuario));
          let querySnapshot = await getDocs(q);

          if (querySnapshot.empty) {
            const pacienteRefAlt = doc(db, "usuarios", estUid, "pacientes", user.uid);
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
              atualizadoEm: new Date()
            }, { merge: true });
            break;
          }
        }
      }

      if (pacienteEncontrado) {
        setDadosPaciente(pacienteEncontrado);

        const mapRef2 = doc(db, "mapeamento_emails", emailUsuario);
        const mapSnap2 = await getDoc(mapRef2);
        if (mapSnap2.exists()) {
          const { profissionalUid, pacienteId } = mapSnap2.data();
          setPacienteDocPath(doc(db, "usuarios", profissionalUid, "pacientes", pacienteId));
        }

        window.history.replaceState({ abaAtiva: 'painelPaciente' }, '', window.location.pathname);
        setAbaAtiva('painelPaciente');
        setAutenticado(true);
      } else {
        alert("Sua ficha de paciente não foi encontrada nas pastas do sistema.");
        await signOut(auth);
        setAutenticado(false);
        setUsuarioLogado(null);
        setAbaAtiva('telainicial');
      }
    } catch (error) {
      console.error("Erro ao carregar pasta do paciente:", error);
      alert("Erro ao acessar ficha do paciente.");
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
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Erro ao sair:', e);
    }
    processandoLoginRef.current = false;
    setAutenticado(false);
    setUsuarioLogado(null);
    setDadosPaciente(null);
    setPacienteDocPath(null);
    setFichaSelecionada(null);
    window.history.replaceState({ abaAtiva: 'telainicial' }, '', window.location.pathname);
    try {
  sessionStorage.removeItem('af_autenticado');
  sessionStorage.removeItem('af_abaAtiva');
  sessionStorage.removeItem('af_authVerificado');
  sessionStorage.removeItem('af_dadosPaciente');
  sessionStorage.removeItem('pp_telaAtual');
} catch {}
    setAbaAtiva('telainicial');
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
    // ✅ 1. Tela de carregamento inicial (Firebase ainda verificando)
    if (!authVerificado) {
      return (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          height: '100vh', backgroundColor: '#d7cee0',
          fontFamily: "'Cinzel', serif", color: '#4a2e7a',
          fontSize: '16px', fontWeight: 700
        }}>
          Verificando sessão...
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