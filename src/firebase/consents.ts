import { addDoc, collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { demoCreateConsent, demoListConsentsByPatient } from '../demo/store';
import type { Consent } from '../types';

const consentsRef = collection(db, 'consents');

export type NewConsent = Omit<Consent, 'id'>;

export async function createConsent(data: NewConsent): Promise<string> {
  if (!isFirebaseConfigured) return demoCreateConsent(data);
  const docRef = await addDoc(consentsRef, data);
  return docRef.id;
}

// Filtra por professionalId E patientId — ver o comentário equivalente em
// firebase/visits.ts sobre por que a regra (isOwner OR isLinkedPatient) exige
// os dois filtros ao mesmo tempo para a consulta ser aceita pelo Firestore.
export async function listConsentsByPatient(patientId: string, professionalId: string): Promise<Consent[]> {
  if (!isFirebaseConfigured) return demoListConsentsByPatient(patientId, professionalId);
  const q = query(
    consentsRef,
    where('professionalId', '==', professionalId),
    where('patientId', '==', patientId),
    orderBy('agreedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Consent, 'id'>) }));
}

export async function hasActiveConsent(patientId: string, professionalId: string, type: Consent['type']): Promise<boolean> {
  const consents = await listConsentsByPatient(patientId, professionalId);
  return consents.some((c) => c.type === type && c.agreed);
}
