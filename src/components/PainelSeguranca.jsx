// src/components/PainelSeguranca.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot, orderBy, query, where,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from './firebase';
import {
  MdWarning, MdShield, MdCheckCircle, MdBlock, MdUndo,
  MdRefresh, MdAccessTime, MdDevices, MdEmail, MdLocationOff,
  MdClose,
} from 'react-icons/md';
import { rotuloStatusLocalizacao, corStatusLocalizacao } from '../utils/geolocalizacao';

export default function PainelSeguranca() {
  const [tentativas, setTentativas] = useState([]);
  const [bloqueios, setBloqueios] = useState([]);
  const [dispositivosPendentes, setDispositivosPendentes] = useState([]);
  const [dispositivosBloqueados, setDispositivosBloqueados] = useState([]);
  const [estados, setEstados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(null);
  const [motivo, setMotivo] = useState('');

  const [indicePacientes, setIndicePacientes] = useState({});

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const colRef = collection(db, `usuarios/${user.uid}/pacientes`);
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const novo = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          novo[d.id] = {
            id: d.id,
            nome: data.nome || data.anamnese?.nome || 'Sem nome',
            documento:
              data.documento ||
              data.anamnese?.numeroDocumento ||
              data.anamnese?.documento ||
              '—',
          };
        });
        setIndicePacientes(novo);
      },
      (e) => console.warn('Erro listener pacientes:', e)
    );

    return () => unsub();
  }, []);

  const nomeDoPaciente = (pacienteId) =>
    indicePacientes[String(pacienteId)]?.nome || 'Paciente';
  const documentoDoPaciente = (pacienteId) =>
    indicePacientes[String(pacienteId)]?.documento || '—';

  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, 'alertas_dispositivo'),
        where('status', '==', 'pendente')
      ),
      (snap) => {
        setDispositivosPendentes(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
      },
      (e) => console.warn('Erro listener alertas_dispositivo:', e)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, 'dispositivos_autorizados'),
        where('autorizado', '==', false)
      ),
      (snap) => {
        setDispositivosBloqueados(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
      },
      (e) => console.warn('Erro listener dispositivos_autorizados:', e)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'tentativas_login'),
      orderBy('atualizadoEm', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setTentativas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bloqueios_login'), (snap) => {
      setBloqueios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'seguranca_estado'), (snap) => {
      setEstados(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const estaBloqueado = (emailHash) => {
    const b = bloqueios.find((x) => x.id === emailHash);
    return b?.bloqueado === true;
  };

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

  const executarAcaoDispositivo = async (pacienteId, fingerprint, acao) => {
    const chave = `${pacienteId}__${fingerprint}`;
    setProcessando(chave);
    try {
      const user = getAuth().currentUser;
      if (!user) throw new Error('Sem sessão');
      const token = await user.getIdToken(true);

      const res = await fetch('/.netlify/functions/gerenciar-dispositivo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pacienteId, fingerprint, acao }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha');
      }
    } catch (e) {
      console.error('Erro ação dispositivo:', e);
      alert('Erro ao processar: ' + e.message);
    } finally {
      setProcessando(null);
    }
  };

  // ✅ LÓGICA FINAL: Esconde completamente os cards que a esteta já dispensou
  const relevantes = tentativas.filter((t) => {
    const bloqueado = estaBloqueado(t.id);
    const temFalhas = (t.tentativas || []).length > 0;
    
    // Se não tem mais falhas (porque o X limpou) E o alerta não está pedindo bloqueio,
    // nós simplesmente esquecemos esse registro na tela. Ele some!
    if (!temFalhas && t.requerBloqueio === false) {
      return false;
    }
    
    return temFalhas || bloqueado || t.requerBloqueio;
  });

  const suspeitos = relevantes.filter((t) => !estaBloqueado(t.id) && t.requerBloqueio !== false);
  const bloqueadosLista = relevantes.filter((t) => estaBloqueado(t.id));

  const semLocalizacao = useMemo(() => {
    return estados.filter((e) => {
      const s = e.localizacaoStatus;
      if (s === 'gps_desligado' || s === 'negada') return true;
      return false;
    });
  }, [estados]);

  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <MdShield size={24} color="#7e22ce" />
        <h3 style={{ fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: 18, margin: 0 }}>
          Segurança
        </h3>
      </div>

      {carregando ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Carregando…</div>
      ) : (
        <>
          {/* DISPOSITIVOS NOVOS AGUARDANDO APROVAÇÃO */}
          {dispositivosPendentes.length > 0 && (
            <>
              <h4 style={tituloSecao}>
                <MdDevices size={16} color="#7e22ce" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Dispositivos novos ({dispositivosPendentes.length})
              </h4>

              {dispositivosPendentes.map((d) => {
                const chave = `${d.pacienteId}__${d.fingerprint}`;
                const carregandoEste = processando === chave;
                return (
                  <div key={d.id} style={{ ...cardBase, borderColor: '#d8b4fe', background: '#faf5ff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <MdDevices size={20} color="#7e22ce" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Cinzel', serif", color: '#7e22ce', fontSize: 13, fontWeight: 700 }}>
                          {d.dispositivo || 'Dispositivo desconhecido'}
                        </div>
                        <div style={{ fontSize: 11, color: '#2c163a', fontWeight: 600, marginTop: 2 }}>
                          {nomeDoPaciente(d.pacienteId)}
                        </div>
                        <div style={{ fontSize: 10, color: '#666', fontFamily: 'monospace' }}>
                          Doc: {documentoDoPaciente(d.pacienteId)}
                        </div>
                      </div>
                    </div>

                    {(d.cidade || d.pais) && (
                      <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>
                        📍 {d.cidade || '—'}{d.pais ? `/${d.pais}` : ''}
                      </div>
                    )}

                    <div style={{ fontSize: 10, color: '#888', marginBottom: 10 }}>
                      Detectado em {d.criadoEm ? new Date(d.criadoEm).toLocaleString('pt-BR') : '—'}
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => executarAcaoDispositivo(d.pacienteId, d.fingerprint, 'autorizar')}
                        disabled={carregandoEste}
                        style={btnPrimario}
                      >
                        <MdCheckCircle size={14} />
                        {carregandoEste ? 'PROCESSANDO…' : 'AUTORIZAR'}
                      </button>
                      <button
                        type="button"
                        onClick={() => executarAcaoDispositivo(d.pacienteId, d.fingerprint, 'bloquear')}
                        disabled={carregandoEste}
                        style={btnPerigo}
                      >
                        <MdBlock size={14} />
                        BLOQUEAR
                      </button>
                      <button
                        type="button"
                        onClick={() => executarAcaoDispositivo(d.pacienteId, d.fingerprint, 'dispensar')}
                        disabled={carregandoEste}
                        title="Fechar aviso (não altera autorização)"
                        style={{
                          background: 'transparent',
                          border: '1.5px solid #ccc',
                          color: '#666',
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <MdClose size={20} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* DISPOSITIVOS BLOQUEADOS */}
          {dispositivosBloqueados.length > 0 && (
            <>
              <h4 style={tituloSecao}>
                <MdBlock size={16} color="#c62828" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Dispositivos bloqueados ({dispositivosBloqueados.length})
              </h4>

              {dispositivosBloqueados.map((d) => {
                const chave = `${d.pacienteId}__${d.fingerprint}`;
                const carregandoEste = processando === chave;
                return (
                  <div key={d.id} style={{ ...cardBase, borderColor: '#fca5a5', background: '#fef2f2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <MdBlock size={20} color="#c62828" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Cinzel', serif", color: '#991b1b', fontSize: 13, fontWeight: 700 }}>
                          {d.dispositivo || 'Dispositivo bloqueado'}
                        </div>
                        <div style={{ fontSize: 11, color: '#2c163a', fontWeight: 600, marginTop: 2 }}>
                          {nomeDoPaciente(d.pacienteId)}
                        </div>
                        <div style={{ fontSize: 10, color: '#666', fontFamily: 'monospace' }}>
                          Doc: {documentoDoPaciente(d.pacienteId)}
                        </div>
                      </div>
                    </div>

                    {d.motivoBloqueio && (
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 8, fontStyle: 'italic' }}>
                        Motivo: {d.motivoBloqueio}
                      </div>
                    )}

                    <div style={{ fontSize: 10, color: '#888', marginBottom: 10 }}>
                      Bloqueado em {d.bloqueadoEm ? new Date(d.bloqueadoEm).toLocaleString('pt-BR') : '—'}
                    </div>

                    <button
                      type="button"
                      onClick={() => executarAcaoDispositivo(d.pacienteId, d.fingerprint, 'autorizar')}
                      disabled={carregandoEste}
                      style={btnPrimario}
                    >
                      <MdUndo size={14} />
                      {carregandoEste ? 'PROCESSANDO…' : 'DESBLOQUEAR DISPOSITIVO'}
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* CONTAS BLOQUEADAS (tentativas erradas) */}
          {bloqueadosLista.length > 0 && (
            <>
              <h4 style={tituloSecao}>
                <MdBlock size={16} color="#c62828" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Contas bloqueadas por tentativas ({bloqueadosLista.length})
              </h4>

              {bloqueadosLista.map((t) => {
                const b = bloqueios.find((x) => x.id === t.id);
                return (
                  <div key={t.id} style={{ ...cardBase, borderColor: '#fca5a5', background: '#fef2f2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <MdBlock size={20} color="#c62828" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Cinzel', serif", color: '#991b1b', fontSize: 13, fontWeight: 700 }}>
                          Conta bloqueada
                        </div>
                        <div style={{ fontSize: 10, color: '#666', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          ID: {t.id.slice(0, 16)}…
                        </div>
                      </div>
                    </div>

                    {t.ultimoIp && t.ultimoIp !== 'desconhecido' && (
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MdLocationOff size={12} color="#666" />
                        <span>
                          {t.ultimaCidade !== 'desconhecido' ? `${t.ultimaCidade}, ${t.ultimoPais}` : t.ultimoPais} · IP: <strong>{t.ultimoIp}</strong>
                        </span>
                      </div>
                    )}

                    {b?.motivo && (
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 8, fontStyle: 'italic' }}>
                        Motivo: {b.motivo}
                      </div>
                    )}

                    <div style={{ fontSize: 10, color: '#888', marginBottom: 10 }}>
                      Bloqueado em {b?.bloqueadoEm ? new Date(b.bloqueadoEm).toLocaleString('pt-BR') : '—'}
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => executarAcao(t.id, 'desbloquear')}
                        disabled={processando === t.id}
                        style={btnPrimario}
                      >
                        <MdUndo size={14} />
                        {processando === t.id ? 'PROCESSANDO…' : 'DESBLOQUEAR ACESSO'}
                      </button>

                      <button
                        type="button"
                        onClick={() => executarAcao(t.id, 'dispensar')}
                        disabled={processando === t.id}
                        title="Fechar alerta sem desbloquear"
                        style={{
                          background: 'transparent',
                          border: '1.5px solid #ccc',
                          color: '#666',
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <MdClose size={20} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ATIVIDADE SUSPEITA */}
          <h4 style={tituloSecao}>
            <MdWarning size={16} color="#92400e" style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Atividade suspeita ({suspeitos.length})
          </h4>

          {suspeitos.length === 0 ? (
            <div style={{
              padding: '20px', background: '#f0fdf4',
              border: '1.5px solid #86efac', borderRadius: 12,
              textAlign: 'center', fontSize: 13, color: '#166534',
            }}>
              <MdCheckCircle size={20} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Nenhuma atividade suspeita detectada.
            </div>
          ) : (
            suspeitos.map((t) => {
              const tent = t.tentativas || [];
              const total = tent.length;
              const ultima = tent[tent.length - 1];
              const carregandoEste = processando === t.id;

              return (
                <div key={t.id} style={cardBase}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <MdWarning size={20} color="#92400e" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Cinzel', serif", color: '#92400e', fontSize: 13, fontWeight: 700 }}>
                        {total} tentativa{total > 1 ? 's' : ''} falha{total > 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: 10, color: '#666', fontFamily: 'monospace' }}>
                        ID: {t.id.slice(0, 16)}…
                      </div>
                    </div>
                  </div>

                  {t.ultimoIp && t.ultimoIp !== 'desconhecido' && (
                    <div style={{ fontSize: 11, color: '#666', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MdLocationOff size={12} color="#666" />
                      <span>
                        {t.ultimaCidade !== 'desconhecido' ? `${t.ultimaCidade}, ${t.ultimoPais}` : t.ultimoPais} · IP: <strong>{t.ultimoIp}</strong>
                      </span>
                    </div>
                  )}

                  {ultima && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#666', marginBottom: 6 }}>
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

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setMostrarModal(t.id)}
                      disabled={carregandoEste}
                      style={btnPerigo}
                    >
                      <MdBlock size={14} />
                      BLOQUEAR
                    </button>

                    <button
                      type="button"
                      onClick={() => executarAcao(t.id, 'dispensar')}
                      disabled={carregandoEste}
                      title="Fechar alerta sem bloquear"
                      style={{
                        background: 'transparent',
                        border: '1.5px solid #ccc',
                        color: '#666',
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <MdClose size={20} />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* LOCALIZAÇÕES DESLIGADAS */}
          <h4 style={tituloSecao}>
            <MdLocationOff size={16} color="#92400e" style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Pacientes sem localização ativa ({semLocalizacao.length})
          </h4>

          {semLocalizacao.length === 0 ? (
            <div style={{
              padding: '14px', background: '#f0fdf4',
              border: '1.5px solid #86efac', borderRadius: 12,
              fontSize: 12, color: '#166534', textAlign: 'center',
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
                    <div style={{ fontSize: 12, color: '#2c163a', fontWeight: 600, marginTop: 2 }}>
                      {nomeDoPaciente(e.id)}
                    </div>
                    <div style={{ fontSize: 10, color: '#666', fontFamily: 'monospace' }}>
                      Doc: {documentoDoPaciente(e.id)}
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

      {/* MODAL DE BLOQUEIO */}
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
            <h3 style={{ fontFamily: "'Cinzel', serif", color: '#c62828', fontSize: 17, margin: '12px 0 8px' }}>
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
  flex: 1,
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