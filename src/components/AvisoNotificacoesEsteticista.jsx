import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { isNativo } from './push-notifications-native';
import { PushNotifications } from '@capacitor/push-notifications';

const STORAGE_KEY = 'aviso_notif_esteticista_aceito';

export default function AvisoNotificacoesEsteticista({ uidEsteticista }) {
  const [permissao, setPermissao] = useState('default');
  const [verificando, setVerificando] = useState(true);
  const [mostrar, setMostrar] = useState(true);

  useEffect(() => {
    const checar = async () => {
      // Se já dispensou antes, não mostra
      try {
        const dispensado = localStorage.getItem(STORAGE_KEY) === 'ok';
        if (dispensado) {
          setMostrar(false);
          setVerificando(false);
          return;
        }
      } catch (e) {}

      if (isNativo()) {
        try {
          const status = await PushNotifications.checkPermissions();
          const perm = status.receive;
          setPermissao(perm === 'prompt' ? 'default' : perm);
        } catch (e) {
          setPermissao('default');
        }
      } else if (typeof Notification !== 'undefined') {
        setPermissao(Notification.permission);
      }
      setVerificando(false);
    };
    checar();
  }, []);

  const ativar = async () => {
    try {
      if (isNativo()) {
        const result = await PushNotifications.requestPermissions();
        if (result.receive === 'granted') {
          setPermissao('granted');
          const { inscreverPushEsteticistaWeb } = await import('./push-notifications');
          await inscreverPushEsteticistaWeb(uidEsteticista);
        } else {
          setPermissao('denied');
        }
      } else {
        const resultado = await Notification.requestPermission();
        setPermissao(resultado);
        if (resultado === 'granted') {
          const { inscreverPushEsteticistaWeb } = await import('./push-notifications');
          await inscreverPushEsteticistaWeb(uidEsteticista);
        }
      }
      // Marca como "não mostrar mais" depois de ativar
      try {
        localStorage.setItem(STORAGE_KEY, 'ok');
      } catch (e) {}
      setMostrar(false);
    } catch (e) {
      console.error('Erro ao ativar notificações:', e);
    }
  };

  const dispensar = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'ok');
    } catch (e) {}
    setMostrar(false);
  };

  // Não mostra se já autorizou, já dispensou, ou está verificando
  if (verificando || !mostrar || permissao === 'granted') return null;

  return (
    <div style={estilos.container}>
      <div style={estilos.icone}>
        <Bell size={22} color="#C8A24A" />
      </div>
      <div style={{ flex: 1 }}>
        <p style={estilos.titulo}>
          {permissao === 'denied'
            ? '⚠️ Notificações bloqueadas'
            : '🔔 Ativar notificações?'}
        </p>
        <p style={estilos.descricao}>
          {permissao === 'denied'
            ? 'Para receber avisos quando pacientes enviarem fotos, ative nas configurações do navegador/celular.'
            : 'Receba um aviso quando um paciente enviar uma nova foto para a galeria.'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {permissao !== 'denied' && (
          <button type="button" onClick={ativar} style={estilos.botaoAtivar}>
            ATIVAR
          </button>
        )}
        <button type="button" onClick={dispensar} style={estilos.botaoDispensar} title="Fechar">
          ×
        </button>
      </div>
    </div>
  );
}

const estilos = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '0 20px 16px 20px',
    padding: '14px 16px',
    background: 'linear-gradient(135deg, #fdf4ff 0%, #f5e6ff 100%)',
    border: '1.5px solid #C8A24A',
    borderRadius: '14px',
    boxShadow: '0 4px 12px rgba(200, 162, 74, 0.15)',
    animation: 'fadeIn 0.3s ease',
  },
  icone: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(200, 162, 74, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titulo: {
    fontFamily: "'Cinzel', serif",
    color: '#2c163a',
    fontSize: '12px',
    fontWeight: 700,
    margin: '0 0 3px 0',
  },
  descricao: {
    fontSize: '11px',
    color: '#555',
    margin: 0,
    lineHeight: 1.5,
  },
  botaoAtivar: {
    fontFamily: "'Cinzel', serif",
    background: '#C8A24A',
    color: '#fff',
    border: 'none',
    padding: '8px 14px',
    borderRadius: '18px',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 3px 10px rgba(200, 162, 74, 0.3)',
  },
  botaoDispensar: {
    background: 'transparent',
    border: 'none',
    color: '#999',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    fontWeight: 700,
  },
};