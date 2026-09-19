import React, { useState, useEffect } from 'react';
import { Bell, Smartphone, Monitor, AlertTriangle } from 'lucide-react';

export default function AvisoNotificacoes({ pacienteId }) {
  const [plataforma, setPlataforma] = useState('desconhecido');
  const [permissao, setPermissao] = useState('default');

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermissao(Notification.permission);
    }

    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isWindows = /Windows/i.test(ua);

    if (isAndroid) setPlataforma('android');
    else if (isIOS) setPlataforma('ios');
    else if (isWindows) setPlataforma('windows');
    else setPlataforma('desktop');
  }, []);

  const abrirConfiguracoesAndroid = () => {
    // Tenta abrir as configurações de otimização de bateria do app
    // O formato do intent pode variar conforme o navegador
    const intentUrl =
      'intent:#Intent;action=android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS;end';

    try {
      window.location.href = intentUrl;
    } catch (e) {
      // Fallback: abre as configurações gerais do app
      window.location.href = 'package:com.android.settings';
    }
  };

  // Não mostra nada se a permissão já foi concedida
  if (permissao === 'granted') return null;

  return (
    <div style={estilos.container}>
      {/* Bloco de permissão de notificação */}
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
              const resultado = await Notification.requestPermission();
              setPermissao(resultado);
              if (resultado === 'granted' && pacienteId) {
                const { inscreverPush } = await import('./push-notifications');
                await inscreverPush(pacienteId);
              }
            }}
            style={estilos.botaoAtivar}
          >
            ATIVAR
          </button>
        </div>
      )}

      {/* Aviso de permissão negada */}
      {permissao === 'denied' && (
        <div style={estilos.blocoNegado}>
          <AlertTriangle size={18} color="#e65100" style={{ flexShrink: 0 }} />
          <div>
            <strong>Notificações bloqueadas.</strong> Para ativar, toque no cadeado 🔒 da barra
            de endereço → <strong>Notificações → Permitir</strong>.
          </div>
        </div>
      )}

      {/* Instruções específicas por plataforma */}
      {plataforma === 'android' && (
        <div style={estilos.blocoInstrucoes}>
          <div style={estilos.headerInstrucoes}>
            <Smartphone size={16} color="#C8A24A" />
            <span style={estilos.tituloInstrucoes}>Android: Garanta lembretes em segundo plano</span>
          </div>
          <p style={estilos.textoInstrucoes}>
            Para que as notificações cheguem mesmo com o app fechado, desative a opção
            <strong> "Gerenciar aplicativo se não usado"</strong> nas configurações do sistema.
          </p>
          <button type="button" onClick={abrirConfiguracoesAndroid} style={estilos.botaoAndroid}>
            Abrir Configurações do App
          </button>
          <p style={estilos.passos}>
            1. Acesse as <strong>Configurações</strong> do celular.
            <br />
            2. Vá em <strong>Aplicativos</strong> → <strong>Samira Ferreira</strong>.
            <br />
            3. Desative <strong>"Gerenciar aplicativo se não usado"</strong>.
          </p>
        </div>
      )}

      {plataforma === 'ios' && (
        <div style={estilos.blocoInstrucoes}>
          <div style={estilos.headerInstrucoes}>
            <Smartphone size={16} color="#C8A24A" />
            <span style={estilos.tituloInstrucoes}>iPhone / iPad</span>
          </div>
          <p style={estilos.textoInstrucoes}>
            No iOS, as notificações push funcionam apenas com o app instalado na Tela de Início
            (iOS 16.4 ou superior). O sistema não permite execução em segundo plano.
          </p>
          <p style={estilos.passos}>
            1. Certifique-se de que o app foi <strong>adicionado à Tela de Início</strong>.
            <br />
            2. Verifique se as notificações estão permitidas em
            <strong> Ajustes → Samira Ferreira → Notificações</strong>.
            <br />
            3. Mantenha o app aberto ou minimize-o (não feche totalmente) para maior
            confiabilidade.
          </p>
        </div>
      )}

      {plataforma === 'windows' && (
        <div style={estilos.blocoInstrucoes}>
          <div style={estilos.headerInstrucoes}>
            <Monitor size={16} color="#C8A24A" />
            <span style={estilos.tituloInstrucoes}>Windows</span>
          </div>
          <p style={estilos.textoInstrucoes}>
            No Windows, as notificações só funcionam com o app aberto ou em segundo plano
            (quando minimizado). O sistema não permite que PWAs rodem após serem fechados.
          </p>
          <p style={estilos.passos}>
            1. Vá em <strong>Configurações → Aplicativos → Aplicativos instalados</strong>.
            <br />
            2. Encontre <strong>Samira Ferreira</strong> e clique em
            <strong> Opções avançadas</strong>.
            <br />
            3. Em <strong>Execução em segundo plano</strong>, selecione
            <strong> "Ativado"</strong>.
          </p>
        </div>
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
    gap: '8px'
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
    color: '#2c163a'
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
  botaoAndroid: {
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
    textAlign: 'center'
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
    lineHeight: 1.6,
    paddingLeft: '16px'
  }
};