import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { MdSearch, MdPhotoLibrary, MdArrowBack, MdDescription, MdCalendarMonth, MdAssignment } from 'react-icons/md';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged       // ⬅️ adicione
} from 'firebase/auth';
import { collection, getDocs, query, where, doc, setDoc, deleteDoc, updateDoc  } from 'firebase/firestore';
import { db } from './firebase';
import { secondaryAuth } from './firebaseSecondary';  // ⬅️ ADICIONAR
import FichaMobile from './FichaMobile';
import FichaEvoMobile from './FichaEvoMobile';
import GaleriaPaciente from './GaleriaPaciente';
import BotaoInstalarApp from './BotaoInstalarApp';
import AvisoNotificacoesEsteticista from './AvisoNotificacoesEsteticista';
import TermoConsentimentoPDF from './TermoConsentimentoPDF'; 
import { registrarLinkPaciente } from '../utils/validarUID';
import LinkAcessoPaciente from './LinkAcessoPaciente';
import PainelAgendamentosEsteticista from './agendamento/PainelAgendamentosEsteticista';

const MODAL_FECHADO = {
  isOpen: false,
  tipo: null,
  idAlvo: null,
  titulo: '',
  senhaInput: '',
  mostrarSenhaModal: false,
  erroSenha: ''
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

export default function PainelEsteticistaMobile({ onLogout }) {
  const [telaAtual, setTelaAtual] = useState('lista');
  const [termoBusca, setTermoBusca] = useState('');
  const [termoBuscaEvolucao, setTermoBuscaEvolucao] = useState('');
  const [mostrarTermoPDF, setMostrarTermoPDF] = useState(false);
  const [pacientes, setPacientes] = useState([]);
  const [carregandoNuvem, setCarregandoNuvem] = useState(true);
  const [jaCarregou, setJaCarregou] = useState(false);   

  const [pacienteSelecionado, setPacienteSelecionado] = useState(null);
  const [evolucaoSelecionada, setEvolucaoSelecionada] = useState(null);

  // Estados para o Modal de Confirmação de Exclusão com Senha
  const [modalExclusao, setModalExclusao] = useState(MODAL_FECHADO);

  const auth = getAuth();

  // ✅ Refs para evitar closures obsoletos
  const pacRef = useRef(null);
  const evoRef = useRef(null);
  const modalOpenRef = useRef(false);
  const [fotosPendentes, setFotosPendentes] = useState([]);
const [mostrarBannerFotos, setMostrarBannerFotos] = useState(true);
  useEffect(() => { pacRef.current = pacienteSelecionado; }, [pacienteSelecionado]);
  useEffect(() => { evoRef.current = evolucaoSelecionada; }, [evolucaoSelecionada]);
  useEffect(() => { modalOpenRef.current = modalExclusao.isOpen; }, [modalExclusao.isOpen]);

  // Adicione esta função auxiliar no topo do componente PainelEsteticista
  const agendarLembretesNoOneSignal = async (pacienteId, lembretes) => {
    if (!Array.isArray(lembretes)) return;

    try {
      const response = await fetch('/.netlify/functions/agendar-lembretes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pacienteId, lembretes }),
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
  // NAVEGAÇÃO COM HISTÓRICO — botão voltar funciona
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

  // Substitui a entrada atual (sem criar nova) — usado após salvar
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

  // Handler do botão voltar (navegador + APK)
  useEffect(() => {
    const onPop = (e) => {
      const st = e.state;

      // ✅ Se o modal estava aberto e o voltar foi acionado, fecha o modal
      if (modalOpenRef.current && !st?.modalAberto) {
        setModalExclusao(MODAL_FECHADO);
      }

      if (st?.painelEsteticista) {
        // Se pediu detalhe_pasta mas o paciente não existe mais → cai pra lista
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

  // Estado inicial no histórico (uma única vez)
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
  

  // ✅ Registra push da esteticista (nativo OU web) ao entrar
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    import('./push-notifications').then(({ inscreverPushEsteticistaWeb }) => {
      inscreverPushEsteticistaWeb(user.uid).catch((e) =>
        console.warn('Falha ao registrar push da esteticista:', e)
      );
    });
  }, []);
  

// ✅ Checa fotos não notificadas
useEffect(() => {
  if (!auth.currentUser || !pacientes.length) return;

  let cancelado = false;

  const checar = async () => {
    const uid = auth.currentUser.uid;
    const pendentes = [];
    for (const p of pacientes) {
      try {
        const snap = await getDocs(query(
          collection(db, `usuarios/${uid}/pacientes/${p.id}/fotos`),
          where('notificado', '==', false)
        ));
        if (!snap.empty && !cancelado) {
          pendentes.push({
            pacienteId: p.id,
            pacienteNome: p.nome,
            count: snap.size,
          });
        }
      } catch (e) { /* ignora */ }
    }
    if (!cancelado) setFotosPendentes(pendentes);
  };

  checar();

  const onVis = () => {
    if (document.visibilityState === 'visible') checar();
  };
  document.addEventListener('visibilitychange', onVis);
  const interval = setInterval(checar, 60000); // 1x por minuto

  return () => {
    cancelado = true;
    document.removeEventListener('visibilitychange', onVis);
    clearInterval(interval);
  };
}, [pacientes]);

// ✅ Marca fotos como notificadas quando abre a galeria do paciente
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
    console.warn('Falha ao marcar como notificadas:', e);
  }
};
  // Carregar dados iniciais do Firestore
  // Carregar dados do Firestore — espera o auth hidratar antes
  useEffect(() => {
    let unsubAuth = null;

    const carregarPacientes = async (user) => {
      if (!user) {
        // Ainda não autenticou — aguarda, NÃO marca jaCarregou
        return;
      }

     try {
  const querySnapshot = await getDocs(
    collection(db, `usuarios/${user.uid}/pacientes`)
  );
  const listaPacientes = [];
  querySnapshot.forEach((docSnap) => {
    listaPacientes.push(docSnap.data());
  });
  listaPacientes.sort((a, b) =>
    (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
  );
  setPacientes(listaPacientes);

  // ✅ BACKFILL — registra em links_pacientes os que ainda não têm.
  // Roda em background, silencioso, não trava a UI nem o loading.
  // Idempotente: pode rodar toda vez sem problema.
  Promise.allSettled(
    listaPacientes.map((p) =>
      registrarLinkPaciente(p.id, user.uid).catch(() => {})
    )
  ).then(() => {
    console.log('✅ Links de pacientes sincronizados:', listaPacientes.length);
  });
} catch (e) {
  console.error('Erro ao carregar fichas do Firestore:', e);
} finally {
  setCarregandoNuvem(false);
  setJaCarregou(true);      // ✅ SÓ AQUI decide entre vazio e lista
}
    };

    unsubAuth = onAuthStateChanged(auth, carregarPacientes);
    return () => { if (unsubAuth) unsubAuth(); };
  }, [db, auth]);
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
      await setDoc(doc(db, `usuarios/${user.uid}/pacientes`, String(pacienteObj.id)), pacienteObj);
    } catch (e) {
      console.error('Erro ao salvar paciente na nuvem:', e);
    }
  };
const excluirPacienteDaNuvem = async (idPaciente) => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // 1. Apaga o doc do paciente
    await deleteDoc(doc(db, `usuarios/${user.uid}/pacientes`, String(idPaciente)));

    // 2. ✅ Invalida o link (apaga o links_pacientes)
    try {
      await deleteDoc(doc(db, 'links_pacientes', String(idPaciente)));
    } catch (e) {
      console.warn('Falha ao apagar links_pacientes:', e);
    }
  } catch (e) {
    console.error('Erro ao excluir paciente da nuvem:', e);
  }
};
  const handleSalvarAnamnese = async (dadosAnamnese) => {
    // 1. Garante que pegamos o usuário esteticista logado corretamente do Auth principal
    const userEsteticista = auth.currentUser;
    if (!userEsteticista) {
      alert("Erro: Sessão da esteticista não encontrada. Faça login novamente.");
      return;
    }

    try {
      // 2. Tratamento do Nome para gerar o e-mail
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

      // 3. Extração do Documento e Geração da Senha (6 últimos dígitos)
      const docFormatado = extrairDocumento(dadosAnamnese);
      const documentoLimpo = docFormatado.replace(/\D/g, '');
      const senhaFicticia = (documentoLimpo.length >= 6 ? documentoLimpo.slice(-6) : '123456').padEnd(6, '0');

      let pacienteUid = '';

      // 4. Criação ou recuperação da conta do paciente no Auth secundário
      try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailFicticio, senhaFicticia);
        pacienteUid = userCredential.user.uid;
        await signOut(secondaryAuth);
      } catch (authError) {
        if (authError.code === 'auth/email-already-in-use') {
          console.warn("E-mail já existe no Auth. Reutilizando a conta existente...");
          try {
            const tempCredential = await signInWithEmailAndPassword(secondaryAuth, emailFicticio, senhaFicticia);
            pacienteUid = tempCredential.user.uid;
            await signOut(secondaryAuth);
          } catch (signInErr) {
            pacienteUid = 'pac_' + documentoLimpo;
          }
        } else {
          console.error("Erro detalhado do Auth Secundário:", authError);
          alert(`Erro ao criar o acesso do paciente: ${authError.message}`);
          return;
        }
      }

      if (!pacienteUid) {
        pacienteUid = String(Date.now());
      }

      // 5. Montagem do objeto e salvamento no Firestore
      const agora = new Date();
      const dataHoraFormatada = agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const novoPaciente = {
        id: pacienteUid,
        nome: dadosAnamnese.nome || 'Paciente sem nome',
        documento: docFormatado,
        emailAcesso: emailFicticio,
        criadoPorUid: userEsteticista.uid,
        dataCriacao: dataHoraFormatada,
        dataUltimaEdicao: dataHoraFormatada,
        anamnese: dadosAnamnese,
        evolucoes: []
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

    } catch (error) {
      console.error("Erro geral ao salvar ficha:", error);
      alert("Erro ao salvar ficha na nuvem.");
    }
  };
  

  const handleAtualizarAnamnese = async (dadosAtualizados) => {
    const agora = new Date();
    const dataHoraFormatada = agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
          dataUltimaEdicao: dataHoraFormatada,
          anamnese: dadosAtualizados
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
    // ⚠️ FichaMobile chama onVoltar após mostrar "SALVO COM SUCESSO"
  };

  // Abrir Modal de Exclusão de Pasta
  const solicitarExclusaoPasta = (idPaciente) => {
    // ✅ Empilha entrada no histórico para o voltar fechar o modal
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

  // Abrir Modal de Exclusão de Evolução
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

  // Executar Exclusão validando a senha
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
        const idDocStr = String(modalExclusao.idAlvo);
        await deleteDoc(doc(db, `usuarios/${user.uid}/pacientes`, idDocStr));

        const filtrados = pacientes.filter(p => p.id !== modalExclusao.idAlvo);
        setPacientes(filtrados);
        setPacienteSelecionado(null);
        setEvolucaoSelecionada(null);

        // Substitui a entrada do modal pela lista (evita botão voltar travar)
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
        const novasEvolucoes = pacienteSelecionado.evolucoes.filter(evo => evo.id !== modalExclusao.idAlvo);
        const idDocStr = String(pacienteSelecionado.id);
        const pacienteAtualizadoObj = { ...pacienteSelecionado, evolucoes: novasEvolucoes };

        await setDoc(doc(db, `usuarios/${user.uid}/pacientes`, idDocStr), pacienteAtualizadoObj, { merge: true });

        const atualizados = pacientes.map(p => {
          if (p.id === pacienteSelecionado.id) {
            return pacienteAtualizadoObj;
          }
          return p;
        });

        setPacientes(atualizados);
        setPacienteSelecionado(pacienteAtualizadoObj);

        window.history.replaceState(
          { painelEsteticista: 'detalhe_pasta', pacienteId: String(pacienteSelecionado.id) },
          '',
          window.location.pathname
        );
        setTelaAtual('detalhe_pasta');
        setModalExclusao(MODAL_FECHADO);
      }

    } catch (error) {
      console.error("Erro ao validar senha ou excluir:", error);
      setModalExclusao(prev => ({
        ...prev,
        erroSenha: 'Senha incorreta ou erro na exclusão. Tente novamente.'
      }));
    }
  };

  // Fechar modal (usa history.back() pra remover a entrada do modal)
  const fecharModalExclusao = () => {
    if (window.history.state?.modalAberto) {
      window.history.back(); // dispara popstate que fecha
    } else {
      setModalExclusao(MODAL_FECHADO);
    }
  };

  const handleSalvarEvolucao = async (dadosEvolucao) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const agora = new Date();
      const dataEvo = agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const novaEvolucaoObj = {
        id: Date.now(),
        dataCriacao: dataEvo,
        ...dadosEvolucao
      };

      const novasEvolucoes = [novaEvolucaoObj, ...pacienteSelecionado.evolucoes];
      const idDocStr = String(pacienteSelecionado.id);
      const pacienteAtualizadoObj = { ...pacienteSelecionado, evolucoes: novasEvolucoes };

      await setDoc(doc(db, `usuarios/${user.uid}/pacientes`, idDocStr), pacienteAtualizadoObj, { merge: true });

      const atualizados = pacientes.map(p => {
        if (p.id === pacienteSelecionado.id) {
          return pacienteAtualizadoObj;
        }
        return p;
      });

      setPacientes(atualizados);
      setPacienteSelecionado(pacienteAtualizadoObj);

      // Substitui 'criar_evolucao' por 'detalhe_pasta' no histórico
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

      await setDoc(doc(db, `usuarios/${user.uid}/pacientes`, idDocStr), pacienteAtualizadoObj, { merge: true });

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

  // Formatação automática para máscara de data (DD/MM/AAAA)
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

  // Filtragem e Ordenação Alfabética dos Pacientes
  const pacientesFiltradosOrdenados = pacientes.filter(pac => {
    const termo = termoBusca.toLowerCase().trim();
    if (!termo) return true;
    const nomeMatch = pac.nome?.toLowerCase().includes(termo);
    const docMatch = pac.documento?.toLowerCase().includes(termo);
    return nomeMatch || docMatch;
  });

  // Filtragem das Evoluções do Paciente Selecionado
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
      `}</style>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', boxSizing: 'border-box' }}>

        {auth.currentUser && (
          <AvisoNotificacoesEsteticista uidEsteticista={auth.currentUser.uid} />
        )}

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
            <h1 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '18px', margin: 0, textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>
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
          <span style={{ fontSize: '11px', color: '#55286f', fontWeight: 600, marginTop: '-6px' }}>Samira Ferreira Estética & Cosmetologia</span>
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
                <h2 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '16px', margin: 0 }}>
                  Prontuários e Pastas de Pacientes
                </h2>
           <div style={{ display: 'flex', gap: '8px', flexDirection: 'row' }}>
  <button
    type="button"
    onClick={() => navegarPara('criar_anamnese')}
    className="btn-efeito-hover"
    style={{
      flex: 1,
      fontFamily: "'Cinzel', serif",
      background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
      color: '#fff',
      border: 'none',
      padding: '12px 16px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      boxShadow: '0 4px 12px rgba(200, 162, 74, 0.3)'
    }}
  >
    <MdAssignment size={16} />
    Ficha de Anamnese
  </button>

  <button
    type="button"
    onClick={() => navegarPara('agendamentos')}
    className="btn-efeito-hover"
    style={{
      flex: 1,
      fontFamily: "'Cinzel', serif",
      background: 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)',
      color: '#fff',
      border: 'none',
      padding: '12px 16px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)'
    }}
  >
    <MdCalendarMonth size={16} />
    Agendamentos
  </button>
</div>    
                </div>
              {fotosPendentes.length > 0 && mostrarBannerFotos && (
  <div style={{
    marginTop: 20,
    background: 'linear-gradient(135deg, #ede9fe 0%, #f3e8ff 100%)',
    border: '1.5px solid #a855f7',
    borderRadius: 12,
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  }}>
    <MdPhotoLibrary size={24} color="#7e22ce" />
    <div style={{ flex: 1 }}>
      <div style={{
        fontFamily: "'Cinzel', serif",
        color: '#2c163a',
        fontSize: 13,
        fontWeight: 700,
        marginBottom: 4,
      }}>
        📸 {fotosPendentes.length === 1
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
      }}
      title="Fechar"
    >
      ×
    </button>
  </div>
)}

              {/* BARRA DE PESQUISA COM EFEITO VIDRO */}
              {pacientes.length > 0 && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  padding: '8px 16px',
                  marginBottom: '15px',
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

              {pacientes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 15px', background: 'rgba(255, 255, 255, 0.92)', borderRadius: '14px', border: '1px solid #e2d2f5', boxShadow: '0 4px 12px rgba(44, 22, 58, 0.05)', backdropFilter: 'blur(5px)' }}>
                  <p style={{ color: '#666', fontSize: '13px', marginBottom: '10px' }}>Nenhum paciente cadastrado na nuvem ainda.</p>
                  <span style={{ color: '#C8A24A', fontSize: '11px', fontWeight: 600 }}>Clique em "Ficha de anamnese" para começar.</span>
                </div>
              ) : pacientesFiltradosOrdenados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 15px', background: 'rgba(255, 255, 255, 0.92)', borderRadius: '14px', border: '1px solid #e2d2f5', boxShadow: '0 4px 12px rgba(44, 22, 58, 0.05)', backdropFilter: 'blur(5px)' }}>
                  <p style={{ color: '#666', fontSize: '13px', marginBottom: '6px' }}>Nenhum paciente encontrado para "{termoBusca}".</p>
                  <button
                    onClick={() => setTermoBusca('')}
                    style={{ background: 'transparent', border: 'none', color: '#C8A24A', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Limpar pesquisa
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pacientesFiltradosOrdenados.map((pac) => (
                    <div
                      key={pac.id}
                      className="card-pasta-hover"
                      style={{
                        background: 'rgba(255, 255, 255, 0.92)',
                        border: '1.5px solid #dfc6fc',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 4px 10px rgba(44, 22, 58, 0.05)',
                        backdropFilter: 'blur(5px)'
                      }}
                    >
                      <div
                        onClick={() => navegarPara('detalhe_pasta', { paciente: pac })}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px', fontFamily: "'Cinzel', serif" }}>
                          Criado em: {pac.dataCriacao}
                        </div>
                        <div style={{ fontSize: '10px', color: '#A6822B', marginBottom: '6px', fontFamily: "'Cinzel', serif", fontWeight: 600 }}>
                          Última edição: {pac.dataUltimaEdicao || pac.dataCriacao}
                        </div>

                        <h3 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '15px', margin: '0 0 4px 0' }}>
                          📁 {pac.nome}
                          </h3>
                        <div style={{ fontSize: '11px', color: '#665078', fontWeight: 600, marginBottom: '8px' }}>
                          Doc: {pac.documento || 'Não informado'}
                          </div>
                          <LinkAcessoPaciente pacienteId={pac.id} compacto />
                      
                      </div>

                      <div style={{ fontSize: '11px', color: '#555', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0e6fa', paddingTop: '8px', marginTop: '8px' }}>
                        <span
                          onClick={() => navegarPara('detalhe_pasta', { paciente: pac })}
                          style={{ cursor: 'pointer' }}
                        >
                          Fichas de Evolução: <strong>{pac.evolucoes?.length || 0}</strong>
                        </span>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span
                            onClick={() => navegarPara('detalhe_pasta', { paciente: pac })}
                            style={{ color: '#C8A24A', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Abrir Pasta →
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              solicitarExclusaoPasta(pac.id);
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
                        </div>
                      </div>
                    </div>
                  ))}

                </div>

              )}
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
    <PainelAgendamentosEsteticista uidEsteticista={auth.currentUser?.uid} />
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
                  <h2 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '18px', margin: 0 }}>
                    📁 {pacienteSelecionado.nome}
                    <LinkAcessoPaciente pacienteId={pacienteSelecionado.id} />
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
                    Excluir Pasta
                  </button>
                </div>


                <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>Doc: {pacienteSelecionado.documento || 'Não informado'}</div>
                <div style={{ fontSize: '10px', color: '#555' }}>Criado em: {pacienteSelecionado.dataCriacao}</div>
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
                  style={{ width: '100%', fontFamily: "'Cinzel', serif", background: '#C8A24A', color: '#fff', border: 'none', padding: '8px', borderRadius: '15px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Adicionar Nova Evolução
                </button>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.92)', padding: '16px', borderRadius: '12px', border: '1px solid #e2d2f5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #eee', paddingBottom: '6px', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '14px', margin: 0 }}>
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
                  <p style={{ color: '#777', fontSize: '12px' }}>Nenhuma evolução registrada.</p>
                ) : evolucoesFiltradas.length === 0 ? (
                  <p style={{ color: '#777', fontSize: '12px' }}>Nenhuma evolução encontrada para a data "{termoBuscaEvolucao}".</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {evolucoesFiltradas.map((evo) => (
                      <div key={evo.id} style={{ border: '1.2px solid #dfc6fc', borderRadius: '8px', padding: '10px', backgroundColor: 'rgba(250, 246, 253, 0.95)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontSize: '11px', fontWeight: 700 }}>
                            Evolução - {evo.dataCriacao}
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => navegarPara('ver_evolucao', { evolucao: evo })}
                              className="btn-efeito-hover"
                              style={{ background: '#C8A24A', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '10px', fontSize: '9px', cursor: 'pointer', fontFamily: "'Cinzel', serif", fontWeight: 700 }}
                            >
                              Ver
                            </button>

                            <button
                              type="button"
                              onClick={() => solicitarExclusaoEvolucao(evo.id)}
                              className="btn-efeito-hover-perigo"
                              style={{ background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', padding: '4px 8px', borderRadius: '10px', fontSize: '9px', cursor: 'pointer', fontFamily: "'Cinzel', serif", fontWeight: 700 }}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evo.textoLivre ? evo.textoLivre : (evo.observacoes || evo.procedimentoRealizado || 'Nenhum texto adicional registrado.')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ✅ Card de Consentimento LGPD */}
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
                  <span style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '12px', fontWeight: 700 }}>
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

          {/* VER EVOLUÇÃO MOBILE */}
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

          {/* CRIAR EVOLUÇÃO MOBILE */}
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

          {/* EDITAR EVOLUÇÃO MOBILE */}
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

      {/* ✅ Modal do Termo de Consentimento */}
      {mostrarTermoPDF && pacienteSelecionado && (
        <TermoConsentimentoPDF
          pacienteData={pacienteSelecionado}
          onFechar={() => setMostrarTermoPDF(false)}
        />
      )}

      {/* MODAL CUSTOMIZADO DE EXCLUSÃO COM SENHA E SUPORTE A ENTER */}
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
            <h3 style={{ fontFamily: "'Cinzel', serif", color: '#c62828', fontSize: '16px', marginBottom: '12px' }}>
              ⚠️ Confirmação de Exclusão
            </h3>
            <p style={{ fontSize: '13px', color: '#2c163a', marginBottom: '15px', fontWeight: 500 }}>
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
                onChange={(e) => setModalExclusao(prev => ({ ...prev, senhaInput: e.target.value, erroSenha: '' }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
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
                onClick={() => setModalExclusao(prev => ({ ...prev, mostrarSenhaModal: !prev.mostrarSenhaModal }))}
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
              <span style={{ color: '#c62828', fontSize: '11px', display: 'block', marginBottom: '12px', fontWeight: 600 }}>
                {modalExclusao.erroSenha}
              </span>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
              <button
                type="button"
                onClick={fecharModalExclusao}
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
                style={{
                  background: '#c62828',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', serif"
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}