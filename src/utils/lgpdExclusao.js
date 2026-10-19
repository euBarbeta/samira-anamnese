// src/utils/lgpdExclusao.js
//
// ⚖️ LGPD + Lei 13.787/2018 — Central de exclusão e anonimização
// ------------------------------------------------------------
// Este arquivo é a ÚNICA fonte de verdade para:
//   - Anonimizar pacientes (mantém prontuário 20 anos)
//   - Reativar pacientes (quando voltam)
//   - Anonimizar agendamentos (nunca deletar)
//
// REGRA DE OURO:
//   - NUNCA usar deleteDoc em pacientes ou agendamentos
//   - SEMPRE usar updateDoc marcando anonimizadoEm
//   - Prontuário (anamnese/evoluções/fotos) NUNCA é apagado

import {
  doc, getDoc, getDocs, collection, query, where, updateDoc, writeBatch, setDoc,

} from 'firebase/firestore';
import { db } from '../components/firebase';

// ============================================================
// CONSTANTES
// ============================================================

const NOME_ANONIMO = 'Paciente excluído';

// ============================================================
// ANONIMIZAR PACIENTE
// ------------------------------------------------------------
// - Limpa dados de contato (nome, documento, telefone, email, endereço)
// - MANTÉM anamnese, evoluções e fotos (obrigação legal — 20 anos)
// - Marca com anonimizadoEm (rastreio LGPD)
// - Desativa link de acesso
//
// Uso:
//   - Quando a ESTETA exclui uma pasta (PainelEsteticista)
//   - Quando o PACIENTE exclui a conta (ModalExclusaoConta)
// ============================================================
export async function anonimizarPaciente({
  pacienteId,
  uidEsteticista,
  motivo = 'paciente-solicitou',  // 'paciente-solicitou' | 'esteta-excluiu'
}) {
  if (!pacienteId || !uidEsteticista) {
    throw new Error('pacienteId e uidEsteticista são obrigatórios.');
  }

  const agora = new Date().toISOString();

  const pacienteRef = doc(
    db,
    'usuarios',
    uidEsteticista,
    'pacientes',
    String(pacienteId)
  );

  // ============================================================
  // 1) Lê o paciente atual pra preservar campos internos
  //    (o que NÃO pode ser perdido — ex: codigos, timestamps originais)
  // ============================================================
  const snap = await getDoc(pacienteRef);
  if (!snap.exists()) {
    throw new Error('Paciente não encontrado.');
  }

  const dadosAtuais = snap.data();

  // ============================================================
  // 2) Atualiza o paciente — ANONIMIZA contato, MANTÉM prontuário
  // ============================================================
await updateDoc(pacienteRef, {
  // ⚖️ LGPD + Lei 13.787/2018:
  //    - NOME e DOCUMENTO são MANTIDOS (parte do prontuário)
  //    - Só os dados de CONTATO são apagados (não são prontuário)

  // ⚠️ Apaga SOMENTE contato
  telefone: null,
  emailContato: null,
  endereco: null,

  // ⚠️ Apaga e-mail de acesso (não é prontuário)
  emailAcesso: null,
  email: null,

  // ⚠️ Consentimento cai (foi revogado)
  consentimentoLGPD: null,
   'anamnese.telefone': null,
  'anamnese.emailContato': null,
  'anamnese.endereco': null,

  // ✅ NOME e DOCUMENTO ficam intactos (não colocamos no update)

  // ⚖️ Marcadores de anonimização
  anonimizadoEm: agora,
  anonimizadoPor: motivo,
  dataCriacaoOriginal: dadosAtuais.dataCriacao || agora,

  dataUltimaEdicao: new Date().toLocaleDateString('pt-BR') +
    ' às ' + new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit'
    }),
});

  // ============================================================
  // 3) Anonimiza TODOS os agendamentos desse paciente
  // ============================================================
  await anonimizarAgendamentosDoPaciente({
    pacienteId,
    uidEsteticista,
      motivo,
  });

  // ============================================================
  // 4) Desativa o link de acesso (não apaga)
  // ============================================================
  try {
    const linkRef = doc(db, 'links_pacientes', String(pacienteId));
    const linkSnap = await getDoc(linkRef);
    if (linkSnap.exists()) {
      await updateDoc(linkRef, {
        ativo: false,
        desativadoEm: agora,
        motivoDesativacao: motivo,
      });
    }
  } catch (e) {
    console.warn('Falha ao desativar link (não bloqueia):', e);
  }

  // ============================================================
  // 5) Apaga o mapeamento de email (não é dado de prontuário)
  // ============================================================
  if (dadosAtuais.emailAcesso) {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      const mapRef = doc(
        db,
        'mapeamento_emails',
        dadosAtuais.emailAcesso.toLowerCase()
      );
      const mapSnap = await getDoc(mapRef);
      if (mapSnap.exists()) {
        await deleteDoc(mapRef);
      }
    } catch (e) {
      console.warn('Falha ao apagar mapeamento de email:', e);
    }
  }

  return { ok: true, pacienteId, anonimizadoEm: agora };
}

