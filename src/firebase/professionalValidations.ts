import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { demoGetProfessionalValidation, demoSaveProfessionalValidation } from '../demo/store';
import type { ProfessionalValidation } from '../types';

export type NewProfessionalValidation = Omit<ProfessionalValidation, 'professionalId' | 'status' | 'submittedAt' | 'updatedAt'>;

export async function getProfessionalValidation(professionalId: string): Promise<ProfessionalValidation | null> {
  if (!isFirebaseConfigured) return demoGetProfessionalValidation(professionalId);
  const snap = await getDoc(doc(db, 'professionalValidations', professionalId));
  return snap.exists() ? (snap.data() as ProfessionalValidation) : null;
}

// Sempre grava status 'pendente' — não existe fluxo real de aprovação nesta
// etapa (demonstrativa), então reenviar o formulário sempre volta a esse estado.
export async function saveProfessionalValidation(professionalId: string, data: NewProfessionalValidation): Promise<void> {
  if (!isFirebaseConfigured) return demoSaveProfessionalValidation(professionalId, data);
  const existing = await getDoc(doc(db, 'professionalValidations', professionalId));
  const now = Date.now();
  await setDoc(doc(db, 'professionalValidations', professionalId), {
    ...data,
    professionalId,
    status: 'pendente',
    submittedAt: existing.exists() ? (existing.data() as ProfessionalValidation).submittedAt : now,
    updatedAt: now,
  });
}
