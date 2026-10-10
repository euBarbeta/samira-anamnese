// src/utils/segurancaEstado.js
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../components/firebase';
import { obterLocalizacao } from './geolocalizacao';
import { gerarFingerprint, rotuloDispositivo, plataformaAtual } from './fingerprint';

/**
 * Atualiza o doc `seguranca_estado/{pacienteId}` com:
 * - status da localização
 * - lat/lng/cidade (se ativa)
 * - fingerprint do dispositivo
 * - data/hora da última verificação
 *
 * Chame isso em 2 momentos:
 *  1. Logo depois do login (pra registrar)
 *  2. Quando o app volta do background (pra atualizar status)
 */
export async function atualizarEstadoSeguranca(pacienteId, opcoes = {}) {
  if (!pacienteId) return null;

  const { incluirLocalizacao = true } = opcoes;

  const fingerprint = gerarFingerprint();
  const dispositivo = rotuloDispositivo();
  const plataforma = plataformaAtual();

  let localizacao = { status: 'nao_solicitada' };

  if (incluirLocalizacao) {
    try {
      localizacao = await obterLocalizacao();
    } catch (e) {
      console.warn('Falha obter localização:', e);
      localizacao = { status: 'nao_suportado' };
    }
  }

  const agora = new Date().toISOString();
  const ref = doc(db, 'seguranca_estado', String(pacienteId));

  // Lê o doc atual pra detectar troca de dispositivo
  let anterior = null;
  try {
    const snap = await getDoc(ref);
    anterior = snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('Falha lendo seguranca_estado:', e);
  }

  const trocouDispositivo =
    anterior?.fingerprint && anterior.fingerprint !== fingerprint;

  const payload = {
    pacienteId: String(pacienteId),
    localizacaoStatus: localizacao.status,
    lat: localizacao.lat ?? null,
    lng: localizacao.lng ?? null,
    cidade: localizacao.cidade ?? null,
    pais: localizacao.pais ?? null,
    fingerprint,
    dispositivo,
    plataforma,
    ultimaVerificacao: agora,
    trocouDispositivo: trocouDispositivo || false,
    dispositivoAnterior: trocouDispositivo ? anterior?.dispositivo || null : null,
    atualizadoEm: agora,
  };

  // Preserva o campo "historicoDispositivos" (array de strings)
  if (anterior?.historicoDispositivos) {
    payload.historicoDispositivos = anterior.historicoDispositivos;
  } else {
    payload.historicoDispositivos = [dispositivo];
  }

  if (
    !payload.historicoDispositivos.includes(dispositivo) &&
    trocouDispositivo
  ) {
    payload.historicoDispositivos.push(dispositivo);
  }

  try {
    await setDoc(ref, payload, { merge: true });
    return payload;
  } catch (e) {
    console.error('Falha salvando estado de segurança:', e);
    return null;
  }
}