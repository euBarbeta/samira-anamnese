import React, { useState, useEffect } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { uploadFoto, deletarFotoCloudinary } from '../utils/uploadFoto';
import { MdDelete, MdAddAPhoto, MdImage, MdClose, MdZoomIn } from 'react-icons/md';

export default function GaleriaPaciente({
  pacienteId,
  uidEsteticista,
  modo = 'paciente', // 'paciente' | 'esteticista'
}) {
  const [fotos, setFotos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  // ✅ Escuta em tempo real a coleção de fotos
  useEffect(() => {
    if (!pacienteId || !uidEsteticista) return;

    const colRef = collection(
      db,
      `usuarios/${uidEsteticista}/pacientes/${pacienteId}/fotos`
    );

    const q = query(colRef, orderBy('enviadoEm', 'desc'));

    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFotos(lista);
      setCarregando(false);
    }, (err) => {
      console.error('Erro ao carregar fotos:', err);
      setCarregando(false);
    });

    return () => unsub();
  }, [pacienteId, uidEsteticista]);

  // ✅ Abre a câmera OU galeria
  const escolherFonte = async (source) => {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        width: 1920,
      });

      // Converte o URI em File
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });

      await enviarFoto(file);
    } catch (err) {
      if (err.message && err.message.includes('cancelled')) {
        // usuário cancelou, ignora
        return;
      }
      console.error('Erro ao obter foto:', err);
      alert('Erro ao obter foto: ' + err.message);
    }
  };

  const enviarFoto = async (file) => {
    setEnviando(true);
    try {
      // 1. Upload Cloudinary
      const resultado = await uploadFoto(file, pacienteId);

      // 2. Salva metadados no Firestore
      await addDoc(
        collection(db, `usuarios/${uidEsteticista}/pacientes/${pacienteId}/fotos`),
        {
          url: resultado.url,
          thumbUrl: resultado.thumbUrl,
          publicId: resultado.publicId,
          tamanho: resultado.tamanho,
          enviadoEm: serverTimestamp(),
          enviadoPor: modo,
          vinculadoA: [], // IDs das evoluções (preenchido pela esteticista)
        }
      );
    } catch (err) {
      console.error('Erro ao enviar foto:', err);
      alert('Erro ao enviar foto: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  // ✅ Excluir foto (só o autor pode)
  const excluirFoto = async (foto) => {
    if (!window.confirm('Deseja realmente excluir esta foto?')) return;

    try {
      // 1. Deleta do Cloudinary via função
      await deletarFotoCloudinary(foto.publicId);

      // 2. Deleta doc do Firestore
      await deleteDoc(
        doc(db, `usuarios/${uidEsteticista}/pacientes/${pacienteId}/fotos`, foto.id)
      );
    } catch (err) {
      console.error('Erro ao excluir:', err);
      alert('Erro ao excluir foto: ' + err.message);
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

  return (
    <div style={{ padding: '16px', fontFamily: "'Montserrat', sans-serif" }}>
      {/* Botões de ação */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => escolherFonte('camera')}
          disabled={enviando}
          style={estilo.botaoAcao}
        >
          <MdAddAPhoto size={16} /> Tirar Foto
        </button>
        <button
          type="button"
          onClick={() => escolherFonte('galeria')}
          disabled={enviando}
          style={estilo.botaoAcao}
        >
          <MdImage size={16} /> Escolher da Galeria
        </button>
      </div>

      {enviando && (
        <div style={estilo.aviso}>📤 Enviando foto...</div>
      )}

      {/* Grid de fotos */}
      {carregando ? (
        <div style={estilo.aviso}>Carregando galeria...</div>
      ) : fotos.length === 0 ? (
        <div style={estilo.vazio}>Nenhuma foto ainda.</div>
      ) : (
        <div style={estilo.grid}>
          {fotos.map((foto) => (
            <div key={foto.id} style={estilo.cardFoto}>
              <img
                src={foto.thumbUrl}
                alt="Foto do paciente"
                loading="lazy"
                style={estilo.img}
                onClick={() => setFotoAmpliada(foto)}
              />
              <div style={estilo.rodape}>
                <span style={estilo.data}>{formatarDataHora(foto.enviadoEm)}</span>
                {modo === 'paciente' && foto.enviadoPor === 'paciente' && (
                  <button
                    type="button"
                    onClick={() => excluirFoto(foto)}
                    style={estilo.btnExcluir}
                  >
                    <MdDelete size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de foto ampliada */}
      {fotoAmpliada && (
        <div style={estilo.modal} onClick={() => setFotoAmpliada(null)}>
          <button
            type="button"
            onClick={() => setFotoAmpliada(null)}
            style={estilo.btnFecharModal}
          >
            <MdClose size={24} color="#fff" />
          </button>
          <img
            src={fotoAmpliada.url}
            alt="Foto ampliada"
            style={estilo.imgAmpliada}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={estilo.infoAmpliada}>
            Enviada em {formatarDataHora(fotoAmpliada.enviadoEm)}
          </div>
        </div>
      )}
    </div>
  );
}

/* Estilos */
const estilo = {
  botaoAcao: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
    color: '#fff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 700,
    fontFamily: "'Cinzel', serif",
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(200, 162, 74, 0.3)',
  },
  aviso: {
    textAlign: 'center',
    padding: '16px',
    color: '#666',
    fontSize: '13px',
  },
  vazio: {
    textAlign: 'center',
    padding: '40px 16px',
    color: '#999',
    fontSize: '13px',
    fontStyle: 'italic',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '10px',
  },
  cardFoto: {
    background: '#fff',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid #e2d2f5',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
  },
  img: {
    width: '100%',
    height: '140px',
    objectFit: 'cover',
    cursor: 'pointer',
    display: 'block',
  },
  rodape: {
    padding: '6px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '10px',
    color: '#666',
  },
  data: {
    fontSize: '10px',
    color: '#666',
  },
  btnExcluir: {
    background: 'transparent',
    border: 'none',
    color: '#e74c3c',
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
  },
  modal: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.9)',
    zIndex: 99999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
  },
  btnFecharModal: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
  },
  imgAmpliada: {
    maxWidth: '100%',
    maxHeight: '85vh',
    objectFit: 'contain',
    borderRadius: '8px',
  },
  infoAmpliada: {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff',
    fontSize: '12px',
    background: 'rgba(0,0,0,0.6)',
    padding: '6px 16px',
    borderRadius: '20px',
  },
};