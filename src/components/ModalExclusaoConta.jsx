import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { MdWarning, MdDelete } from 'react-icons/md';
import {
  getAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  doc, getDoc, getDocs, deleteDoc, collection, setDoc,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Modal de exclusão da conta do paciente.
 *
 * Props:
 *  - pacienteData: dados do paciente (precisa ter id, emailAcesso, criadoPorUid)
 *  - onFechar: () => void
 *  - onExcluido: () => void   // callback após exclusão bem-sucedida
 */
export default function ModalExclusaoConta({ pacienteData, onFechar, onExcluido }) {
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('');

  const handleExcluir = async () => {
    setErro('');

    if (!senha) {
      setErro('Digite sua senha para confirmar.');
      return;
    }

    if (confirmacaoTexto.trim().toUpperCase() !== 'EXCLUIR') {
      setErro('Digite EXCLUIR no campo de confirmação.');
      return;
    }

    setExcluindo(true);
    const auth = getAuth();

    try {
      const emailPaciente = pacienteData?.emailAcesso || pacienteData?.email;
      if (!emailPaciente) {
        throw new Error('E-mail do paciente não encontrado.');
      }

      // 1) Valida a senha fazendo re-login
      await signInWithEmailAndPassword(auth, emailPaciente, senha);

      const pacienteId = pacienteData.id;
      const uidEsteticista = pacienteData.criadoPorUid;

      // 2) Apaga TODAS as fotos da subcoleção
      if (uidEsteticista && pacienteId) {
        const fotosRef = collection(
          db,
          `usuarios/${uidEsteticista}/pacientes/${pacienteId}/fotos`
        );
        try {
          const fotosSnap = await getDocs(fotosRef);
          const deletes = fotosSnap.docs.map((d) => deleteDoc(d.ref));
          await Promise.all(deletes);
        } catch (e) {
          console.warn('Erro ao excluir fotos (pode não ter permissão):', e);
          // segue mesmo assim — tenta apagar o resto
        }

        // 3) Apaga o documento principal do paciente
        try {
          await deleteDoc(
            doc(db, `usuarios/${uidEsteticista}/pacientes`, String(pacienteId))
          );
        } catch (e) {
          console.warn('Erro ao excluir doc do paciente:', e);
          throw e;
        }

        // 4) Apaga o mapeamento de e-mail
        try {
          const mapRef = doc(db, 'mapeamento_emails', emailPaciente.toLowerCase());
          const mapSnap = await getDoc(mapRef);
          if (mapSnap.exists()) {
            await deleteDoc(mapRef);
          }
        } catch (e) {
          console.warn('Erro ao excluir mapeamento (pode não ter permissão):', e);
        }
      }

      // 5) Remove o usuário do Firebase Auth
      try {
        if (auth.currentUser) {
          await auth.currentUser.delete();
        }
      } catch (e) {
        console.warn('Erro ao excluir usuário do Auth:', e);
        // Mesmo que falhe, os dados do Firestore já foram apagados
      }

      // 6) Sucesso → dispara callback
      onExcluido?.();
    } catch (err) {
      console.error('Erro ao excluir conta:', err);
      const code = err?.code || '';
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-login-credentials'
      ) {
        setErro('Senha incorreta. Tente novamente.');
      } else if (code === 'auth/too-many-requests') {
        setErro('Muitas tentativas. Aguarde alguns minutos.');
      } else {
        setErro(err?.message || 'Não foi possível excluir a conta. Tente novamente.');
      }
      setExcluindo(false);
    }
  };

  return (
    <div
      onClick={excluindo ? undefined : onFechar}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(44, 22, 58, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 2147483647, padding: '20px', boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '28px 24px 24px 24px',
          maxWidth: '440px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
          border: '1.5px solid #f98080',
          fontFamily: "'Montserrat', sans-serif",
          textAlign: 'center',
        }}
      >
        <div style={{
          width: '68px', height: '68px',
          margin: '0 auto 16px auto',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ffebee 0%, #fde8e8 100%)',
          border: '2px solid #ef9a9a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 18px rgba(198, 40, 40, 0.18)',
        }}>
          <MdWarning size={34} color="#c62828" />
        </div>

        <h3 style={{
          fontFamily: "'Cinzel', serif",
          color: '#c62828',
          fontSize: '19px',
          fontWeight: 700,
          margin: '0 0 12px 0',
          letterSpacing: '0.4px',
        }}>
          Excluir minha conta
        </h3>

        <p style={{
          fontSize: '13px',
          color: '#2c163a',
          lineHeight: 1.6,
          margin: '0 0 14px 0',
        }}>
          Esta ação <strong>é permanente</strong> e irá apagar:
        </p>

        <div style={{
          background: '#fde8e8',
          border: '1px solid #f98080',
          borderRadius: '10px',
          padding: '12px 16px',
          textAlign: 'left',
          fontSize: '12px',
          color: '#7f1d1d',
          lineHeight: 1.7,
          marginBottom: '18px',
        }}>
          ❌ Todos os seus dados pessoais<br />
          ❌ Sua ficha de anamnese completa<br />
          ❌ Todas as fotos da galeria<br />
          ❌ Todas as evoluções registradas<br />
          ❌ Sua conta de acesso ao sistema
        </div>

        <p style={{
          fontSize: '12px',
          color: '#666',
          marginBottom: '14px',
        }}>
          Digite sua senha e <strong>EXCLUIR</strong> para confirmar:
        </p>

        {/* Campo de senha */}
        <div style={{
          display: 'flex', alignItems: 'center',
          border: '1.5px solid #ccc', borderRadius: '10px',
          padding: '0 12px', marginBottom: '10px',
          background: '#fff',
        }}>
          <input
            type={mostrarSenha ? 'text' : 'password'}
            placeholder="Digite sua senha"
            value={senha}
            autoComplete="current-password"
            onChange={(e) => { setSenha(e.target.value); setErro(''); }}
            disabled={excluindo}
            style={{
              width: '100%', padding: '11px 0',
              border: 'none', fontSize: '14px', outline: 'none',
              backgroundColor: 'transparent', boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha(!mostrarSenha)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '0 4px', display: 'flex', alignItems: 'center',
            }}
            title={mostrarSenha ? 'Esconder senha' : 'Ver senha'}
          >
            {mostrarSenha
              ? <FaEye size={17} color="#C8A24A" />
              : <FaEyeSlash size={17} color="#C8A24A" />}
          </button>
        </div>

        {/* Campo de confirmação de texto */}
        <input
          type="text"
          placeholder="Digite EXCLUIR para confirmar"
          value={confirmacaoTexto}
          onChange={(e) => { setConfirmacaoTexto(e.target.value); setErro(''); }}
          disabled={excluindo}
          style={{
            width: '100%', padding: '11px 12px',
            border: '1.5px solid #ccc', borderRadius: '10px',
            fontSize: '13px', outline: 'none',
            marginBottom: '10px', boxSizing: 'border-box',
            textAlign: 'center', letterSpacing: '2px',
            fontWeight: 700, color: '#c62828',
            textTransform: 'uppercase',
          }}
        />

        {erro && (
          <div style={{
            background: '#fde8e8',
            border: '1px solid #f98080',
            color: '#c81e1e',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            marginBottom: '12px',
            fontWeight: 600,
          }}>
            {erro}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          <button
            type="button"
            onClick={onFechar}
            disabled={excluindo}
            style={{
              flex: 1,
              background: '#f0f0f0',
              color: '#333',
              border: 'none',
              padding: '12px 16px',
              borderRadius: '22px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: excluindo ? 'not-allowed' : 'pointer',
              fontFamily: "'Cinzel', serif",
              opacity: excluindo ? 0.6 : 1,
            }}
          >
            CANCELAR
          </button>

          <button
            type="button"
            onClick={handleExcluir}
            disabled={excluindo}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #c62828 0%, #e53935 100%)',
              color: '#fff',
              border: 'none',
              padding: '12px 16px',
              borderRadius: '22px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: excluindo ? 'wait' : 'pointer',
              fontFamily: "'Cinzel', serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(198, 40, 40, 0.35)',
              opacity: excluindo ? 0.7 : 1,
            }}
          >
            {excluindo ? (
              <>
                <span style={{
                  display: 'inline-block',
                  width: '13px', height: '13px',
                  border: '2px solid #fff',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                EXCLUINDO...
              </>
            ) : (
              <>
                <MdDelete size={16} />
                EXCLUIR
              </>
            )}
          </button>
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}