exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY
        ? `OK (${process.env.VAPID_PUBLIC_KEY.length} chars)`
        : 'FALTANDO',
      VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ? 'OK' : 'FALTANDO',
      VAPID_EMAIL: process.env.VAPID_EMAIL || 'FALTANDO',
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'FALTANDO',
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'OK' : 'FALTANDO',
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'OK' : 'FALTANDO',
    }),
  };
};