import React, { useState, useEffect, useMemo } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNativo } from './push-notifications-native';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp, updateDoc, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { db } from './firebase';
import { uploadFoto, deletarFotoCloudinary } from '../utils/uploadFoto';
import {
  MdDelete, MdAddAPhoto, MdImage, MdClose, MdLink, MdSearch,
  MdFileUpload, MdImageNotSupported, MdCheckCircle, MdWarning,
  MdClear
} from 'react-icons/md';

export default function GaleriaPaciente({
  pacienteId,
  uidEsteticista,
  pacienteNome = 'Paciente',
  modo = 'paciente',
  evolucoes = [],
}) {
  const [fotos, setFotos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [modalVincular, setModalVincular] = useState(null);
  const [buscaEvolucao, setBuscaEvolucao] = useState('');

  const [modalExclusao, setModalExclusao] = useState({
    isOpen: false, foto: null, excluindo: false, erro: '',
  });

  // ✅ Só paciente pode ADICIONAR fotos
  const podeAdicionar = modo === 'paciente';

  // ✅ Escuta em tempo real
  useEffect(() => {
    if (!pacienteId || !uidEsteticista) return;
    const colRef = collection(db, `usuarios/${uidEsteticista}/pacientes/${pacienteId}/fotos`);
    const q = query(colRef, orderBy('enviadoEm', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setFotos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCarregando(false);
    }, (err) => {
      console.error('Erro ao carregar fotos:', err);
      setCarregando(false);
    });
    return () => unsub();
  }, [pacienteId, uidEsteticista]);

 const escolherFonte = async (source) => {
  // ============================================================
  // 🌐 WEB / PWA → input file direto (NÃO recarrega a página)
  // ============================================================
  if (!isNativo()) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') {
      input.capture = 'environment';   // abre a câmera traseira
    }

    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          await enviarFoto(file);
        } catch (err) {
          console.error('Erro ao enviar foto:', err);
          alert('Erro ao enviar foto: ' + (err?.message || err));
        }
      }
    };

    input.click();
    return;
  }

  // ============================================================
  // 📱 APK / Nativo → Capacitor Camera
  // ============================================================
  // ============================================================
  // 📱 APK / Nativo → Capacitor Camera (config LEVE p/ não matar o WebView)
  // ============================================================
  try {
    const photo = await Camera.getPhoto({
      quality: 75,                          // ✅ menos bytes
      allowEditing: false,
      resultType: CameraResultType.Uri,     // ✅ USA URI — não carrega base64 na RAM
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      width: 1600,                          // ✅ menor que 1920
      saveToGallery: false,                 // ✅ não salva na galeria do device
      correctOrientation: true,
      preserveAspectRatio: true,
    });

    // ✅ Usa webPath (Uri → arquivo no cache do app)
    const caminho = photo.webPath || photo.path;
    if (!caminho) throw new Error('Nenhum caminho de imagem recebido');

    const res = await fetch(caminho);
    const blob = await res.blob();
    const file = new File([blob], `foto_${Date.now()}.jpg`, {
      type: blob.type || 'image/jpeg',
    });

    await enviarFoto(file);
  } catch (err) {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('cancel') || msg.includes('user cancelled')) return;
    console.error('Erro ao obter foto:', err);
    alert('Erro ao obter foto: ' + (err?.message || err));
  }
};

  const enviarFoto = async (file) => {
      if (enviando) return; 
    setEnviando(true);
     try {
      const resultado = await uploadFoto(file, pacienteId);
      await addDoc(
        collection(db, `usuarios/${uidEsteticista}/pacientes/${pacienteId}/fotos`),
        {
          url: resultado.url, thumbUrl: resultado.thumbUrl,
          publicId: resultado.publicId, tamanho: resultado.tamanho,
          enviadoEm: serverTimestamp(), enviadoPor: modo, vinculadoA: [],
        }
      );

      if (modo === 'paciente') {
        fetch('/.netlify/functions/notificar-foto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uidEsteticista, pacienteId, pacienteNome }),
        }).catch((e) => console.warn('Falha ao notificar esteticista:', e));
      }
    } catch (err) {
      console.error('Erro ao enviar foto:', err);
      alert('Erro ao enviar foto: ' + (err?.message || err));
    } finally {
      setEnviando(false);
    }
  };

  const abrirModalExclusao = (foto) => {
    setModalExclusao({ isOpen: true, foto, excluindo: false, erro: '' });
  };
  const fecharModalExclusao = () => {
    if (modalExclusao.excluindo) return;
    setModalExclusao({ isOpen: false, foto: null, excluindo: false, erro: '' });
  };

  const confirmarExclusao = async () => {
    const foto = modalExclusao.foto;
    if (!foto) return;
    setModalExclusao((p) => ({ ...p, excluindo: true, erro: '' }));
    try {
      await deletarFotoCloudinary(foto.publicId);
      await deleteDoc(doc(db, `usuarios/${uidEsteticista}/pacientes/${pacienteId}/fotos`, foto.id));
      if (fotoAmpliada?.id === foto.id) setFotoAmpliada(null);
      setModalExclusao({ isOpen: false, foto: null, excluindo: false, erro: '' });
    } catch (err) {
      setModalExclusao((p) => ({ ...p, excluindo: false, erro: err?.message || 'Erro ao excluir.' }));
    }
  };

  const toggleVinculo = async (foto, evoId) => {
    const jaVinculado = (foto.vinculadoA || []).includes(evoId);
    const ref = doc(db, `usuarios/${uidEsteticista}/pacientes/${pacienteId}/fotos`, foto.id);
    try {
      await updateDoc(ref, {
        vinculadoA: jaVinculado ? arrayRemove(evoId) : arrayUnion(evoId),
      });
      setFotos((prev) => prev.map((f) => {
        if (f.id !== foto.id) return f;
        const s = new Set(f.vinculadoA || []);
        jaVinculado ? s.delete(evoId) : s.add(evoId);
        return { ...f, vinculadoA: Array.from(s) };
      }));
      setModalVincular((prev) => prev && prev.id === foto.id ? {
        ...prev,
        vinculadoA: jaVinculado
          ? (prev.vinculadoA || []).filter((x) => x !== evoId)
          : [...(prev.vinculadoA || []), evoId],
      } : prev);
    } catch (e) {
      console.error('Erro ao vincular:', e);
      alert('Erro ao vincular foto: ' + (e?.message || e));
    }
  };

  const formatarDataHora = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // ✅ Filtro de evoluções pelo termo de busca
  const evolucoesFiltradas = useMemo(() => {
    const termo = buscaEvolucao.toLowerCase().trim();
    if (!termo) return evolucoes;
    return evolucoes.filter((e) =>
      (e.dataCriacao || '').toLowerCase().includes(termo) ||
      (e.textoLivre || '').toLowerCase().includes(termo)
    );
  }, [evolucoes, buscaEvolucao]);

  return (
    <div style={estilo.container}>
      {/* Botões de ação — SÓ para o paciente */}
      {podeAdicionar && (
        <div style={estilo.barraAcoes}>
          <button type="button" onClick={() => escolherFonte('camera')} disabled={enviando} style={estilo.botaoAcao}>
            <MdAddAPhoto size={16} /> Tirar Foto
          </button>
          <button type="button" onClick={() => escolherFonte('galeria')} disabled={enviando} style={estilo.botaoAcao}>
            <MdImage size={16} /> Escolher da Galeria
          </button>
        </div>
      )}

      {enviando && (
        <div style={estilo.aviso}>
          <MdFileUpload size={16} /> Enviando foto...
        </div>
      )}

      {carregando ? (
        <div style={estilo.aviso}>Carregando galeria...</div>
      ) : fotos.length === 0 ? (
        <div style={estilo.vazio}>
          <MdImageNotSupported size={36} color="#bbb" />
          <p style={{ margin: '8px 0 0 0' }}>Nenhuma foto ainda.</p>
        </div>
      ) : (
        <div style={estilo.grid}>
          {fotos.map((foto) => (
            <div key={foto.id} style={estilo.cardFoto}>
              <img
                src={foto.thumbUrl} alt="Foto do paciente" loading="lazy"
                style={estilo.img} onClick={() => setFotoAmpliada(foto)}
              />
              <div style={estilo.rodape}>
                <span style={estilo.data}>{formatarDataHora(foto.enviadoEm)}</span>
                <div style={estilo.acoes}>
                  {modo === 'esteticista' && evolucoes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setModalVincular(foto); setBuscaEvolucao(''); }}
                      title="Vincular à evolução"
                      style={{
                        ...estilo.btnIcone,
                        color: (foto.vinculadoA || []).length > 0 ? '#16a34a' : '#7e22ce',
                      }}
                    >
                      <MdLink size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => abrirModalExclusao(foto)}
                    title="Excluir foto"
                    style={{ ...estilo.btnIcone, color: '#e74c3c' }}
                  >
                    <MdDelete size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal foto ampliada */}
      {fotoAmpliada && (
        <div style={estilo.modal} onClick={() => setFotoAmpliada(null)}>
          <button type="button" onClick={() => setFotoAmpliada(null)} style={estilo.btnFecharModal}>
            <MdClose size={24} color="#fff" />
          </button>
          <img src={fotoAmpliada.url} alt="Foto ampliada" style={estilo.imgAmpliada} onClick={(e) => e.stopPropagation()} />
          <div style={estilo.infoAmpliada}>Enviada em {formatarDataHora(fotoAmpliada.enviadoEm)}</div>
        </div>
      )}

      {/* Modal vincular — com LUPA de busca */}
      {modalVincular && (
        <div style={estilo.modal} onClick={() => setModalVincular(null)}>
          <div style={estilo.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={estilo.modalTitulo}>Vincular à Evolução</h3>
            <p style={{ fontSize: '12px', color: '#666', marginTop: 0 }}>
              Selecione as evoluções que devem mostrar esta foto:
            </p>

            {/* 🔍 Lupa de busca */}
            {evolucoes.length > 0 && (
              <div style={estilo.barraBusca}>
                <MdSearch size={18} color="#C8A24A" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Buscar por data ou texto..."
                  value={buscaEvolucao}
                  onChange={(e) => setBuscaEvolucao(e.target.value)}
                  style={estilo.inputBusca}
                  autoComplete="off"
                />
                {buscaEvolucao && (
                  <button
                    type="button"
                    onClick={() => setBuscaEvolucao('')}
                    style={estilo.btnLimparBusca}
                    title="Limpar busca"
                  >
                    <MdClear size={16} />
                  </button>
                )}
              </div>
            )}

            {evolucoes.length === 0 ? (
              <p style={{ color: '#888', fontStyle: 'italic' }}>Nenhuma evolução cadastrada ainda.</p>
            ) : evolucoesFiltradas.length === 0 ? (
              <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>
                Nenhuma evolução encontrada para "{buscaEvolucao}".
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {evolucoesFiltradas.map((evo) => {
                  const marcado = (modalVincular.vinculadoA || []).includes(evo.id);
                  return (
                    <label
                      key={evo.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                        background: marcado ? '#f0fdf4' : '#faf5ff',
                        border: `1.5px solid ${marcado ? '#16a34a' : '#d8b4fe'}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => toggleVinculo(modalVincular, evo.id)}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#2c163a', display: 'block' }}>
                          {evo.dataCriacao || 'Sem data'}
                        </span>
                        {evo.textoLivre && (
                          <span style={{
                            fontSize: '10.5px', color: '#666',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', display: 'block',
                          }}>
                            {evo.textoLivre}
                          </span>
                        )}
                      </div>
                      {marcado && <MdCheckCircle size={16} color="#16a34a" style={{ flexShrink: 0 }} />}
                    </label>
                  );
                })}
              </div>
            )}

            <button type="button" onClick={() => setModalVincular(null)} style={estilo.btnFecharModalCard}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal exclusão — estilo Samira */}
      {modalExclusao.isOpen && (
        <div style={estiloExclusao.overlay}>
          <div style={estiloExclusao.card}>
            <div style={estiloExclusao.iconeTopo}>
              <MdWarning size={32} color="#c62828" />
            </div>
            <h3 style={estiloExclusao.titulo}>Excluir Foto</h3>
            <p style={estiloExclusao.texto}>
              Tem certeza que deseja excluir esta foto?
              <br />
              <span style={{ fontSize: '11px', color: '#888', display: 'block', marginTop: '6px' }}>
                Esta ação é permanente e não pode ser desfeita.
              </span>
            </p>
            {modalExclusao.foto?.thumbUrl && (
              <img src={modalExclusao.foto.thumbUrl} alt="Foto a excluir" style={estiloExclusao.preview} />
            )}
            {modalExclusao.erro && <div style={estiloExclusao.erro}>{modalExclusao.erro}</div>}
            <div style={estiloExclusao.botoes}>
              <button
                type="button" onClick={fecharModalExclusao} disabled={modalExclusao.excluindo}
                style={{ ...estiloExclusao.btnCancelar, opacity: modalExclusao.excluindo ? 0.5 : 1 }}
              >
                Cancelar
              </button>
              <button
                type="button" onClick={confirmarExclusao} disabled={modalExclusao.excluindo}
                style={{ ...estiloExclusao.btnExcluir, opacity: modalExclusao.excluindo ? 0.7 : 1 }}
              >
                {modalExclusao.excluindo ? (
                  <><span className="spinner-salvar" /> Excluindo...</>
                ) : (
                  <><MdDelete size={16} /> Excluir Foto</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== ESTILOS ============== */
const estilo = {
  container: { padding: '16px', fontFamily: "'Montserrat', sans-serif" },
  barraAcoes: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' },
  botaoAcao: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
    color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '20px',
    fontSize: '12px', fontWeight: 700, fontFamily: "'Cinzel', serif",
    cursor: 'pointer', boxShadow: '0 3px 10px rgba(200, 162, 74, 0.3)',
  },
  aviso: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '6px', padding: '16px', color: '#666', fontSize: '13px',
  },
  vazio: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '40px 16px', color: '#999', fontSize: '13px', fontStyle: 'italic',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' },
  cardFoto: {
    background: '#fff', borderRadius: '10px', overflow: 'hidden',
    border: '1px solid #e2d2f5', boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
  },
  img: { width: '100%', height: '140px', objectFit: 'cover', cursor: 'pointer', display: 'block' },
  rodape: {
    padding: '6px 8px', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', fontSize: '10px', color: '#666',
  },
  data: { fontSize: '10px', color: '#666' },
  acoes: { display: 'flex', gap: '4px' },
  btnIcone: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' },
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
    zIndex: 99999, display: 'flex', justifyContent: 'center',
    alignItems: 'center', padding: '20px',
  },
  btnFecharModal: { position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' },
  imgAmpliada: { maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' },
  infoAmpliada: {
    position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
    color: '#fff', fontSize: '12px', background: 'rgba(0,0,0,0.6)',
    padding: '6px 16px', borderRadius: '20px',
  },
  modalCard: {
    background: '#fff', borderRadius: '16px', padding: '24px',
    maxWidth: '480px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
  },
  modalTitulo: { fontFamily: "'Cinzel', serif", color: '#2c163a', fontSize: '16px', margin: '0 0 10px 0' },
  barraBusca: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: '#faf5ff', border: '1.5px solid #d8b4fe',
    borderRadius: '10px', padding: '6px 10px', marginBottom: '12px',
  },
  inputBusca: {
    flex: 1, border: 'none', outline: 'none', background: 'transparent',
    fontSize: '12px', color: '#2c163a', fontFamily: "'Montserrat', sans-serif",
  },
  btnLimparBusca: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#888', padding: 0, display: 'flex', alignItems: 'center',
  },
  btnFecharModalCard: {
    marginTop: '16px', width: '100%', padding: '10px',
    fontFamily: "'Cinzel', serif", background: '#2c163a',
    color: '#C8A24A', border: '1.2px solid #C8A24A', borderRadius: '16px',
    fontSize: '11px', fontWeight: 700, cursor: 'pointer',
  },
};

const estiloExclusao = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(44, 22, 58, 0.6)',
    backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center',
    alignItems: 'center', zIndex: 999999, padding: '20px', boxSizing: 'border-box',
  },
  card: {
    background: '#fff', borderRadius: '20px', padding: '28px 24px 24px 24px',
    maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(44, 22, 58, 0.35)',
    border: '1.5px solid #e2d2f5', textAlign: 'center', fontFamily: "'Montserrat', sans-serif",
  },
  iconeTopo: {
    width: '64px', height: '64px', margin: '0 auto 14px auto', borderRadius: '50%',
    background: 'linear-gradient(135deg, #ffebee 0%, #fde8e8 100%)',
    border: '2px solid #ef9a9a', display: 'flex', alignItems: 'center',
    justifyContent: 'center', boxShadow: '0 4px 14px rgba(198, 40, 40, 0.15)',
  },
  titulo: {
    fontFamily: "'Cinzel', serif", color: '#c62828',
    fontSize: '18px', fontWeight: 700, margin: '0 0 10px 0', letterSpacing: '0.5px',
  },
  texto: { fontSize: '14px', color: '#2c163a', margin: '0 0 16px 0', fontWeight: 500, lineHeight: 1.5 },
  preview: {
    width: '120px', height: '120px', objectFit: 'cover', borderRadius: '12px',
    border: '2px solid #e2d2f5', margin: '0 auto 16px auto', display: 'block',
    boxShadow: '0 4px 12px rgba(44, 22, 58, 0.1)',
  },
  erro: {
    background: '#fde8e8', border: '1px solid #f98080', color: '#c81e1e',
    padding: '8px 12px', borderRadius: '8px', fontSize: '12px',
    marginBottom: '12px', fontWeight: 600,
  },
  botoes: { display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '8px' },
  btnCancelar: {
    flex: 1, background: '#f0f0f0', color: '#333', border: 'none',
    padding: '12px 20px', borderRadius: '24px', fontSize: '12px',
    fontWeight: 700, cursor: 'pointer', fontFamily: "'Cinzel', serif",
  },
  btnExcluir: {
    flex: 1, background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
    color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '24px',
    fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Cinzel', serif",
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    boxShadow: '0 4px 14px rgba(198, 40, 40, 0.3)',
  },
};