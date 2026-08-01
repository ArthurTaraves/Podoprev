import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { demoGetAvailability, demoSaveAvailability } from '../demo/store';
import type { Availability } from '../types';

export type NewAvailability = Omit<Availability, 'professionalId' | 'updatedAt'>;

export async function getAvailability(professionalId: string): Promise<Availability | null> {
  if (!isFirebaseConfigured) return demoGetAvailability(professionalId);
  const snap = await getDoc(doc(db, 'availability', professionalId));
  if (!snap.exists()) return null;
  const data = snap.data() as Availability;
  // Documentos salvos antes da Onda 3 não têm o campo `blocks` ainda.
  return { ...data, blocks: data.blocks ?? [] };
}

export async function saveAvailability(professionalId: string, data: NewAvailability): Promise<void> {
  if (!isFirebaseConfigured) return demoSaveAvailability(professionalId, data);
  await setDoc(doc(db, 'availability', professionalId), {
    ...data,
    professionalId,
    updatedAt: Date.now(),
  });
}
