import React, { useState, useEffect } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { MdSearch } from 'react-icons/md';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import FichaMobile from './FichaMobile';
import FichaEvoMobile from './FichaEvoMobile';

export default function PainelEsteticistaMobile({ onLogout }) {
  const [telaAtual, setTelaAtual] = useState('lista');
  const [termoBusca, setTermoBusca] = useState('');
  const [termoBuscaEvolucao, setTermoBuscaEvolucao] = useState('');
  
  const [pacientes, setPacientes] = useState([]);
  const [carregandoNuvem, setCarregandoNuvem] = useState(true);

  const [pacienteSelecionado, setPacienteSelecionado] = useState(null);
  const [evolucaoSelecionada, setEvolucaoSelecionada] = useState(null);

  // Estados para o Modal de Confirmação de Exclusão com Senha
  const [modalExclusao, setModalExclusao] = useState({
    isOpen: false,
    tipo: null, // 'pasta' ou 'evolucao'
    idAlvo: null,
    titulo: '',
    senhaInput: '',
    mostrarSenhaModal: false,
    erroSenha: ''
  });
  const db = getFirestore();
    const auth = getAuth();
// Adicione esta função auxiliar no topo do componente PainelEsteticista
const agendarLembretesNoOneSignal = async (pacienteId, lembretes) => {
  if (!lembretes || lembretes.length === 0) return;
  
  for (const lembrete of lembretes) {
    if (!lembrete.titulo || !lembrete.valor) continue; // pula lembretes vazios
    
    try {
      const response = await fetch('/.netlify/functions/agendar-notificacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pacienteId, lembrete }),
      });
      
      if (!response.ok) {
        console.error('Falha ao agendar lembrete:', lembrete.titulo);
      } else {
        console.log('✅ Lembrete agendado:', lembrete.titulo);
      }
    } catch (err) {
      console.error('Erro ao agendar lembrete:', err);
    }
  }
};
  // Carregar dados iniciais do Firestore de forma assíncrona alinhado ao UID do usuário logado
  useEffect(() => {
    async function carregarDadosDaNuvem() {
      try {
        setCarregandoNuvem(true);
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (!user) {
          setCarregandoNuvem(false);
          return;
        }

        const querySnapshot = await getDocs(collection(db, `usuarios/${user.uid}/pacientes`));
        const listaPacientes = querySnapshot.docs.map(docSnap => ({
          ...docSnap.data()
        }));
        
        // Ordena por nome alfabeticamente
        const listaOrdenada = listaPacientes.sort((a, b) => 
          (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
        );
        
        setPacientes(listaOrdenada);
      } catch (error) {
        console.error("Erro ao carregar dados do Firestore:", error);
        alert("Erro ao carregar pacientes da nuvem.");
      } finally {
        setCarregandoNuvem(false);
      }
    }

    carregarDadosDaNuvem();
  }, []);

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

      // 4. Criação ou recuperação da conta do paciente no Auth secundário (COM O TRATAMENTO DE RECASTRADO)
      try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailFicticio, senhaFicticia);
        pacienteUid = userCredential.user.uid;
        await signOut(secondaryAuth);
      } catch (authError) {
        if (authError.code === 'auth/email-already-in-use') {
          console.warn("E-mail já existe no Auth. Reutilizando a conta existente...");
          try {
            // Se o e-mail já existe, fazemos login para recuperar o UID exato dele
            const tempCredential = await signInWithEmailAndPassword(secondaryAuth, emailFicticio, senhaFicticia);
            pacienteUid = tempCredential.user.uid;
            await signOut(secondaryAuth);
          } catch (signInErr) {
            // Se a senha mudou ou deu conflito, geramos um ID seguro baseado no documento
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
      
      alert(`Ficha salva e Acesso criado com sucesso!`);
      setTelaAtual('lista');

    } catch (error) {
      console.error("Erro geral ao salvar ficha:", error);
      alert("Erro ao salvar ficha na nuvem.");
    }
  };

    const handleAtualizarAnamnese = async (dadosAtualizados) => {
    const agora = new Date();
    const dataHoraFormatada = agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const novoDoc = extrairDocumento(dadosAtualizados);
    if (dadosAnamnese.lembretes) {
  await agendarLembretesNoOneSignal(pacienteUid, dadosAnamnese.lembretes);
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
    setTelaAtual('detalhe_pasta');
  };

  // Abrir Modal de Exclusão de Pasta
  const solicitarExclusaoPasta = (idPaciente) => {
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

  // Executar Exclusão validando a senha com o Firebase e removendo do Firestore
  const confirmarExclusao = async () => {
    const auth = getAuth();
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
        setTelaAtual('lista');
      } else if (modalExclusao.tipo === 'evolucao') {
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
        setTelaAtual('detalhe_pasta');
      }

      fecharModalExclusao();

    } catch (error) {
      console.error("Erro ao validar senha ou excluir:", error);
      setModalExclusao(prev => ({ 
        ...prev, 
        erroSenha: 'Senha incorreta ou erro na exclusão. Tente novamente.' 
      }));
    }
  };

  const fecharModalExclusao = () => {
    setModalExclusao({
      isOpen: false,
      tipo: null,
      idAlvo: null,
      titulo: '',
      senhaInput: '',
      mostrarSenhaModal: false,
      erroSenha: ''
    });
  };

  const handleSalvarEvolucao = async (dadosEvolucao) => {
    try {
      const auth = getAuth();
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
      setTelaAtual('detalhe_pasta');
    } catch (error) {
      console.error("Erro ao salvar evolução:", error);
      alert("Erro ao salvar evolução na nuvem.");
    }
  };

  const handleAtualizarEvolucao = async (dadosAtualizados) => {
    try {
      const auth = getAuth();
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
      setTelaAtual('detalhe_pasta');
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

  if (carregandoNuvem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#d7cee0', fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '15px', fontWeight: 700 }}>
        Carregando dados da nuvem...
      </div>
    );
  }

  if (telaAtual === 'criar_anamnese') {
    return <FichaMobile onVoltar={() => setTelaAtual('lista')} onSave={handleSalvarAnamnese} />;
  }

  if (telaAtual === 'editar_anamnese' && pacienteSelecionado) {
    return (
      <FichaMobile 
        mode="edit" 
        initialData={pacienteSelecionado.anamnese} 
        onSave={handleAtualizarAnamnese} 
        onVoltar={() => setTelaAtual('detalhe_pasta')} 
      />
    );
  }

  if (telaAtual === 'ver_anamnese' && pacienteSelecionado) {
    return (
      <FichaMobile 
        fichaSelecionada={pacienteSelecionado.anamnese}
        mode="view"
        onVoltar={() => setTelaAtual('detalhe_pasta')}
        onIrParaEdicao={() => setTelaAtual('editar_anamnese')}
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
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '20px 20px 10px 20px',
          gap: '12px',
          borderBottom: '1px solid rgba(226, 210, 245, 0.6)',
          marginBottom: '15px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h1 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '18px', margin: 0, textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}>
              Painel da Esteticista
            </h1>

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
                  cursor: 'pointer'
                }}
              >
                Sair
              </button>
            )}
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
                <button
                  type="button"
                  onClick={() => setTelaAtual('criar_anamnese')}
                  className="btn-efeito-hover"
                  style={{
                    fontFamily: "'Cinzel', serif",
                    background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(200, 162, 74, 0.3)',
                    textAlign: 'center',
                    width: '100%'
                  }}
                >
                  + Novo Paciente
                </button>
              </div>

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
                  <span style={{ color: '#C8A24A', fontSize: '11px', fontWeight: 600 }}>Clique em "+ Novo Paciente" para iniciar a primeira ficha.</span>
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
                        onClick={() => { setPacienteSelecionado(pac); setTelaAtual('detalhe_pasta'); }}
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
                      </div>

                      <div style={{ fontSize: '11px', color: '#555', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0e6fa', paddingTop: '8px', marginTop: '8px' }}>
                        <span 
                          onClick={() => { setPacienteSelecionado(pac); setTelaAtual('detalhe_pasta'); }}
                          style={{ cursor: 'pointer' }}
                        >
                          Fichas de Evolução: <strong>{pac.evolucoes?.length || 0}</strong>
                        </span>
                        
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span 
                            onClick={() => { setPacienteSelecionado(pac); setTelaAtual('detalhe_pasta'); }}
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

          {/* DETALHE DA PASTA */}
          {telaAtual === 'detalhe_pasta' && pacienteSelecionado && (
            <div>
              <div style={{ marginBottom: '15px' }}>
                <button
                  type="button"
                  onClick={() => setTelaAtual('lista')}
                  style={{ background: 'transparent', border: 'none', color: '#2c163a', cursor: 'pointer', fontWeight: 600, fontSize: '11px', padding: 0, marginBottom: '8px' }}
                >
                  ← Voltar para lista de pacientes
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '18px', margin: 0 }}>
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
  onClick={() => setTelaAtual('ver_anamnese')}
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
                  onClick={() => setTelaAtual('criar_evolucao')}
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
                              onClick={() => { setEvolucaoSelecionada(evo); setTelaAtual('ver_evolucao'); }}
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
            </div>
          )}

          {/* VER EVOLUÇÃO MOBILE */}
          {telaAtual === 'ver_evolucao' && evolucaoSelecionada && (
            <div>
              <FichaEvoMobile 
                mode="view" 
                initialData={{
                  ...evolucaoSelecionada,
                  onIrParaEdicao: () => setTelaAtual('editar_evolucao')
                }} 
                onVoltar={() => setTelaAtual('detalhe_pasta')} 
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
                onSave={handleSalvarEvolucao} 
                onVoltar={() => setTelaAtual('detalhe_pasta')} 
              />
            </div>
          )}

          {/* EDITAR EVOLUÇÃO MOBILE */}
          {telaAtual === 'editar_evolucao' && evolucaoSelecionada && (
            <div>
              <FichaEvoMobile 
                mode="edit" 
                initialData={evolucaoSelecionada} 
                onSave={handleAtualizarEvolucao} 
                onVoltar={() => setTelaAtual('detalhe_pasta')} 
              />
            </div>
          )}

        </div>
      </div>

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