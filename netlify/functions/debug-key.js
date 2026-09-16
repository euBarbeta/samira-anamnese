exports.handler = async () => {
  const key = process.env.FIREBASE_PRIVATE_KEY || '';
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tamanho_total: key.length,
      primeiros_30: key.slice(0, 30),
      ultimos_30: key.slice(-30),
      tem_barra_n_literal: key.includes('\\n'),
      tem_quebra_real: key.includes('\n'),
      tem_aspas_no_inicio: key.startsWith('"'),
      tem_aspas_no_fim: key.endsWith('"'),
      tem_espaco_no_inicio: key.startsWith(' '),
      tem_espaco_no_fim: key.endsWith(' '),
      versao_apos_replace: {
        tamanho: key.replace(/\\n/g, '\n').length,
        primeiros_30: key.replace(/\\n/g, '\n').slice(0, 30),
      }
    }),
  };
};