import React, { useState, useEffect } from 'react';
import TelaInicial from './TelaInicial';
import TelaInicialMobile from './TelaInicialMobile';
import FichaDesktop from './FichaDesktop';
import FichaMobile from './FichaMobile';
import FichaEvoDesktop from './FichaEvoDesktop';
import FichaEvoMobile from './FichaEvoMobile';
import PainelEsteticista from './PainelEsteticista';
import PainelEsteticistaMobile from './PainelEsteticistaMobile';
import PainelPaciente from './PainelPaciente'; 
import { secondaryAuth } from './firebaseSecondary'; 
import { 
  doc, 
  getDoc, 
  getDocs,       // <-- Adicione isto
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot     // <-- Adicione isto
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut, onAuthStateChanged  } from 'firebase/auth';
import { db, auth } from './firebase';

const EMAILS_ESTETICISTAS = [
  'samira.ferreira@sistema.local',
  'mbtech@sistema.local'
];

export default function AnamneseFicha() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [autenticado, setAutenticado] = useState(false);
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('painel'); 

  // Estado para armazenar os dados exclusivos do paciente logado
  const [dadosPaciente, setDadosPaciente] = useState(null);

  // Estado para armazenar a lista de fichas salvas na nuvem (Visão Esteticista)
  const [fichasSalvas, setFichasSalvas] = useState([]);
  const [carregandoNuvem, setCarregandoNuvem] = useState(false);

  // Ficha selecionada no momento para edição ou visualização
  const [fichaSelecionada, setFichaSelecionada] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user && !autenticado) {
      // Sessão persistente detectada — refaz o fluxo
      await handleLoginSucesso(user);
    } else if (!user && autenticado) {
      // Sessão caiu (ex: logout em outra aba)
      setAutenticado(false);
      setUsuarioLogado(null);
      setDadosPaciente(null);
      setAbaAtiva('telainicial');
    }
  });
  return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  // Sincronização em tempo real das fichas (Somente para a Esteticista)
  useEffect(() => {
    if (autenticado && usuarioLogado && abaAtiva !== 'painelPaciente') {
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
        console.error("Erro ao sincronizar dados da nuvem:", error);
        setCarregandoNuvem(false);
      });

      return () => unsubscribe();
    }
  }, [autenticado, usuarioLogado, abaAtiva]);

  // Função de Pós-Login inteligente
