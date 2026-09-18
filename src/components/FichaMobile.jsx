import React, { useState, useEffect } from 'react';
import FichaDesktop from './FichaDesktop';
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
  MdAdd, 
  MdDelete, 
  MdSave, 
  MdArrowBack, 
  MdPrint,
  MdEdit,
  MdKeyboardArrowDown,
  MdStar,
  MdLocalFlorist,
  MdBrightnessHigh,
  MdCleaningServices,
  MdCheckCircle,
  MdFavorite,
  MdBrightness2,
  MdLocalDining,
  MdSelfImprovement,
  MdTimer,
  MdLocalPharmacy,
  MdEco,
  MdDateRange,
  MdDownload
} from 'react-icons/md';
export default function AnamneseFicha({ onVoltar, onSave, fichaSelecionada, mode = 'edit', onIrParaEdicao, onSalvarSucesso }) {
  // Dados básicos
  const [salvando, setSalvando] = useState(false);
const [salvoSucesso, setSalvoSucesso] = useState(false);
const [pdfDesktopRenderizando, setPdfDesktopRenderizando] = useState(false);
  const [nome, setNome] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [dataNasc, setDataNasc] = useState('');
  const [dataRealizacao, setDataRealizacao] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Referência para gerenciar a altura do textarea de observações
  const observacoesRef = React.useRef(null);

  // Função para ajustar automaticamente a altura do textarea de observações sem scroll interno
  const ajustarAlturaTextarea = () => {
    const textarea = observacoesRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
    }
  };

  // Efeito para reajustar a altura sempre que o texto de observações mudar
  useEffect(() => {
    ajustarAlturaTextarea();
  }, [observacoes]);

  // Respostas
  const [respostasRadio, setRespostasRadio] = useState({});
  const [habitosTextos, setHabitosTextos] = useState({});
  const [checkboxesAlt, setCheckboxesAlt] = useState({});
  
  // Estados de Edição das Seções Customizáveis
  const [editandoHabitos, setEditandoHabitos] = useState(false);
  const [editandoSimNao, setEditandoSimNao] = useState(false);
  const [editandoPele, setEditandoPele] = useState(false);
  const [editandoAltCutaneas, setEditandoAltCutaneas] = useState(false);

  // Auxiliares de interface
  const [dropdownAbertoIndex, setDropdownAbertoIndex] = useState(null);
  const [dropdownNovoAberto, setDropdownNovoAberto] = useState(false);
  const [novoValorOpcaoPele, setNovoValorOpcaoPele] = useState({});

  const [lembretes, setLembretes] = useState([
  { titulo: '', tipo: 'intervalo', valor: '', intervaloNumero: '8', intervaloUnidade: 'horas' }
]);

  // Ícones disponíveis
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

  // 1. Perguntas de Sim / Não
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

  // 2. Hábitos e Cuidados
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

  // 3. Avaliação da Pele
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

  // 4. Alterações Cutâneas
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
  // ⬇️ Quando o usuário clica em "Baixar PDF", renderizamos a versão
