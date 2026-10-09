import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../components/firebase';

export async function validarUIDPaciente(uid) {
  if (!uid || typeof uid !== 'string') return false;
  if (uid.length < 6 || uid.length > 128) return false;
  try {
    const snap = await getDoc(doc(db, 'links_pacientes', uid));
    if (!snap.exists()) return false;
    return snap.data().ativo !== false;
  } catch (e) {
    console.warn('Erro ao validar UID:', e);
    return false;
  }
}

export async function registrarLinkPaciente(pacienteId, uidEsteticista) {
  await setDoc(
    doc(db, 'links_pacientes', String(pacienteId)),
    {
      pacienteId: String(pacienteId),
      uidEsteticista: String(uidEsteticista),
      criadoEm: new Date().toISOString(),
      ativo: true,
    },
    { merge: true }
  );
}
export function gerarUidDeterministico(chave) {
  const base = String(chave || '');
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i);
    hash |= 0; // mantém como int32
  }
  return `u${Math.abs(hash).toString(36)}`;
}/**
 * ✅ Remove recursivamente qualquer campo `undefined` de um objeto.
 * O Firestore rejeita `undefined` — `null` é permitido, `undefined` não.
 *
 * Use SEMPRE antes de `setDoc`/`addDoc`/`updateDoc` quando o objeto
 * puder conter campos opcionais que não foram preenchidos.
 */
export function limparUndefined(obj) {
  if (obj === null) return null;
  if (obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(limparUndefined).filter((v) => v !== undefined);
  }
  if (obj instanceof Date) return obj;
  if (typeof obj === 'object') {
    const limpo = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue; // pula undefined
      limpo[k] = limparUndefined(v);
    }
    return limpo;
  }
  return obj;
}