const handleLoginSucesso = async (user) => {
    setUsuarioLogado(user);
    setAutenticado(true);

    const emailUsuario = user.email ? user.email.toLowerCase().trim() : '';
    

    // 1. Se for esteticista, vai direto para o painel administrativo
    if (EMAILS_ESTETICISTAS.includes(emailUsuario) || !emailUsuario.endsWith('@sistema.local')) {
    setAbaAtiva('painel');
      return;
    }

    // 2. Se for paciente, busca pelo mapeamento ou faz query pelo campo de e-mail na subcoleção
    try {
      setCarregandoNuvem(true);
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
      
      // Se não achou pelo mapeamento, faz a varredura nas possíveis UIDs de esteticistas
      if (!pacienteEncontrado) {
        // Incluímos as variações da UID da esteticista para garantir a compatibilidade
        const esteticistasUids = [
          "ZvzIxDhsh7WMZqvG5hcFSOy9I2", 
          "ZvzIxDhsh7WMZqvG5hcFQS0yd9I2",
          "MZ5j3NpjlxY67yLRiEfg13TbPE32"
        ]; 

        for (const estUid of esteticistasUids) {
         
          
          const pacientesRef = collection(db, "usuarios", estUid, "pacientes");
          
          // Busca principal e mais garantida: pelo campo emailAcesso
          let q = query(pacientesRef, where("emailAcesso", "==", emailUsuario));
          let querySnapshot = await getDocs(q);

          // Alternativa por ID de documento caso coincida com o Auth
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
            
            // Auto-cura do mapeamento na raiz para logins futuros instantâneos
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
        setAbaAtiva('painelPaciente');
      } else {
        alert("Sua ficha de paciente não foi encontrada nas pastas do sistema.");
        setAutenticado(false);
        setUsuarioLogado(null);
        setAbaAtiva('telainicial');
      }
    } catch (error) {
      console.error("Erro crítico ao carregar pasta do paciente:", error);
      alert("Erro ao acessar ficha do paciente.");
      setAutenticado(false);
      setUsuarioLogado(null);
      setAbaAtiva('telainicial');
    } finally {
      setCarregandoNuvem(false);
    }
  };
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
const handleSalvarFicha = async (dadosNovaFicha) => {
    try {
      const nomeOriginal = dadosNovaFicha.nome ? dadosNovaFicha.nome.trim() : '';
      let partes = nomeOriginal.split(/\s+/);
      
      let primeiroNome = partes[0] || 'usuario';
      let sobrenome = partes[partes.length - 1] || 'paciente';

      const pNomeLimpo = primeiroNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const sSobrenomeLimpo = sobrenome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const emailFicticio = `${pNomeLimpo}.${sSobrenomeLimpo}@sistema.local`;
      
      const documentoLimpo = dadosNovaFicha.numeroDocumento ? dadosNovaFicha.numeroDocumento.replace(/\D/g, '') : '123456';
      const senhaFicticia = documentoLimpo.slice(-6).padEnd(6, '0');

      let pacienteUid = dadosNovaFicha.id ? String(dadosNovaFicha.id) : String(Date.now());

      if (senhaFicticia.length >= 6) {
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailFicticio, senhaFicticia);
          pacienteUid = userCredential.user.uid;
          await signOut(secondaryAuth);
        } catch (authError) {
          if (authError.code !== 'auth/email-already-in-use') {
            console.error("Erro ao criar usuário no Auth:", authError);
          }
        }
      }

      const fichaParaSalvar = { 
        ...dadosNovaFicha, 
        id: pacienteUid,
        emailAcesso: emailFicticio, 
        criadoPorUid: usuarioLogado.uid
      };

      // 1. Salva a ficha na subcoleção do profissional
      const docRef = doc(db, `usuarios/${usuarioLogado.uid}/pacientes`, pacienteUid);
      await setDoc(docRef, fichaParaSalvar, { merge: true });

      // 2. Salva o mapeamento direto na coleção raiz para busca rápida via getDoc
      const mapRef = doc(db, "mapeamento_emails", emailFicticio);
      await setDoc(mapRef, {
        profissionalUid: usuarioLogado.uid,
        pacienteId: pacienteUid,
        atualizadoEm: new Date()
      }, { merge: true });
      

      alert('Ficha salva e acesso do paciente gerado com sucesso!');
      setFichaSelecionada(null);
      setAbaAtiva('painel');
    } catch (error) {
      console.error("Erro ao salvar ficha:", error);
      alert('Erro ao salvar na nuvem.');
    }
  };

  const handleExcluirFicha = async (idFicha) => {
    if (window.confirm("Deseja realmente excluir esta pasta/ficha?")) {
      try {
        const docRef = doc(db, `usuarios/${usuarioLogado.uid}/pacientes`, String(idFicha));
        await deleteDoc(docRef);
        alert('Excluído com sucesso!');
        setFichaSelecionada(null);
        setAbaAtiva('painel');
      } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir da nuvem.");
      }
    }
  };

  // 1. TELA DE LOGIN / TELA INICIAL
  if (!autenticado || abaAtiva === 'telainicial') {
    return (
      <div style={{ position: 'relative', width: '100vw', height: '100vh', boxSizing: 'border-box' }}>
        {autenticado && (
          <button
            type="button"
            onClick={() => setAbaAtiva(EMAILS_ESTETICISTAS.includes(usuarioLogado?.email) ? 'painel' : 'painelPaciente')}
            style={{
              position: 'absolute', top: '20px', left: '20px', zIndex: 30,
              fontFamily: "'Cinzel', serif", background: '#2c163a', color: '#C8A24A',
              border: '1.5px solid #C8A24A', padding: '8px 16px', borderRadius: '20px',
              fontSize: '11px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
            }}
          >
            ← Voltar ao Painel
          </button>
        )}

        {isMobile ? (
          <TelaInicialMobile onLoginSucesso={handleLoginSucesso} />
        ) : (
          <TelaInicial onLoginSucesso={handleLoginSucesso} />
        )}
      </div>
    );
  }

  if (carregandoNuvem && fichasSalvas.length === 0 && abaAtiva !== 'painelPaciente') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#dfc6fc', fontFamily: "'Cinzel', serif", color: '#4a2e7a', fontSize: '16px', fontWeight: 700 }}>
        Carregando dados da nuvem...
      </div>
    );
  }

  // 2. PAINEL EXCLUSIVO DO PACIENTE
 <PainelPaciente 
  pacienteData={dadosPaciente}
  onLogout={async () => {
    try {
      await signOut(auth);  // ⬅️ destrói a sessão no Firebase
    } catch (e) {
      console.error('Erro ao sair:', e);
    }
    setAutenticado(false);
    setUsuarioLogado(null);
    setDadosPaciente(null);
    setAbaAtiva('telainicial');
  }}