//    desktop oculta, esperamos montar e exportamos o PDF a partir dela.
useEffect(() => {
  if (!pdfDesktopRenderizando) return;

  // Delay para garantir que as imagens da moldura carregaram
  const timer = setTimeout(async () => {
    try {
      await exportarParaPDF(
        'ficha-container',
        fichaSelecionada?.nome || nome
      );
    } catch (err) {
      console.error('Erro ao gerar PDF (modo desktop):', err);
    } finally {
      setPdfDesktopRenderizando(false);
    }
  }, 900); // 900ms é seguro; pode reduzir se quiser

  return () => clearTimeout(timer);
}, [pdfDesktopRenderizando, fichaSelecionada, nome]);

  // Fechar dropdown se clicar fora
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

  // Carregar ficha selecionada se houver
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
    if (mode === 'view' || !novaSimNaoTexto.trim()) return;
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

  const adicionarHabitoPersonalizado = () => {
    if (mode === 'view' || !novaPerguntaTexto.trim()) return;
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
    setHabitosComIcones(habitosComIcones.filter((_, i) => i !== index));
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
    if (mode === 'view' || !novoTituloPele.trim()) return;
    const nameGrupo = `pele_custom_${Date.now()}`;
    setSecoesPele([
      ...secoesPele,
      {
        titulo: novoTituloPele.trim(),
        nameGrupo,
        opcoes: [{ label: "Normal", value: "normal" }]
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
    if (mode === 'view' || !novaAltCutaneaTexto.trim()) return;
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
    setLembretes(lembretes.filter((_, i) => i !== index));
  };

  const atualizarLembrete = (index, campo, valor) => {
    if (mode === 'view') return;
    const novos = [...lembretes];
    novos[index][campo] = valor;
    setLembretes(novos);
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

  const abrirCalendarioNativo = (idInputDate) => {
    if (mode === 'view') return;
    const elemento = document.getElementById(idInputDate);
    if (elemento) {
      if (typeof elemento.showPicker === 'function') {
        try {
          elemento.showPicker();
        } catch (e) {
          elemento.focus();
        }
      } else {
        elemento.focus();
        elemento.click();
      }
    }
  };

  const converterParaISO = (dataStr) => {
    if (!dataStr || dataStr.length !== 10) return '';
    const partes = dataStr.split('/');
    if (partes.length !== 3) return '';
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  };

  const converterParaBR = (dataIso) => {
    if (!dataIso) return '';
    const partes = dataIso.split('-');
    if (partes.length !== 3) return '';
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
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
      backgroundColor: '#f3eef8',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100vw',
      minHeight: '100vh',
      margin: 0,
      padding: 0,
      fontFamily: "'Montserrat', sans-serif",
      boxSizing: 'border-box',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600;700&display=swap');

        /* Oculta os botões de ação e itens de edição quando estiver gerando o PDF */
        body.sendo-exportado .botoes-acao-container {
          display: none !important;
        }

        /* Regras para alternância visual no PDF utilizando a classe do body (.sendo-exportado) */
        body.sendo-exportado .textarea-edicao-original,
        body.sendo-exportado .habit-input-line,
        body.sendo-exportado .lembrete-input-original {
          display: none !important;
        }

        body.sendo-exportado .div-visualizacao-pdf,
        body.sendo-exportado .habit-div-pdf,
        body.sendo-exportado .lembrete-div-pdf {
          display: block !important;
          white-space: pre-wrap;
          word-wrap: break-word;
          font-size: 11.5px;
          border: 1.5px solid rgba(200, 162, 74, 0.5);
          padding: 6px 8px;
          border-radius: 4px;
          font-family: "'Montserrat', sans-serif";
          color: #1A1A1A;
          background: transparent;
          box-sizing: border-box;
          width: 100%;
        }

        .div-visualizacao-pdf,
        .habit-div-pdf,
        .lembrete-div-pdf {
          display: none;
        }

        @media print {
          body, html {
            width: 100%;
            margin: 0;
            padding: 0;
            background-color: #ffffff !important;
          }
          .modulo-card-mobile {
            background-color: transparent !important;
            border-color: #9333ea !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }
          button,
          .btn-toggle-edicao {
            display: none !important;
          }
          .textarea-edicao-original,
          .habit-input-line,
          .lembrete-input-original {
            display: none !important;
          }
          .div-visualizacao-pdf,
          .habit-div-pdf,
          .lembrete-div-pdf {
            display: block !important;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 11.5px;
            border: 1.5px solid rgba(200, 162, 74, 0.5);
            padding: 6px 8px;
            border-radius: 4px;
            font-family: "'Montserrat', sans-serif";
            color: #1A1A1A;
            background: transparent;
            box-sizing: border-box;
            width: 100%;
          }
          .lembretes-paciente {
            page-break-before: always;
            break-before: page;
          }
        }

        .input-line {
          width: 100%;
          border: none;
          background: transparent;
          border-bottom: 1.5px solid #D4AF37;
          outline: none;
          height: 24px;
          font-size: 14px;
          font-weight: 500;
          color: #1A1A1A;
          margin-top: 2px;
          -webkit-text-fill-color: #1A1A1A;
        }

        .habit-input-line {
          width: 100%;
          border: none;
          background: transparent;
          border-bottom: 1.5px solid #1A1A1A;
          height: 18px;
          outline: none;
          font-size: 11px;
          color: #1A1A1A;
          margin-top: 2px;
          -webkit-text-fill-color: #1A1A1A;
        }

        .btn-toggle-edicao {
          background: transparent;
          border: 1.5px solid #8B5CF6;
          color: #8B5CF6;
          padding: 4px 10px;
          border-radius: 16px;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }

        .modulo-card-mobile {
          background: rgba(255, 255, 255, 0.75);
          border: 1.5px solid #a855f7;
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          box-sizing: border-box;
          width: 100%;
        }

        input, select, textarea {
          color: #1A1A1A !important;
          -webkit-text-fill-color: #1A1A1A !important;
        }
      `}</style>

      <div 
        id="ficha-container-pdf"
        style={{
          width: '100%',
          maxWidth: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          padding: '160px 14px 340px 14px',
          boxSizing: 'border-box',
          backgroundColor: '#f3eef8',
          overflow: 'hidden'
        }}
      >
        {/* Moldura Topo */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '160px',
          backgroundImage: 'url("/imagens/moldura-topo.jpeg")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top center',
          backgroundSize: '100% 100%',
          pointerEvents: 'none',
          zIndex: 3
        }} />

        {/* Moldura Meio */}
        <div style={{
          position: 'absolute',
          top: '160px',
          left: 0,
          width: '100%',
          bottom: '320px',
          backgroundImage: 'url("/imagens/moldura-meio.jpeg")',
          backgroundRepeat: 'repeat-y',
          backgroundPosition: 'center',
          backgroundSize: '100% auto',
          pointerEvents: 'none',
          zIndex: 0
        }} />

        {/* Moldura Base (Fundo visível na tela e no PDF) */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '320px',
          backgroundImage: 'url("/imagens/moldura-base.jpeg")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'bottom center',
          backgroundSize: '100% 100%',
          pointerEvents: 'none',
          zIndex: 3
        }} />

        {/* Container dos Botões de Ação (Ocultado apenas no PDF) */}
        <div className="botoes-acao-container" style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '320px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 16px 30px 16px',
          boxSizing: 'border-box',
          zIndex: 4,
          pointerEvents: 'auto'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'center' }}>
            {mode === 'view' ? (
              <>
              <button
  type="button"
  className="btn-baixar-pdf nao-imprimir btn-lavanda-hover"
  onClick={() => setPdfDesktopRenderizando(true)}
  disabled={pdfDesktopRenderizando}
  style={{
    fontFamily: "'Cinzel', serif",
    background: 'linear-gradient(135deg, #b8a3c9 0%, #d7cee0 100%)',
    color: '#2c163a',
    border: '1.5px solid #8a6fa8',
    padding: '12px 20px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: pdfDesktopRenderizando ? 'wait' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
    maxWidth: '220px',
    boxShadow: '0 3px 10px rgba(138, 111, 168, 0.25)',
    transition: 'all 0.25s ease',
    opacity: pdfDesktopRenderizando ? 0.7 : 1
  }}
>
 {pdfDesktopRenderizando ? (
  <>
    <span className="spinner-pdf" />
    GERANDO PDF...
  </>
) : (
    <>
      <MdDownload size={18} /> BAIXAR PDF
    </>
  )}
</button>

                {onIrParaEdicao && (
                  <button
                    type="button"
                    onClick={onIrParaEdicao}
                    style={{
                      backgroundColor: '#D4AF37', color: '#FFFFFF', border: 'none', borderRadius: '6px',
                      padding: '12px 20px', fontSize: '13px', fontWeight: 700, fontFamily: "'Cinzel', serif",
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '6px', width: '100%', maxWidth: '220px'
                    }}
                  >
                    EDITAR FICHA
                  </button>
                )}
              </>
            ) : (
             <button
  type="button"
  onClick={salvarFicha}
  disabled={salvando || salvoSucesso}
  style={{
    backgroundColor: salvoSucesso ? '#16a34a' : '#D4AF37',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    padding: '12px 20px',
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: "'Cinzel', serif",
    cursor: (salvando || salvoSucesso) ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
    maxWidth: '220px',
    transition: 'all 0.3s ease'
  }}
>
  {salvando ? (
    <>
      <span className="spinner-salvar" />
      SALVANDO...
    </>
  ) : salvoSucesso ? (
    <>
      <MdCheckCircle size={18} />
      SALVO!
    </>
  ) : (
    <>
      <MdSave size={18} /> SALVAR FICHA
    </>
  )}
</button>
            )}

            <button
              type="button"
              onClick={voltarFicha}
              style={{
                backgroundColor: '#D4AF37', color: '#FFFFFF', border: 'none', borderRadius: '6px',
                padding: '12px 20px', fontSize: '13px', fontWeight: 700, fontFamily: "'Cinzel', serif",
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '6px', width: '100%', maxWidth: '220px'
              }}
            >
              <MdArrowBack size={18} /> VOLTAR
            </button>
          </div>
        </div>

        {/* Marca d'água */}
        <div style={{
          position: 'absolute',
          top: '45%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '280px',
          height: '280px',
          backgroundImage: 'url("/imagens/logo-samiramarcadagua.jpeg")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'contain',
          opacity: 0.4,
          pointerEvents: 'none',
          zIndex: 1
        }} />

        {/* CONTEÚDO PRINCIPAL */}
        <div style={{ width: '100%', zIndex: 2, position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}>

          {/* DADOS PESSOAIS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div style={{ flex: 1, height: '1.5px', background: 'rgba(212, 175, 55, 0.5)' }} />
              <div style={{ fontFamily: "'Cinzel', serif", color: '#1A1A1A', background: 'rgba(244, 239, 252, 0.9)', padding: '3px 10px', fontSize: '11px', fontWeight: 700, border: '1.5px solid #D4AF37', borderRadius: '12px', textAlign: 'center' }}>
                DADOS PESSOAIS
              </div>
              <div style={{ flex: 1, height: '1.5px', background: 'rgba(212, 175, 55, 0.5)' }} />
            </div>
              
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label htmlFor="input-nome" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: '12px' }}>Nome:</label>
                <input id="input-nome" name="nome" type="text" className="input-line" value={nome} readOnly={mode === 'view'} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="input-documento" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: '12px' }}>Documento:</label>
                  <input id="input-documento" name="numeroDocumento" type="text" className="input-line" value={numeroDocumento} readOnly={mode === 'view'} onChange={(e) => setNumeroDocumento(e.target.value)} autoComplete="off" />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="input-telefone" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: '12px' }}>Telefone:</label>
                  <input id="input-telefone" name="telefone" type="tel" className="input-line" value={telefone} readOnly={mode === 'view'} onChange={(e) => setTelefone(e.target.value)} autoComplete="tel" />
                </div>
              </div>

              <div>
                <label htmlFor="input-endereco" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: '12px' }}>Endereço:</label>
                <input id="input-endereco" name="endereco" type="text" className="input-line" value={endereco} readOnly={mode === 'view'} onChange={(e) => setEndereco(e.target.value)} autoComplete="street-address" />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="input-datanasc" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: '12px' }}>Data Nasc.:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
                    <input 
                      id="input-datanasc" 
                      name="dataNasc" 
                      type="text" 
                      className="input-line" 
                      value={dataNasc} 
                      readOnly={mode === 'view'} 
                      onChange={(e) => setDataNasc(mascaraData(e.target.value))} 
                      placeholder="DD/MM/AAAA" 
                      autoComplete="off" 
                      style={{ flex: 1 }} 
                    />
                    {mode !== 'view' && (
                      <input 
                        type="date" 
                        id="picker-datanasc"
                        name="picker-datanasc"
                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', bottom: 0, left: 0, width: '1px', height: '1px' }}
                        value={converterParaISO(dataNasc)}
                        onChange={(e) => setDataNasc(converterParaBR(e.target.value))}
                      />
                    )}
                    <MdDateRange 
                      size={18} 
                      color="#D4AF37" 
                      style={{ marginTop: '2px', flexShrink: 0, cursor: mode === 'view' ? 'default' : 'pointer' }} 
                      onClick={() => abrirCalendarioNativo('picker-datanasc')}
                    />
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label htmlFor="input-datarealizacao" style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontWeight: 700, fontSize: '12px' }}>Data Realização:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
                    <input 
                      id="input-datarealizacao" 
                      name="dataRealizacao" 
                      type="text" 
                      className="input-line" 
                      value={dataRealizacao} 
                      readOnly={mode === 'view'} 
                      onChange={(e) => setDataRealizacao(mascaraData(e.target.value))} 
                      placeholder="DD/MM/AAAA" 
                      autoComplete="off" 
                      style={{ flex: 1 }} 
                    />
                    {mode !== 'view' && (
                      <input 
                        type="date" 
                        id="picker-datarealizacao"
                        name="picker-datarealizacao"
                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', bottom: 0, left: 0, width: '1px', height: '1px' }}
                        value={converterParaISO(dataRealizacao)}
                        onChange={(e) => setDataRealizacao(converterParaBR(e.target.value))}
                      />
                    )}
                    <MdDateRange 
                      size={18} 
                      color="#D4AF37" 
                      style={{ marginTop: '2px', flexShrink: 0, cursor: mode === 'view' ? 'default' : 'pointer' }} 
                      onClick={() => abrirCalendarioNativo('picker-datarealizacao')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MÓDULO 1: PERGUNTAS SIM / NÃO */}
          <div className="modulo-card-mobile">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: "'Cinzel', serif", color: '#a855f7', fontWeight: 700, fontSize: '11px' }}>
                AVALIAÇÃO DE SAÚDE E ANTECEDENTES
              </span>
              {mode !== 'view' && (
                <button type="button" className="btn-toggle-edicao" onClick={() => setEditandoSimNao(!editandoSimNao)}>
                  <MdEdit size={12} /> {editandoSimNao ? 'Concluir' : ''}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {perguntasSimNao.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', gap: '6px' }}>
                  {mode !== 'view' && editandoSimNao ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexGrow: 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <button type="button" onClick={() => moverSimNao(idx, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '8px', padding: 0, color: '#9333ea' }}>▲</button>
                        <button type="button" onClick={() => moverSimNao(idx, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '8px', padding: 0, color: '#9333ea' }}>▼</button>
                      </div>
                      <input 
                        type="text" 
                        id={`edit-sn-${idx}`}
                        name={`edit_sn_${idx}`}
                        value={item.label}
                        onChange={(e) => atualizarTextoSimNao(idx, e.target.value)}
                        style={{ border: 'none', borderBottom: '1px dashed #a855f7', background: 'transparent', fontSize: '11px', width: '100%', outline: 'none' }}
                        autoComplete="off"
                      />
                      <button type="button" onClick={() => removerSimNao(idx)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: 0 }}>
                        <MdDelete size={13} />
                      </button>
                    </div>
                  ) : (
                    <span id={`label-sn-${idx}`} style={{ color: '#2D2D2D', fontWeight: 500, flexGrow: 1 }}>{item.label}</span>
                  )}

                  <div style={{ display: 'flex', gap: '6px', color: '#C8A24A', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap', alignItems: 'center' }}>
                    <label htmlFor={`${item.name}_sim`} style={{ cursor: mode === 'view' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <input 
                        type="radio" 
                        id={`${item.name}_sim`}
                        name={item.name} 
                        value="sim" 
                        disabled={mode === 'view'}
                        checked={respostasRadio[item.name] === 'sim'} 
                        onChange={() => handleRadioChange(item.name, 'sim')} 
                        autoComplete="off"
                      /> Sim
                    </label>
                    <label htmlFor={`${item.name}_nao`} style={{ cursor: mode === 'view' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <input 
                        type="radio" 
                        id={`${item.name}_nao`}
                        name={item.name} 
                        value="nao" 
                        disabled={mode === 'view'}
                        checked={respostasRadio[item.name] === 'nao'} 
                        onChange={() => handleRadioChange(item.name, 'nao')} 
                        autoComplete="off"
                      /> Não
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {mode !== 'view' && editandoSimNao && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(168, 85, 247, 0.4)' }}>
                <input 
                  type="text"
                  id="nova-sim-nao-input"
                  name="novaSimNaoTexto"
                  placeholder="Nova pergunta..."
                  value={novaSimNaoTexto}
                  onChange={(e) => setNovaSimNaoTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarSimNao(); } }}
                  style={{ flexGrow: 1, border: '1px solid #a855f7', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', outline: 'none', background: '#fff' }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={adicionarSimNao}
                  style={{ backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <MdAdd size={14} /> Add
                </button>
              </div>
            )}
          </div>

          {/* MÓDULO 2: HÁBITOS E CUIDADOS DIÁRIOS */}
          <div className="modulo-card-mobile">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: "'Cinzel', serif", color: '#a855f7', fontWeight: 700, fontSize: '11px' }}>
                HÁBITOS E CUIDADOS DIÁRIOS
              </span>
              {mode !== 'view' && (
                <button type="button" className="btn-toggle-edicao" onClick={() => setEditandoHabitos(!editandoHabitos)}>
                  <MdEdit size={12} /> {editandoHabitos ? 'Concluir' : ''}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {habitosComIcones.map((item, idx) => {
                const IconComponent = item.icone || MdSpa;
                const isOpen = dropdownAbertoIndex === idx;

                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11.5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {mode !== 'view' && editandoHabitos ? (
                        <div className="dropdown-icone-container" style={{ position: 'relative' }}>
                          <button
                            type="button"
                            id={`btn-icone-habito-${idx}`}
                            onClick={() => setDropdownAbertoIndex(isOpen ? null : idx)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '2px 4px', background: '#ffffff', border: '1px solid #a855f7',
                              borderRadius: '4px', cursor: 'pointer', width: '45px'
                            }}
                          >
                            <IconComponent size={14} color="#9333ea" />
                            <MdKeyboardArrowDown size={12} color="#9333ea" />
                          </button>

                          {isOpen && (
                            <div style={{
                              position: 'absolute', top: '100%', left: 0, marginTop: '2px',
                              background: '#ffffff', border: '1.5px solid #a855f7', borderRadius: '6px',
                              boxShadow: '0 4px 12px rgba(147, 51, 234, 0.25)', zIndex: 100,
                              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px',
                              padding: '6px', width: '150px', maxHeight: '180px', overflowY: 'auto'
                            }}>
                              {iconesDisponiveis.map((ic, i) => {
                                const ItemIcon = ic.componente;
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => atualizarIconeHabito(idx, ic)}
                                    style={{
                                      background: item.iconeId === ic.id ? '#fdf4ff' : 'transparent',
                                      border: item.iconeId === ic.id ? '1px solid #a855f7' : '1px solid transparent',
                                      borderRadius: '4px', padding: '4px', cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                  >
                                    <ItemIcon size={16} color="#9333ea" />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <IconComponent size={16} color="#9333ea" style={{ flexShrink: 0 }} />
                      )}

                      {mode !== 'view' && editandoHabitos ? (
                        <input 
                          type="text" 
                          id={`edit-habito-pergunta-${idx}`}
                          name={`edit_habito_pergunta_${idx}`}
                          value={item.pergunta}
                          onChange={(e) => atualizarTextoHabito(idx, e.target.value)}
                          style={{ border: 'none', borderBottom: '1px dashed #a855f7', background: 'transparent', fontSize: '11px', flexGrow: 1, outline: 'none' }}
                          autoComplete="off"
                        />
                      ) : (
                        <label htmlFor={item.name} style={{ color: '#2D2D2D', fontWeight: 500, flexGrow: 1, cursor: 'default' }}>{item.pergunta}</label>
                      )}

                      {mode !== 'view' && editandoHabitos && (
                        <button type="button" onClick={() => removerHabitoCustomizado(idx)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: 0 }}>
                          <MdDelete size={13} />
                        </button>
                      )}
                    </div>

                    <input 
                      type="text" 
                      id={item.name} 
                      name={item.name} 
                      className="habit-input-line" 
                      value={habitosTextos[item.name] || ''}
                      readOnly={mode === 'view'}
                      onChange={(e) => handleHabitoTextoChange(item.name, e.target.value)}
                      autoComplete="off"
                    />
                    <div className="habit-div-pdf">
                      {habitosTextos[item.name] || ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {mode !== 'view' && editandoHabitos && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(168, 85, 247, 0.4)', alignItems: 'center' }}>
                <div className="dropdown-icone-container" style={{ position: 'relative' }}>
                  <button
                    type="button"
                    id="btn-novo-icone-habito"
                    onClick={() => setDropdownNovoAberto(!dropdownNovoAberto)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '3px 4px', background: '#ffffff', border: '1px solid #a855f7',
                      borderRadius: '4px', cursor: 'pointer', width: '45px'
                    }}
                  >
                    {React.createElement(novoIconeSelecionado.componente, { size: 14, color: '#9333ea' })}
                    <MdKeyboardArrowDown size={12} color="#9333ea" />
                  </button>

                  {dropdownNovoAberto && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, marginTop: '2px',
                      background: '#ffffff', border: '1.5px solid #a855f7', borderRadius: '6px',
                      boxShadow: '0 4px 12px rgba(147, 51, 234, 0.25)', zIndex: 100,
                      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px',
                      padding: '6px', width: '150px', maxHeight: '180px', overflowY: 'auto'
                    }}>
                      {iconesDisponiveis.map((ic, i) => {
                        const ItemIcon = ic.componente;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => { setNovoIconeSelecionado(ic); setDropdownNovoAberto(false); }}
                            style={{
                              background: novoIconeSelecionado.id === ic.id ? '#fdf4ff' : 'transparent',
                              border: novoIconeSelecionado.id === ic.id ? '1px solid #a855f7' : '1px solid transparent',
                              borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                          >
                            <ItemIcon size={16} color="#9333ea" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <input 
                  type="text" 
                  id="novo-habito-pergunta-input"
                  name="novaPerguntaTexto"
                  placeholder="Nova pergunta de hábito..." 
                  value={novaPerguntaTexto}
                  onChange={(e) => setNovaPerguntaTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarHabitoPersonalizado(); } }}
                  style={{ flexGrow: 1, border: '1px solid #a855f7', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', outline: 'none', background: '#fff' }}
                  autoComplete="off"
                />

                <button
                  type="button"
                  onClick={adicionarHabitoPersonalizado}
                  style={{ backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <MdAdd size={14} /> Add
                </button>
              </div>
            )}
          </div>

          {/* DIVISOR: AVALIAÇÃO DA PELE */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.4)' }} />
            <span style={{ fontFamily: "'Cinzel', serif", color: '#2D2D2D', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>
              ❀ AVALIAÇÃO DA PELE ❀
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.4)' }} />
          </div>

          {/* MÓDULO 3: AVALIAÇÃO DA PELE */}
          <div className="modulo-card-mobile">
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {mode !== 'view' && (
                <button type="button" className="btn-toggle-edicao" onClick={() => setEditandoPele(!editandoPele)}>
                  <MdEdit size={12} /> {editandoPele ? 'Concluir' : ''}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11.5px' }}>
              {secoesPele.map((secao, secaoIdx) => (
                <div key={secaoIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '6px', borderBottom: secaoIdx < secoesPele.length - 1 ? '1px dashed rgba(168, 85, 247, 0.2)' : 'none' }}>
                  
                  {/* Cabeçalho da Categoria */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {mode !== 'view' && editandoPele ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexGrow: 1 }}>
                        <input 
                          type="text" 
                          id={`edit-secao-pele-${secaoIdx}`}
                          name={`edit_secao_pele_${secaoIdx}`}
                          value={secao.titulo}
                          onChange={(e) => atualizarTituloPele(secaoIdx, e.target.value)}
                          style={{ border: 'none', borderBottom: '1px dashed #a855f7', background: 'transparent', fontWeight: 700, color: '#C8A24A', fontSize: '11px', outline: 'none', flexGrow: 1 }}
                          autoComplete="off"
                        />
                        <button type="button" onClick={() => removerSecaoPele(secaoIdx)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: 0 }}>
                          <MdDelete size={13} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontWeight: 700, color: '#C8A24A' }}>{secao.titulo}:</span>
                    )}
                  </div>

                  {/* Opções */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {secao.opcoes.map((opt, optIdx) => (
                      <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <label htmlFor={`${secao.nameGrupo}_${opt.value}`} style={{ display: 'flex', gap: '3px', cursor: mode === 'view' ? 'default' : 'pointer', alignItems: 'center' }}>
                          <input 
                            type="radio" 
                            id={`${secao.nameGrupo}_${opt.value}`}
                            name={secao.nameGrupo} 
                            value={opt.value} 
                            disabled={mode === 'view'}
                            checked={respostasRadio[secao.nameGrupo] === opt.value} 
                            onChange={() => handleRadioChange(secao.nameGrupo, opt.value)} 
                            autoComplete="off"
                          /> {opt.label}
                        </label>

                        {mode !== 'view' && editandoPele && (
                          <button type="button" onClick={() => removerOpcaoPele(secaoIdx, optIdx)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: 0 }}>
                            <MdDelete size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Input rápido para nova opção */}
                  {mode !== 'view' && editandoPele && (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '2px' }}>
                      <input 
                        type="text"
                        id={`nova-opcao-pele-${secaoIdx}`}
                        name={`novoValorOpcaoPele_${secaoIdx}`}
                        placeholder="Nova opção para esta categoria..."
                        value={novoValorOpcaoPele[secaoIdx] || ''}
                        onChange={(e) => setNovoValorOpcaoPele(prev => ({ ...prev, [secaoIdx]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarOpcaoPele(secaoIdx); } }}
                        style={{ border: '1px solid #a855f7', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', outline: 'none', background: '#fff', flexGrow: 1 }}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => adicionarOpcaoPele(secaoIdx)}
                        style={{ backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <MdAdd size={12} /> Opção
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {mode !== 'view' && editandoPele && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(168, 85, 247, 0.4)' }}>
                <input 
                  type="text"
                  id="novo-titulo-pele-input"
                  name="novoTituloPele"
                  placeholder="Nova Categoria Principal..."
                  value={novoTituloPele}
                  onChange={(e) => setNovoTituloPele(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarSecaoPele(); } }}
                  style={{ flexGrow: 1, border: '1px solid #a855f7', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', outline: 'none', background: '#fff' }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={adicionarSecaoPele}
                  style={{ backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <MdAdd size={14} /> Categoria
                </button>
              </div>
            )}
          </div>

          {/* DIVISOR: ALTERAÇÕES CUTÂNEAS */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.4)' }} />
            <span style={{ fontFamily: "'Cinzel', serif", color: '#2D2D2D', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>
              ❀ ALTERAÇÕES CUTÂNEAS ❀
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.4)' }} />
          </div>

          {/* MÓDULO 4: ALTERAÇÕES CUTÂNEAS */}
          <div className="modulo-card-mobile">
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {mode !== 'view' && (
                <button type="button" className="btn-toggle-edicao" onClick={() => setEditandoAltCutaneas(!editandoAltCutaneas)}>
                  <MdEdit size={12} /> {editandoAltCutaneas ? 'Concluir' : ''}
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 10px', fontSize: '11px' }}>
              {alteracoesCutaneas.map((alt, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <label htmlFor={alt.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: mode === 'view' ? 'default' : 'pointer', flexGrow: 1 }}>
                    <input 
                      type="checkbox" 
                      id={alt.name} 
                      name={alt.name} 
                      disabled={mode === 'view'}
                      checked={!!checkboxesAlt[alt.name]} 
                      onChange={(e) => handleCheckboxChange(alt.name, e.target.checked)} 
                      autoComplete="off"
                    /> 
                    {mode !== 'view' && editandoAltCutaneas ? (
                      <input 
                        type="text"
                        id={`edit-alt-cutanea-${idx}`}
                        name={`edit_alt_cutanea_${idx}`}
                        value={alt.label}
                        onChange={(e) => atualizarAltCutaneaTexto(idx, e.target.value)}
                        style={{ border: 'none', borderBottom: '1px dashed #a855f7', background: 'transparent', fontSize: '10px', width: '100%', outline: 'none' }}
                        autoComplete="off"
                      />
                    ) : (
                      <span>{alt.label}</span>
                    )}
                  </label>

                  {mode !== 'view' && editandoAltCutaneas && (
                    <button type="button" onClick={() => removerAltCutanea(idx)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: 0 }}>
                      <MdDelete size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {mode !== 'view' && editandoAltCutaneas && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(168, 85, 247, 0.4)' }}>
                <input 
                  type="text"
                  id="nova-alt-cutanea-input"
                  name="novaAltCutaneaTexto"
                  placeholder="Nova alteração cutânea..."
                  value={novaAltCutaneaTexto}
                  onChange={(e) => setNovaAltCutaneaTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarAltCutanea(); } }}
                  style={{ flexGrow: 1, border: '1px solid #a855f7', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', outline: 'none', background: '#fff' }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={adicionarAltCutanea}
                  style={{ backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <MdAdd size={14} /> Add
                </button>
              </div>
            )}
          </div>

          {/* DIVISOR: OBSERVAÇÕES & CONDUTA */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.4)' }} />
            <span style={{ fontFamily: "'Cinzel', serif", color: '#2D2D2D', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>
              ❀ OBSERVAÇÕES & CONDUTA PROFISSIONAL ❀
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.4)' }} />
          </div>

          {/* MÓDULO 5: OBSERVAÇÃO COM SUPORTE A EXPANSÃO DINÂMICA */}
          <div className="modulo-card-mobile">
            <label htmlFor="observacoes-textarea" style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontWeight: 600, fontSize: '11px', display: 'block' }}>
              Notas e Restrições Adicionais:
            </label>
            
            {/* Textarea visível apenas na tela */}
            <textarea 
              ref={observacoesRef}
              id="observacoes-textarea"
              name="observacoes"
              rows="3"
              placeholder="Digite as observações detalhadas da avaliação..."
              value={observacoes}
              readOnly={mode === 'view'}
              onChange={(e) => setObservacoes(e.target.value)}
              className="textarea-edicao-original"
              style={{
                width: '100%',
                border: '1.5px solid rgba(200, 162, 74, 0.5)',
                borderRadius: '4px',
                background: 'transparent',
                padding: '8px',
                fontSize: '11.5px',
                outline: 'none',
                resize: 'none',
                overflow: 'hidden',
                fontFamily: "'Montserrat', sans-serif",
                boxSizing: 'border-box'
              }}
              autoComplete="off"
            />

            {/* Div legível renderizada apenas no momento da exportação do PDF */}
            <div className="div-visualizacao-pdf">
              {observacoes || 'Nenhuma observação registrada.'}
            </div>
          </div>

          {/* DIVISOR: LEMBRETES */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', pageBreakBefore: 'always', breakBefore: 'page' }} className="lembretes-paciente">
            <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.4)' }} />
            <span style={{ fontFamily: "'Cinzel', serif", color: '#1A1A1A', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>
              LEMBRETES PARA O PACIENTE
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(200, 162, 74, 0.4)' }} />
          </div>

      {/* MÓDULO 6: LEMBRETES */}
<div className="modulo-card-mobile" style={{ marginBottom: '20px' }}>
  
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
          <label htmlFor={`lembrete-titulo-${index}`} style={{ fontSize: '9.5px', fontWeight: 600, color: '#1A1A1A', display: 'block' }}>Título do Lembrete:</label>
          <input 
            type="text" 
            id={`lembrete-titulo-${index}`}
            name={`lembrete_titulo_${index}`}
            placeholder="Ex: Retorno em 30 dias / Usar protetor" 
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
            <label htmlFor={`lembrete-tipo-${index}`} style={{ fontSize: '9.5px', fontWeight: 600, color: '#1A1A1A', display: 'block' }}>Tipo:</label>
            {mode === 'view' ? (
              <input 
                type="text" 
                id={`lembrete-tipo-${index}`}
                name={`lembrete_tipo_${index}`}
                readOnly 
                value={lembrete.tipo === 'intervalo' ? 'Intervalo de tempo' : 'Data e Hora específica'} 
                className="habit-input-line lembrete-input-original" 
              />
            ) : (
              <select 
                id={`lembrete-tipo-${index}`}
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
                  <option value="horas">Horas</option>
                  <option value="dias">Dias</option>
                  <option value="minutos">Minutos</option>
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
        backgroundColor: '#C8A24A', color: '#fff', border: 'none', borderRadius: '4px',
        padding: '6px', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px'
      }}
    >
      <MdAdd size={12} /> {lembretes.length === 0 ? 'Adicionar Lembrete' : 'Outro Lembrete'}
    </button>
  )}
</div>
        </div>
      </div>
      {/* ⬇️ VERSÃO DESKTOP OCULTA PARA EXPORTAÇÃO DE PDF NO MOBILE */}
{pdfDesktopRenderizando && (
  <div
    aria-hidden="true"
    style={{
      position: 'fixed',
      left: '-99999px',
      top: 0,
      width: '1175px', // largura máxima da FichaDesktop
      zIndex: -1,
      pointerEvents: 'none',
      opacity: 0.01 // 0.01 evita otimizações do navegador que pulam render
    }}
  >
    <FichaDesktop
      mode="view"
      fichaSelecionada={fichaSelecionada}
    />
  </div>
)}
    </div>
  );
}