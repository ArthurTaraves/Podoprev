import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import {
  demoGetProfessionalProfile,
  demoListPublicProfessionalProfiles,
  demoSaveProfessionalProfile,
} from '../demo/store';
import type { ProfessionalProfile } from '../types';

const professionalProfilesRef = collection(db, 'professionalProfiles');

export type NewProfessionalProfile = Omit<ProfessionalProfile, 'professionalId' | 'updatedAt'>;

export async function getProfessionalProfile(professionalId: string): Promise<ProfessionalProfile | null> {
  if (!isFirebaseConfigured) return demoGetProfessionalProfile(professionalId);
  const snap = await getDoc(doc(db, 'professionalProfiles', professionalId));
  if (!snap.exists()) return null;
  return snap.data() as ProfessionalProfile;
}

export async function saveProfessionalProfile(professionalId: string, data: NewProfessionalProfile): Promise<void> {
  if (!isFirebaseConfigured) return demoSaveProfessionalProfile(professionalId, data);
  await setDoc(doc(db, 'professionalProfiles', professionalId), {
    ...data,
    professionalId,
    updatedAt: Date.now(),
  });
}

// Busca com um único filtro (isPubliclyVisible == true) — texto, especialidade
// e ordenação são feitos no cliente, como combinado, pra manter simples e não
// precisar de índice composto novo nem de múltiplas consultas por filtro.
export async function listPublicProfessionalProfiles(): Promise<ProfessionalProfile[]> {
  if (!isFirebaseConfigured) return demoListPublicProfessionalProfiles();
  const q = query(professionalProfilesRef, where('isPubliclyVisible', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as ProfessionalProfile);
}
