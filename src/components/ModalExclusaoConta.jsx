// src/components/ModalExclusaoConta.jsx
import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { MdWarning, MdDelete, MdInfoOutline } from 'react-icons/md';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from './firebase';

/**
 * Modal de exclusão da conta do paciente.
 *
 * ⚖️ LGPD + Lei 13.787/2018:
 *  - Dados de CONTATO (telefone, email de contato, endereço) → anonimizados
 *  - E-mail de ACESSO (login) → MANTIDO mas conta DESATIVADA no Auth
 *  - Dados de SAÚDE (anamnese, evoluções, fotos) → MANTIDOS por 20 anos
 *  - Agendamentos → anonimizados (mantidos para histórico da esteta)
 *  - Lembretes pendentes → ignorados por `checar-lembretes.js`
 *
 * ✅ Mesmo comportamento da exclusão feita pela esteticista
 *    (função `excluir-paciente-completo`).
 */
export default function ModalExclusaoConta({ pacienteData, onFechar, onExcluido }) {
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('');

  // ✅ Retry — evita erro "Database is closing/hidden" quando o modal abre/fecha rápido
  const tentarComRetry = async (fn, tentativas = 3) => {
    for (let i = 0; i < tentativas; i++) {
      try {
        return await fn();
      } catch (error) {
        const msg = error?.message || '';
        if (msg.includes('Database is closing/hidden') && i < tentativas - 1) {
          console.warn(`[Firebase] Tentativa ${i + 1} falhou (Database fechando). Retentando...`);
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        throw error;
      }
    }
  };

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

      const pacienteId = pacienteData.id;
      const uidEsteticista = pacienteData.criadoPorUid;

      if (!uidEsteticista || !pacienteId) {
        throw new Error('Dados do paciente incompletos.');
      }

      // ============================================================
      // 1) Re-autentica (pra ter um token válido + validar a senha)
      // ============================================================
      await tentarComRetry(async () => {
        await signInWithEmailAndPassword(auth, emailPaciente, senha);
      });

      const user = auth.currentUser;
      const token = await user.getIdToken(true);

      // ============================================================
      // 2) Chama a Function que anonimiza + desativa o Auth
      // ------------------------------------------------------------
      // ✅ A function cuida de:
      //    - Anonimizar contato (telefone, emailContato, endereço)
      //    - Manter emailAcesso (login) e nome/documento (prontuário)
      //    - Marcar anonimizadoEm (move pra "Arquivados")
      //    - Anonimizar agendamentos e dispositivos
      //    - Desativar a conta no Firebase Auth (disabled: true)
      //    - Notificar a esteta
      // ============================================================
      const res = await fetch('/.netlify/functions/anonimizar-conta-paciente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uidEsteticista }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao anonimizar conta.');
      }

      // ============================================================
      // 3) Desloga do dispositivo
      // ------------------------------------------------------------
      // ✅ A conta no Auth NÃO é deletada — apenas desativada pela
      //    function. Aqui só encerramos a sessão local.
      // ============================================================
      try {
        await signOut(auth);
      } catch (e) {
        console.warn('Falha ao deslogar após exclusão:', e);
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
          Esta ação é permanente. Seus dados de contato serão <strong>anonimizados</strong>
          {' '}e sua conta de acesso será <strong>desativada</strong>.
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
            <li>Seus <strong>dados de contato</strong> (telefone, e-mail de contato, endereço) serão anonimizados;</li>
            <li>Seu <strong>e-mail de acesso</strong> permanece apenas para controle interno da profissional;</li>
            <li>Seu <strong>prontuário de saúde</strong> (anamnese, evoluções, fotos clínicas) será mantido por <strong>20 anos</strong> por obrigação legal;</li>
            <li>Seus <strong>agendamentos</strong> serão anonimizados, mas mantidos no histórico da profissional;</li>
            <li>Sua <strong>conta de acesso</strong> será desativada — você não conseguirá logar novamente;</li>
            <li>Você <strong>deixará de receber lembretes</strong> e notificações.</li>
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