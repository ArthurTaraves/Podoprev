import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { demoGetPatientAccount, demoSavePatientAccount } from '../demo/store';
import type { PatientAccount } from '../types';

export async function savePatientAccount(account: PatientAccount): Promise<void> {
  if (!isFirebaseConfigured) return demoSavePatientAccount(account);
  await setDoc(doc(db, 'patientAccounts', account.uid), account);
}

export async function getPatientAccount(uid: string): Promise<PatientAccount | null> {
  if (!isFirebaseConfigured) return demoGetPatientAccount(uid);
  const snap = await getDoc(doc(db, 'patientAccounts', uid));
  if (!snap.exists()) return null;
  return snap.data() as PatientAccount;
}
