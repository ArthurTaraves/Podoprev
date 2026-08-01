import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { demoGetPatientProfessionalLink, demoRevokeHistoryAccess } from '../demo/store';
import type { PatientProfessionalLink } from '../types';

// Id determinístico {patientId}_{professionalId} — sempre um get() de documento
// único, nunca uma query de lista (ver comentário em firestore.rules sobre por que
// isso evita por completo o problema de provabilidade de regra).
function linkId(patientId: string, professionalId: string): string {
  return `${patientId}_${professionalId}`;
}

export async function getPatientProfessionalLink(patientId: string, professionalId: string): Promise<PatientProfessionalLink | null> {
  if (!isFirebaseConfigured) return demoGetPatientProfessionalLink(patientId, professionalId);
  const snap = await getDoc(doc(db, 'patient_professional_links', linkId(patientId, professionalId)));
  return snap.exists() ? (snap.data() as PatientProfessionalLink) : null;
}

// Revogação de consentimento (Onda 4, item 5) — só altera historyAccessConsented e
// revokedAt; consentedAt/consentTerm originais nunca são tocados, preservando a
// prova de que o consentimento existiu e por quanto tempo (ver firestore.rules,
// que só permite exatamente essa transição true -> false nesses dois campos).
export async function revokeHistoryAccess(patientId: string, professionalId: string): Promise<void> {
  if (!isFirebaseConfigured) return demoRevokeHistoryAccess(patientId, professionalId);
  await updateDoc(doc(db, 'patient_professional_links', linkId(patientId, professionalId)), {
    historyAccessConsented: false,
    revokedAt: Date.now(),
  });
}
