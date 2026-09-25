import React, { useState } from 'react';
import { MdLock, MdPerson, MdArrowForward } from 'react-icons/md';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import { EMAILS_ESTETICISTAS } from './constantes';
import { isNativo } from './push-notifications-native';

export default function TelaInicial({ onLoginSucesso, modoEsteticista = false }) {
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const nomeLimpo = nomeCompleto.trim().toLowerCase();
      let emailFicticio = '';

      if (nomeLimpo === 'mbtech') {
        emailFicticio = 'mbtech@sistema.local';
      } else if (nomeLimpo === 'samira ferreira' || nomeLimpo === 'samira') {
        emailFicticio = 'samira.ferreira@sistema.local';
      } else {
        const partes = nomeCompleto.trim().split(/\s+/);
        if (partes.length < 2) {
          setErro('Por favor, digite o nome completo corretamente.');
          setCarregando(false);
          return;
        }

        const primeiroNome = partes[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const sobrenome = partes[partes.length - 1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        emailFicticio = `${primeiroNome}.${sobrenome}@sistema.local`;
      }
    // ✅ No APK, não restringimos nada — deixa qualquer um logar
const ehNativo = isNativo();

if (!ehNativo && modoEsteticista && !EMAILS_ESTETICISTAS.includes(emailFicticio)) {
  setErro('Acesso não autorizado.');
  setCarregando(false);
  return;
}
if (!ehNativo && !modoEsteticista && EMAILS_ESTETICISTAS.includes(emailFicticio)) {
  setErro('Link inválido para este usuário.');
  setCarregando(false);
  return;
}

      await signInWithEmailAndPassword(auth, emailFicticio, senha);
      setCarregando(false);
    
      } catch (error) {
      console.error("Erro no login:", error);
      setCarregando(false);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErro('Nome ou senha incorretos.');
      } else {
        setErro('Erro ao realizar login. Tente novamente.');
      }
    }
  };

  return (
    <div style={{
      backgroundColor: '#d7cee0',
      width: '100vw',
      height: '100dvh',
      margin: 0,
      padding: 0,
      fontFamily: "'Montserrat', sans-serif",
      boxSizing: 'border-box',
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600&display=swap');

        .input-login {
          width: 100%;
          border: none;
          background: transparent;
          border-bottom: 1.5px solid #C8A24A;
          outline: none;
          height: 32px;
          font-size: 14px;
          color: #1A1A1A;
          -webkit-text-fill-color: #1A1A1A;
        }

        .login-container-embaçado {
          position: absolute;
          inset: 0;
          background: rgba(44, 22, 58, 0.4);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20;
          padding: 16px 24px;
          box-sizing: border-box;
          animation: fadeIn 0.4s ease forwards;
        }

        .login-box {
          background: rgba(255, 255, 255, 0.98);
          border: 1.5px solid #C8A24A;
          border-radius: 16px;
          padding: 20px 18px;
          width: 100%;
          max-width: 320px;
          box-shadow: 0 15px 35px rgba(44, 22, 58, 0.3);
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          animation: scaleUp 0.3s ease forwards;
        }

        .btn-efeito-hover {
          transition: all 0.2s ease-in-out !important;
        }
        .btn-efeito-hover:not(:disabled):active, .btn-efeito-hover:not(:disabled):hover {
          transform: translateY(-2px);
          filter: brightness(1.05);
          box-shadow: 0 6px 16px rgba(200, 162, 74, 0.45) !important;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* IMAGEM DE FUNDO: Mantém altura total (100%) e diminui a largura (ex: 280px ou auto 100%) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
        zIndex: 1
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          backgroundImage: 'url("/imagens/logo-telainicial.jpeg"), url("./imagens/logo-telainicial.jpeg")',
          backgroundSize: '450px 100%', /* Mantém a altura completa da tela, mas estreita a largura para centralizar a logo com respiro */
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }} />
      </div>

      {/* CAIXA DE LOGIN */}
      <div className="login-container-embaçado">
        <div className="login-box" onClick={(e) => e.stopPropagation()}>
          
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <h2 style={{
              fontFamily: "'Cinzel', serif",
              color: '#C8A24A',
              fontSize: '15px',
              fontWeight: 700,
              margin: '0 0 3px 0',
              letterSpacing: '1px'
            }}>
              LOGIN
            </h2>
            <span style={{ fontSize: '9.5px', color: '#666666' }}>
              Samira Ferreira Estética & Cosmetologia
            </span>
          </div>

          {erro && (
            <div style={{
              backgroundColor: '#fde8e8',
              border: '1px solid #f98080',
              color: '#c81e1e',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '11px',
              marginBottom: '12px',
              textAlign: 'center'
            }}>
              {erro}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="login-nome-m" style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontSize: '10px', fontWeight: 700 }}>
                NOME COMPLETO
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdPerson size={16} color="#C8A24A" />
                <input
                  type="text"
                  id="login-nome-m"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  required
                  className="input-login"
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="login-senha-m" style={{ fontFamily: "'Cinzel', serif", color: '#C8A24A', fontSize: '10px', fontWeight: 700 }}>
                SENHA
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdLock size={16} color="#C8A24A" />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  id="login-senha-m"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="input-login"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={mostrarSenha ? 'Esconder senha' : 'Ver senha'}
                >
                  {mostrarSenha ? (
                    <FaEye size={16} color="#C8A24A" />
                  ) : (
                    <FaEyeSlash size={16} color="#C8A24A" />
                  )}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', marginTop: '8px' }}>
              <button
                type="submit"
                disabled={carregando}
                className="btn-efeito-hover"
                style={{
                  width: '100%',
                  backgroundColor: '#C8A24A',
                  color: '#ffffff',
                  border: '1.5px solid #b38f3f',
                  padding: '10px',
                  borderRadius: '8px',
                  fontFamily: "'Cinzel', serif",
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  boxShadow: '0 4px 10px rgba(200, 162, 74, 0.3)',
                  opacity: carregando ? 0.7 : 1
                }}
              >
                {carregando ? 'ENTRANDO...' : <>ENTRAR <MdArrowForward size={12} /></>}
              </button>
            </div>

          </form>

        </div>
      </div>

    </div>
  );
}