exports.handler = async () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';

  const resultado = {
    tamanho_string: raw.length,
    primeiros_80: raw.slice(0, 80),
    ultimos_80: raw.slice(-80),
    tem_aspas_no_inicio: raw.startsWith('"'),
    tem_aspas_no_fim: raw.endsWith('"'),
  };

  try {
    const obj = JSON.parse(raw);
    resultado.parse_ok = true;
    resultado.chaves = Object.keys(obj);
    resultado.project_id = obj.project_id;
    resultado.client_email = obj.client_email;
    resultado.private_key_tipo = typeof obj.private_key;
    resultado.private_key_tamanho = obj.private_key ? obj.private_key.length : 'UNDEFINED';
    resultado.private_key_primeiros = obj.private_key ? obj.private_key.slice(0, 40) : null;
    resultado.private_key_ultimos = obj.private_key ? obj.private_key.slice(-40) : null;
    resultado.tem_begin = obj.private_key ? obj.private_key.includes('-----BEGIN PRIVATE KEY-----') : false;
    resultado.tem_end = obj.private_key ? obj.private_key.includes('-----END PRIVATE KEY-----') : false;
  } catch (err) {
    resultado.parse_ok = false;
    resultado.parse_error = err.message;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resultado, null, 2),
  };
};