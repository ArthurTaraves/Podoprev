import type { CareInstruction, PatientAccount, Prescription } from '../types';

// Cache local mínimo do modo offline do paciente — de propósito, NÃO é um cache
// completo do app: só os cuidados ativos (prescrições ativas + orientações do
// último atendimento, o uso mais crítico sem internet) e a própria conta do
// paciente (sem ela o app nem sabe quem está logado ao abrir offline, porque
// patientAccounts/{uid} vem do Firestore). Fica só no aparelho do paciente e é
// apagado no logout.
//
// localStorage pode lançar (modo privado, armazenamento bloqueado/cheio) —
// toda leitura/escrita é protegida e o app continua funcionando sem cache.

export interface CachedPrescriptions {
  savedAt: number;
  prescriptions: Prescription[];
  instructions: CareInstruction[];
  visitDate: number | null;
}

const prescriptionsKey = (patientId: string) => `cache_prescriptions_${patientId}`;
const accountKey = (uid: string) => `cache_patient_account_${uid}`;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sem espaço / bloqueado — segue sem cache
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignora
  }
}

export function saveCachedPrescriptions(patientId: string, data: Omit<CachedPrescriptions, 'savedAt'>): void {
  writeJson(prescriptionsKey(patientId), { ...data, savedAt: Date.now() } satisfies CachedPrescriptions);
}

export function loadCachedPrescriptions(patientId: string): CachedPrescriptions | null {
  const cached = readJson<CachedPrescriptions>(prescriptionsKey(patientId));
  if (!cached || typeof cached.savedAt !== 'number' || !Array.isArray(cached.prescriptions) || !Array.isArray(cached.instructions)) return null;
  return cached;
}

export function saveCachedPatientAccount(account: PatientAccount): void {
  writeJson(accountKey(account.uid), account);
}

export function loadCachedPatientAccount(uid: string): PatientAccount | null {
  const cached = readJson<PatientAccount>(accountKey(uid));
  // professionalId pode ser '' (conta criada sem convite, ainda sem podólogo).
  if (!cached || cached.uid !== uid || !cached.patientId || typeof cached.professionalId !== 'string') return null;
  return cached;
}

/** Logout: remove tudo que o modo offline guardou deste paciente no aparelho. */
export function clearPatientOfflineCache(uid: string, patientId?: string): void {
  remove(accountKey(uid));
  if (patientId) remove(prescriptionsKey(patientId));
}
