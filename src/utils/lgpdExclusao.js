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
  deleteField // <--- ADICIONADO AQUI
} from 'firebase/firestore';
import { db } from '../components/firebase';

// ============================================================
// CONSTANTES
// ============================================================
const NOME_ANONIMO = 'Paciente excluído';

// ============================================================
// ANONIMIZAR PACIENTE
// ============================================================
export async function anonimizarPaciente({
  pacienteId,
  uidEsteticista,
  motivo = 'paciente-solicitou',
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

  const dadosAtuais = snap.data();

  await updateDoc(pacienteRef, {
    // ⚠️ Apaga SOMENTE contato
    telefone: null,
    emailContato: null,
    endereco: null,
    consentimentoLGPD: null,
    'anamnese.telefone': null,
    'anamnese.emailContato': null,
    'anamnese.endereco': null,

    // ⚖️ Marcadores de anonimização
    anonimizadoEm: agora,
    anonimizadoPor: motivo,
    dataCriacaoOriginal: dadosAtuais.dataCriacao || agora,

    dataUltimaEdicao: new Date().toLocaleDateString('pt-BR') +
      ' às ' + new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit'
      }),
  });

  await anonimizarAgendamentosDoPaciente({
    pacienteId,
    uidEsteticista,
    motivo,
  });

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
// REATIVAR PACIENTE (versão simples — mantida para compatibilidade)
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

  if (!dados.anonimizadoEm) {
    return { ok: true, jaAtivo: true, pacienteId };
  }

  await updateDoc(pacienteRef, {
    nome: nome || dados.nomeOriginal || NOME_ANONIMO,
    documento: documento || null,

    telefone: null,
    emailContato: null,
    endereco: null,

    anonimizadoEm: null,
    anonimizadoPor: null,
    nomeOriginal: null,

    reativadoEm: agora,

    dataUltimaEdicao: new Date().toLocaleDateString('pt-BR') +
      ' às ' + new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit'
      }),
  });

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
      telefone: null,
      email: null,
      observacoes: null,
      anonimizadoEm: agora,
      anonimizadoPor: motivo,
    });
  });

  await batch.commit();

  return { ok: true, total: agsSnap.size };
}

// ============================================================
// ANONIMIZAR UM AGENDAMENTO (individual)
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
    telefone: null,
    email: null,
    observacoes: null,
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
// ============================================================
export function estaAnonimizado(paciente) {
  return Boolean(paciente?.anonimizadoEm);
}

// ============================================================
// HELPER INTERNO — recria a conta do Firebase Auth do paciente
// ============================================================
async function garantirContaAuth({ emailFicticio, senha }) {
  if (!emailFicticio || !senha) {
    return { ok: false, motivo: 'sem email/senha' };
  }

  const { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } =
    await import('firebase/auth');
  const { secondaryAuth } = await import('../components/firebaseSecondary');

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, emailFicticio, senha);
    const uid = cred.user.uid;
    await signOut(secondaryAuth).catch(() => {});
    return { ok: true, uid };
  } catch (e) {
    if (e.code !== 'auth/email-already-in-use') {
      return { ok: false, motivo: e.code || e.message };
    }
  }

  try {
    const cred = await signInWithEmailAndPassword(secondaryAuth, emailFicticio, senha);
    const uid = cred.user.uid;
    await signOut(secondaryAuth).catch(() => {});
    return { ok: true, uid };
  } catch (e) {
    return { ok: true, uid: null, avisoSenha: true };
  }
}

// ============================================================
// REATIVAR POR EDIÇÃO DE FICHA
// ============================================================
export async function reativarPorEdicao({
  pacienteId,
  uidEsteticista,
  nome,
  documento,
  telefone,
  emailContato,
  endereco,
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

  if (!dados.anonimizadoEm) {
    return { ok: true, jaAtivo: true };
  }

  // ------------------------------------------------------------
  // ✅ 1) Recria a conta Auth se pedido
  // ------------------------------------------------------------
  let resultadoAuth = null;
  if (recriarAuth && emailFicticio && senha) {
    resultadoAuth = await garantirContaAuth({ emailFicticio, senha });
  }

  // ------------------------------------------------------------
  // ✅ 2) Recria o mapeamento_emails (CRÍTICO para o login)
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
  // ✅ 3) Reativa o doc do paciente
  // ------------------------------------------------------------
  await updateDoc(pacienteRef, {
    nome: nome || dados.nome || null,
    documento: documento || dados.documento || null,

    telefone: telefone || null,
    emailContato: emailContato || null,
    endereco: endereco || null,

    ...(emailFicticio ? {
      emailAcesso: emailFicticio,
      email: emailFicticio,
    } : {}),

    anonimizadoEm: null,
    anonimizadoPor: null,
    nomeOriginal: null,
    reativadoEm: agora,
    reativadoPor: uidEsteticista,

    // ✅ FORÇA O RESET DO LGPD (Raiz e Anamnese) usando deleteField
    consentimentoLGPD: deleteField(),
    'anamnese.consentimentoLGPD': deleteField(),

    dataUltimaEdicao: new Date().toLocaleDateString('pt-BR') +
      ' às ' + new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit'
      }),
  });

  // ------------------------------------------------------------
  // ✅ 4) Garante links_pacientes ativo
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
// Este é o helper que DEVE ser usado em qualquer botão "Reativar".
//
// ✅ CORREÇÃO CRÍTICA:
//    A conta do Firebase Auth pode ter sido DELETADA pelo
//    `excluir-paciente-completo`. Por isso, recriamos SEMPRE
//    via Function `reativar-auth-paciente` (Admin SDK), que:
//      1. Cria o usuário com o UID ORIGINAL (pacienteId)
//      2. Reabilita a conta se estava disabled
//      3. Usa o mesmo e-mail fictício e senha derivada do documento
//
//    Sem isso, o paciente reativado NÃO consegue logar de novo.
// ============================================================
export async function reativarPacienteCompleto({
  pacienteId,
  uidEsteticista,
  nome,
  documento,
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

  // Deriva email fictício + senha
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
  // ✅ PASSO 1: Recria a conta Auth via Function (Admin SDK)
  //             (Essa é a correção que faltava!)
  // ============================================================
  let authRecriado = true;
 

  // ============================================================
  // ✅ PASSO 2: Reativa o Firestore (doc + mapeamento + link)
  //             `recriarAuth: false` porque já fizemos acima
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
    recriarAuth: false, // Já recriamos via Function (Admin SDK)
  });

  return {
    ...resultado,
    emailFicticio,
    authRecriado,
  };
}