// ============================================================
// REATIVAR PACIENTE
// ------------------------------------------------------------
// - Remove marcadores de anonimização
// - Restaura nome e documento (dados de prontuário)
// - NÃO restaura telefone, email ou endereço (consentimento novo)
// - NÃO restaura consentimentoLGPD (paciente aceita de novo)
//
// Uso:
//   - Quando o paciente volta e a esteta cria pasta com mesmo
//     nome + documento (uid determinístico bate)
// ============================================================
export async function reativarPaciente({
  pacienteId,
  uidEsteticista,
  nome,
  documento,
}) {
  if (!pacienteId || !uidEsteticista) {
    throw new Error('pacienteId e uidEsteticista são obrigatórios.');
  }

  const agora = new Date().toISOString();

  const pacienteRef = doc(
    db,
    'usuarios',
    uidEsteticista,
    'pacientes',
    String(pacienteId)
  );

  const snap = await getDoc(pacienteRef);
  if (!snap.exists()) {
    throw new Error('Paciente não encontrado.');
  }

  const dados = snap.data();

  // ============================================================
  // ⚠️ Só reativa se estiver anonimizado
  // ============================================================
  if (!dados.anonimizadoEm) {
    return { ok: true, jaAtivo: true, pacienteId };
  }

  // ============================================================
  // Restaura nome + documento (dados de prontuário)
  // Mantém dataCriacao ORIGINAL (não sobrescreve)
  // ============================================================
  await updateDoc(pacienteRef, {
    nome: nome || dados.nomeOriginal || NOME_ANONIMO,
    documento: documento || null,

    // ⚠️ Contato continua NULL — será re-preenchido pela esteta
    telefone: null,
    emailContato: null,
    endereco: null,

    // ⚖️ LGPD — limpa marcadores de anonimização
    anonimizadoEm: null,
    anonimizadoPor: null,
    nomeOriginal: null,

    // ✅ Marca reativação pra auditoria (não aparece na UI)
    reativadoEm: agora,

    dataUltimaEdicao: new Date().toLocaleDateString('pt-BR') +
      ' às ' + new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit'
      }),
  });

  // ============================================================
  // Reativa o link de acesso
  // ============================================================
  try {
    const linkRef = doc(db, 'links_pacientes', String(pacienteId));
    const linkSnap = await getDoc(linkRef);
    if (linkSnap.exists()) {
      await updateDoc(linkRef, {
        ativo: true,
        reativadoEm: agora,
      });
    }
  } catch (e) {
    console.warn('Falha ao reativar link:', e);
  }

  return { ok: true, pacienteId, reativadoEm: agora };
}

// ============================================================
// ANONIMIZAR AGENDAMENTOS DO PACIENTE
// ------------------------------------------------------------
// - Anonimiza TODOS os agendamentos com aquele pacienteId
// - Mantém o registro (não deleta) — obrigação legal
// - Limpa PII: nome, documento, telefone, email, observações
// ============================================================
export async function anonimizarAgendamentosDoPaciente({
  pacienteId,
  uidEsteticista,
    motivo = 'anonimizacao',
}) {
  const agsSnap = await getDocs(
    query(
      collection(db, 'agendamentos'),
      where('pacienteId', '==', String(pacienteId))
    )
  );

  if (agsSnap.empty) return { ok: true, total: 0 };

  const agora = new Date().toISOString();
  const batch = writeBatch(db);

 agsSnap.docs.forEach((d) => {
  batch.update(d.ref, {
    // ⚠️ Só apaga CONTATO e observações
    telefone: null,
    email: null,
    observacoes: null,

    // ✅ NOME e DOCUMENTO ficam (são prontuário)

    anonimizadoEm: agora,
    anonimizadoPor: motivo,
  });
});

  await batch.commit();

  return { ok: true, total: agsSnap.size };
}

