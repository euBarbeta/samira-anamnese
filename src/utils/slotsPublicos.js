// src/utils/slotsPublicos.js
//
// ⚡ Escuta em TEMPO REAL a coleção pública de slots ocupados.
//    Latência típica: 100-300ms.
//    Sem polling, sem PII.

import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../components/firebase';

/**
 * Escuta em tempo real os slots ocupados de uma esteta.
 *
 * @param {string} uidEsteticista
 * @param {(slots: Array) => void} onSlots
 * @returns {() => void} unsubscribe
 */
export function escutarSlotsPublicos(uidEsteticista, onSlots) {
  if (!uidEsteticista) return () => {};

  const q = query(
    collection(db, 'slots_ocupados_publicos'),
    where('uidEsteticista', '==', String(uidEsteticista))
  );

  const unsub = onSnapshot(
    q,
    (snap) => {
      const slots = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onSlots(slots);
    },
    (err) => {
      console.error('Erro listener slots públicos:', err);
    }
  );

  return unsub;
}