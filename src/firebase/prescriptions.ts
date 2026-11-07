import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { demoCreatePrescription, demoDeletePrescription, demoListPrescriptionsByPatient } from '../demo/store';
import { stripUndefined } from '../lib/firestoreSanitize';
import type { Prescription } from '../types';

const prescriptionsRef = collection(db, 'prescriptions');

export type NewPrescription = Omit<Prescription, 'id' | 'createdAt'>;

export async function createPrescription(data: NewPrescription): Promise<string> {
  if (!isFirebaseConfigured) return demoCreatePrescription(data);
  const docRef = await addDoc(prescriptionsRef, stripUndefined({ ...data, createdAt: Date.now() }));
  return docRef.id;
}

// Filtro duplo (professionalId + patientId), mesmo motivo documentado em
// src/firebase/visits.ts — a regra referencia os dois campos.
export async function listPrescriptionsByPatient(patientId: string, professionalId: string): Promise<Prescription[]> {
  if (!isFirebaseConfigured) return demoListPrescriptionsByPatient(patientId, professionalId);
  const q = query(prescriptionsRef, where('professionalId', '==', professionalId), where('patientId', '==', patientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Prescription, 'id'>) }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deletePrescription(id: string): Promise<void> {
  if (!isFirebaseConfigured) return demoDeletePrescription(id);
  await deleteDoc(doc(db, 'prescriptions', id));
}
