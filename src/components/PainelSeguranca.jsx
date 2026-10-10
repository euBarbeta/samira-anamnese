// src/components/PainelSeguranca.jsx
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from './firebase';
import {
  MdWarning, MdShield, MdCheckCircle, MdBlock, MdUndo,
  MdRefresh, MdAccessTime, MdDevices, MdEmail, MdLocationOff
} from 'react-icons/md';
import { rotuloStatusLocalizacao, corStatusLocalizacao } from '../utils/geolocalizacao';
export default function PainelSeguranca() {
  const [tentativas, setTentativas] = useState([]);
  const [bloqueios, setBloqueios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(null);
  const [motivo, setMotivo] = useState('');

  // ============================================================
  // Listener — tentativas de login
  // ============================================================
  useEffect(() => {
    const q = query(
      collection(db, 'tentativas_login'),
      orderBy('atualizadoEm', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setTentativas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    }, (e) => {
      console.error('Erro listener tentativas:', e);
      setCarregando(false);
    });

    return () => unsub();
  }, []);

  // ============================================================
  // Listener — bloqueios
  // ============================================================
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bloqueios_login'), (snap) => {
      setBloqueios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const estaBloqueado = (emailHash) => {
    const b = bloqueios.find((x) => x.id === emailHash);
    return b?.bloqueado === true;
  };

  // ============================================================
  // Bloquear / desbloquear
  // ============================================================
  const executarAcao = async (emailHash, acao, motivoTexto = '') => {
    setProcessando(emailHash);

    try {
      const user = getAuth().currentUser;
      if (!user) throw new Error('Sem sessão');

      const token = await user.getIdToken(true);

      const res = await fetch('/.netlify/functions/gerenciar-bloqueio-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ emailHash, acao, motivo: motivoTexto }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha');
      }
    } catch (e) {
      console.error('Erro ação:', e);
      alert('Erro ao processar: ' + e.message);
    } finally {
      setProcessando(null);
      setMostrarModal(null);
      setMotivo('');
    }
  };

  // ============================================================
  // Filtra tentativas relevantes (com falhas ou bloqueadas)
  // ============================================================
  const relevantes = tentativas.filter((t) => {
    const temFalhas = (t.tentativas || []).length > 0;
    const bloqueado = estaBloqueado(t.id);
    return temFalhas || bloqueado || t.requerBloqueio;
  });

  const suspeitos = relevantes.filter((t) => !estaBloqueado(t.id));
  const bloqueadosLista = relevantes.filter((t) => estaBloqueado(t.id));
const [estados, setEstados] = useState([]);

useEffect(() => {
  const unsub = onSnapshot(collection(db, 'seguranca_estado'), (snap) => {
    setEstados(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
  return () => unsub();
}, []);

const semLocalizacao = estados.filter((e) =>
  e.localizacaoStatus && e.localizacaoStatus !== 'ativa'
);
  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 18,
      }}>
        <MdShield size={24} color="#7e22ce" />
        <h3 style={{
          fontFamily: "'Cinzel', serif",
          color: '#2c163a',
          fontSize: 18,
          margin: 0,
        }}>
          Segurança
        </h3>
      </div>

      {carregando ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          Carregando…
        </div>
      ) : (
        <>
          {/* ============================================== */}
          {/* BLOQUEADOS                                     */}
          {/* ============================================== */}
          {bloqueadosLista.length > 0 && (
            <>
              <h4 style={tituloSecao}>
                <MdBlock size={16} color="#c62828" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Contas bloqueadas ({bloqueadosLista.length})
              </h4>

              {bloqueadosLista.map((t) => {
                const b = bloqueios.find((x) => x.id === t.id);
                return (
                  <div key={t.id} style={{ ...cardBase, borderColor: '#fca5a5', background: '#fef2f2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <MdBlock size={20} color="#c62828" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: "'Cinzel', serif",
                          color: '#991b1b',
                          fontSize: 13,
                          fontWeight: 700,
                        }}>
                          Conta bloqueada
                        </div>
                        <div style={{ fontSize: 10, color: '#666', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          ID: {t.id.slice(0, 16)}…
                        </div>
                      </div>
                    </div>

                    {b?.motivo && (
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 8, fontStyle: 'italic' }}>
                        Motivo: {b.motivo}
                      </div>
                    )}

                    <div style={{ fontSize: 10, color: '#888', marginBottom: 10 }}>
                      Bloqueado em {b?.bloqueadoEm ? new Date(b.bloqueadoEm).toLocaleString('pt-BR') : '—'}
                    </div>

                    <button
                      type="button"
                      onClick={() => executarAcao(t.id, 'desbloquear')}
                      disabled={processando === t.id}
                      style={btnPrimario}
                    >
                      <MdUndo size={14} />
                      {processando === t.id ? 'PROCESSANDO…' : 'DESBLOQUEAR ACESSO'}
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* ============================================== */}
          {/* SUSPEITOS                                      */}
          {/* ============================================== */}
          <h4 style={tituloSecao}>
            <MdWarning size={16} color="#92400e" style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Atividade suspeita ({suspeitos.length})
          </h4>

          {suspeitos.length === 0 ? (
            <div style={{
              padding: '20px',
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              borderRadius: 12,
              textAlign: 'center',
              fontSize: 13,
              color: '#166534',
            }}>
              <MdCheckCircle size={20} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Nenhuma atividade suspeita detectada.
            </div>
          ) : (
            suspeitos.map((t) => {
              const tent = t.tentativas || [];
              const total = tent.length;
              const ultima = tent[tent.length - 1];
              const carregando = processando === t.id;

              return (
                <div key={t.id} style={cardBase}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <MdWarning size={20} color="#92400e" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Cinzel', serif",
                        color: '#92400e',
                        fontSize: 13,
                        fontWeight: 700,
                      }}>
                        {total} tentativa{total > 1 ? 's' : ''} falha{total > 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: 10, color: '#666', fontFamily: 'monospace' }}>
                        ID: {t.id.slice(0, 16)}…
                      </div>
                    </div>
                  </div>

                  {ultima && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 11, color: '#666', marginBottom: 6,
                    }}>
                      <MdAccessTime size={12} />
                      Última: {new Date(ultima).toLocaleString('pt-BR')}
                    </div>
                  )}

                  {t.ultimoDispositivo && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      fontSize: 10, color: '#666', marginBottom: 10, lineHeight: 1.5,
                    }}>
                      <MdDevices size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ wordBreak: 'break-word' }}>{t.ultimoDispositivo}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setMostrarModal(t.id)}
                      disabled={carregando}
                      style={btnPerigo}
                    >
                      <MdBlock size={14} />
                      BLOQUEAR
                    </button>
                  </div>
                </div>
              );
            })
          )}
          {/* ============================================== */}
{/* LOCALIZAÇÕES DESLIGADAS                       */}
{/* ============================================== */}
<h4 style={tituloSecao}>
  <MdLocationOff size={16} color="#92400e" style={{ verticalAlign: 'middle', marginRight: 6 }} />
  Pacientes sem localização ativa ({semLocalizacao.length})
