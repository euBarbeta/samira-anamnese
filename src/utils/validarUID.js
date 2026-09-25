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