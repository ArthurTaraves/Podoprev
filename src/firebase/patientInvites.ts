import { collection, doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { demoCreatePatientInvite, demoGetPatientInvite, demoRedeemPatientInvite } from '../demo/store';
import type { PatientInvite } from '../types';

const invitesRef = collection(db, 'patientInvites');

function generateCode(): string {
  // Código curto, fácil de digitar/ditar por telefone: 6 caracteres alfanuméricos.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0/I/1 para evitar confusão
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createPatientInvite(patientId: string, professionalId: string): Promise<string> {
  if (!isFirebaseConfigured) return demoCreatePatientInvite(patientId, professionalId);
  const code = generateCode();
  const invite: PatientInvite = { code, patientId, professionalId, createdAt: Date.now(), used: false };
  await setDoc(doc(invitesRef, code), invite);
  return code;
}

export async function getPatientInvite(code: string): Promise<PatientInvite | null> {
  if (!isFirebaseConfigured) return demoGetPatientInvite(code);
  const snap = await getDoc(doc(invitesRef, code.toUpperCase()));
  if (!snap.exists()) return null;
  return snap.data() as PatientInvite;
}

export async function redeemPatientInvite(code: string, uid: string): Promise<PatientInvite> {
  if (!isFirebaseConfigured) return demoRedeemPatientInvite(code, uid);
  const inviteRef = doc(invitesRef, code.toUpperCase());
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(inviteRef);
    if (!snap.exists()) throw new Error('Código de convite inválido.');
    const invite = snap.data() as PatientInvite;
    if (invite.used) throw new Error('Este código de convite já foi utilizado.');
    tx.update(inviteRef, { used: true, usedByUid: uid });
    return { ...invite, used: true, usedByUid: uid };
  });
}