</h4>

{semLocalizacao.length === 0 ? (
  <div style={{
    padding: '14px',
    background: '#f0fdf4',
    border: '1.5px solid #86efac',
    borderRadius: 12,
    fontSize: 12,
    color: '#166534',
    textAlign: 'center',
  }}>
    <MdCheckCircle size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
    Todos os pacientes estão com localização ativa.
  </div>
) : (
  semLocalizacao.map((e) => (
    <div key={e.id} style={cardBase}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <MdLocationOff size={16} color={corStatusLocalizacao(e.localizacaoStatus)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: corStatusLocalizacao(e.localizacaoStatus) }}>
            {rotuloStatusLocalizacao(e.localizacaoStatus)}
          </div>
          <div style={{ fontSize: 10, color: '#666', fontFamily: 'monospace' }}>
            ID: {String(e.id).slice(0, 16)}…
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: '#555' }}>
        <strong>Dispositivo:</strong> {e.dispositivo || '—'}
      </div>
      <div style={{ fontSize: 10.5, color: '#555', marginTop: 2 }}>
        <strong>Última verificação:</strong>{' '}
        {e.ultimaVerificacao
          ? new Date(e.ultimaVerificacao).toLocaleString('pt-BR')
          : '—'}
      </div>
    </div>
  ))
)}
        </>
      )}

      {/* ============================================== */}
      {/* MODAL DE BLOQUEIO                              */}
      {/* ============================================== */}
      {mostrarModal && (
        <div
          onClick={() => setMostrarModal(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(44, 22, 58, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 2147483647, padding: 20, boxSizing: 'border-box',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 20,
              padding: '24px 22px', maxWidth: 420, width: '100%',
              border: '1.5px solid #fca5a5',
              boxShadow: '0 20px 60px rgba(44, 22, 58, 0.4)',
              fontFamily: "'Montserrat', sans-serif",
              textAlign: 'center',
            }}
          >
            <MdBlock size={40} color="#c62828" />
            <h3 style={{
              fontFamily: "'Cinzel', serif",
              color: '#c62828',
              fontSize: 17,
              margin: '12px 0 8px',
            }}>
              Bloquear acesso?
            </h3>
            <p style={{ fontSize: 12, color: '#666', lineHeight: 1.6, marginBottom: 16 }}>
              A pessoa não vai conseguir mais logar até você desbloquear.
            </p>

            <input
              type="text"
              placeholder="Motivo (opcional) — ex: acesso suspeito"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={200}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1.5px solid #d8b4fe',
                borderRadius: 10,
                fontSize: 13,
                marginBottom: 16,
                boxSizing: 'border-box',
                fontFamily: "'Montserrat', sans-serif",
              }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setMostrarModal(null)}
                style={{
                  flex: 1, background: '#f0f0f0', color: '#333',
                  border: 'none', padding: '12px',
                  borderRadius: 20, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', fontFamily: "'Cinzel', serif",
                }}
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={() => executarAcao(mostrarModal, 'bloquear', motivo)}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
                  color: '#fff', border: 'none',
                  padding: '12px', borderRadius: 20,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'Cinzel', serif",
                }}
              >
                BLOQUEAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const tituloSecao = {
  fontFamily: "'Cinzel', serif",
  color: '#2c163a',
  fontSize: 13,
  margin: '20px 0 10px 0',
  paddingBottom: 6,
  borderBottom: '1px dashed #e2d2f5',
};

const cardBase = {
  background: '#fff',
  border: '1.5px solid #fcd34d',
  borderRadius: 12,
  padding: '12px 14px',
  marginBottom: 10,
};

const btnPrimario = {
  width: '100%',
  background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
  color: '#fff', border: 'none',
  padding: '10px 14px', borderRadius: 14,
  fontSize: 11, fontWeight: 700,
  fontFamily: "'Cinzel', serif", cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};

const btnPerigo = {
  flex: 1,
  background: '#ffebee', color: '#c62828',
  border: '1.5px solid #ef9a9a',
  padding: '10px 14px', borderRadius: 14,
  fontSize: 11, fontWeight: 700,
  fontFamily: "'Cinzel', serif", cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};