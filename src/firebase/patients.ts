import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import {
  demoCreatePatient,
  demoDeletePatient,
  demoGetPatient,
  demoHardDeletePatient,
  demoListPatients,
  demoUpdatePatient,
} from '../demo/store';
import type { Patient } from '../types';

const patientsRef = collection(db, 'patients');

export type NewPatient = Omit<Patient, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>;

export async function createPatient(data: NewPatient): Promise<string> {
  if (!isFirebaseConfigured) return demoCreatePatient(data);
  const docRef = await addDoc(patientsRef, {
    ...data,
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return docRef.id;
}

export async function updatePatient(id: string, data: Partial<NewPatient>): Promise<void> {
  if (!isFirebaseConfigured) return demoUpdatePatient(id, data);
  await updateDoc(doc(db, 'patients', id), { ...data, updatedAt: Date.now() });
}

export async function deletePatient(id: string): Promise<void> {
  // Soft delete: preserva histórico clínico e consentimentos já registrados.
  if (!isFirebaseConfigured) return demoDeletePatient(id);
  await updateDoc(doc(db, 'patients', id), { isActive: false, updatedAt: Date.now() });
}

export async function hardDeletePatient(id: string): Promise<void> {
  if (!isFirebaseConfigured) return demoHardDeletePatient(id);
  await deleteDoc(doc(db, 'patients', id));
}

export async function getPatient(id: string): Promise<Patient | null> {
  if (!isFirebaseConfigured) return demoGetPatient(id);
  const snap = await getDoc(doc(db, 'patients', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Patient, 'id'>) };
}

export async function listPatients(professionalId: string): Promise<Patient[]> {
  if (!isFirebaseConfigured) return demoListPatients(professionalId);
  const q = query(
    patientsRef,
    where('professionalId', '==', professionalId),
    where('isActive', '==', true),
    orderBy('fullName', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Patient, 'id'>) }));
}