// ============================================================
// ANONIMIZAR UM AGENDAMENTO (individual)
// ------------------------------------------------------------
// Usado quando o PACIENTE remove um agendamento da própria lista
// (antes era deleteDoc, agora é anonimização)
// ============================================================
export async function anonimizarAgendamento({
  agendamentoId,
  motivo = 'paciente-removeu',
}) {
  if (!agendamentoId) {
    throw new Error('agendamentoId é obrigatório.');
  }

  const agora = new Date().toISOString();
  const ref = doc(db, 'agendamentos', String(agendamentoId));

  await updateDoc(ref, {
  // ⚠️ Só apaga contato + observações
  telefone: null,
  email: null,
  observacoes: null,

  // ✅ Nome e documento ficam (são prontuário)

  anonimizadoEm: agora,
  anonimizadoPor: motivo,
  ocultoParaPaciente: true,
  ocultadoPacienteEm: agora,
  atualizadoEm: agora,
});

  return { ok: true, agendamentoId };
}

// ============================================================
// VERIFICAR SE PACIENTE ESTÁ ANONIMIZADO
// ------------------------------------------------------------
// Helper pra UI decidir se mostra a aba "Arquivadas"
// ============================================================
export function estaAnonimizado(paciente) {
  return Boolean(paciente?.anonimizadoEm);
}
// ============================================================
// HELPER INTERNO — recria a conta do Firebase Auth do paciente
// ------------------------------------------------------------
// Chamado quando o paciente foi anonimizado (conta Auth pode ter
// sido deletada) e precisamos recriar o acesso dele.
//
// Usa secondaryAuth pra não deslogar a esteticista.
// Retorna { ok, uid, email, senha } ou { ok: false, motivo }.
// ============================================================
async function garantirContaAuth({ emailFicticio, senha }) {
  if (!emailFicticio || !senha) {
    return { ok: false, motivo: 'sem email/senha' };
  }

  // Import dinâmico pra evitar ciclo com firebaseSecondary
  const { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } =
    await import('firebase/auth');
  const { secondaryAuth } = await import('../components/firebaseSecondary');

  // 1) Tenta criar
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, emailFicticio, senha);
    const uid = cred.user.uid;
    await signOut(secondaryAuth).catch(() => {});
    return { ok: true, uid };
  } catch (e) {
    if (e.code !== 'auth/email-already-in-use') {
      // Erro real (senha fraca? email inválido?)
      return { ok: false, motivo: e.code || e.message };
    }
  }

  // 2) Conta já existe → tenta logar pra confirmar que a senha bate
  try {
    const cred = await signInWithEmailAndPassword(secondaryAuth, emailFicticio, senha);
    const uid = cred.user.uid;
    await signOut(secondaryAuth).catch(() => {});
    return { ok: true, uid };
  } catch (e) {
    // Conta existe mas senha não bate.
    // Não é erro fatal — o paciente só não vai poder logar até
    // redefinir a senha. Retornamos ok pra não travar a reativação.
    return { ok: true, uid: null, avisoSenha: true };
  }
}

