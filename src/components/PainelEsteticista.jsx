import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { MdSearch, MdPhotoLibrary, MdArrowBack, MdDescription } from 'react-icons/md';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import FichaDesktop from './FichaDesktop';
import FichaEvoDesktop from './FichaEvoDesktop';
import GaleriaPaciente from './GaleriaPaciente'; 
import BotaoInstalarApp from './BotaoInstalarApp';
import AvisoNotificacoesEsteticista from './AvisoNotificacoesEsteticista';
import { secondaryAuth } from './firebaseSecondary';
import TermoConsentimentoPDF from './TermoConsentimentoPDF';

const MODAL_FECHADO = {
  isOpen: false,
  tipo: null,
  idAlvo: null,
  titulo: '',
  senhaInput: '',
  mostrarSenhaModal: false,
  erroSenha: ''
};

export default function PainelEsteticista({ onLogout }) {
  const [telaAtual, setTelaAtual] = useState('lista');
  const [termoBusca, setTermoBusca] = useState('');
  const [termoBuscaEvolucao, setTermoBuscaEvolucao] = useState('');
  const [carregandoNuvem, setCarregandoNuvem] = useState(true);
  
  const [pacientes, setPacientes] = useState([]);
  const [pacienteSelecionado, setPacienteSelecionado] = useState(null);
  const [evolucaoSelecionada, setEvolucaoSelecionada] = useState(null);
  const [mostrarTermoPDF, setMostrarTermoPDF] = useState(false);

  const [modalExclusao, setModalExclusao] = useState(MODAL_FECHADO);

  const db = getFirestore();
  const auth = getAuth();

  // ✅ Refs para evitar closures obsoletos em navegarPara/popstate
  const pacRef = useRef(null);
  const evoRef = useRef(null);
  const modalOpenRef = useRef(false);
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

      // ✅ Fechar modal de exclusão se estiver aberto
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

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    import('./push-notifications').then(({ inscreverPushEsteticistaWeb }) => {
      inscreverPushEsteticistaWeb(user.uid).catch(() => {});
    });
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

  // Carregar dados do Firestore ao iniciar
  useEffect(() => {
    async function carregarDadosNuvem() {
      const user = auth.currentUser;
      if (!user) {
        setCarregandoNuvem(false);
        return;
      }

      try {
        const querySnapshot = await getDocs(collection(db, `usuarios/${user.uid}/pacientes`));
        const listaPacientes = [];
        querySnapshot.forEach((docSnap) => {
          listaPacientes.push(docSnap.data());
        });

        listaPacientes.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
        setPacientes(listaPacientes);
      } catch (e) {
        console.error('Erro ao carregar fichas do Firestore:', e);
      } finally {
        setCarregandoNuvem(false);
      }
    }

    carregarDadosNuvem();
  }, [db, auth]);
  
  // Função auxiliar para excluir um paciente do Firestore
  const excluirPacienteDaNuvem = async (idPaciente) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await deleteDoc(doc(db, `usuarios/${user.uid}/pacientes`, String(idPaciente)));
    } catch (e) {
      console.error('Erro ao excluir paciente da nuvem:', e);
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
      await setDoc(doc(db, `usuarios/${user.uid}/pacientes`, String(pacienteObj.id)), pacienteObj);
    } catch (e) {
      console.error('Erro ao salvar paciente na nuvem:', e);
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

      // 4. Tratamento limpo sem gerar erro visível no console
      try {
        // Tenta criar diretamente
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailFicticio, senhaFicticia);
        pacienteUid = userCredential.user.uid;
        await signOut(secondaryAuth);
      } catch (authError) {
        // Se o e-mail já existe, apenas fazemos o login em silêncio para recuperar o UID, sem logs de erro
        if (authError.code === 'auth/email-already-in-use') {
          try {
            const tempCredential = await signInWithEmailAndPassword(secondaryAuth, emailFicticio, senhaFicticia);
            pacienteUid = tempCredential.user.uid;
            await signOut(secondaryAuth);
          } catch (signInErr) {
            pacienteUid = 'pac_' + documentoLimpo;
          }
        } else {
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
        email: emailFicticio,        // Adicionado para padronizar buscas por 'email'
        emailAcesso: emailFicticio,  // Mantido para compatibilidade
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
    // ⚠️ Não navega aqui — FichaDesktop chama onVoltar após mostrar "SALVO COM SUCESSO"
  };

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
        const filtrados = pacientes.filter(p => p.id !== modalExclusao.idAlvo);
        setPacientes(filtrados);
        await excluirPacienteDaNuvem(modalExclusao.idAlvo);
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
    // Se o modal foi empilhado no histórico, usa back() pra fechar
    if (window.history.state?.modalAberto) {
      window.history.back();
    } else {
      setModalExclusao(MODAL_FECHADO);
    }
  };

  const handleSalvarEvolucao = async (dadosEvolucao) => {
    const agora = new Date();
    const dataEvo = agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

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

    // Substitui 'criar_evolucao' por 'detalhe_pasta' no histórico
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

  const pacientesFiltrados = pacientes.filter(pac => {
    const termo = termoBusca.toLowerCase().trim();
    if (!termo) return true;
    const nomePaciente = (pac.nome || '').toLowerCase();
    const docPaciente = (pac.documento || '').toLowerCase();
    return nomePaciente.includes(termo) || docPaciente.includes(termo);
  });

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
            <h1 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '22px', margin: 0, textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>
              Painel da Esteticista
            </h1>
            <span style={{ fontSize: '12px', color: '#55286f', fontWeight: 600 }}>Samira Ferreira Estética & Cosmetóloga</span>
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
          
          {/* LISTA DE PACIENTES */}
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
                <h2 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '18px', margin: 0 }}>
                  Pastas de Pacientes
                </h2>
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
                    boxShadow: '0 4px 15px rgba(200, 162, 74, 0.4)'
                  }}
                >
                 Ficha de anamnese
                </button>
              </div>

              {pacientes.length > 0 && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  padding: '8px 16px',
                  marginBottom: '20px',
                  boxShadow: '0 4px 16px rgba(44, 22, 58, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '500px',
                  maxWidth: '100%'
                }}>
                  <MdSearch size={20} color="#C8A24A" style={{ flexShrink: 0 }} />
                  <input
                    id="termoBusca"
                    name="termoBusca"
                    type="text"
                    placeholder="Pesquisar pasta pelo nome do paciente ou número do documento..."
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: '13px',
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
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Limpar
                    </button>
                  )}
                </div>
              )}

              {carregandoNuvem ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255, 255, 255, 0.92)', borderRadius: '16px', border: '1px solid #e2d2f5' }}>
                  <p style={{ color: '#666', fontSize: '14px' }}>Carregando dados da nuvem...</p>
                </div>
              ) : pacientes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255, 255, 255, 0.92)', borderRadius: '16px', border: '1px solid #e2d2f5' }}>
                  <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>Nenhum paciente cadastrado ainda.</p>
                  <span style={{ color: '#C8A24A', fontSize: '12px', fontWeight: 600 }}>Clique em "Ficha de anamnese" para começar.</span>
                </div>
              ) : pacientesFiltrados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255, 255, 255, 0.92)', borderRadius: '16px', border: '1px solid #e2d2f5' }}>
                  <p style={{ color: '#666', fontSize: '13px' }}>Nenhum paciente encontrado para "{termoBusca}".</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                  {pacientesFiltrados.map((pac) => (
                    <div
                      key={pac.id}
                      onClick={() => navegarPara('detalhe_pasta', { paciente: pac })}
                      className="card-pasta-hover"
                      style={{
                        background: 'rgba(255, 255, 255, 0.92)',
                        border: '1.5px solid #dfc6fc',
                        borderRadius: '12px',
                        padding: '20px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(44, 22, 58, 0.05)',
                        backdropFilter: 'blur(5px)'
                      }}
                    >
                      <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px', fontFamily: "'Cinzel', serif" }}>
                        Criado em: {pac.dataCriacao}
                      </div>
                      <div style={{ fontSize: '10px', color: '#A6822B', marginBottom: '8px', fontFamily: "'Cinzel', serif", fontWeight: 600 }}>
                        Última edição: {pac.dataUltimaEdicao || pac.dataCriacao}
                      </div>
                      
                      <h3 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '16px', margin: '0 0 4px 0' }}>
                        📁 {pac.nome}
                      </h3>
                      <div style={{ fontSize: '11px', color: '#665078', fontWeight: 600, marginBottom: '10px' }}>
                        Doc: {pac.documento || 'Não informado'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#555', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0e6fa', paddingTop: '10px', marginTop: '10px' }}>
                        <span>Fichas de Evolução: <strong>{pac.evolucoes?.length || 0}</strong></span>
                        <span style={{ color: '#C8A24A', fontWeight: 700 }}>Abrir Pasta →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DETALHES DA PASTA DO PACIENTE */}
          {telaAtual === 'detalhe_pasta' && pacienteSelecionado && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
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
                  <h2 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '22px', margin: 0 }}>
                    📁 {pacienteSelecionado.nome}
                  </h2>
                  <span style={{ fontSize: '11px', color: '#555', display: 'block', marginTop: '3px' }}>Doc: {pacienteSelecionado.documento || 'Não informado'}</span>
                  <span style={{ fontSize: '11px', color: '#555', display: 'block' }}>Pasta criada em: {pacienteSelecionado.dataCriacao}</span>
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
                    onClick={() => navegarPara('galeria')}
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
                      background:'#C8A24A' ,
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
           
              <div style={{ background: 'rgba(255, 255, 255, 0.92)', padding: '25px', borderRadius: '12px', border: '1px solid #e2d2f5', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', backdropFilter: 'blur(5px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px', flexWrap: 'wrap', gap: '15px' }}>
                  <h3 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '16px', margin: 0 }}>
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
                  <p style={{ color: '#777', fontSize: '13px' }}>Nenhuma ficha de evolução registrada nesta pasta ainda.</p>
                ) : evolucoesFiltradas.length === 0 ? (
                  <p style={{ color: '#777', fontSize: '13px' }}>Nenhuma evolução encontrada para a data "{termoBuscaEvolucao}".</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {evolucoesFiltradas.map((evo) => (
                      <div key={evo.id} style={{ border: '1.5px solid #dfc6fc', borderRadius: '8px', padding: '15px', backgroundColor: 'rgba(250, 246, 253, 0.95)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontSize: '12px', fontWeight: 700 }}>
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
                        <div style={{ fontSize: '12px', color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evo.textoLivre ? evo.textoLivre : (evo.observacoes || evo.procedimentoRealizado || 'Nenhum texto adicional registrado.')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

      {/* ✅ Modal do Termo de Consentimento */}
      {mostrarTermoPDF && pacienteSelecionado && (
        <TermoConsentimentoPDF
          pacienteData={pacienteSelecionado}
          onFechar={() => setMostrarTermoPDF(false)}
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
            <h3 style={{ fontFamily: "'Cinzel', serif", color: '#c62828', fontSize: '18px', marginBottom: '15px' }}>
              ⚠️ Confirmação de Exclusão
            </h3>
            <p style={{ fontSize: '14px', color: '#2c163a', marginBottom: '20px', fontWeight: 500 }}>
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
                  fontSize: '14px',
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
              <span style={{ color: '#c62828', fontSize: '12px', display: 'block', marginBottom: '15px', fontWeight: 600 }}>
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