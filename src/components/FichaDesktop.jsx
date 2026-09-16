import React, { useState, useEffect, useRef } from 'react';
import { exportarParaPDF } from '../utils/gerarPdf';
import { 
  MdFace, 
  MdLocalDrink, 
  MdLocalBar, 
  MdWbSunny, 
  MdHotel, 
  MdFitnessCenter, 
  MdAccessibleForward, 
  MdSpa, 
  MdMedication, 
  MdNoFood, 
  MdRestaurant, 
  MdWarning, 
  MdDelete, 
  MdAdd, 
  MdSave, 
  MdArrowBack, 
  MdDownload,
  MdEdit, 
  MdFavorite, 
  MdStar, 
  MdLocalFlorist, 
  MdBrightnessHigh, 
  MdCleaningServices, 
  MdCheckCircle,
  MdKeyboardArrowDown,
  MdBrightness2,
  MdLocalDining,
  MdSelfImprovement,
  MdTimer,
  MdLocalPharmacy,
  MdEco
} from 'react-icons/md';

export default function AnamneseFicha({ onVoltar, onSave, fichaSelecionada, mode = 'edit', onIrParaEdicao, onSalvarSucesso }) {
  const [salvando, setSalvando] = useState(false);
const [salvoSucesso, setSalvoSucesso] = useState(false);
  const [nome, setNome] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [dataNasc, setDataNasc] = useState('');
  const [dataRealizacao, setDataRealizacao] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [respostasRadio, setRespostasRadio] = useState({});
  const [habitosTextos, setHabitosTextos] = useState({});
  const [checkboxesAlt, setCheckboxesAlt] = useState({});

  // Estados para modo de edição das seções customizáveis
  const [editandoHabitos, setEditandoHabitos] = useState(false);
  const [editandoSimNao, setEditandoSimNao] = useState(false);
  const [editandoPele, setEditandoPele] = useState(false);
  const [editandoAltCutaneas, setEditandoAltCutaneas] = useState(false);

  // Estados para gerenciar a adição de novas opções dentro de uma categoria de pele específica
  const [novoValorOpcaoPele, setNovoValorOpcaoPele] = useState({});

  // Estados para controlar os dropdowns customizados de ícones
  const [dropdownAbertoIndex, setDropdownAbertoIndex] = useState(null);
  const [dropdownNovoAberto, setDropdownNovoAberto] = useState(false);

  // Referência para gerenciar o foco dos inputs de hábitos com a tecla Enter e altura do textarea de obs
  const habitosInputsRef = useRef([]);
  const observacoesRef = useRef(null);

 const [lembretes, setLembretes] = useState([
  { titulo: '', tipo: 'intervalo', valor: '', intervaloNumero: '8', intervaloUnidade: 'horas' }
]);

  // Catálogo expandido com mais opções de ícones vetoriais em roxo (#9333ea)
  const iconesDisponiveis = [
    { componente: MdFace, id: 'MdFace' },
    { componente: MdLocalDrink, id: 'MdLocalDrink' },
    { componente: MdLocalBar, id: 'MdLocalBar' },
    { componente: MdWbSunny, id: 'MdWbSunny' },
    { componente: MdHotel, id: 'MdHotel' },
    { componente: MdFitnessCenter, id: 'MdFitnessCenter' },
    { componente: MdAccessibleForward, id: 'MdAccessibleForward' },
    { componente: MdSpa, id: 'MdSpa' },
    { componente: MdMedication, id: 'MdMedication' },
    { componente: MdNoFood, id: 'MdNoFood' },
    { componente: MdRestaurant, id: 'MdRestaurant' },
    { componente: MdWarning, id: 'MdWarning' },
    { componente: MdFavorite, id: 'MdFavorite' },
    { componente: MdStar, id: 'MdStar' },
    { componente: MdLocalFlorist, id: 'MdLocalFlorist' },
    { componente: MdBrightnessHigh, id: 'MdBrightnessHigh' },
    { componente: MdCleaningServices, id: 'MdCleaningServices' },
    { componente: MdCheckCircle, id: 'MdCheckCircle' },
    { componente: MdBrightness2, id: 'MdBrightness2' },
    { componente: MdLocalDining, id: 'MdLocalDining' },
    { componente: MdSelfImprovement, id: 'MdSelfImprovement' },
    { componente: MdTimer, id: 'MdTimer' },
    { componente: MdLocalPharmacy, id: 'MdLocalPharmacy' },
    { componente: MdEco, id: 'MdEco' }
  ];

  // Perguntas de Sim e Não (customizáveis)
  const [perguntasSimNao, setPerguntasSimNao] = useState([
    { label: "Utiliza lentes de contato?", name: "lentes_contato" },
    { label: "Tem epilepsia/convulsões?", name: "epilepsia" },
    { label: "Tem intestino regulado?", name: "intestino_regulado" },
    { label: "Tem alterações cardíacas?", name: "alteracoes_cardiacas" },
    { label: "Tem marcapasso?", name: "marcapasso" },
    { label: "É tabagista?", name: "tabagista" },
    { label: "Está gestante?", name: "gestante" }
  ]);
  const [novaSimNaoTexto, setNovaSimNaoTexto] = useState('');

  const [habitosComIcones, setHabitosComIcones] = useState([
    { pergunta: "Tem tratamento facial anterior?", icone: MdFace, iconeId: 'MdFace', name: "tratamento_facial" },
    { pergunta: "Toma água com frequência?", icone: MdLocalDrink, iconeId: 'MdLocalDrink', name: "toma_agua" },
    { pergunta: "Ingere bebidas alcoólicas?", icone: MdLocalBar, iconeId: 'MdLocalBar', name: "bebidas_alcoolicas" },
    { pergunta: "Se expõe ao sol com muita frequência? Utiliza filtro solar?", icone: MdWbSunny, iconeId: 'MdWbSunny', name: "exposicao_sol" },
    { pergunta: "Tem boa qualidade de sono?", icone: MdHotel, iconeId: 'MdHotel', name: "qualidade_sono" },
    { pergunta: "Pratica atividade física?", icone: MdFitnessCenter, iconeId: 'MdFitnessCenter', name: "atividade_fisica" },
    { pergunta: "Possui prótese corporal/facial?", icone: MdAccessibleForward, iconeId: 'MdAccessibleForward', name: "protese" },
    { pergunta: "Utiliza cremes ou loções faciais?", icone: MdSpa, iconeId: 'MdSpa', name: "cremes_faciais" },
    { pergunta: "Utiliza algum medicamento?", icone: MdMedication, iconeId: 'MdMedication', name: "medicamento" },
    { pergunta: "Possui algum tipo de alergia?", icone: MdNoFood, iconeId: 'MdNoFood', name: "alergia" },
    { pergunta: "Possui uma boa alimentação?", icone: MdRestaurant, iconeId: 'MdRestaurant', name: "alimentacao" },
    { pergunta: "Tem problemas de pele?", icone: MdWarning, iconeId: 'MdWarning', name: "problemas_pele" }
  ]);

  const [novaPerguntaTexto, setNovaPerguntaTexto] = useState('');
  const [novoIconeSelecionado, setNovoIconeSelecionado] = useState(iconesDisponiveis[8]);

  // Avaliação de Pele
  const [secoesPele, setSecoesPele] = useState([
    {
      titulo: "Oleosidade",
      nameGrupo: "oleosidade",
      opcoes: [
        { label: "Alípica", value: "alipica" },
        { label: "Lipídica", value: "lipidica" },
        { label: "Normal", value: "normal" },
        { label: "Seborreica", value: "seborreica" }
      ]
    },
    {
      titulo: "Espessura da pele",
      nameGrupo: "espessura",
      opcoes: [
        { label: "Espessa", value: "espessa" },
        { label: "Fina", value: "fina" },
        { label: "Muito fina", value: "muito_fina" }
      ]
    },
    {
      titulo: "Fototipo",
      nameGrupo: "fototipo",
      opcoes: [
        { label: "I", value: "I" },
        { label: "II", value: "II" },
        { label: "III", value: "III" },
        { label: "IV", value: "IV" },
        { label: "V", value: "V" },
        { label: "VI", value: "VI" }
      ]
    },
    {
      titulo: "Hidratação",
      nameGrupo: "hidratacao",
      opcoes: [
        { label: "Desidratada", value: "desidratada" },
        { label: "Normal", value: "normal" }
      ]
    },
    {
      titulo: "Acne grau",
      nameGrupo: "acne_grau",
      opcoes: [
        { label: "I", value: "I" },
        { label: "II", value: "II" },
        { label: "III", value: "III" },
        { label: "IV", value: "IV" }
      ]
    }
  ]);
  const [novoTituloPele, setNovoTituloPele] = useState('');

  // Alterações Cutâneas
  const [alteracoesCutaneas, setAlteracoesCutaneas] = useState([
    { label: "Milium", name: "alt_milium" },
    { label: "Foliculite", name: "alt_foliculite" },
    { label: "Hipertricose", name: "alt_hipertricose" },
    { label: "Papilona", name: "alt_papilona" },
    { label: "Nódulos", name: "alt_nodulos" },
    { label: "Comedão", name: "alt_comedao" },
    { label: "Queratose", name: "alt_queratose" },
    { label: "Ptose", name: "alt_ptose" },
    { label: "Efélides", name: "alt_efelides" },
    { label: "Vibices", name: "alt_vibices" },
    { label: "Pápula", name: "alt_papula" },
    { label: "Cicatriz", name: "alt_cicatriz" },
    { label: "Rugas", name: "alt_rugas" },
    { label: "Bolhas", name: "alt_bolhas" },
    { label: "Telangiectasia", name: "alt_telangiectasia" },
    { label: "Pústula", name: "alt_pustula" },
    { label: "Atrofia", name: "alt_atrofia" },
    { label: "Acromia", name: "alt_acromia" },
    { label: "Abceessos", name: "alt_abceessos" },
    { label: "Hipocromia", name: "alt_hipocromia" },
    { label: "Cisto", name: "alt_cisto" },
    { label: "Xantelasma", name: "alt_xantelasma" },
    { label: "Hipercromia", name: "alt_hipercromia" },
    { label: "Hirsutismo", name: "alt_hirsutismo" }
  ]);
  const [novaAltCutaneaTexto, setNovaAltCutaneaTexto] = useState('');

  // Função para ajustar automaticamente a altura do textarea de observações sem scroll interno
  const ajustarAlturaTextarea = () => {
    const textarea = observacoesRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(300, textarea.scrollHeight)}px`;
    }
  };

  // Efeito para reajustar a altura sempre que o texto de observações mudar
  useEffect(() => {
    ajustarAlturaTextarea();
  }, [observacoes]);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-icone-container')) {
        setDropdownAbertoIndex(null);
        setDropdownNovoAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (fichaSelecionada) {
      setNome(fichaSelecionada.nome || '');
      setNumeroDocumento(fichaSelecionada.numeroDocumento || '');
      setTelefone(fichaSelecionada.telefone || '');
      setEndereco(fichaSelecionada.endereco || '');
      setDataNasc(fichaSelecionada.dataNascimento || '');
      setDataRealizacao(fichaSelecionada.dataRealizacao || '');
      setObservacoes(fichaSelecionada.observacoes || '');
      setRespostasRadio(fichaSelecionada.respostasRadio || {});
      setHabitosTextos(fichaSelecionada.habitosTextos || {});
      setCheckboxesAlt(fichaSelecionada.checkboxesAlt || {});
      
      if (fichaSelecionada.perguntasSimNao && fichaSelecionada.perguntasSimNao.length > 0) {
        setPerguntasSimNao(fichaSelecionada.perguntasSimNao);
      }
      if (fichaSelecionada.secoesPele && fichaSelecionada.secoesPele.length > 0) {
        setSecoesPele(fichaSelecionada.secoesPele);
      }
      if (fichaSelecionada.alteracoesCutaneas && fichaSelecionada.alteracoesCutaneas.length > 0) {
        setAlteracoesCutaneas(fichaSelecionada.alteracoesCutaneas);
      }
      if (fichaSelecionada.habitosComIcones && fichaSelecionada.habitosComIcones.length > 0) {
        const habitosMapeados = fichaSelecionada.habitosComIcones.map(h => {
          let iconeObj = iconesDisponiveis[0];
          const idBusca = h.iconeId || h.iconeNome;
          if (idBusca) {
            const encontrado = iconesDisponiveis.find(i => i.id === idBusca || i.componente.name === idBusca);
            if (encontrado) iconeObj = encontrado;
          }
          return { 
            ...h, 
            icone: iconeObj.componente, 
            iconeId: iconeObj.id 
          };
        });
        setHabitosComIcones(habitosMapeados);
      }
      if (Array.isArray(fichaSelecionada.lembretes)) {
  setLembretes(fichaSelecionada.lembretes);
}

    }
  }, [fichaSelecionada]);

  const handleRadioChange = (name, value) => {
    if (mode === 'view') return;
    setRespostasRadio(prev => ({ ...prev, [name]: value }));
  };

  const handleHabitoTextoChange = (name, value) => {
    if (mode === 'view') return;
    setHabitosTextos(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name, checked) => {
    if (mode === 'view') return;
    setCheckboxesAlt(prev => ({ ...prev, [name]: checked }));
  };

  const adicionarSimNao = () => {
    if (mode === 'view') return;
    if (!novaSimNaoTexto.trim()) return;
    const novoName = `sn_custom_${Date.now()}`;
    setPerguntasSimNao([...perguntasSimNao, { label: novaSimNaoTexto.trim(), name: novoName }]);
    setNovaSimNaoTexto('');
  };

  const removerSimNao = (index) => {
    if (mode === 'view') return;
    setPerguntasSimNao(perguntasSimNao.filter((_, i) => i !== index));
  };

  const moverSimNao = (index, direcao) => {
    if (mode === 'view') return;
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= perguntasSimNao.length) return;
    const novaLista = [...perguntasSimNao];
    const temp = novaLista[index];
    novaLista[index] = novaLista[novoIndex];
    novaLista[novoIndex] = temp;
    setPerguntasSimNao(novaLista);
  };

  const atualizarTextoSimNao = (index, novoTexto) => {
    if (mode === 'view') return;
    const novaLista = [...perguntasSimNao];
    novaLista[index].label = novoTexto;
    setPerguntasSimNao(novaLista);
  };

  const handleHabitoKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const proximoInput = habitosInputsRef.current[index + 1];
      if (proximoInput) {
        proximoInput.focus();
      }
    }
  };

  const adicionarHabitoPersonalizado = () => {
    if (mode === 'view') return;
    if (!novaPerguntaTexto.trim()) return;
    const novoName = `habito_custom_${Date.now()}`;
    
    setHabitosComIcones([
      ...habitosComIcones,
      { 
        pergunta: novaPerguntaTexto.trim(), 
        icone: novoIconeSelecionado.componente, 
        iconeId: novoIconeSelecionado.id,
        name: novoName 
      }
    ]);
    setNovaPerguntaTexto('');
  };

  const removerHabitoCustomizado = (index) => {
    if (mode === 'view') return;
    const novos = habitosComIcones.filter((_, i) => i !== index);
    setHabitosComIcones(novos);
  };

  const atualizarTextoHabito = (index, novaPergunta) => {
    if (mode === 'view') return;
    const novos = [...habitosComIcones];
    novos[index].pergunta = novaPergunta;
    setHabitosComIcones(novos);
  };

  const atualizarIconeHabito = (index, novoObjIcone) => {
    if (mode === 'view') return;
    const novos = [...habitosComIcones];
    novos[index].icone = novoObjIcone.componente;
    novos[index].iconeId = novoObjIcone.id;
    setHabitosComIcones(novos);
    setDropdownAbertoIndex(null);
  };

  const adicionarSecaoPele = () => {
    if (mode === 'view') return;
    if (!novoTituloPele.trim()) return;
    const nameGrupo = `pele_custom_${Date.now()}`;
    setSecoesPele([
      ...secoesPele,
      {
        titulo: novoTituloPele.trim(),
        nameGrupo,
        opcoes: [
          { label: "Normal", value: "normal" }
        ]
      }
    ]);
    setNovoTituloPele('');
  };

  const removerSecaoPele = (index) => {
    if (mode === 'view') return;
    setSecoesPele(secoesPele.filter((_, i) => i !== index));
  };

  const atualizarTituloPele = (index, novoTitulo) => {
    if (mode === 'view') return;
    const novas = [...secoesPele];
    novas[index].titulo = novoTitulo;
    setSecoesPele(novas);
  };

  const adicionarOpcaoPele = (secaoIndex) => {
    if (mode === 'view') return;
    const textoOpcao = (novoValorOpcaoPele[secaoIndex] || '').trim();
    if (!textoOpcao) return;
    
    const valorOpt = textoOpcao.toLowerCase().replace(/\s+/g, '_');
    const novas = [...secoesPele];
    
    if (novas[secaoIndex].opcoes.some(o => o.value === valorOpt || o.label.toLowerCase() === textoOpcao.toLowerCase())) {
      return;
    }

    novas[secaoIndex].opcoes.push({ label: textoOpcao, value: valorOpt });
    setSecoesPele(novas);
    setNovoValorOpcaoPele(prev => ({ ...prev, [secaoIndex]: '' }));
  };

  const removerOpcaoPele = (secaoIndex, optIndex) => {
    if (mode === 'view') return;
    const novas = [...secoesPele];
    novas[secaoIndex].opcoes = novas[secaoIndex].opcoes.filter((_, i) => i !== optIndex);
    setSecoesPele(novas);
  };

  const adicionarAltCutanea = () => {
    if (mode === 'view') return;
    if (!novaAltCutaneaTexto.trim()) return;
    const novoName = `alt_custom_${Date.now()}`;
    setAlteracoesCutaneas([...alteracoesCutaneas, { label: novaAltCutaneaTexto.trim(), name: novoName }]);
    setNovaAltCutaneaTexto('');
  };

  const removerAltCutanea = (index) => {
    if (mode === 'view') return;
    setAlteracoesCutaneas(alteracoesCutaneas.filter((_, i) => i !== index));
  };

  const atualizarAltCutaneaTexto = (index, novoTexto) => {
    if (mode === 'view') return;
    const novas = [...alteracoesCutaneas];
    novas[index].label = novoTexto;
    setAlteracoesCutaneas(novas);
  };

  const adicionarLembrete = () => {
  if (mode === 'view') return;
  setLembretes([...lembretes, { 
    titulo: '', 
    tipo: 'intervalo', 
    valor: '', 
    intervaloNumero: '8', 
    intervaloUnidade: 'horas' 
  }]);
};
  const removerLembrete = (index) => {
    if (mode === 'view') return;
    const novosLembretes = lembretes.filter((_, i) => i !== index);
    setLembretes(novosLembretes);
  };

  const atualizarLembrete = (index, campo, valor) => {
    if (mode === 'view') return;
    const novosLembretes = [...lembretes];
    novosLembretes[index][campo] = valor;
    setLembretes(novosLembretes);
  };
// ✅ Converte "2026-09-16T12:55" → "16/09/2026 12:55"
const formatarDataHoraBR = (valorISO) => {
  if (!valorISO) return '';
  // Se já está no formato BR (com /), retorna como está
  if (valorISO.includes('/')) return valorISO;
  
  try {
    const [data, hora] = valorISO.split('T');
    if (!data) return valorISO;
    const [ano, mes, dia] = data.split('-');
    const horaFinal = hora ? hora.slice(0, 5) : '';
    return `${dia}/${mes}/${ano}${horaFinal ? ' ' + horaFinal : ''}`;
  } catch (e) {
    return valorISO;
  }
};

// ✅ Converte "16/09/2026 12:55" → "2026-09-16T12:55"
const converterBRParaISO = (valorBR) => {
  if (!valorBR) return '';
  // Se já está em ISO, retorna como está
  if (valorBR.includes('-') && valorBR.includes('T')) return valorBR;
  
  try {
    const [data, hora] = valorBR.split(' ');
    if (!data) return valorBR;
    const [dia, mes, ano] = data.split('/');
    const horaFinal = hora || '00:00';
    return `${ano}-${mes}-${dia}T${horaFinal}`;
  } catch (e) {
    return valorBR;
  }
};
  const mascaraData = (valor) => {
    let v = valor.replace(/\D/g, '');
    if (v.length > 8) v = v.substring(0, 8);
    if (v.length > 4) {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}/${v.substring(4)}`;
    } else if (v.length > 2) {
      return `${v.substring(0, 2)}/${v.substring(2)}`;
    }
    return v;
  };

 const salvarFicha = async () => {
    if (mode === 'view' || salvando || salvoSucesso) return;
    if (!nome.trim()) {
      alert('Por favor, preencha o nome do paciente.');
      return;
    }

    const agora = new Date();
    const dataModificacao = agora.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const habitosParaSalvar = habitosComIcones.map(h => ({
      pergunta: h.pergunta,
      name: h.name,
      iconeId: h.iconeId || 'MdSpa'
    }));

    const dadosAnamnese = {
      id: fichaSelecionada ? fichaSelecionada.id : Date.now(),
      titulo: fichaSelecionada ? fichaSelecionada.titulo : `Ficha de Anamnese - ${dataModificacao}`,
      dataModificacao,
      nome: nome.trim(),
      numeroDocumento: numeroDocumento.trim(),
      telefone: telefone.trim(),
      endereco: endereco.trim(),
      dataNascimento: dataNasc,
      dataRealizacao: dataRealizacao,
      respostasRadio,
      habitosTextos,
      checkboxesAlt,
      perguntasSimNao,
      secoesPele,
      alteracoesCutaneas,
      habitosComIcones: habitosParaSalvar,
      observacoes,
      lembretes
    };

    setSalvando(true);
    try {
      if (onSave) {
        await onSave(dadosAnamnese);
      }
      setSalvando(false);
      setSalvoSucesso(true);

      setTimeout(() => {
        setSalvoSucesso(false);
        const destino = onSalvarSucesso || onVoltar;
        if (destino) destino();
      }, 1400);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setSalvando(false);
      alert('Erro ao salvar ficha. Tente novamente.');
    }
  };

 
  const voltarFicha = () => {
    if (onVoltar) {
      onVoltar();
    } else {
      window.history.back();
    }
  };

  return (
    <div style={{
      backgroundColor: '#dfc6fc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      minHeight: '100vh',
      margin: 0,
      padding: '20px 10px',
      fontFamily: "'Montserrat', sans-serif",
      boxSizing: 'border-box',
      overflowX: 'hidden',
      position: 'relative'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600&display=swap');

        .input-line {
          width: 100%;
          border: none;
          background: transparent;
          border-bottom: 1px solid #C8A24A;
          outline: none;
          height: 18px;
          font-size: 13px;
        }
        .habit-input-line {
          flex-grow: 1;
          border: none;
          background: transparent;
          border-bottom: 1px solid #000000;
          height: 17px;
          outline: none;
          font-size: 12.5px;
          color: #000000;
        }

        .modulo-bloco {
          background: rgba(255, 255, 255, 0.45);
          border: 1.5px solid #a855f7;
          border-radius: 8px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.03);
          box-sizing: border-box;
          width: 100%;
        }

        .btn-salvar-ficha,
        .btn-voltar-ficha,
        .btn-baixar-pdf,
        .btn-editar-ficha {
          font-family: 'Cinzel', serif;
          background: linear-gradient(135deg, #C8A24A 0%, #e2be64 100%);
          color: #ffffff;
          border: 1.5px solid #9c7826;
          padding: 12px 32px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 1.5px;
          border-radius: 30px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 15px rgba(200, 162, 74, 0.4);
          transition: all 0.3s ease;
          outline: none;
        }

        .btn-salvar-ficha:hover,
        .btn-voltar-ficha:hover,
        .btn-editar-ficha:hover {
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 6px 22px rgba(200, 162, 74, 0.6);
          background: linear-gradient(135deg, #d8b052 0%, #eccb74 100%);
        }

        .btn-baixar-pdf {
          font-family: 'Cinzel', serif;
          background: linear-gradient(135deg, #4a2e7a 0%, #6d42a8 100%);
          color: #e2be64;
          border: 1.5px solid #C8A24A;
          padding: 12px 32px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 1.5px;
          border-radius: 30px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 15px rgba(109, 66, 168, 0.4);
          transition: all 0.3s ease;
          outline: none;
          width: 100%;
          max-width: 340px;
          justify-content: center;
        } 

        .btn-baixar-pdf:hover {
          background: linear-gradient(135deg, #381d4a 0%, #593175 100%);
          box-shadow: 0 6px 22px rgba(44, 22, 58, 0.6);
        }

        .btn-toggle-edicao-habitos,
        .btn-toggle-edicao-simnao,
        .btn-toggle-edicao-pele,
        .btn-toggle-edicao-alt {
          background: transparent;
          border: 1.5px solid #a855f7;
          color: #a855f7;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        .btn-toggle-edicao-habitos:hover,
        .btn-toggle-edicao-simnao:hover,
        .btn-toggle-edicao-pele:hover,
        .btn-toggle-edicao-alt:hover {
          background: #a855f7;
          color: #ffffff;
        }

        /* Regras para ocultar os botões de ação durante a exportação do PDF */
        body.sendo-exportado .botoes-acao-container {
          display: none !important;
        }

        /* Regras de alternância visual para o Módulo 6 (Observações) no PDF */
        body.sendo-exportado .textarea-edicao-original {
          display: none !important;
        }

        body:not(.sendo-exportado) .div-visualizacao-pdf {
          display: none !important;
        }

        .div-visualizacao-pdf {
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: break-word;
          padding: 8px 10px;
          font-size: 12px;
          font-family: 'Montserrat', sans-serif;
          color: #2D2D2D;
          min-height: 100px;
          border: 1.5px solid rgba(200, 162, 74, 0.5);
          border-radius: 4px;
          background: transparent;
          width: 100%;
          box-sizing: border-box;
        }

        /* Regras de alternância visual para os Hábitos no PDF */
        body.sendo-exportado .habit-input-line {
          display: none !important;
        }

        body:not(.sendo-exportado) .habit-div-pdf {
          display: none !important;
        }

        .habit-div-pdf {
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: break-word;
          font-size: 12.5px;
          font-family: 'Montserrat', sans-serif;
          color: #000000;
          border-bottom: 1px solid #000000;
          min-height: 17px;
          width: 100%;
        }

        /* Regras de alternância visual para os Lembretes no PDF */
        body.sendo-exportado .lembrete-input-original {
          display: none !important;
        }

        body:not(.sendo-exportado) .lembrete-div-pdf {
          display: none !important;
        }

        .lembrete-div-pdf {
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: break-word;
          font-size: 12.5px;
          font-family: 'Montserrat', sans-serif;
          color: #000000;
          border-bottom: 1px solid #000000;
          min-height: 17px;
          width: 100%;
        }
      `}</style>

      <div 
        id="ficha-container"
        style={{
          width: '100%',
          maxWidth: '1175px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          zIndex: 1,
          backgroundColor: '#ffffff'
        }}
      >
        {/* 1. TOPO DA MOLDURA COM DADOS PESSOAIS */}
        <div style={{
          width: '100%',
          height: '420px',
          backgroundImage: 'url("/imagens/moldura-topo.jpeg")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center bottom',
          backgroundSize: '100% 100%',
          flexShrink: 0,
          marginBottom: '-130px',
          zIndex: 3,
          position: 'relative',
          boxSizing: 'border-box',
          padding: '330px 95px 0 95px',
          pointerEvents: 'auto'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px', minWidth: '220px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>Nome:</span>
                <div style={{ flexGrow: 1, minWidth: 0, display: 'flex' }}>
                  <input 
                    type="text" 
                    id="nome_cliente" 
                    name="nome_cliente" 
                    autoComplete="name" 
                    className="input-line" 
                    value={nome}
                    readOnly={mode === 'view'}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
              </div>
              
              <div style={{ width: '250px', flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>DATA DE NASC.:</span>
                <div style={{ width: '100px', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    id="data_nascimento"
                    name="data_nascimento"
                    autoComplete="bday-day"
                    value={dataNasc}
                    readOnly={mode === 'view'}
                    onChange={(e) => setDataNasc(mascaraData(e.target.value))}
                    className="input-line"
                    style={{ paddingRight: mode === 'view' ? '0px' : '22px' }}
                  />
                  {mode !== 'view' && (
                    <>
                      <input 
                        type="date"
                        id="data_nascimento_picker"
                        name="data_nascimento_picker"
                        aria-label="Selecionar data de nascimento"
                        onChange={(e) => {
                          if (e.target.value) {
                            const [ano, mes, dia] = e.target.value.split('-');
                            setDataNasc(`${dia}/${mes}/${ano}`);
                          }
                        }}
                        style={{
                          position: 'absolute',
                          right: 0,
                          width: '18px',
                          height: '18px',
                          opacity: 0,
                          cursor: 'pointer',
                          zIndex: 3
                        }}
                      />
                      <svg 
                        style={{ position: 'absolute', right: 0, pointerEvents: 'none', zIndex: 2 }} 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="#C8A24A" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px', minWidth: '220px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>Telefone:</span>
                <div style={{ flexGrow: 1, minWidth: 0, display: 'flex' }}>
                  <input 
                    type="tel" 
                    id="telefone_cliente" 
                    name="telefone_cliente" 
                    autoComplete="tel" 
                    className="input-line" 
                    value={telefone}
                    readOnly={mode === 'view'}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ width: '300px', flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>DATA DE REALIZAÇÃO:</span>
                <div style={{ width: '100px', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    id="data_realizacao"
                    name="data_realizacao"
                    autoComplete="off"
                    value={dataRealizacao}
                    readOnly={mode === 'view'}
                    onChange={(e) => setDataRealizacao(mascaraData(e.target.value))}
                    className="input-line"
                    style={{ paddingRight: mode === 'view' ? '0px' : '22px' }}
                  />
                  {mode !== 'view' && (
                    <>
                      <input 
                        type="date"
                        id="data_realizacao_picker"
                        name="data_realizacao_picker"
                        aria-label="Selecionar data de realização"
                        onChange={(e) => {
                          if (e.target.value) {
                            const [ano, mes, dia] = e.target.value.split('-');
                            setDataRealizacao(`${dia}/${mes}/${ano}`);
                          }
                        }}
                        style={{
                          position: 'absolute',
                          right: 0,
                          width: '18px',
                          height: '18px',
                          opacity: 0,
                          cursor: 'pointer',
                          zIndex: 3
                        }}
                      />
                      <svg 
                        style={{ position: 'absolute', right: 0, pointerEvents: 'none', zIndex: 2 }} 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="#C8A24A" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px', minWidth: '220px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>Endereço:</span>
                <div style={{ flexGrow: 1, minWidth: 0, display: 'flex' }}>
                  <input 
                    type="text" 
                    id="endereco_cliente" 
                    name="endereco_cliente" 
                    autoComplete="street-address" 
                    className="input-line" 
                    value={endereco}
                    readOnly={mode === 'view'}
                    onChange={(e) => setEndereco(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ width: '250px', flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '13px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, whiteSpace: 'nowrap' }}>Nº Documento:</span>
                <div style={{ flexGrow: 1, display: 'flex' }}>
                  <input 
                    type="text" 
                    id="numero_documento" 
                    name="numero_documento" 
                    autoComplete="off" 
                    className="input-line" 
                    value={numeroDocumento}
                    readOnly={mode === 'view'}
                    onChange={(e) => setNumeroDocumento(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. CORPO DA MOLDURA */}
        <div style={{
          width: '100%',
          backgroundImage: 'url("/imagens/moldura-meio.jpeg")',
          backgroundRepeat: 'repeat-y',
          backgroundPosition: 'center top',
          backgroundSize: '100% auto',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: '150px 95px 160px 95px', 
          position: 'relative',
          zIndex: 2
        }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '480px',
            height: '480px',
            backgroundImage: 'url("/imagens/logo-samiramarcadagua.jpeg")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundSize: 'contain',
            opacity: 0.45,
            pointerEvents: 'none',
            zIndex: 1
          }} />

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            
            {/* MÓDULO 2: PERGUNTAS SIM / NÃO */}
            <div className="modulo-bloco">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", color: '#a855f7', fontWeight: 700, fontSize: '11px', letterSpacing: '0.5px' }}>
                  AVALIAÇÃO DE SAÚDE E ANTECEDENTES
                </span>
                {mode !== 'view' && (
                  <button 
                    type="button"
                    className="btn-toggle-edicao-simnao"
                    onClick={() => setEditandoSimNao(!editandoSimNao)}
                  >
                    <MdEdit size={13} />
                    {editandoSimNao ? 'Concluir Edição' : ''}
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 1fr', gap: '4px 2px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {perguntasSimNao.slice(0, Math.ceil(perguntasSimNao.length / 2)).map((item, idx) => (
                    <div key={`simnao_col1_${idx}`} style={{ display: 'flex', alignItems: 'center', fontSize: '12.5px', paddingRight: '10px', gap: '10px' }}>
                      {mode !== 'view' && editandoSimNao ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexGrow: 1 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <button type="button" onClick={() => moverSimNao(idx, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px', padding: 0, color: '#9333ea' }} title="Mover para cima">▲</button>
                            <button type="button" onClick={() => moverSimNao(idx, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px', padding: 0, color: '#9333ea' }} title="Mover para baixo">▼</button>
                          </div>
                          <input 
                            type="text" 
                            id={`simnao_texto_col1_${idx}`}
                            name={`simnao_texto_col1_${idx}`}
                            value={item.label}
                            onChange={(e) => atualizarTextoSimNao(idx, e.target.value)}
                            style={{ border: 'none', borderBottom: '1px dashed #a855f7', background: 'transparent', fontSize: '11.5px', width: '100%', outline: 'none', color: '#2D2D2D' }}
                          />
                          <button type="button" onClick={() => removerSimNao(idx)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: 0 }} title="Remover"><MdDelete size={13} /></button>
                        </div>
                      ) : (
                        <span style={{ color: '#2D2D2D', fontWeight: 500 }}>{item.label}</span>
                      )}

                      <div style={{ display: 'flex', gap: '4px', color: '#C8A24A', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap', flexShrink: 0, alignItems: 'center' }}>
                        <label style={{ cursor: mode === 'view' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '1px' }}>
                          <input 
                            type="radio" 
                            id={`${item.name}_sim_col1_${idx}`}
                            name={item.name} 
                            value="sim" 
                            autoComplete="off" 
                            disabled={mode === 'view'}
                            checked={respostasRadio[item.name] === 'sim'} 
                            onChange={() => handleRadioChange(item.name, 'sim')} 
                            style={{ margin: 0, padding: 0 }}
                          /> Sim
                        </label>
                        <label style={{ cursor: mode === 'view' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '1px' }}>
                          <input 
                            type="radio" 
                            id={`${item.name}_nao_col1_${idx}`}
                            name={item.name} 
                            value="nao" 
                            autoComplete="off" 
                            disabled={mode === 'view'}
                            checked={respostasRadio[item.name] === 'nao'} 
                            onChange={() => handleRadioChange(item.name, 'nao')} 
                            style={{ margin: 0, padding: 0 }}
                          /> Não
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <div style={{ width: '1px', flex: 1, backgroundColor: '#C8A24A' }} />
                  <div style={{ padding: '2px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                    <img 
                      src="/imagens/efeito.jpeg" 
                      alt="Lótus" 
                      style={{ width: '40px', height: '28px', objectFit: 'contain', display: 'block' }} 
                    />
                  </div>
                  <div style={{ width: '1px', flex: 1, backgroundColor: '#C8A24A' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifySelf: 'start', width: '100%' }}>
                  {perguntasSimNao.slice(Math.ceil(perguntasSimNao.length / 2)).map((item, originalIdx) => {
                    const idx = originalIdx + Math.ceil(perguntasSimNao.length / 2);
                    return (
                      <div key={`simnao_col2_${idx}`} style={{ display: 'flex', alignItems: 'center', fontSize: '12.5px', gap: '10px' }}>
                        {mode !== 'view' && editandoSimNao ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexGrow: 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              <button type="button" onClick={() => moverSimNao(idx, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px', padding: 0, color: '#9333ea' }} title="Mover para cima">▲</button>
                              <button type="button" onClick={() => moverSimNao(idx, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px', padding: 0, color: '#9333ea' }} title="Mover para baixo">▼</button>
                            </div>
                            <input 
                              type="text" 
                              id={`simnao_texto_col2_${idx}`}
                              name={`simnao_texto_col2_${idx}`}
                              value={item.label}
                              onChange={(e) => atualizarTextoSimNao(idx, e.target.value)}
                              style={{ border: 'none', borderBottom: '1px dashed #a855f7', background: 'transparent', fontSize: '11.5px', width: '100%', outline: 'none', color: '#2D2D2D' }}
                            />
                            <button type="button" onClick={() => removerSimNao(idx)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: 0 }} title="Remover"><MdDelete size={13} /></button>
                          </div>
                        ) : (
                          <span style={{ color: '#2D2D2D', fontWeight: 500 }}>{item.label}</span>
                        )}

                        <div style={{ display: 'flex', gap: '4px', color: '#C8A24A', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap', flexShrink: 0, alignItems: 'center' }}>
                          <label style={{ cursor: mode === 'view' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '1px' }}>
                            <input 
                              type="radio" 
                              id={`${item.name}_sim_col2_${idx}`}
                              name={item.name} 
                              value="sim" 
                              autoComplete="off" 
                              disabled={mode === 'view'}
                              checked={respostasRadio[item.name] === 'sim'} 
                              onChange={() => handleRadioChange(item.name, 'sim')} 
                              style={{ margin: 0, padding: 0 }}
                            /> Sim
                          </label>
                          <label style={{ cursor: mode === 'view' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '1px' }}>
                            <input 
                              type="radio" 
                              id={`${item.name}_nao_col2_${idx}`}
                              name={item.name} 
                              value="nao" 
                              autoComplete="off" 
                              disabled={mode === 'view'}
                              checked={respostasRadio[item.name] === 'nao'} 
                              onChange={() => handleRadioChange(item.name, 'nao')} 
                              style={{ margin: 0, padding: 0 }}
                            /> Não
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {mode !== 'view' && editandoSimNao && (
                <div className="painel-edicao-simnao" style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(168, 85, 247, 0.4)', alignItems: 'center' }}>
                  <input 
                    type="text"
                    id="nova_simnao_input"
                    name="nova_simnao_input"
                    placeholder="Nova pergunta de Sim/Não..."
                    value={novaSimNaoTexto}
                    onChange={(e) => setNovaSimNaoTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarSimNao(); } }}
                    style={{ flexGrow: 1, border: '1.5px solid #a855f7', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', outline: 'none', background: 'rgba(255,255,255,0.8)' }}
                  />
                  <button
                    type="button"
                    onClick={adicionarSimNao}
                    style={{ backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <MdAdd size={14} /> Adicionar
                  </button>
                </div>
              )}
            </div>

            {/* MÓDULO 3: HÁBITOS E CUIDADOS DIÁRIOS */}
            <div className="modulo-bloco" style={{ padding: '8px 14px', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontFamily: "'Cinzel', serif", color: '#a855f7', fontWeight: 700, fontSize: '12px' }}>
                  HÁBITOS E CUIDADOS DIÁRIOS
                </span>
                {mode !== 'view' && (
                  <button 
                    type="button"
                    className="btn-toggle-edicao-habitos"
                    onClick={() => setEditandoHabitos(!editandoHabitos)}
                  >
                    <MdEdit size={13} />
                    {editandoHabitos ? 'Concluir Edição de Hábitos' : ''}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {habitosComIcones.map((item, idx) => {
                  const IconComponent = item.icone || MdSpa;
                  const isOpen = dropdownAbertoIndex === idx;

                  return (
                    <div key={`habito_item_${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11.5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: mode !== 'view' && editandoHabitos ? '240px' : '300px' }}>
                        {mode !== 'view' && editandoHabitos ? (
                          <div className="dropdown-icone-container" style={{ position: 'relative' }}>
                            <button
                              type="button"
                              id={`btn_dropdown_icone_${idx}`}
                              onClick={() => setDropdownAbertoIndex(isOpen ? null : idx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '6px',
                                padding: '3px 6px',
                                background: '#ffffff',
                                border: '1.5px solid #a855f7',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                width: '55px',
                                boxShadow: '0 2px 5px rgba(147, 51, 234, 0.15)'
                              }}
                            >
                              <IconComponent size={16} color="#9333ea" />
                              <MdKeyboardArrowDown size={14} color="#9333ea" />
                            </button>

                            {isOpen && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: '4px',
                                background: '#ffffff',
                                border: '1.5px solid #a855f7',
                                borderRadius: '8px',
                                boxShadow: '0 4px 15px rgba(147, 51, 234, 0.25)',
                                zIndex: 100,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '6px',
                                padding: '8px',
                                width: '170px',
                                maxHeight: '220px',
                                overflowY: 'auto'
                              }}>
                                {iconesDisponiveis.map((ic, i) => {
                                  const ItemIcon = ic.componente;
                                  return (
                                    <button
                                      key={`icone_opcao_${idx}_${i}`}
                                      type="button"
                                      onClick={() => atualizarIconeHabito(idx, ic)}
                                      style={{
                                        background: item.iconeId === ic.id ? '#fdf4ff' : 'transparent',
                                        border: item.iconeId === ic.id ? '1px solid #a855f7' : '1px solid transparent',
                                        borderRadius: '6px',
                                        padding: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      <ItemIcon size={18} color="#9333ea" />
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '22px' }}>
                            <IconComponent size={18} color="#9333ea" />
                          </div>
                        )}
                        
                        {mode !== 'view' && editandoHabitos ? (
                          <input 
                            type="text" 
                            id={`habito_texto_edicao_${idx}`}
                            name={`habito_texto_edicao_${idx}`}
                            value={item.pergunta}
                            onChange={(e) => atualizarTextoHabito(idx, e.target.value)}
                            style={{ 
                              border: 'none', 
                              borderBottom: '1px dashed #a855f7', 
                              background: 'transparent', 
                              fontSize: '11px', 
                              color: '#2D2D2D', 
                              width: '100%',
                              outline: 'none',
                              fontWeight: 500
                            }}
                          />
                        ) : (
                          <span style={{ color: '#2D2D2D', fontWeight: 500 }}>{item.pergunta}</span>
                        )}
                      </div>

                      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        {/* Input visível na tela normal */}
                        <input 
                          type="text" 
                          id={`habito_resposta_${item.name}_${idx}`}
                          name={item.name} 
                          autoComplete="off" 
                          className="habit-input-line" 
                          style={{ height: '15px' }} 
                          value={habitosTextos[item.name] || ''}
                          readOnly={mode === 'view'}
                          ref={(el) => (habitosInputsRef.current[idx] = el)}
                          onKeyDown={(e) => handleHabitoKeyDown(e, idx)}
                          onChange={(e) => handleHabitoTextoChange(item.name, e.target.value)}
                        />

                        {/* Div estática renderizada perfeitamente pelo html2pdf com quebra de linha */}
                        <div className="habit-div-pdf">
                          {habitosTextos[item.name] || ''}
                        </div>
                      </div>

                      {mode !== 'view' && editandoHabitos && (
                        <button 
                          type="button" 
                          onClick={() => removerHabitoCustomizado(idx)}
                          title="Remover pergunta"
                          style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                        >
                          <MdDelete size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {mode !== 'view' && editandoHabitos && (
                <div className="painel-edicao-habitos" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(168, 85, 247, 0.4)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#a855f7' }}>Adicionar Nova Pergunta com Ícone Vetorial Roxo:</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div className="dropdown-icone-container" style={{ position: 'relative' }}>
                      <button
                        type="button"
                        id="btn_dropdown_novo_habito"
                        onClick={() => setDropdownNovoAberto(!dropdownNovoAberto)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                          padding: '4px 6px',
                          background: '#ffffff',
                          border: '1.5px solid #a855f7',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          width: '55px',
                          boxShadow: '0 2px 5px rgba(147, 51, 234, 0.15)'
                        }}
                      >
                        {React.createElement(novoIconeSelecionado.componente, { size: 16, color: '#9333ea' })}
                        <MdKeyboardArrowDown size={14} color="#9333ea" />
                      </button>

                      {dropdownNovoAberto && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: '4px',
                          background: '#ffffff',
                          border: '1.5px solid #a855f7',
                          borderRadius: '8px',
                          boxShadow: '0 4px 15px rgba(147, 51, 234, 0.25)',
                          zIndex: 100,
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '6px',
                          padding: '8px',
                          width: '170px',
                          maxHeight: '220px',
                          overflowY: 'auto'
                        }}>
                          {iconesDisponiveis.map((ic, i) => {
                            const ItemIcon = ic.componente;
                            return (
                              <button
                                key={`novo_icone_opcao_${i}`}
                                type="button"
                                onClick={() => {
                                  setNovoIconeSelecionado(ic);
                                  setDropdownNovoAberto(false);
                                }}
                                style={{
                                  background: novoIconeSelecionado.id === ic.id ? '#fdf4ff' : 'transparent',
                                  border: novoIconeSelecionado.id === ic.id ? '1px solid #a855f7' : '1px solid transparent',
                                  borderRadius: '6px',
                                  padding: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s'
                                }}
                              >
                                <ItemIcon size={18} color="#9333ea" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <input 
                      type="text" 
                      id="novo_habito_input"
                      name="novo_habito_input"
                      placeholder="Digite a nova pergunta de hábitos..." 
                      value={novaPerguntaTexto}
                      onChange={(e) => setNovaPerguntaTexto(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarHabitoPersonalizado(); } }}
                      style={{
                        flexGrow: 1,
                        border: '1.5px solid #a855f7',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        fontSize: '11px',
                        outline: 'none',
                        background: 'rgba(255, 255, 255, 0.8)',
                        color: '#2D2D2D',
                        fontFamily: "'Montserrat', sans-serif"
                      }}
                    />

                    <button
                      type="button"
                      onClick={adicionarHabitoPersonalizado}
                      style={{
                        backgroundColor: '#a855f7',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontFamily: "'Cinzel', serif",
                        boxShadow: '0 2px 6px rgba(168, 85, 247, 0.3)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <MdAdd size={14} /> Adicionar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* SEÇÃO DA AVALIAÇÃO DA PELE */}
            <div className="avaliacao-pele-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '1px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.3)' }} />
                <div style={{ 
                  fontFamily: "'Cinzel', serif", color: '#2D2D2D', 
                  background: 'transparent', padding: '2px 10px', fontSize: '10px', letterSpacing: '1px', 
                  fontWeight: 600, border: '1px solid rgba(200, 162, 74, 0.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <span style={{ color: '#C8A24A', fontSize: '9px' }}>❀</span> AVALIAÇÃO DA PELE <span style={{ color: '#C8A24A', fontSize: '9px' }}>❀</span>
                </div>
                <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.3)' }} />
              </div>

              {/* MÓDULO 4: AVALIAÇÃO DA PELE */}
              <div className="modulo-bloco" style={{ padding: '8px 14px', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
                  {mode !== 'view' && (
                    <button 
                      type="button"
                      className="btn-toggle-edicao-pele"
                      onClick={() => setEditandoPele(!editandoPele)}
                    >
                      <MdEdit size={13} />
                      {editandoPele ? 'Concluir Edição de Avaliação de Pele' : ''}
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', fontSize: '12px' }}>
                  {secoesPele.map((secao, secaoIdx) => (
                    <div key={`secao_pele_${secaoIdx}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '6px', borderBottom: secaoIdx < secoesPele.length - 1 ? '1px dashed rgba(168, 85, 247, 0.2)' : 'none' }}>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {mode !== 'view' && editandoPele ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexGrow: 1 }}>
                            <input 
                              type="text" 
                              id={`secao_pele_titulo_${secaoIdx}`}
                              name={`secao_pele_titulo_${secaoIdx}`}
                              value={secao.titulo}
                              onChange={(e) => atualizarTituloPele(secaoIdx, e.target.value)}
                              style={{ border: 'none', borderBottom: '1px dashed #a855f7', background: 'transparent', fontWeight: 600, color: '#C8A24A', fontSize: '11px', outline: 'none', width: '150px' }}
                            />
                            <button type="button" onClick={() => removerSecaoPele(secaoIdx)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: 0 }} title="Remover Categoria"><MdDelete size={13} /></button>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 700, color: '#C8A24A' }}>{secao.titulo}:</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                        {secao.opcoes.map((opt, optIdx) => (
                          <div key={`opcao_pele_${secaoIdx}_${optIdx}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <label style={{ display: 'flex', gap: '4px', cursor: mode === 'view' ? 'default' : 'pointer', alignItems: 'center' }}>
                              <input 
                                type="radio" 
                                id={`pele_${secao.nameGrupo}_${opt.value}_${secaoIdx}_${optIdx}`}
                                name={secao.nameGrupo} 
                                value={opt.value} 
                                autoComplete="off" 
                                disabled={mode === 'view'}
                                checked={respostasRadio[secao.nameGrupo] === opt.value} 
                                onChange={() => handleRadioChange(secao.nameGrupo, opt.value)} 
                              /> {opt.label}
                            </label>

                            {mode !== 'view' && editandoPele && (
                              <button 
                                type="button" 
                                onClick={() => removerOpcaoPele(secaoIdx, optIdx)} 
                                style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} 
                                title="Remover esta opção"
                              >
                                <MdDelete size={11} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {mode !== 'view' && editandoPele && (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px', paddingLeft: '10px' }}>
                          <input 
                            type="text"
                            id={`nova_opcao_pele_${secaoIdx}`}
                            name={`nova_opcao_pele_${secaoIdx}`}
                            placeholder="Adicionar nova opção (ex: Sensível)..."
                            value={novoValorOpcaoPele[secaoIdx] || ''}
                            onChange={(e) => setNovoValorOpcaoPele(prev => ({ ...prev, [secaoIdx]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarOpcaoPele(secaoIdx); } }}
                            style={{ border: '1px solid #a855f7', borderRadius: '4px', padding: '2px 6px', fontSize: '10.5px', outline: 'none', background: '#fff', width: '220px' }}
                          />
                          <button
                            type="button"
                            onClick={() => adicionarOpcaoPele(secaoIdx)}
                            style={{ backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                          >
                            <MdAdd size={12} /> Add Opção
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {mode !== 'view' && editandoPele && (
                  <div className="painel-edicao-pele" style={{ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed rgba(168, 85, 247, 0.4)', alignItems: 'center' }}>
                    <input 
                      type="text"
                      id="nova_secao_pele_input"
                      name="nova_secao_pele_input"
                      placeholder="Nova categoria de pele (ex: Textura)..."
                      value={novoTituloPele}
                      onChange={(e) => setNovoTituloPele(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarSecaoPele(); } }}
                      style={{ flexGrow: 1, border: '1.5px solid #a855f7', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', outline: 'none', background: 'rgba(255,255,255,0.8)' }}
                    />
                    <button
                      type="button"
                      onClick={adicionarSecaoPele}
                      style={{ backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <MdAdd size={14} /> Adicionar Categoria Principal
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO: ALTERAÇÕES CUTÂNEAS */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '1px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.3)' }} />
              <div style={{ 
                fontFamily: "'Cinzel', serif", color: '#2D2D2D', 
                background: 'transparent', padding: '2px 10px', fontSize: '10px', letterSpacing: '1px', 
                fontWeight: 600, border: '1px solid rgba(200, 162, 74, 0.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                <span style={{ color: '#C8A24A', fontSize: '9px' }}>❀</span> ALTERAÇÕES CUTÂNEAS <span style={{ color: '#C8A24A', fontSize: '9px' }}>❀</span>
              </div>
              <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.3)' }} />
            </div>

            {/* MÓDULO 5: ALTERAÇÃO CUTÂNEA */}
            <div className="modulo-bloco" style={{ padding: '8px 14px', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
                {mode !== 'view' && (
                  <button 
                    type="button"
                    className="btn-toggle-edicao-alt"
                    onClick={() => setEditandoAltCutaneas(!editandoAltCutaneas)}
                  >
                    <MdEdit size={13} />
                    {editandoAltCutaneas ? 'Concluir Edição de Alterações Cutâneas' : ''}
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px 12px', fontSize: '10.5px' }}>
                {alteracoesCutaneas.map((alt, idx) => (
                  <div key={`alt_cutanea_${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: mode === 'view' ? 'default' : 'pointer', flexGrow: 1 }}>
                      <input 
                        type="checkbox" 
                        id={`${alt.name}_${idx}`} 
                        name={alt.name} 
                        autoComplete="off" 
                        disabled={mode === 'view'}
                        style={{ margin: 0 }} 
                        checked={!!checkboxesAlt[alt.name]} 
                        onChange={(e) => handleCheckboxChange(alt.name, e.target.checked)} 
                      /> 
                      {mode !== 'view' && editandoAltCutaneas ? (
                        <input 
                          type="text"
                          id={`alt_cutanea_texto_${idx}`}
                          name={`alt_cutanea_texto_${idx}`}
                          value={alt.label}
                          onChange={(e) => atualizarAltCutaneaTexto(idx, e.target.value)}
                          style={{ border: 'none', borderBottom: '1px dashed #a855f7', background: 'transparent', fontSize: '10px', width: '100%', outline: 'none' }}
                        />
                      ) : (
                        <span>{alt.label}</span>
                      )}
                    </label>
                    {mode !== 'view' && editandoAltCutaneas && (
                      <button type="button" onClick={() => removerAltCutanea(idx)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: 0 }} title="Remover"><MdDelete size={12} /></button>
                    )}
                  </div>
                ))}
              </div>

              {mode !== 'view' && editandoAltCutaneas && (
                <div className="painel-edicao-alt" style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(168, 85, 247, 0.4)', alignItems: 'center' }}>
                  <input 
                    type="text"
                    id="nova_alt_cutanea_input"
                    name="nova_alt_cutanea_input"
                    placeholder="Nome da nova alteração cutânea..."
                    value={novaAltCutaneaTexto}
                    onChange={(e) => setNovaAltCutaneaTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarAltCutanea(); } }}
                    style={{ flexGrow: 1, border: '1.5px solid #a855f7', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', outline: 'none', background: 'rgba(255,255,255,0.8)' }}
                  />
                  <button
                    type="button"
                    onClick={adicionarAltCutanea}
                    style={{ backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <MdAdd size={14} /> Adicionar Item
                  </button>
                </div>
              )}
            </div>

            {/* SEÇÃO: OBSERVAÇÕES & CONDUTA PROFISSIONAL */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '1px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.3)' }} />
              <div style={{ 
                fontFamily: "'Cinzel', serif", color: '#2D2D2D', 
                background: 'transparent', padding: '2px 10px', fontSize: '10px', letterSpacing: '1px', 
                fontWeight: 600, border: '1.5px solid #C8A24A', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                <span style={{ color: '#C8A24A', fontSize: '9px' }}>❀</span> OBSERVAÇÕES & CONDUTA PROFISSIONAL <span style={{ color: '#C8A24A', fontSize: '9px' }}>❀</span>
              </div>
              <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.3)' }} />
            </div>

            {/* MÓDULO 6: OBSERVAÇÃO (Com textarea para tela e div estática para PDF) */}
            <div className="modulo-bloco">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', boxSizing: 'border-box' }}>
                <span style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, fontSize: '11px' }}>
                  Notas e Restrições Adicionais:
                </span>
                
                {/* Textarea visível na interface de edição/visualização normal */}
                <textarea 
                  ref={observacoesRef}
                  id="observacoes_cliente" 
                  name="observacoes_cliente" 
                  className="textarea-edicao-original"
                  placeholder="Digite aqui as observações detalhadas da avaliação, queixas principais ou cuidados recomendados..."
                  value={observacoes}
                  readOnly={mode === 'view'}
                  onChange={(e) => {
                    setObservacoes(e.target.value);
                    ajustarAlturaTextarea();
                  }}
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    minHeight: '300px',
                    height: 'auto',
                    border: '1.5px solid rgba(200, 162, 74, 0.5)',
                    borderRadius: '4px',
                    background: 'transparent',
                    padding: '8px 10px',
                    fontSize: '12px',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: "'Montserrat', sans-serif",
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word'
                  }}
                />

                {/* Div estática renderizada perfeitamente pelo html2pdf */}
                <div className="div-visualizacao-pdf">
                  {observacoes || 'Nenhuma observação registrada.'}
                </div>
              </div>
            </div>

            <div className="lembretes-paciente" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '1px 0' }}>
                <div style={{ flex: 1, height: '1.5px', background: 'rgba(200, 162, 74, 0.4)' }} />
                <div style={{ fontFamily: "'Cinzel', serif", color: '#1A1A1A', background: 'transparent', padding: '2px 10px', fontSize: '10px', fontWeight: 700, border: '1.5px solid #C8A24A', borderRadius: '12px' }}>
                  LEMBRETES PARA O PACIENTE
                </div>
                <div style={{ flex: 1, height: '1.5px', background: 'rgba(200, 162, 74, 0.4)' }} />
              </div>

             {/* MÓDULO 7: LEMBRETES */}
<div className="modulo-bloco" style={{ padding: '6px 12px', gap: '4px', marginBottom: '30px' }}>
  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
    
    {lembretes.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '16px 8px', color: '#999', fontSize: '11.5px', fontStyle: 'italic' }}>
        Nenhum lembrete registrado.
      </div>
    ) : (
      lembretes.map((lembrete, index) => (
        <div key={`lembrete_${index}`} style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '4px', 
          paddingBottom: '6px', 
          borderBottom: index < lembretes.length - 1 ? '1px dashed rgba(200, 162, 74, 0.4)' : 'none' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#C8A24A' }}>Lembrete #{index + 1}</span>
            {mode !== 'view' && (
              <button 
                type="button" 
                onClick={() => removerLembrete(index)}
                style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <MdDelete size={13} />
              </button>
            )}
          </div>

          {/* TÍTULO DO LEMBRETE */}
          <div>
            <span style={{ fontSize: '9.5px', fontWeight: 600, color: '#1A1A1A', display: 'block' }}>Título do Lembrete:</span>
            <input 
              type="text" 
              id={`lembrete_titulo_${index}`}
              name={`lembrete_titulo_${index}`}
              value={lembrete.titulo}
              readOnly={mode === 'view'}
              onChange={(e) => atualizarLembrete(index, 'titulo', e.target.value)}
              className="habit-input-line lembrete-input-original"
            />
            <div className="lembrete-div-pdf">
              {lembrete.titulo || '-'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* TIPO */}
            <div style={{ flex: 1, minWidth: '140px' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 600, color: '#1A1A1A', display: 'block' }}>Tipo:</span>
              {mode === 'view' ? (
                <input 
                  type="text" 
                  id={`lembrete_tipo_view_${index}`}
                  name={`lembrete_tipo_view_${index}`}
                  readOnly 
                  value={lembrete.tipo === 'intervalo' ? 'Intervalo de tempo' : 'Data e Hora específica'} 
                  className="habit-input-line lembrete-input-original" 
                />
              ) : (
                <select 
                  id={`lembrete_tipo_${index}`}
                  name={`lembrete_tipo_${index}`}
                  value={lembrete.tipo}
                  onChange={(e) => atualizarLembrete(index, 'tipo', e.target.value)}
                  style={{ width: '100%', padding: '2px 4px', borderRadius: '4px', border: '1.5px solid #C8A24A', fontSize: '10px', background: '#fff' }}
                  className="lembrete-input-original"
                >
                  <option value="intervalo">Intervalo de tempo</option>
                  <option value="data_hora">Data e Hora específica</option>
                </select>
              )}
              <div className="lembrete-div-pdf">
                {lembrete.tipo === 'intervalo' ? 'Intervalo de tempo' : 'Data e Hora específica'}
              </div>
            </div>

            {/* VALOR / INTERVALO */}
            <div style={{ flex: '1', minWidth: '200px' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 600, color: '#1A1A1A', display: 'block' }}>
                {lembrete.tipo === 'intervalo' ? 'A cada:' : 'Data e Hora:'}
              </span>

              {lembrete.tipo === 'intervalo' ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                  <input
                    type="number"
                    min="1"
                    id={`lembrete_numero_${index}`}
                    name={`lembrete_numero_${index}`}
                    placeholder="Ex: 8"
                    value={lembrete.intervaloNumero || ''}
                    readOnly={mode === 'view'}
                    onChange={(e) => atualizarLembrete(index, 'intervaloNumero', e.target.value)}
                    className="habit-input-line lembrete-input-original"
                    style={{ width: '70px', flexGrow: 0 }}
                  />
                  <select
                    id={`lembrete_unidade_${index}`}
                    name={`lembrete_unidade_${index}`}
                    value={lembrete.intervaloUnidade || 'horas'}
                    disabled={mode === 'view'}
                    onChange={(e) => atualizarLembrete(index, 'intervaloUnidade', e.target.value)}
                    className="lembrete-input-original"
                    style={{
                      padding: '2px 4px',
                      borderRadius: '4px',
                      border: '1.5px solid #C8A24A',
                      fontSize: '10px',
                      background: '#fff'
                    }}
                  >
                    <option value="minutos">Minutos</option>
                    <option value="horas">Horas</option>
                    <option value="dias">Dias</option>
                  </select>
                </div>
              ) : (
  /* DATA/HORA: input datetime-local (edição) ou texto BR (visualização) */
  mode === 'view' ? (
    <input 
      type="text"
      id={`lembrete_valor_${index}`}
      name={`lembrete_valor_${index}`}
      value={formatarDataHoraBR(lembrete.valor)}
      readOnly
      className="habit-input-line lembrete-input-original"
    />
  ) : (
    <input 
      type="datetime-local"
      id={`lembrete_valor_${index}`}
      name={`lembrete_valor_${index}`}
      value={lembrete.valor}
      onChange={(e) => atualizarLembrete(index, 'valor', e.target.value)}
      className="habit-input-line lembrete-input-original"
    />
  )
)}

              <div className="lembrete-div-pdf">
  {lembrete.tipo === 'intervalo' 
    ? `A cada ${lembrete.intervaloNumero || '?'} ${lembrete.intervaloUnidade || 'horas'}`
    : (lembrete.valor ? formatarDataHoraBR(lembrete.valor) : '-')
  }
</div>
            </div>
          </div>
        </div>
      ))
    )}

    {mode !== 'view' && (
      <button
        type="button"
        onClick={adicionarLembrete}
        style={{
          backgroundColor: '#C8A24A',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          padding: '4px',
          fontSize: '10px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          marginTop: '2px',
          width: '100%'
        }}
      >
        <MdAdd size={12} /> {lembretes.length === 0 ? 'Adicionar Lembrete' : 'Adicionar Outro Lembrete'}
      </button>
    )}
  </div>
</div>

            </div>

          </div>
        </div>

        {/* 3. BASE DA MOLDURA COM BOTÕES SEPARADOS */}
        <div style={{
          width: '100%',
          height: '600px',
          backgroundImage: 'url("/imagens/moldura-base.jpeg")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center top',
          backgroundSize: '100% 100%',
          flexShrink: 0,
          marginTop: '-140px',
          zIndex: 3,
          position: 'relative',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          paddingTop: '90px',
          boxSizing: 'border-box',
          gap: '15px'
        }}>
          {/* Container controlado para esconder os botões no PDF */}
          <div className="botoes-acao-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', width: '100%' }}>
            {mode === 'view' ? (
              <>
                <button
  type="button"
  className="btn-baixar-pdf nao-imprimir btn-lavanda-hover"
  onClick={() => exportarParaPDF('ficha-container', nome)}
  style={{
    fontFamily: "'Cinzel', serif",
    background: 'linear-gradient(135deg, #b8a3c9 0%, #d7cee0 100%)',
    color: '#2c163a',
    border: '1.5px solid #8a6fa8',
    padding: '12px 32px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    boxShadow: '0 3px 10px rgba(138, 111, 168, 0.25)',
    transition: 'all 0.25s ease',
    width: '100%',
    maxWidth: '340px'
  }}
>
  <MdDownload size={20} />
  BAIXAR PDF
</button>
                {onIrParaEdicao && (
                  <button
                    type="button"
                    className="btn-editar-ficha"
                    onClick={onIrParaEdicao}
                  >
                    EDITAR FICHA DE ANAMNESE
                  </button>
                )}
              </>
            ) : (
             <button
  type="button"
  className="btn-salvar-ficha"
  onClick={salvarFicha}
  disabled={salvando || salvoSucesso}
  style={{
    background: salvoSucesso
      ? 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)'
      : 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
    borderColor: salvoSucesso ? '#16a34a' : '#9c7826',
    cursor: (salvando || salvoSucesso) ? 'default' : 'pointer',
    transition: 'all 0.3s ease',
    opacity: 1
  }}
>
  {salvando ? (
    <>
      <span className="spinner-salvar" />
      SALVANDO...
    </>
  ) : salvoSucesso ? (
    <>
      <MdCheckCircle size={20} />
      SALVO COM SUCESSO!
    </>
  ) : (
    <>
      <MdSave size={20} />
      SALVAR FICHA
    </>
  )}
</button>
            )}
            
            <button
              type="button"
              className="btn-voltar-ficha"
              onClick={voltarFicha}
            >
              <MdArrowBack size={20} />
              VOLTAR
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}