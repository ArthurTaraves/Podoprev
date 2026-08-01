import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase/config';
import { getProfessional, saveProfessional } from '../firebase/professionals';
import { getPatientAccount, savePatientAccount } from '../firebase/patientAccounts';
import { redeemPatientInvite } from '../firebase/patientInvites';
import { updatePatient } from '../firebase/patients';
import { demoPatientAccount, demoProfessional } from '../demo/seed';
import type { PatientAccount, Professional } from '../types';

// Usuários fictícios do modo demonstração — só os campos realmente lidos pelo app
// (uid) precisam existir; o restante da interface do Firebase `User` nunca é
// usado fora do próprio AuthContext.
const DEMO_USER = { uid: demoProfessional.uid } as User;
const DEMO_PATIENT_USER = { uid: demoPatientAccount.uid } as User;

export type Role = 'professional' | 'patient';

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  professional: Professional | null;
  patientAccount: PatientAccount | null;
  loading: boolean;
  loginDemo: () => void;
  loginDemoPatient: () => void;
  login: (email: string, password: string) => Promise<void>;
  registerProfessional: (name: string, email: string, password: string, registrationNumber?: string) => Promise<void>;
  registerPatient: (name: string, email: string, password: string, inviteCode: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshPatientAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [patientAccount, setPatientAccount] = useState<PatientAccount | null>(null);
  const [loading, setLoading] = useState(true);

  // Durante registerProfessional/registerPatient, o próprio fluxo já define
  // role/professional/patientAccount depois de gravar o perfil no Firestore. Sem essa
  // trava, o onAuthStateChanged (disparado assim que a conta é criada) tenta reler o
  // perfil em paralelo e às vezes vence a corrida contra a escrita — encontra o
  // documento ainda inexistente e zera o papel do usuário recém-cadastrado.
  const registeringRef = useRef(false);

  useEffect(() => {
    // Sem projeto Firebase real, o listener nunca teria um usuário para reportar —
    // evita depender da rede/IndexedDB nesse caso e destrava a tela de login direto.
    // "?demo=professional|patient" pula direto para o modo demonstração — útil para
    // capturas de tela e demonstrações rápidas, só ativo sem Firebase configurado.
    if (!isFirebaseConfigured) {
      const demoRole = new URLSearchParams(window.location.search).get('demo');
      if (demoRole === 'patient') loginDemoPatient();
      else if (demoRole === 'professional') loginDemo();
      else setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (registeringRef.current) {
        setLoading(false);
        return;
      }
      if (firebaseUser) {
        const profile = await getProfessional(firebaseUser.uid);
        if (profile) {
          setProfessional(profile);
          setPatientAccount(null);
          setRole('professional');
        } else {
          const account = await getPatientAccount(firebaseUser.uid);
          setPatientAccount(account);
          setProfessional(null);
          setRole(account ? 'patient' : null);
        }
      } else {
        setProfessional(null);
        setPatientAccount(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Sem projeto Firebase real, autentica localmente com dados fictícios só para
  // permitir navegar pela interface — nunca toca a rede.
  function loginDemo() {
    setUser(DEMO_USER);
    setProfessional(demoProfessional);
    setPatientAccount(null);
    setRole('professional');
    setLoading(false);
  }

  function loginDemoPatient() {
    setUser(DEMO_PATIENT_USER);
    setProfessional(null);
    setPatientAccount(demoPatientAccount);
    setRole('patient');
    setLoading(false);
  }

  async function login(email: string, password: string) {
    // `loading` já pode estar em `false` desde a carga inicial da página (sem sessão
    // persistida). Reativar aqui evita que a navegação para "/" logo após o login
    // encontre um `role` ainda não resolvido pelo onAuthStateChanged (assíncrono,
    // não aguardado por esta função) e seja mandada de volta para o login.
    setLoading(true);
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function registerProfessional(name: string, email: string, password: string, registrationNumber?: string) {
    registeringRef.current = true;
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      const profile: Professional = {
        uid: credential.user.uid,
        name,
        email,
        createdAt: Date.now(),
        ...(registrationNumber ? { registrationNumber } : {}),
      };
      await saveProfessional(profile);
      setUser(credential.user);
      setProfessional(profile);
      setPatientAccount(null);
      setRole('professional');
    } finally {
      registeringRef.current = false;
    }
  }

  async function registerPatient(name: string, email: string, password: string, inviteCode: string) {
    registeringRef.current = true;
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      try {
        const invite = await redeemPatientInvite(inviteCode, credential.user.uid);
        await updateProfile(credential.user, { displayName: name });
        const account: PatientAccount = {
          uid: credential.user.uid,
          patientId: invite.patientId,
          professionalId: invite.professionalId,
          name,
          email,
          createdAt: Date.now(),
        };
        await savePatientAccount(account);
        await updatePatient(invite.patientId, { linkedUserId: credential.user.uid });
        setUser(credential.user);
        setProfessional(null);
        setPatientAccount(account);
        setRole('patient');
      } catch (err) {
        // Se o convite for inválido, desfaz a criação da conta para não deixar um usuário órfão.
        await credential.user.delete().catch(() => undefined);
        throw err;
      }
    } finally {
      registeringRef.current = false;
    }
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  // Recarrega patientAccounts/{uid} do próprio state do AuthContext — necessário
  // depois de uma troca de profissional (Onda 4), que atualiza professionalId
  // diretamente no Firestore/demo store sem passar pelo fluxo normal de login,
  // então o objeto patientAccount já carregado em memória ficaria desatualizado.
  async function refreshPatientAccount() {
    if (!user) return;
    const account = await getPatientAccount(user.uid);
    setPatientAccount(account);
  }

  async function logout() {
    if (!isFirebaseConfigured) {
      setUser(null);
      setProfessional(null);
      setPatientAccount(null);
      setRole(null);
      return;
    }
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        professional,
        patientAccount,
        loading,
        loginDemo,
        loginDemoPatient,
        login,
        registerProfessional,
        registerPatient,
        resetPassword,
        logout,
        refreshPatientAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
