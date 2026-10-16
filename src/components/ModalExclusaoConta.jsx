// src/components/ModalExclusaoConta.jsx
import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { MdWarning, MdDelete, MdInfoOutline } from 'react-icons/md';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import {
  doc, getDoc, getDocs, deleteDoc, collection,
  query, where, updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { anonimizarPaciente } from '../utils/lgpdExclusao';

/**
 * Modal de exclusão da conta do paciente.
 *
 * ⚖️ LGPD + Lei 13.787/2018:
 *  - Dados de CONTATO (nome, telefone, email, endereço) → anonimizados
 *  - Dados de SAÚDE (anamnese, evoluções, fotos) → MANTIDOS por 20 anos
 *  - Agendamentos → anonimizados (mantidos para histórico da esteta)
 *  - Conta de acesso (Auth) → deletada
 *
 * ✅ Refatorado: usa o helper `anonimizarPaciente()` (fonte única de verdade)
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

    try {
      const emailPaciente = pacienteData?.emailAcesso || pacienteData?.email;
      if (!emailPaciente) {
        throw new Error('E-mail do paciente não encontrado.');
      }

      // 1) Valida a senha fazendo re-login
      await signInWithEmailAndPassword(auth, emailPaciente, senha);

      const pacienteId = pacienteData.id;
      const uidEsteticista = pacienteData.criadoPorUid;

      if (uidEsteticista && pacienteId) {
        // ============================================================
        // ⚖️ 1) ANONIMIZAR PACIENTE (helper central)
        //    - Anonimiza dados de contato (nome, telefone, email, endereço)
        //    - Anonimiza TODOS os agendamentos do paciente
        //    - Desativa o link de acesso
        //    - Apaga mapeamento de email
        //    - MANTÉM anamnese, evoluções e fotos (obrigação legal)
        //    - Guarda nomeOriginal pra reativação futura
        // ============================================================
        await anonimizarPaciente({
          pacienteId,
          uidEsteticista,
          motivo: 'paciente-solicitou',
        });

        // ============================================================
        // ⚖️ 2) ANONIMIZAR DADOS DE SEGURANÇA
        //    (seguranca_estado e dispositivos_autorizados)
        // ============================================================
        await anonimizarDadosSeguranca(pacienteId);

        // ============================================================
        // ⚖️ 3) NOTIFICAR A ESTETICISTA
        // ============================================================
        try {
          await Promise.race([
            fetch('/.netlify/functions/notificar-conta-excluida', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uidEsteticista,
                pacienteId,
                pacienteNome: pacienteData?.nome || 'Paciente',
              }),
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 5000)
            ),
          ]);
        } catch (e) {
          console.warn('Falha ao notificar exclusão:', e);
        }
      }

      // ============================================================
      // ⚖️ 4) REMOVE O USUÁRIO DO FIREBASE AUTH (por último)
      // ============================================================
     // ============================================================
// ⚖️ 4) REMOVE O USUÁRIO DO FIREBASE AUTH (por último)
// ------------------------------------------------------------
// ⚠️ O Firebase exige uma sessão MUITO RECENTE pra deletar a conta.
//    Se passou tempo demais desde o re-login (anonimização, fetch
//    de notificação, etc), o delete falha com "Missing or
//    insufficient permissions".
//
//    Solução: re-autenticar IMEDIATAMENTE antes de deletar.
// ============================================================
try {
  if (auth.currentUser) {
    // ✅ Re-autentica com a senha pra garantir sessão fresca
    await signInWithEmailAndPassword(auth, emailPaciente, senha);
    // ✅ Agora deleta
    await auth.currentUser.delete();
  }
} catch (e) {
  console.warn('Erro ao excluir usuário do Auth:', e);

  // Se falhar mesmo assim, ao menos desloga o usuário
  try {
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
  } catch {}
}

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
    // ... (todo o JSX permanece IGUAL — nenhuma mudança visual)
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
          maxWidth: '460px',
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
          Esta ação é permanente e irá <strong>anonimizar</strong> seus dados de contato.
        </p>

        <div style={{
          background: '#fff8e1',
          border: '1px solid #fcd34d',
          borderRadius: '10px',
          padding: '12px 16px',
          textAlign: 'left',
          fontSize: '12px',
          color: '#92400e',
          lineHeight: 1.7,
          marginBottom: '18px',
        }}>
          <strong>⚖️ Importante (LGPD + Lei 13.787/2018):</strong>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px' }}>
            <li>Seus <strong>dados de contato</strong> (nome, telefone, e-mail, endereço) serão anonimizados;</li>
            <li>Seu <strong>prontuário de saúde</strong> (anamnese, evoluções, fotos clínicas) será mantido por <strong>20 anos</strong> por obrigação legal;</li>
            <li>Seus <strong>agendamentos</strong> serão anonimizados, mas mantidos no histórico da profissional;</li>
            <li>Sua <strong>conta de acesso</strong> será excluída.</li>
          </ul>
        </div>

        <p style={{
          fontSize: '12px',
          color: '#666',
          marginBottom: '14px',
        }}>
          Digite sua senha e <strong>EXCLUIR</strong> para confirmar:
        </p>

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

/* ============================================================
   HELPER — anonimiza dados de segurança (seguranca_estado + dispositivos)
   ------------------------------------------------------------
   ⚠️ As rules bloqueiam DELETE em dispositivos_autorizados.
   Por isso só podemos ANONIMIZAR (updateDoc), não deletar.
   ============================================================ */
async function anonimizarDadosSeguranca(pacienteId) {
  const pid = String(pacienteId);
  const agora = new Date().toISOString();

  // 1) seguranca_estado — apaga localização e marca como anonimizado
  try {
    const segRef = doc(db, 'seguranca_estado', pid);
    const segSnap = await getDoc(segRef);
    if (segSnap.exists()) {
      await updateDoc(segRef, {
        localizacaoStatus: 'anonimizada',
        lat: null,
        lng: null,
        cidade: null,
        pais: null,
        anonimizadoEm: agora,
      });
    }
  } catch (e) {
    console.warn('Falha ao anonimizar seguranca_estado:', e);
  }

  // 2) dispositivos_autorizados — marca como anonimizado (NÃO deleta)
  try {
    const devSnap = await getDocs(
      query(
        collection(db, 'dispositivos_autorizados'),
        where('pacienteId', '==', pid)
      )
    );
    for (const d of devSnap.docs) {
      try {
        await updateDoc(d.ref, {
          autorizado: false,
          anonimizadoEm: agora,
        });
      } catch (e) {
        console.warn('Falha ao anonimizar dispositivo:', d.id, e);
      }
    }
  } catch (e) {
    console.warn('Falha ao anonimizar dispositivos:', e);
  }
}