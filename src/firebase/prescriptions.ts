import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import {
  demoCreatePrescription,
  demoDeletePrescription,
  demoIsPrescriptionDoneOn,
  demoListAdherenceDays,
  demoListPrescriptionsByPatient,
  demoMarkPrescriptionDone,
} from '../demo/store';
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

// Remove também as marcações de adesão — o Firestore não apaga subcoleções
// junto com o documento pai, elas ficariam órfãs.
export async function deletePrescription(id: string): Promise<void> {
  if (!isFirebaseConfigured) return demoDeletePrescription(id);
  const adherence = await getDocs(adherenceRef(id));
  const batch = writeBatch(db);
  adherence.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'prescriptions', id));
  await batch.commit();
}

// --- Adesão: prescriptions/{id}/adherence/{yyyy-mm-dd} = { done: true, timestamp } ---
// Um documento por dia em que o paciente marcou "feito". Só criação (sem update/
// delete pelo paciente) — uma vez marcado, o dia não é desmarcado.

function adherenceRef(prescriptionId: string) {
  return collection(db, 'prescriptions', prescriptionId, 'adherence');
}

export async function markPrescriptionDone(prescriptionId: string, dayIso: string): Promise<void> {
  if (!isFirebaseConfigured) return demoMarkPrescriptionDone(prescriptionId, dayIso);
  await setDoc(doc(adherenceRef(prescriptionId), dayIso), { done: true, timestamp: Date.now() });
}

export async function isPrescriptionDoneOn(prescriptionId: string, dayIso: string): Promise<boolean> {
  if (!isFirebaseConfigured) return demoIsPrescriptionDoneOn(prescriptionId, dayIso);
  const snap = await getDoc(doc(adherenceRef(prescriptionId), dayIso));
  return snap.exists();
}

// Dias (yyyy-mm-dd) marcados como feitos — usado pelo profissional no modal.
export async function listAdherenceDays(prescriptionId: string): Promise<string[]> {
  if (!isFirebaseConfigured) return demoListAdherenceDays(prescriptionId);
  const snap = await getDocs(adherenceRef(prescriptionId));
  return snap.docs.map((d) => d.id);
}
