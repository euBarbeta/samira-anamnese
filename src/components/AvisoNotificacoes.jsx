import React, { useState, useEffect } from 'react';
import { Bell, Smartphone, Monitor, AlertTriangle } from 'lucide-react';
import { isNativo } from './push-notifications-native';
import { PushNotifications } from '@capacitor/push-notifications';

const STORAGE_KEY = 'aviso_segundo_plano_aceito';

export default function AvisoNotificacoes({ pacienteId, appInstalado = false }) {
  const [plataforma, setPlataforma] = useState('desconhecido');
  const [permissao, setPermissao] = useState('default');
  const [avisoSegundoPlanoAceito, setAvisoSegundoPlanoAceito] = useState(true);
  const [verificando, setVerificando] = useState(true);   // ✅ DENTRO do componente

  useEffect(() => {
    const checarPermissao = async () => {
      if (isNativo()) {
        try {
          const status = await PushNotifications.checkPermissions();
          const perm = status.receive;
          setPermissao(perm === 'prompt' ? 'default' : perm);
        } catch (e) {
          console.warn('Erro ao checar permissão nativa:', e);
          setPermissao('default');
        }
      } else {
        if (typeof Notification !== 'undefined') {
          setPermissao(Notification.permission);
        }
      }

      // ✅ Libera a renderização depois de checar
      setVerificando(false);
    };

    checarPermissao();

    // Detecta plataforma
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isWindows = /Windows/i.test(ua);

    if (isAndroid) setPlataforma('android');
    else if (isIOS) setPlataforma('ios');
    else if (isWindows) setPlataforma('windows');
    else setPlataforma('desktop');

    try {
      const aceito = localStorage.getItem(STORAGE_KEY) === 'ok';
      setAvisoSegundoPlanoAceito(aceito);
    } catch (e) {
      setAvisoSegundoPlanoAceito(false);
    }
  }, []);

  const aceitarAvisoSegundoPlano = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'ok');
    } catch (e) {
      // ignora erros
    }
    setAvisoSegundoPlanoAceito(true);
  };

  const mostrarAvisoSegundoPlano = appInstalado && !avisoSegundoPlanoAceito;

  // ✅ Enquanto verifica, não mostra NADA (evita o "flash" dos avisos)
  if (verificando) return null;

  return (
    <div style={estilos.container}>
      {/* ============================================== */}
      {/* BLOCO 1: PERMISSÃO DE NOTIFICAÇÃO              */}
      {/* ============================================== */}
      {permissao === 'default' && (
        <div style={estilos.blocoPermissao}>
          <Bell size={22} color="#C8A24A" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={estilos.titulo}>Ativar lembretes?</p>
            <p style={estilos.descricao}>
              Receba notificações dos seus lembretes de tratamento direto no celular.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (isNativo()) {
                const result = await PushNotifications.requestPermissions();
                if (result.receive === 'granted') {
                  setPermissao('granted');
                  if (pacienteId) {
                    const { inscreverPush } = await import('./push-notifications');
                    await inscreverPush(pacienteId);
                  }
                } else {
                  setPermissao('denied');
                }
              } else {
                const resultado = await Notification.requestPermission();
                setPermissao(resultado);
                if (resultado === 'granted' && pacienteId) {
                  const { inscreverPush } = await import('./push-notifications');
                  await inscreverPush(pacienteId);
                }
              }
            }}
            style={estilos.botaoAtivar}
          >
            ATIVAR
          </button>
        </div>
      )}

      {/* ============================================== */}
      {/* BLOCO 2: PERMISSÃO NEGADA                      */}
      {/* ============================================== */}
      {permissao === 'denied' && (
        <div style={estilos.blocoNegado}>
          <AlertTriangle size={18} color="#e65100" style={{ flexShrink: 0 }} />
          <div>
            {isNativo() ? (
              <>
                <strong>Notificações bloqueadas.</strong> Para ativar, vá em{' '}
                <strong>Configurações → Aplicativos → Samira Estética → Notificações</strong>{' '}
                e permita.
              </>
            ) : (
              <>
                <strong>Notificações bloqueadas.</strong> Para ativar, toque no cadeado 🔒 da
                barra de endereço → <strong>Notificações → Permitir</strong>.
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* BLOCO 3: GARANTIA EM SEGUNDO PLANO             */}
      {/* ============================================== */}
      {mostrarAvisoSegundoPlano && (
        <>
          {plataforma === 'android' && (
            <div style={estilos.blocoInstrucoes}>
              <div style={estilos.headerInstrucoes}>
                <Smartphone size={16} color="#C8A24A" />
                <span style={estilos.tituloInstrucoes}>
                  Android: garanta que os lembretes toquem mesmo com o app fechado
                </span>
              </div>
              <p style={estilos.textoInstrucoes}>
                O Android pode "hibernar" o app se não for usado por muito tempo, e isso
                <strong> cancela as notificações</strong>. Siga os passos abaixo para evitar:
              </p>
              <p style={estilos.passos}>
                1. Acesse as <strong>Configurações</strong> do celular.
                <br />
                2. Vá em <strong>Aplicativos</strong> → <strong>Samira Estética</strong>.
                <br />
                3. Desative <strong>"Gerenciar aplicativo se não usado"</strong>.
                <br />
                4. Em <strong>Bateria</strong>, marque <strong>"Sem restrições"</strong>.
              </p>
              <button
                type="button"
                onClick={aceitarAvisoSegundoPlano}
                style={estilos.botaoEntendi}
              >
                ENTENDI
              </button>
            </div>
          )}

          {plataforma === 'ios' && (
            <div style={estilos.blocoInstrucoes}>
              <div style={estilos.headerInstrucoes}>
                <Smartphone size={16} color="#C8A24A" />
                <span style={estilos.tituloInstrucoes}>
                  iPhone / iPad: dicas para receber sempre
                </span>
              </div>
              <p style={estilos.textoInstrucoes}>
                No iOS, as notificações push funcionam apenas com o app instalado na Tela de
                Início (iOS 16.4 ou superior).
              </p>
              <p style={estilos.passos}>
                1. Certifique-se de que o app foi <strong>adicionado à Tela de Início</strong>.
                <br />
                2. Verifique se as notificações estão permitidas em
                <strong> Ajustes → Samira Estética → Notificações</strong>.
                <br />
                3. Mantenha o app aberto ou minimize-o para maior confiabilidade.
              </p>
              <button
                type="button"
                onClick={aceitarAvisoSegundoPlano}
                style={estilos.botaoEntendi}
              >
                ENTENDI
              </button>
            </div>
          )}

          {plataforma === 'windows' && (
            <div style={estilos.blocoInstrucoes}>
              <div style={estilos.headerInstrucoes}>
                <Monitor size={16} color="#C8A24A" />
                <span style={estilos.tituloInstrucoes}>
                  Windows: mantenha as notificações ativas
                </span>
              </div>
              <p style={estilos.textoInstrucoes}>
                O Windows pode suspender apps em segundo plano. Ajuste para garantir os
                lembretes:
              </p>
              <p style={estilos.passos}>
                1. Vá em <strong>Configurações → Aplicativos → Aplicativos instalados</strong>.
                <br />
                2. Encontre <strong>Samira Estética</strong> e clique em
                <strong> Opções avançadas</strong>.
                <br />
                3. Em <strong>Execução em segundo plano</strong>, selecione
                <strong> "Ativado"</strong>.
              </p>
              <button
                type="button"
                onClick={aceitarAvisoSegundoPlano}
                style={estilos.botaoEntendi}
              >
                ENTENDI
              </button>
            </div>
          )}

          {plataforma === 'desktop' && (
            <div style={estilos.blocoInstrucoes}>
              <div style={estilos.headerInstrucoes}>
                <Monitor size={16} color="#C8A24A" />
                <span style={estilos.tituloInstrucoes}>Mantenha as notificações ativas</span>
              </div>
              <p style={estilos.textoInstrucoes}>
                Para receber os lembretes, mantenha o navegador ou o app instalado aberto. Se
                fechá-lo, as notificações podem não chegar.
              </p>
              <button
                type="button"
                onClick={aceitarAvisoSegundoPlano}
                style={estilos.botaoEntendi}
              >
                ENTENDI
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Estilos */
const estilos = {
  container: {
    margin: '0 20px 20px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  blocoPermissao: {
    padding: '16px',
    background: 'linear-gradient(135deg, #fdf4ff 0%, #f5e6ff 100%)',
    border: '1.5px solid #C8A24A',
    borderRadius: '14px',
    boxShadow: '0 4px 12px rgba(200, 162, 74, 0.15)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  blocoNegado: {
    padding: '12px 16px',
    background: '#fff3e0',
    border: '1.5px solid #ffb74d',
    borderRadius: '12px',
    fontSize: '11px',
    color: '#5d4037',
    lineHeight: 1.5,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px'
  },
  blocoInstrucoes: {
    padding: '14px',
    background: 'rgba(215, 206, 224, 0.25)',
    border: '1px solid rgba(226, 210, 245, 0.7)',
    borderRadius: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  headerInstrucoes: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  tituloInstrucoes: {
    fontFamily: "'Cinzel', serif",
    fontSize: '12px',
    fontWeight: 700,
    color: '#2c163a',
    lineHeight: 1.4
  },
  titulo: {
    fontFamily: "'Cinzel', serif",
    color: '#2c163a',
    fontSize: '12px',
    fontWeight: 700,
    margin: '0 0 4px 0'
  },
  descricao: {
    fontSize: '11px',
    color: '#555',
    margin: 0,
    lineHeight: 1.5
  },
  botaoAtivar: {
    fontFamily: "'Cinzel', serif",
    background: '#C8A24A',
    color: '#fff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '20px',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 3px 10px rgba(200, 162, 74, 0.3)'
  },
  botaoEntendi: {
    fontFamily: "'Cinzel', serif",
    background: '#2c163a',
    color: '#C8A24A',
    border: '1.2px solid #C8A24A',
    padding: '10px 16px',
    borderRadius: '16px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center',
    letterSpacing: '1px'
  },
  textoInstrucoes: {
    fontSize: '11px',
    color: '#444',
    margin: 0,
    lineHeight: 1.5
  },
  passos: {
    fontSize: '11px',
    color: '#555',
    margin: 0,
    lineHeight: 1.7,
    paddingLeft: '4px'
  }
};