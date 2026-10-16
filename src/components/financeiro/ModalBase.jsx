// src/components/financeiro/ModalBase.jsx
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * ✅ ModalBase — wrapper universal pra modais do financeiro
 *
 * Resolve 4 problemas de uma vez:
 *  1. Ocupa 100% da tela em mobile (nunca sai pra fora)
 *  2. Trava scroll do body (não deixa a página de trás rolar)
 *  3. Botão voltar (Android/navegador/PWA) fecha o modal
 *  4. Z-index máximo (nunca fica atrás de nada)
 *
 * Props:
 *  - onFechar: () => void  (chamado ao clicar fora, apertar voltar ou botão X)
 *  - bloquearFechar: boolean (impede fechar durante salvamento)
 *  - isMobile: boolean (opcional — se não passar, detecta sozinho)
 *  - children: conteúdo do modal
 */
export default function ModalBase({
  onFechar,
  bloquearFechar = false,
  isMobile: isMobileProp,
  children,
}) {
  const onFecharRef = useRef(onFechar);
  useEffect(() => { onFecharRef.current = onFechar; }, [onFechar]);

  const bloquearRef = useRef(bloquearFechar);
  useEffect(() => { bloquearRef.current = bloquearFechar; }, [bloquearFechar]);

  // ✅ Detecta mobile (permite override via prop)
  const [isMobileAuto, setIsMobileAuto] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth <= 640 : false
  );

  useEffect(() => {
    if (isMobileProp !== undefined) return; // se passou via prop, não detecta
    const handler = () => setIsMobileAuto(window.innerWidth <= 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [isMobileProp]);

  const isMobile = isMobileProp !== undefined ? isMobileProp : isMobileAuto;

  // ============================================================
  // ✅ 1. HISTÓRICO — botão voltar fecha o modal
  // ============================================================
  useEffect(() => {
    // Empilha uma entrada fantasma no histórico
    window.history.pushState(
      { ...(window.history.state || {}), modalFinanceiroAberto: true },
      '',
      window.location.href
    );

    const onPop = () => {
      // Se o usuário apertou voltar e não está bloqueado, fecha
      if (!bloquearRef.current) {
        onFecharRef.current?.();
      } else {
        // Se está bloqueado (salvando), re-empilha pra não sair
        window.history.pushState(
          { ...(window.history.state || {}), modalFinanceiroAberto: true },
          '',
          window.location.href
        );
      }
    };

    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);

      // Se ainda tem nossa entrada no histórico, remove
      if (window.history.state?.modalFinanceiroAberto) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // ✅ 2. TRAVA SCROLL DO BODY
  // ============================================================
  useEffect(() => {
    const scrollY = window.scrollY;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;

      // Restaura posição do scroll
      window.scrollTo(0, scrollY);
    };
  }, []);

  // ============================================================
  // ✅ 3. FECHAR AO APERTAR ESC (desktop)
  // ============================================================
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && !bloquearRef.current) {
        onFecharRef.current?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ============================================================
  // ✅ 4. RENDERIZA VIA PORTAL (imune a transform/overflow do pai)
  // ============================================================
  const conteudo = (
    <div
      onClick={bloquearFechar ? undefined : () => onFecharRef.current?.()}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',           // ✅ dvh — respeita barra de URL do mobile
        background: 'rgba(44, 22, 58, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: isMobile ? 'stretch' : 'center',
        zIndex: 2147483647,
        padding: isMobile ? 0 : 20,
        boxSizing: 'border-box',
        // ✅ Blindagem contra layout quebrado
        overflow: 'hidden',
        transform: 'none',
        filter: 'none',
        isolation: 'isolate',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: isMobile ? 0 : 20,
          width: isMobile ? '100%' : '100%',
          maxWidth: isMobile ? '100%' : 480,
          height: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '100%' : '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: isMobile ? 'none' : '0 25px 70px rgba(44, 22, 58, 0.5)',
          // ✅ Nunca deixa conteúdo vazar horizontalmente
          overflowX: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(conteudo, document.body);
}