// ============================================================
// REATIVAR POR EDIÇÃO DE FICHA
// ------------------------------------------------------------
// Chamado quando a esteta edita a ficha de um paciente arquivado
// (via botão "Reativar" nos painéis ou pelo painel de agendamentos).
//
// Passos:
//   1) (Opcional) Recria a conta Auth do paciente, se receber email+senha
//   2) (Opcional) Recria o mapeamento_emails
//   3) Reativa o doc do paciente (remove anonimizadoEm)
//   4) Restaura/garante o links_pacientes ativo
//
// ⚖️ LGPD: telefone, emailContato e endereço NÃO são restaurados
//    automaticamente — ficam null pra esteta preencher de novo
//    e salvar. ConsentimentoLGPD também precisa ser re-aceito.
//
// Parâmetros novos (opcionais — retrocompatível):
//   - emailFicticio: "nome.sobrenome@sistema.local"
//   - senha: senha fictícia derivada do documento
//   - recriarAuth: boolean — se true, tenta recriar o Auth
// ============================================================
export async function reativarPorEdicao({
  pacienteId,
  uidEsteticista,
  nome,
  documento,
  telefone,
  emailContato,
  endereco,
  // ⬇️ NOVOS (opcionais)
  emailFicticio = null,
  senha = null,
  recriarAuth = false,
}) {
  if (!pacienteId || !uidEsteticista) {
    throw new Error('pacienteId e uidEsteticista são obrigatórios.');
  }

  const agora = new Date().toISOString();

  const pacienteRef = doc(
    db,
    'usuarios',
    uidEsteticista,
    'pacientes',
    String(pacienteId)
  );

  const snap = await getDoc(pacienteRef);
  if (!snap.exists) {
    throw new Error('Paciente não encontrado.');
  }

  const dados = snap.data();

  // Só reativa se realmente estiver anonimizado
  if (!dados.anonimizadoEm) {
    return { ok: true, jaAtivo: true };
  }

  // ------------------------------------------------------------
  // 1) Recria a conta Auth (se pedido e se tiver email+senha)
  // ------------------------------------------------------------
  let resultadoAuth = null;
  if (recriarAuth && emailFicticio && senha) {
    resultadoAuth = await garantirContaAuth({ emailFicticio, senha });
  }

  // ------------------------------------------------------------
  // 2) Recria o mapeamento_emails (se tiver emailFicticio)
  // ------------------------------------------------------------
  if (emailFicticio) {
    try {
      await setDoc(
        doc(db, 'mapeamento_emails', emailFicticio.toLowerCase()),
        {
          profissionalUid: uidEsteticista,
          pacienteId: String(pacienteId),
          atualizadoEm: agora,
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Falha ao recriar mapeamento de email:', e);
    }
  }

  // ------------------------------------------------------------
  // 3) Reativa o doc do paciente
  // ------------------------------------------------------------
  await updateDoc(pacienteRef, {
    // ✅ Restaura dados de prontuário
    nome: nome || dados.nome || null,
    documento: documento || dados.documento || null,

    // ⚠️ LGPD: contato NÃO é restaurado automaticamente
    //    (só preenche se a esteta passar explicitamente)
    telefone: telefone || null,
    emailContato: emailContato || null,
    endereco: endereco || null,

    // ✅ Se temos email fictício, restaura no doc
    ...(emailFicticio ? {
      emailAcesso: emailFicticio,
      email: emailFicticio,
    } : {}),

    // ⚖️ Limpa marcadores de anonimização
    anonimizadoEm: null,
    anonimizadoPor: null,
    nomeOriginal: null,
    reativadoEm: agora,
    reativadoPor: uidEsteticista,

    dataUltimaEdicao: new Date().toLocaleDateString('pt-BR') +
      ' às ' + new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit'
      }),
  });

  // ------------------------------------------------------------
  // 4) Garante links_pacientes ativo (recria se faltar)
  // ------------------------------------------------------------
  try {
    const linkRef = doc(db, 'links_pacientes', String(pacienteId));
    await setDoc(
      linkRef,
      {
        pacienteId: String(pacienteId),
        uidEsteticista: String(uidEsteticista),
        ativo: true,
        reativadoEm: agora,
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Falha ao reativar link:', e);
  }

  return {
    ok: true,
    pacienteId,
    reativadoEm: agora,
    auth: resultadoAuth,
  };
}

// ============================================================
// REATIVAR PACIENTE — COMPLETO (helper de alto nível)
// ------------------------------------------------------------
// Faz TODOS os passos de uma vez:
//   1) Deriva email fictício e senha a partir de nome+documento
//   2) Recria Auth
//   3) Recria mapeamento_emails
//   4) Reativa o doc do paciente
//   5) Reativa/cria links_pacientes
//
// Use este helper em qualquer botão "Reativar paciente" para
// garantir que o paciente consiga logar de novo depois.
// ============================================================
export async function reativarPacienteCompleto({
  pacienteId,
  uidEsteticista,
  nome,
  documento,
  // Opcionais — se não vierem, tentamos puxar do agendamento
  telefone = null,
  emailContato = null,
  endereco = null,
}) {
  if (!pacienteId || !uidEsteticista) {
    throw new Error('pacienteId e uidEsteticista são obrigatórios.');
  }

  const nomeFinal = (nome || '').trim();
  if (!nomeFinal) {
    throw new Error('Nome é obrigatório para reativar o paciente.');
  }

  // ============================================================
  // 1) Deriva email fictício + senha (mesma lógica do handleSalvarAnamnese)
  // ============================================================
  const partes = nomeFinal.split(/\s+/);
  const primeiroNome = (partes[0] || 'usuario')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sobrenome = (partes[partes.length - 1] || 'paciente')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const emailFicticio = `${primeiroNome}.${sobrenome}@sistema.local`;

  const docLimpo = String(documento || '').replace(/\D/g, '');
  const senha = (docLimpo.length >= 6 ? docLimpo.slice(-6) : '123456')
    .padEnd(6, '0');

  // ============================================================
  // 2) Recria Auth + mapeamento + reativa doc (tudo junto)
  // ============================================================
  const resultado = await reativarPorEdicao({
    pacienteId,
    uidEsteticista,
    nome: nomeFinal,
    documento: documento || null,
    telefone,
    emailContato,
    endereco,
    emailFicticio,
    senha,
    recriarAuth: true,
  });

  return {
    ...resultado,
    emailFicticio,
  };
}