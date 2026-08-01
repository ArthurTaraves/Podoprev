import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(envConfig.apiKey && envConfig.projectId && envConfig.appId);

// Firebase Storage exige o plano Blaze (cartão cadastrado) desde out/2024. Fica
// desativado por padrão — fotos caem no armazenamento local do navegador (mesmo
// comportamento do modo demonstração) até VITE_FIREBASE_STORAGE_ENABLED=true.
export const isStorageConfigured = isFirebaseConfigured && import.meta.env.VITE_FIREBASE_STORAGE_ENABLED === 'true';

// Sem .env.local, getAuth() lança "auth/invalid-api-key" de forma síncrona — isso
// acontecia na carga do módulo, antes do React montar, e derrubava o app inteiro
// numa tela branca sem nenhum erro visível. Com placeholders válidos (formato aceito,
// sem credenciais reais), a UI sempre carrega; só as chamadas de rede ao Firebase
// falham, de forma tratada, quando o profissional tenta entrar (ver isFirebaseConfigured).
const firebaseConfig = isFirebaseConfigured
  ? envConfig
  : {
      apiKey: 'demo-api-key-not-configured',
      authDomain: 'localhost',
      projectId: 'podoprev-not-configured',
      storageBucket: 'podoprev-not-configured.appspot.com',
      messagingSenderId: '0',
      appId: '1:0:web:0',
    };

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
