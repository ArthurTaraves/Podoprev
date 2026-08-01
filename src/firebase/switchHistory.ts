import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { demoListSwitchHistoryByPatient } from '../demo/store';
import type { SwitchHistoryEntry } from '../types';

const switchHistoryRef = collection(db, 'switch_history');

// Filtro único (patientId) — não sofre o problema de provabilidade de regra
// porque a regra de switch_history tem uma única condição, isLinkedPatient(patientId).
// É a base do "fan-out" de histórico do próprio paciente: a partir daqui ele sabe
// com quais professionalIds antigos precisa consultar visits/consents/photos/preAnamnesis.
export async function listSwitchHistoryByPatient(patientId: string): Promise<SwitchHistoryEntry[]> {
  if (!isFirebaseConfigured) return demoListSwitchHistoryByPatient(patientId);
  const q = query(switchHistoryRef, where('patientId', '==', patientId), orderBy('switchedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SwitchHistoryEntry, 'id'>) }));
}

// Todos os professionalIds distintos que o paciente já teve, a partir do próprio
// log de trocas — base do "fan-out" usado por PatientHistory/PatientProfile para
// reconstruir o histórico completo sem depender de uma única query que atravesse
// vários valores de professionalId (o Firestore não permite isso, ver visits.ts).
export async function listAllProfessionalIdsForPatient(patientId: string, currentProfessionalId: string): Promise<string[]> {
  const history = await listSwitchHistoryByPatient(patientId);
  const ids = new Set<string>([currentProfessionalId]);
  for (const entry of history) {
    ids.add(entry.previousProfessionalId);
    ids.add(entry.newProfessionalId);
  }
  return Array.from(ids);
}
