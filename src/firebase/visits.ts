import { collection, doc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { demoListVisitsByPatient, demoListVisitsByProfessional, demoSaveVisit, demoUpdateVisit } from '../demo/store';
import { stripUndefined } from '../lib/firestoreSanitize';
import type { Visit } from '../types';

const visitsRef = collection(db, 'visits');

export type NewVisit = Omit<Visit, 'id' | 'createdAt'>;

// O id da visita é gerado no cliente (uuid) antes do preenchimento do formulário,
// pois fotos podem ser enviadas para o Storage durante o preenchimento, antes de o
// atendimento ser salvo — ambos precisam referenciar o mesmo visitId desde o início.
// stripUndefined evita "Unsupported field value: undefined" em campos opcionais da
// anamnese ainda não respondidos (ex.: painIntensity antes de "Dor nos pés?" = sim).
export async function saveVisit(id: string, data: NewVisit): Promise<void> {
  if (!isFirebaseConfigured) return demoSaveVisit(id, data);
  await setDoc(doc(db, 'visits', id), stripUndefined({ ...data, createdAt: Date.now() }));
}

export async function updateVisit(id: string, data: Partial<NewVisit>): Promise<void> {
  if (!isFirebaseConfigured) return demoUpdateVisit(id, data);
  await updateDoc(doc(db, 'visits', id), stripUndefined(data));
}

// firestore.rules autoriza a leitura de `visits` por dois caminhos possíveis
// (isOwner OR isLinkedPatient) — um para o profissional, outro para o paciente.
// O Firestore só aceita executar a consulta se TODO campo referenciado nos dois
// lados da regra estiver restrito por um filtro de igualdade na própria consulta
// (para o profissional bastaria professionalId; para o paciente, patientId) —
// por isso filtramos pelos dois ao mesmo tempo, o que deixa a consulta válida
// para ambos os chamadores sem precisar de duas funções separadas.
export async function listVisitsByPatient(patientId: string, professionalId: string): Promise<Visit[]> {
  if (!isFirebaseConfigured) return demoListVisitsByPatient(patientId, professionalId);
  const q = query(
    visitsRef,
    where('professionalId', '==', professionalId),
    where('patientId', '==', patientId),
    orderBy('date', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Visit, 'id'>) }));
}

// Todas as visitas do profissional, mais recentes primeiro. Base para o Painel de
// Ação: uma única leitura, agrupada no cliente, em vez de N consultas por paciente.
export async function listVisitsByProfessional(professionalId: string): Promise<Visit[]> {
  if (!isFirebaseConfigured) return demoListVisitsByProfessional(professionalId);
  const q = query(visitsRef, where('professionalId', '==', professionalId), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Visit, 'id'>) }));
}

export async function listRecentVisits(professionalId: string, max = 5): Promise<Visit[]> {
  const all = await listVisitsByProfessional(professionalId);
  return all.slice(0, max);
}

// A visita mais recente de cada paciente, a partir da lista já ordenada por data desc.
export function latestVisitByPatient(visits: Visit[]): Map<string, Visit> {
  const map = new Map<string, Visit>();
  for (const v of visits) {
    if (!map.has(v.patientId)) map.set(v.patientId, v);
  }
  return map;
}

// A segunda visita mais recente de cada paciente (o "atendimento anterior" ao
// mais recente) — base para comparar evolução no Painel de ação, sem precisar de
// uma nova consulta ao Firestore (reaproveita a mesma lista já carregada).
export function previousVisitByPatient(visits: Visit[]): Map<string, Visit> {
  const seenOnce = new Set<string>();
  const map = new Map<string, Visit>();
  for (const v of visits) {
    if (seenOnce.has(v.patientId)) {
      if (!map.has(v.patientId)) map.set(v.patientId, v);
    } else {
      seenOnce.add(v.patientId);
    }
  }
  return map;
}
