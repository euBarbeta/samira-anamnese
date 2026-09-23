import React from 'react';
import { MdClose } from 'react-icons/md';

export default function PoliticaPrivacidade({ onFechar }) {
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
          padding: '0',
          maxWidth: '720px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 70px rgba(44, 22, 58, 0.4)',
          fontFamily: "'Montserrat', sans-serif",
          position: 'relative',
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Montserrat:wght@400;500;600&display=swap');
          .politica-scroll::-webkit-scrollbar { width: 8px; }
          .politica-scroll::-webkit-scrollbar-track { background: #f3eef8; }
          .politica-scroll::-webkit-scrollbar-thumb { background: #C8A24A; border-radius: 4px; }
          .politica-scroll::-webkit-scrollbar-thumb:hover { background: #a8852f; }
        `}</style>

        {/* Cabeçalho */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1.5px solid #e2d2f5',
          background: 'linear-gradient(135deg, rgba(200, 162, 74, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
        }}>
          <h2 style={{
            fontFamily: "'Cinzel', serif",
            color: '#2c163a',
            fontSize: '18px',
            margin: 0,
            letterSpacing: '0.5px',
          }}>
            Política de Privacidade
          </h2>
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

        {/* Corpo rolável */}
        <div
          className="politica-scroll"
          style={{
            padding: '24px 28px',
            overflowY: 'auto',
            fontSize: '13px',
            color: '#333',
            lineHeight: 1.7,
          }}
        >
          <p style={{ fontSize: '11px', color: '#888', marginTop: 0 }}>
            Última atualização: Setembro de 2026 · Versão 1.0
          </p>

          <h3 style={subTitulo}>1. Quem é o responsável pelos seus dados</h3>
          <p style={paragrafo}>
            <strong>Samira Ferreira Estética & Cosmetologia</strong><br />
            Endereço: Rua Paulo VI, 166 — Nossa Senhora do Monte Serrat, Salto — SP<br />
            E-mail de contato: <strong>contatomiguelbtech@gmail.com</strong>
          </p>

          <h3 style={subTitulo}>2. Quais dados coletamos</h3>
          <p style={paragrafo}>Para prestar os serviços de estética e cosmetologia, coletamos os seguintes dados:</p>
          <ul style={lista}>
            <li><strong>Dados pessoais:</strong> nome completo, telefone, endereço, número de documento e data de nascimento.</li>
            <li><strong>Dados sensíveis de saúde:</strong> informações da ficha de anamnese (alergias, medicações em uso, condições de saúde, histórico clínico estético).</li>
            <li><strong>Imagens:</strong> fotos faciais e/ou corporais enviadas por você para acompanhamento de procedimentos.</li>
            <li><strong>Registros de evolução:</strong> anotações dos procedimentos realizados.</li>
          </ul>

          <h3 style={subTitulo}>3. Para que usamos seus dados</h3>
          <ul style={lista}>
            <li>Realizar os procedimentos estéticos com segurança e personalização.</li>
            <li>Manter seu histórico de evolução e acompanhamento.</li>
            <li>Enviar lembretes de tratamento via notificações push.</li>
            <li>Cumprir obrigações legais e regulatórias.</li>
          </ul>

          <h3 style={subTitulo}>4. Base legal do tratamento</h3>
          <p style={paragrafo}>
            O tratamento dos seus dados é realizado com base no seu <strong>consentimento livre, informado e inequívoco</strong>,
            conforme o art. 7º, inciso I e art. 11, inciso I da LGPD (Lei 13.709/2018), que trata especificamente
            de dados sensíveis de saúde.
          </p>

          <h3 style={subTitulo}>5. Com quem compartilhamos</h3>
          <p style={paragrafo}>
            Seus dados <strong>não são vendidos nem compartilhados com terceiros</strong> para fins comerciais.
            Utilizamos apenas os seguintes provedores técnicos:
          </p>
          <ul style={lista}>
            <li><strong>Google Firebase</strong> (autenticação e banco de dados) — servidores em conformidade com a LGPD.</li>
            <li><strong>Cloudinary</strong> (armazenamento seguro de imagens).</li>
            <li><strong>Netlify</strong> (hospedagem do sistema).</li>
          </ul>

          <h3 style={subTitulo}>6. Por quanto tempo guardamos</h3>
          <p style={paragrafo}>
            Seus dados são mantidos enquanto durar o relacionamento e pelos prazos legais aplicáveis
            (mínimo de 5 anos para fins de defesa em eventuais processos, conforme legislação civil).
            Você pode solicitar a exclusão a qualquer momento.
          </p>

          <h3 style={subTitulo}>7. Seus direitos como titular</h3>
          <p style={paragrafo}>A qualquer momento você pode exercer gratuitamente:</p>
          <ul style={lista}>
            <li>✅ <strong>Acesso</strong> aos seus dados (painel do paciente).</li>
            <li>✅ <strong>Correção</strong> de dados incompletos ou desatualizados.</li>
            <li>✅ <strong>Exclusão</strong> dos seus dados (botão “Excluir minha conta”).</li>
            <li>✅ <strong>Portabilidade</strong> — baixar suas fichas em PDF.</li>
            <li>✅ <strong>Revogação do consentimento</strong> a qualquer momento.</li>
            <li>✅ <strong>Informação</strong> sobre compartilhamentos.</li>
          </ul>

          <h3 style={subTitulo}>8. Segurança</h3>
          <p style={paragrafo}>
            Adotamos medidas técnicas e administrativas para proteger seus dados, incluindo:
            autenticação individual, criptografia HTTPS, controle de acesso, backup e exclusão segura.
          </p>

          <h3 style={subTitulo}>9. Como exercer seus direitos</h3>
          <p style={paragrafo}>
            Envie um e-mail para <strong>contatomiguelbtech@gmail.com</strong> ou utilize as opções
            disponíveis no próprio painel do paciente. Responderemos em até 15 dias.
          </p>

          <h3 style={subTitulo}>10. Alterações nesta política</h3>
          <p style={paragrafo}>
            Podemos atualizar esta política periodicamente. A versão vigente sempre estará disponível
            no sistema, e você será avisado(a) em caso de mudanças relevantes.
          </p>

          <div style={{
            marginTop: '24px',
            padding: '14px',
            background: 'rgba(200, 162, 74, 0.08)',
            border: '1.5px dashed #C8A24A',
            borderRadius: '10px',
            fontSize: '12px',
            color: '#55286f',
          }}>
            <strong>Ao utilizar o sistema e autorizar o tratamento dos dados</strong>, você declara
            que leu, entendeu e concorda com esta Política de Privacidade.
          </div>
        </div>

        {/* Rodapé */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1.5px solid #e2d2f5',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <button
            type="button"
            onClick={onFechar}
            style={{
              fontFamily: "'Cinzel', serif",
              background: 'linear-gradient(135deg, #C8A24A 0%, #e2be64 100%)',
              color: '#fff',
              border: '1.5px solid #9c7826',
              padding: '11px 32px',
              borderRadius: '24px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(200, 162, 74, 0.35)',
            }}
          >
            ENTENDI
          </button>
        </div>
      </div>
    </div>
  );
}

const subTitulo = {
  fontFamily: "'Cinzel', serif",
  color: '#2c163a',
  fontSize: '13px',
  fontWeight: 700,
  marginTop: '20px',
  marginBottom: '8px',
  letterSpacing: '0.3px',
};

const paragrafo = {
  fontSize: '12.5px',
  color: '#444',
  margin: '0 0 10px 0',
  lineHeight: 1.7,
};

const lista = {
  fontSize: '12.5px',
  color: '#444',
  margin: '0 0 10px 0',
  paddingLeft: '22px',
  lineHeight: 1.8,
};