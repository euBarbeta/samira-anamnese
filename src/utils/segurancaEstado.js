// src/utils/segurancaEstado.js
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../components/firebase';
import { obterLocalizacao, detectarEstadoGPS } from './geolocalizacao';
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

/**
 * ✅ NOVO: Monitora a localização em TEMPO REAL.
 *
 * Detecta:
 *  - GPS ligado/desligado
 *  - Permissão concedida/negada
 *  - Mudanças de posição
 *
 * E atualiza o doc `seguranca_estado/{id}` sempre que algo muda.
 *
 * Retorna uma função pra parar o monitoramento.
 *
 * Uso:
 *   const parar = iniciarMonitoramentoLocalizacao(pacienteId);
 *   // ... depois: parar();
 */
export function iniciarMonitoramentoLocalizacao(pacienteId) {
  if (!pacienteId) return () => {};

  let cancelado = false;
  let ultimoStatusEnviado = null;
  let ultimaAtualizacaoMs = 0;

  // ⏱️ Limita updates no Firestore (máx 1 a cada 15s)
  const INTERVALO_MIN_MS = 15000;

  const ref = doc(db, 'seguranca_estado', String(pacienteId));

  async function sincronizar(payloadParcial = {}) {
    if (cancelado) return;

    const agora = Date.now();
    const mudouStatus = payloadParcial.localizacaoStatus !== ultimoStatusEnviado;

    // Se não mudou status E passou pouco tempo → ignora (evita spammar)
    if (!mudouStatus && agora - ultimaAtualizacaoMs < INTERVALO_MIN_MS) {
      return;
    }

    ultimaAtualizacaoMs = agora;
    if (payloadParcial.localizacaoStatus) {
      ultimoStatusEnviado = payloadParcial.localizacaoStatus;
    }

    try {
      await setDoc(
        ref,
        {
          pacienteId: String(pacienteId),
          ...payloadParcial,
          ultimaVerificacao: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Falha sincronizando segurança:', e);
    }
  }

  // 1) Checa estado inicial imediatamente
  detectarEstadoGPS().then((estado) => {
    if (cancelado) return;

    if (estado === 'ligado') {
      // Já tenta pegar cidade
      obterLocalizacao().then((loc) => {
        if (cancelado) return;
        sincronizar({
          localizacaoStatus: loc.status,
          lat: loc.lat ?? null,
          lng: loc.lng ?? null,
          cidade: loc.cidade ?? null,
          pais: loc.pais ?? null,
        });
      });
    } else {
      sincronizar({ localizacaoStatus: estado });
    }
  });

  // 2) Escuta mudanças de permissão (quando o usuário muda em Configurações)
  let statusPermissaoRef = null;
  if (navigator.permissions?.query) {
    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      if (cancelado) return;
      statusPermissaoRef = status;

      status.onchange = () => {
        if (cancelado) return;

        // Re-checa estado real
        detectarEstadoGPS().then((estado) => {
          if (cancelado) return;
          if (estado === 'ligado') {
            obterLocalizacao().then((loc) => {
              if (cancelado) return;
              sincronizar({
                localizacaoStatus: loc.status,
                lat: loc.lat ?? null,
                lng: loc.lng ?? null,
                cidade: loc.cidade ?? null,
                pais: loc.pais ?? null,
              });
            });
          } else {
            sincronizar({ localizacaoStatus: estado });
          }
        });
      };
    }).catch(() => {});
  }

  // 3) Polling leve (a cada 30s) pra detectar GPS ligando/desligando
  //    (o permissions.onchange NÃO dispara quando GPS é desligado,
  //     só quando a permissão muda)
  const intervalId = setInterval(async () => {
    if (cancelado) return;

    const estado = await detectarEstadoGPS();
    if (cancelado) return;

    if (estado === 'ligado') {
      const loc = await obterLocalizacao();
      if (cancelado) return;
      sincronizar({
        localizacaoStatus: loc.status,
        lat: loc.lat ?? null,
        lng: loc.lng ?? null,
        cidade: loc.cidade ?? null,
        pais: loc.pais ?? null,
      });
    } else {
      sincronizar({ localizacaoStatus: estado });
    }
  }, 30000); // 30s

  // Retorna função pra parar
  return () => {
    cancelado = true;
    clearInterval(intervalId);
    if (statusPermissaoRef) statusPermissaoRef.onchange = null;
  };
}