/>
  // 3. PAINEL DA ESTETICISTA
  if (abaAtiva === 'painel') {
    return isMobile ? (
      <PainelEsteticistaMobile 
        fichas={fichasSalvas}
        onSelectFicha={(ficha) => { setFichaSelecionada(ficha); setAbaAtiva('anamnese'); }}
        onSelectEvolucao={(ficha) => { setFichaSelecionada(ficha); setAbaAtiva('evolucao'); }}
        onExcluirFicha={handleExcluirFicha}
        onLogout={() => { setAutenticado(false); setUsuarioLogado(null); }} 
      />
    ) : (
      <PainelEsteticista 
        fichas={fichasSalvas}
        onSelectFicha={(ficha) => { setFichaSelecionada(ficha); setAbaAtiva('anamnese'); }}
        onSelectEvolucao={(ficha) => { setFichaSelecionada(ficha); setAbaAtiva('evolucao'); }}
        onExcluirFicha={handleExcluirFicha}
        onLogout={() => { setAutenticado(false); setUsuarioLogado(null); }} 
      />
    );
  }

  // 4. MODO VISUALIZAÇÃO/EDIÇÃO DA ANAMNESE E EVOLUÇÃO
  if (abaAtiva === 'anamnese') {
    return isMobile ? (
      <FichaMobile key={`anamnese-view-${abaAtiva}`} fichaSelecionada={fichaSelecionada} mode="view" onVoltar={() => { setFichaSelecionada(null); setAbaAtiva('painel'); }} onIrParaEdicao={() => setAbaAtiva('editar-anamnese')} />
    ) : (
      <FichaDesktop key={`anamnese-view-${abaAtiva}`} fichaSelecionada={fichaSelecionada} mode="view" onVoltar={() => { setFichaSelecionada(null); setAbaAtiva('painel'); }} onIrParaEdicao={() => setAbaAtiva('editar-anamnese')} />
    );
  }

  if (abaAtiva === 'editar-anamnese') {
    return isMobile ? (
      <FichaMobile key={`anamnese-edit-${abaAtiva}`} fichaSelecionada={fichaSelecionada} mode="edit" onVoltar={() => setAbaAtiva('anamnese')} onSave={handleSalvarFicha} />
    ) : (
      <FichaDesktop key={`anamnese-edit-${abaAtiva}`} fichaSelecionada={fichaSelecionada} mode="edit" onVoltar={() => setAbaAtiva('anamnese')} onSave={handleSalvarFicha} />
    );
  }

  if (abaAtiva === 'evolucao') {
    return isMobile ? (
      <FichaEvoMobile key={`evolucao-view-${abaAtiva}`} initialData={fichaSelecionada} pacienteSelecionado={fichaSelecionada} mode="view" onVoltar={() => { setFichaSelecionada(null); setAbaAtiva('painel'); }} onIrParaEdicao={() => setAbaAtiva('editar-evolucao')} />
    ) : (
      <FichaEvoDesktop key={`evolucao-view-${abaAtiva}`} initialData={fichaSelecionada} pacienteSelecionado={fichaSelecionada} mode="view" onVoltar={() => { setFichaSelecionada(null); setAbaAtiva('painel'); }} onIrParaEdicao={() => setAbaAtiva('editar-evolucao')} />
    );
  }

  if (abaAtiva === 'editar-evolucao') {
    return isMobile ? (
      <FichaEvoMobile key={`evolucao-edit-${abaAtiva}`} initialData={fichaSelecionada} pacienteSelecionado={fichaSelecionada} mode="edit" onVoltar={() => setAbaAtiva('evolucao')} onSave={handleSalvarFicha} />
    ) : (
      <FichaEvoDesktop key={`evolucao-edit-${abaAtiva}`} initialData={fichaSelecionada} pacienteSelecionado={fichaSelecionada} mode="edit" onVoltar={() => setAbaAtiva('evolucao')} onSave={handleSalvarFicha} />
    );
  }

  return null;
}