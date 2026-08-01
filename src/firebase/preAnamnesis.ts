import { addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import {
  demoCreatePreAnamnesis,
  demoGetPreAnamnesisForPatient,
  demoListPendingPreAnamnesisByProfessional,
  demoUpdatePreAnamnesisAnswers,
  demoValidatePreAnamnesis,
} from '../demo/store';
import type { Anamnesis, PreAnamnesis } from '../types';

const preAnamnesisRef = collection(db, 'preAnamnesis');

export type NewPreAnamnesis = {
  patientId: string;
  professionalId: string;
  anamnesis: Anamnesis;
  preenchidoPor: string;
};

export async function createPreAnamnesis(data: NewPreAnamnesis): Promise<string> {
  if (!isFirebaseConfigured) return demoCreatePreAnamnesis(data);
  const docRef = await addDoc(preAnamnesisRef, {
    ...data,
    status: 'aguardando_validacao',
    createdAt: Date.now(),
  });
  return docRef.id;
}

// Busca a pré-anamnese de um paciente específico, independente do status —
// usada tanto pelo prontuário (que só se importa com a pendente) quanto pela
// própria tela do paciente (que precisa saber também quando já foi validada).
// Filtro duplo (professionalId + patientId), mesmo motivo documentado em
// src/firebase/visits.ts.
export async function getPreAnamnesisForPatient(patientId: string, professionalId: string): Promise<PreAnamnesis | null> {
  if (!isFirebaseConfigured) return demoGetPreAnamnesisForPatient(patientId, professionalId);
  const q = query(preAnamnesisRef, where('professionalId', '==', professionalId), where('patientId', '==', patientId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...(snap.docs[0].data() as Omit<PreAnamnesis, 'id'>) };
}

// Todas as pré-anamneses pendentes de um profissional (não filtra por
// paciente) — alimenta o indicador "Anamnese pendente" na lista de pacientes.
export async function listPendingPreAnamnesisByProfessional(professionalId: string): Promise<PreAnamnesis[]> {
  if (!isFirebaseConfigured) return demoListPendingPreAnamnesisByProfessional(professionalId);
  const q = query(preAnamnesisRef, where('professionalId', '==', professionalId), where('status', '==', 'aguardando_validacao'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PreAnamnesis, 'id'>) }));
}

// O próprio paciente corrigindo as respostas — só permitido pela regra do
// Firestore enquanto o status ainda for "aguardando_validacao".
export async function updatePreAnamnesisAnswers(id: string, anamnesis: Anamnesis): Promise<void> {
  if (!isFirebaseConfigured) return demoUpdatePreAnamnesisAnswers(id, anamnesis);
  await updateDoc(doc(db, 'preAnamnesis', id), { anamnesis });
}

// O profissional pode corrigir/complementar os campos antes de validar — por
// isso recebe a anamnese (possivelmente editada) junto com a validação.
export async function validatePreAnamnesis(id: string, anamnesis: Anamnesis, validadoPor: string): Promise<void> {
  if (!isFirebaseConfigured) return demoValidatePreAnamnesis(id, anamnesis, validadoPor);
  await updateDoc(doc(db, 'preAnamnesis', id), {
    anamnesis,
    status: 'validada',
    reviewedAt: Date.now(),
    validadoPor,
  });
}
