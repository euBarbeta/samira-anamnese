import React, { useState } from 'react';
import { MdClose, MdDownload, MdVerifiedUser, MdWarning } from 'react-icons/md';
import { exportarParaPDF } from '../utils/gerarPdf';

/**
 * Modal que exibe o Termo de Consentimento LGPD assinado pelo paciente.
 * Permite baixar em PDF.
 *
 * Props:
 *  - pacienteData: objeto do paciente (precisa ter nome, documento, id, consentimentoLGPD)
 *  - onFechar: () => void
 */
export default function TermoConsentimentoPDF({ pacienteData, onFechar }) {
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const consentimento = pacienteData?.consentimentoLGPD || {};

  const aceito = consentimento.aceito === true;
  const dataAceite = consentimento.dataAceite
    ? new Date(consentimento.dataAceite).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : '—';
  const versaoTermo = consentimento.versaoTermo || '—';
  const plataforma = traduzirPlataforma(consentimento.plataforma);
  const userAgent = consentimento.userAgent || '—';
  const codigoAutenticidade = gerarHashConsentimento(pacienteData);

  const handleBaixarPDF = async () => {
    setGerandoPDF(true);
    try {
      await exportarParaPDF(
        'termo-consentimento-pdf',
        `Termo-Consentimento-${(pacienteData.nome || 'paciente').replace(/\s+/g, '-')}`
      );
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <div
      onClick={onFechar}
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
          padding: 0,
          maxWidth: '820px',
          width: '100%',
          maxHeight: '94vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.45)',
          fontFamily: "'Montserrat', sans-serif",
          border: '1.5px solid #C8A24A',
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600;700&display=swap');
          .termo-scroll::-webkit-scrollbar { width: 8px; }
          .termo-scroll::-webkit-scrollbar-track { background: #f3eef8; }
          .termo-scroll::-webkit-scrollbar-thumb { background: #C8A24A; border-radius: 4px; }
          .termo-scroll::-webkit-scrollbar-thumb:hover { background: #a8852f; }
        `}</style>

        {/* Cabeçalho do modal */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 24px',
          borderBottom: '1.5px solid #e2d2f5',
          background: 'linear-gradient(135deg, rgba(200, 162, 74, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {aceito ? (
              <MdVerifiedUser size={22} color="#16a34a" />
            ) : (
              <MdWarning size={22} color="#e65100" />
            )}
            <h2 style={{
              fontFamily: "'Cinzel', serif",
              color: '#2c163a',
              fontSize: '16px',
              margin: 0,
              letterSpacing: '0.3px',
            }}>
              {aceito ? 'Termo de Consentimento — LGPD' : 'Consentimento pendente'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '6px', borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MdClose size={22} color="#2c163a" />
          </button>
        </div>

        {/* Corpo rolável — é o que vai pro PDF */}
        <div
          className="termo-scroll"
          style={{ padding: '28px 32px', overflowY: 'auto', background: '#fefefe' }}
        >
          <div id="termo-consentimento-pdf" style={{
            background: '#fff',
            padding: '32px 36px',
            fontFamily: "'Montserrat', sans-serif",
            color: '#222',
            lineHeight: 1.6,
          }}>

            {/* Cabeçalho do documento */}
            <div style={{ textAlign: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #C8A24A' }}>
              <h1 style={{
                fontFamily: "'Cinzel', serif",
                fontSize: '20px',
                color: '#2c163a',
                margin: '0 0 6px 0',
                letterSpacing: '1px',
              }}>
                TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO
              </h1>
              <p style={{ fontSize: '11px', color: '#666', margin: 0, letterSpacing: '0.5px' }}>
                Tratamento de dados pessoais e sensíveis — LGPD (Lei 13.709/2018)
              </p>
            </div>

            {!aceito && (
              <div style={{
                background: '#fff3e0',
                border: '1.5px solid #ffb74d',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '20px',
                fontSize: '12px',
                color: '#5d4037',
              }}>
                <strong>⚠️ Atenção:</strong> Este paciente ainda não aceitou o Termo de Consentimento LGPD.
                O documento abaixo é um modelo e não possui validade como registro de aceite.
              </div>
            )}

            {/* Seção 1 — Titular */}
            <h3 style={subTitulo}>1. TITULAR DOS DADOS</h3>
            <div style={linhaInfo}><strong>Nome:</strong> {pacienteData?.nome || '—'}</div>
            <div style={linhaInfo}><strong>Documento:</strong> {pacienteData?.documento || 'Não informado'}</div>
            <div style={linhaInfo}><strong>Data de nascimento:</strong> {pacienteData?.anamnese?.dataNascimento || pacienteData?.dataNascimento || 'Não informado'}</div>

            {/* Seção 2 — Controladora */}
            <h3 style={subTitulo}>2. CONTROLADORA DOS DADOS</h3>
            <div style={linhaInfo}><strong>Razão Social:</strong> Samira Ferreira Estética & Cosmetologia</div>
            <div style={linhaInfo}><strong>Endereço:</strong> Rua Paulo VI, 166 — Nossa Senhora do Monte Serrat, Salto/SP</div>
            <div style={linhaInfo}><strong>E-mail:</strong> contatomiguelbtech@gmail.com</div>

            {/* Seção 3 — Objeto */}
            <h3 style={subTitulo}>3. OBJETO DO CONSENTIMENTO</h3>
            <p style={paragrafo}>
              O(a) titular acima identificado(a) declara, de forma <strong>livre, informada e inequívoca</strong>,
              que <strong>AUTORIZA</strong> a controladora a realizar o tratamento dos seus dados pessoais e
              dados pessoais sensíveis (de saúde) para as seguintes finalidades:
            </p>

            <p style={paragrafo}><strong>a)</strong> <strong>Dados pessoais</strong> (nome, telefone, endereço, documento, data de nascimento): para cadastro, identificação, contato e execução dos procedimentos estéticos contratados.</p>
            <p style={paragrafo}><strong>b)</strong> <strong>Dados sensíveis de saúde</strong> (ficha de anamnese — alergias, medicamentos, condições de saúde, histórico clínico estético): para garantir segurança e personalização dos procedimentos.</p>
            <p style={paragrafo}><strong>c)</strong> <strong>Imagens</strong> (fotos faciais e/ou corporais): para acompanhamento da evolução dos procedimentos.</p>
            <p style={paragrafo}><strong>d)</strong> <strong>Envio de lembretes</strong> via notificação push sobre retornos e cuidados.</p>

            {/* Seção 4 — Base legal */}
            <h3 style={subTitulo}>4. BASE LEGAL</h3>
            <p style={paragrafo}>
              Art. 7º, inciso I e Art. 11, inciso I da Lei nº 13.709/2018 (LGPD) — mediante consentimento
              específico e destacado do titular, para finalidades específicas.
            </p>

            {/* Seção 5 — Direitos */}
            <h3 style={subTitulo}>5. DIREITOS DO TITULAR</h3>
            <p style={paragrafo}>O(a) titular poderá, a qualquer momento e gratuitamente, exercer:</p>
            <ul style={lista}>
              <li>Confirmação da existência de tratamento e acesso aos dados;</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>Portabilidade dos dados a outro fornecedor;</li>
              <li>Eliminação dos dados pessoais tratados com consentimento;</li>
              <li>Informação sobre compartilhamentos de dados;</li>
              <li>Revogação do consentimento a qualquer momento.</li>
            </ul>

            {/* Seção 6 — Compartilhamento */}
            <h3 style={subTitulo}>6. COMPARTILHAMENTO</h3>
            <p style={paragrafo}>
              Os dados <strong>não são vendidos nem compartilhados com terceiros</strong> para fins comerciais.
              Utilizamos apenas provedores técnicos (Google Firebase, Cloudinary, Netlify) em conformidade
              com a LGPD.
            </p>

            {/* Seção 7 — Validade */}
            <h3 style={subTitulo}>7. VALIDADE</h3>
            <p style={paragrafo}>
              Este consentimento é válido por tempo indeterminado, podendo ser revogado a qualquer momento
              pelo titular através dos canais de contato da controladora.
            </p>

            {/* Registro de aceite */}
            <h3 style={subTitulo}>8. REGISTRO DE ACEITE</h3>
            <div style={{
              background: aceito ? '#f0fdf4' : '#fff8e1',
              border: `1.5px solid ${aceito ? '#86efac' : '#fcd34d'}`,
              borderRadius: '8px',
              padding: '14px 18px',
              marginTop: '8px',
            }}>
              <div style={linhaInfo}><strong>Status:</strong> {aceito ? '✅ ACEITO' : '⚠️ PENDENTE'}</div>
              <div style={linhaInfo}><strong>Data e hora do aceite:</strong> {dataAceite}</div>
              <div style={linhaInfo}><strong>Versão do termo:</strong> {versaoTermo}</div>
              <div style={linhaInfo}><strong>Plataforma:</strong> {plataforma}</div>
              <div style={linhaInfo}><strong>Código de autenticidade:</strong> <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#7e22ce' }}>{codigoAutenticidade}</span></div>
            </div>

            {/* Assinatura */}
            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', minWidth: '320px' }}>
                <div style={{ borderTop: '1.5px solid #333', marginBottom: '8px' }} />
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#222' }}>
                  {pacienteData?.nome || 'TITULAR DOS DADOS'}
                </div>
                <div style={{ fontSize: '10px', color: '#666' }}>
                  Documento: {pacienteData?.documento || '—'}
                </div>
                <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                  Assinatura eletrônica do titular
                </div>
              </div>
            </div>

            {/* Rodapé */}
            <div style={{
              marginTop: '32px',
              paddingTop: '14px',
              borderTop: '1px dashed #ddd',
              fontSize: '10px',
              color: '#888',
              textAlign: 'center',
              lineHeight: 1.5,
            }}>
              Documento gerado eletronicamente em {dataAceite}.
              <br />
              Este registro tem validade como prova de consentimento nos termos da LGPD.
              <br />
              Código de autenticidade: <strong>{codigoAutenticidade}</strong>
              {userAgent !== '—' && (
                <>
                  <br />
                  <span style={{ fontSize: '9px' }}>
                    User-Agent: {userAgent}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé do modal */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1.5px solid #e2d2f5',
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          background: '#fafafc',
        }}>
          <button
            type="button"
            onClick={handleBaixarPDF}
            disabled={gerandoPDF || !aceito}
            style={{
              fontFamily: "'Cinzel', serif",
              background: !aceito
                ? 'linear-gradient(135deg, #ccc 0%, #ddd 100%)'
                : 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
              color: !aceito ? '#888' : '#fff',
              border: !aceito ? '1.5px solid #bbb' : '1.5px solid #9c7826',
              padding: '12px 28px',
              borderRadius: '24px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1px',
              cursor: (!aceito || gerandoPDF) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: aceito ? '0 4px 14px rgba(200, 162, 74, 0.35)' : 'none',
              opacity: gerandoPDF ? 0.7 : 1,
            }}
          >
            <MdDownload size={16} />
            {gerandoPDF ? 'GERANDO PDF...' : 'BAIXAR PDF'}
          </button>
          <button
            type="button"
            onClick={onFechar}
            style={{
              fontFamily: "'Cinzel', serif",
              background: '#f0f0f0',
              color: '#333',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '24px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

const subTitulo = {
  fontFamily: "'Cinzel', serif",
  fontSize: '12px',
  color: '#2c163a',
  fontWeight: 700,
  marginTop: '22px',
  marginBottom: '8px',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const paragrafo = {
  fontSize: '12px',
  color: '#333',
  lineHeight: 1.7,
  margin: '0 0 8px 0',
};

const lista = {
  fontSize: '12px',
  color: '#333',
  lineHeight: 1.8,
  paddingLeft: '20px',
  margin: '0 0 8px 0',
};

const linhaInfo = {
  fontSize: '12px',
  color: '#333',
  marginBottom: '4px',
  lineHeight: 1.5,
};

function traduzirPlataforma(p) {
  const map = {
    'android-app': 'Aplicativo Android (APK)',
    'ios-app': 'Aplicativo iOS',
    'pwa': 'Web App instalado (PWA)',
    'web': 'Navegador Web',
  };
  return map[p] || (p ? p : 'Não informado');
}

function gerarHashConsentimento(pacienteData) {
  if (!pacienteData) return '—';
  const c = pacienteData.consentimentoLGPD || {};
  const str = `${pacienteData.id || ''}|${pacienteData.nome || ''}|${c.dataAceite || ''}|${c.versaoTermo || ''}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const h = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  return `LGPD-${h.slice(0, 4)}-${h.slice(4, 8)}-${(pacienteData.id || '0000').slice(-4).toUpperCase()}`;
}