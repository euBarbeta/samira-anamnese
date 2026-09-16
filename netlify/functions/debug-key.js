exports.handler = async () => {
  const email = process.env.FIREBASE_CLIENT_EMAIL || '';
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valor_completo: email,
      tamanho: email.length,
      termina_com_gserviceaccount: email.endsWith('.gserviceaccount.com'),
      contem_arroba: email.includes('@'),
      contem_samira: email.includes('samiraestetica'),
      tem_espaco: email.includes(' '),
      tem_aspas: email.includes('"'),
      projectId_valor: process.env.FIREBASE_PROJECT_ID,
    }),
  };
};