import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { demoGetProfessional, demoSaveProfessional } from '../demo/store';
import type { Professional } from '../types';

export async function saveProfessional(profile: Professional): Promise<void> {
  if (!isFirebaseConfigured) return demoSaveProfessional(profile);
  await setDoc(doc(db, 'users', profile.uid), profile);
}

export async function getProfessional(uid: string): Promise<Professional | null> {
  if (!isFirebaseConfigured) return demoGetProfessional(uid);
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as Professional;
}
