import { v4 as uuid } from 'uuid';
import type {
  Anamnesis,
  AppNotification,
  Appointment,
  AppointmentSlot,
  Availability,
  Consent,
  Patient,
  PatientAccount,
  PatientInvite,
  PatientPhoto,
  PatientProfessionalLink,
  PreAnamnesis,
  Prescription,
  Professional,
  ProfessionalProfile,
  ProfessionalValidation,
  SwitchHistoryEntry,
  Visit,
} from '../types';
import {
  demoAppointments,
  demoAppointmentSlots,
  demoAvailabilities,
  demoConsents,
  demoPatientAccount,
  demoPatientProfessionalLinks,
  demoPatients,
  demoPreAnamneses,
  demoNotifications,
  demoPrescriptionAdherence,
  demoPrescriptions,
  demoProfessional,
  demoProfessionalProfiles,
  demoProfessionals,
  demoSwitchHistoryEntries,
  demoVisits,
  DEMO_PROFESSIONAL_UID,
} from './seed';
import { newPrescriptionMessage } from '../domain/prescriptions';

// Camada de dados 100% em memória (sem Firebase), usada apenas quando
// `isFirebaseConfigured` é falso — ver src/firebase/config.ts. Cada função aqui
// espelha a assinatura da função real correspondente em src/firebase/*.ts, para
// que as páginas nunca precisem saber se estão em modo demonstração ou não.
// Os dados resetam a cada recarregamento de página (não há persistência real).

let patients: Patient[] = demoPatients.map((p) => ({ ...p }));
let visits: Visit[] = demoVisits.map((v) => ({ ...v }));
let consents: Consent[] = demoConsents.map((c) => ({ ...c }));
let photos: PatientPhoto[] = [];
const professionals = new Map<string, Professional>([
  [DEMO_PROFESSIONAL_UID, demoProfessional],
  ...demoProfessionals.map((p) => [p.uid, p] as const),
]);
// Precisa estar pré-populado (não só setado via loginDemoPatient) para que
// demoGetPatientAccount/demoSwitchProfessional consigam ler e atualizar esta
// mesma conta depois de uma troca de profissional (refreshPatientAccount em
// AuthContext.tsx relê daqui, não do valor fixo importado de seed.ts).
const patientAccounts = new Map<string, PatientAccount>([[demoPatientAccount.uid, { ...demoPatientAccount }]]);
const patientInvites = new Map<string, PatientInvite>();
const availabilities = new Map<string, Availability>(demoAvailabilities.map((a) => [a.professionalId, { ...a }]));
let preAnamneses: PreAnamnesis[] = demoPreAnamneses.map((p) => ({ ...p }));
let prescriptions: Prescription[] = demoPrescriptions.map((p) => ({ ...p }));
let notifications: AppNotification[] = demoNotifications.map((n) => ({ ...n }));
const prescriptionAdherence = new Map<string, Set<string>>(Object.entries(demoPrescriptionAdherence).map(([id, days]) => [id, new Set(days)]));
let appointments: Appointment[] = demoAppointments.map((a) => ({ ...a }));
const appointmentSlots = new Map<string, AppointmentSlot>(demoAppointmentSlots.map((s) => [`${s.professionalId}_${s.date}_${s.startTime}`, { ...s }]));
const professionalProfiles = new Map<string, ProfessionalProfile>(
  demoProfessionalProfiles.map((p) => [p.professionalId, p]),
);
const patientProfessionalLinks = new Map<string, PatientProfessionalLink>(
  demoPatientProfessionalLinks.map((l) => [`${l.patientId}_${l.professionalId}`, { ...l }]),
);
let switchHistory: SwitchHistoryEntry[] = demoSwitchHistoryEntries.map((s) => ({ ...s }));
const professionalValidations = new Map<string, ProfessionalValidation>();

// Mesmo filtro duplo (patientId + professionalId) que as consultas reais fazem no
// Firestore — ver gotcha 1 do CLAUDE.md. Filtrar só por patientId aqui escondia,
// no demo, o bloqueio de histórico entre profissionais (bug da Onda 5).
function byPatientAndProfessional<T extends { patientId: string; professionalId: string }>(list: T[], patientId: string, professionalId: string): T[] {
  return list.filter((item) => item.patientId === patientId && item.professionalId === professionalId);
}

// --- patients ---

export async function demoCreatePatient(data: Omit<Patient, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = uuid();
  patients.push({ ...data, id, isActive: true, createdAt: Date.now(), updatedAt: Date.now() });
  return id;
}

export async function demoUpdatePatient(id: string, data: Partial<Patient>): Promise<void> {
  patients = patients.map((p) => (p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p));
}

export async function demoDeletePatient(id: string): Promise<void> {
  patients = patients.map((p) => (p.id === id ? { ...p, isActive: false, updatedAt: Date.now() } : p));
}

export async function demoHardDeletePatient(id: string): Promise<void> {
  patients = patients.filter((p) => p.id !== id);
}

export async function demoGetPatient(id: string): Promise<Patient | null> {
  return patients.find((p) => p.id === id) ?? null;
}

export async function demoListPatients(professionalId: string): Promise<Patient[]> {
  return patients
    .filter((p) => p.professionalId === professionalId && p.isActive)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

// --- visits ---

export async function demoSaveVisit(id: string, data: Omit<Visit, 'id' | 'createdAt'>): Promise<void> {
  visits.unshift({ ...data, id, createdAt: Date.now() });
}

export async function demoUpdateVisit(id: string, data: Partial<Visit>): Promise<void> {
  visits = visits.map((v) => (v.id === id ? { ...v, ...data } : v));
}

// Filtra por professionalId E patientId, espelhando exatamente a consulta real do
// Firestore (ver firebase/visits.ts) — sem isso, o modo demonstração mostraria o
// histórico de um profissional anterior mesmo sem consentimento, o que mascararia
// justamente o comportamento de segurança que a Onda 4 precisa demonstrar.
export async function demoListVisitsByPatient(patientId: string, professionalId: string): Promise<Visit[]> {
  return byPatientAndProfessional(visits, patientId, professionalId).sort((a, b) => b.date - a.date);
}

export async function demoListVisitsByProfessional(professionalId: string): Promise<Visit[]> {
  return visits.filter((v) => v.professionalId === professionalId).sort((a, b) => b.date - a.date);
}

// --- consents ---

export async function demoCreateConsent(data: Omit<Consent, 'id'>): Promise<string> {
  const id = uuid();
  consents.push({ ...data, id });
  return id;
}

export async function demoListConsentsByPatient(patientId: string, professionalId: string): Promise<Consent[]> {
  return byPatientAndProfessional(consents, patientId, professionalId).sort((a, b) => b.agreedAt - a.agreedAt);
}

// --- photos ---

export async function demoUploadPatientPhoto(file: File, meta: Omit<PatientPhoto, 'id' | 'storagePath' | 'url' | 'createdAt'>): Promise<string> {
  const id = uuid();
  photos.push({ ...meta, id, storagePath: '', url: URL.createObjectURL(file), createdAt: Date.now() });
  return id;
}

export async function demoListPhotosByPatient(patientId: string, professionalId: string): Promise<PatientPhoto[]> {
  return byPatientAndProfessional(photos, patientId, professionalId).sort((a, b) => b.createdAt - a.createdAt);
}

export async function demoListPhotosByVisit(visitId: string): Promise<PatientPhoto[]> {
  return photos.filter((p) => p.visitId === visitId).sort((a, b) => b.createdAt - a.createdAt);
}

// --- professionals ---

export async function demoSaveProfessional(profile: Professional): Promise<void> {
  professionals.set(profile.uid, profile);
}

export async function demoGetProfessional(uid: string): Promise<Professional | null> {
  return professionals.get(uid) ?? null;
}

// --- patient accounts ---

export async function demoSavePatientAccount(account: PatientAccount): Promise<void> {
  patientAccounts.set(account.uid, account);
}

export async function demoGetPatientAccount(uid: string): Promise<PatientAccount | null> {
  return patientAccounts.get(uid) ?? null;
}

export async function demoRegisterPatientWithoutInvite(
  name: string,
  email: string,
  cpf: string,
  birthDate: string,
  phone: string,
): Promise<PatientAccount> {
  const uid = uuid();
  const patientId = uuid();
  const now = Date.now();
  patients.push({
    id: patientId,
    professionalId: '',
    fullName: name,
    birthDate,
    cpf,
    phone,
    email,
    isActive: true,
    linkedUserId: uid,
    createdAt: now,
    updatedAt: now,
  });
  const account: PatientAccount = { uid, patientId, professionalId: '', name, email, createdAt: now };
  patientAccounts.set(uid, account);
  return account;
}

// --- patient invites ---

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function demoCreatePatientInvite(patientId: string, professionalId: string): Promise<string> {
  const code = generateInviteCode();
  patientInvites.set(code, { code, patientId, professionalId, createdAt: Date.now(), used: false });
  return code;
}

export async function demoGetPatientInvite(code: string): Promise<PatientInvite | null> {
  return patientInvites.get(code.toUpperCase()) ?? null;
}

export async function demoRedeemPatientInvite(code: string, uid: string): Promise<PatientInvite> {
  const invite = patientInvites.get(code.toUpperCase());
  if (!invite) throw new Error('Código de convite inválido.');
  if (invite.used) throw new Error('Este código de convite já foi utilizado.');
  const updated: PatientInvite = { ...invite, used: true, usedByUid: uid };
  patientInvites.set(code.toUpperCase(), updated);
  return updated;
}

// --- availability ---

export async function demoGetAvailability(professionalId: string): Promise<Availability | null> {
  return availabilities.get(professionalId) ?? null;
}

export async function demoSaveAvailability(professionalId: string, data: Omit<Availability, 'professionalId' | 'updatedAt'>): Promise<void> {
  availabilities.set(professionalId, { ...data, professionalId, updatedAt: Date.now() });
}

// --- pré-anamnese ---

export async function demoCreatePreAnamnesis(data: {
  patientId: string;
  professionalId: string;
  anamnesis: Anamnesis;
  preenchidoPor: string;
}): Promise<string> {
  const id = uuid();
  preAnamneses.push({ ...data, id, status: 'aguardando_validacao', createdAt: Date.now() });
  return id;
}

export async function demoGetPreAnamnesisForPatient(patientId: string, professionalId: string): Promise<PreAnamnesis | null> {
  return byPatientAndProfessional(preAnamneses, patientId, professionalId)[0] ?? null;
}

export async function demoListPendingPreAnamnesisByProfessional(professionalId: string): Promise<PreAnamnesis[]> {
  return preAnamneses.filter((p) => p.professionalId === professionalId && p.status === 'aguardando_validacao');
}

export async function demoUpdatePreAnamnesisAnswers(id: string, anamnesis: Anamnesis): Promise<void> {
  preAnamneses = preAnamneses.map((p) => (p.id === id ? { ...p, anamnesis } : p));
}

export async function demoValidatePreAnamnesis(id: string, anamnesis: Anamnesis, validadoPor: string): Promise<void> {
  preAnamneses = preAnamneses.map((p) => (p.id === id ? { ...p, anamnesis, status: 'validada', reviewedAt: Date.now(), validadoPor } : p));
}

// --- agendamentos ---

export async function demoListOccupiedSlots(professionalId: string, date: string): Promise<AppointmentSlot[]> {
  return Array.from(appointmentSlots.values()).filter((s) => s.professionalId === professionalId && s.date === date);
}

export async function demoReserveSlot(appointment: Appointment, slot: AppointmentSlot): Promise<Appointment> {
  // Mesma semântica do Firestore: escrever num id já existente é tratado como
  // "update", não "create" — então uma segunda tentativa no mesmo horário falha.
  if (appointments.some((a) => a.id === appointment.id)) {
    throw new Error('Esse horário acabou de ser reservado por outro paciente.');
  }
  appointments.push(appointment);
  appointmentSlots.set(appointment.id, slot);
  return appointment;
}

export async function demoConfirmAppointment(id: string): Promise<void> {
  const confirmedAt = Date.now();
  appointments = appointments.map((a) => (a.id === id ? { ...a, status: 'confirmado', confirmedAt } : a));
  const slot = appointmentSlots.get(id);
  if (slot) appointmentSlots.set(id, { ...slot, status: 'confirmado' });
}

export async function demoCancelAppointment(id: string): Promise<void> {
  appointments = appointments.map((a) => (a.id === id ? { ...a, status: 'cancelado' } : a));
  const slot = appointmentSlots.get(id);
  if (slot) appointmentSlots.set(id, { ...slot, status: 'cancelado' });
}

export async function demoListAppointmentsByPatient(patientId: string, professionalId: string): Promise<Appointment[]> {
  return byPatientAndProfessional(appointments, patientId, professionalId);
}

export async function demoListConfirmedAppointmentsByProfessional(professionalId: string): Promise<Appointment[]> {
  return appointments.filter((a) => a.professionalId === professionalId && a.status === 'confirmado');
}

// --- perfil público do profissional ---

export async function demoGetProfessionalProfile(professionalId: string): Promise<ProfessionalProfile | null> {
  return professionalProfiles.get(professionalId) ?? null;
}

export async function demoSaveProfessionalProfile(
  professionalId: string,
  data: Omit<ProfessionalProfile, 'professionalId' | 'updatedAt'>,
): Promise<void> {
  professionalProfiles.set(professionalId, { ...data, professionalId, updatedAt: Date.now() });
}

export async function demoListPublicProfessionalProfiles(): Promise<ProfessionalProfile[]> {
  return Array.from(professionalProfiles.values()).filter((p) => p.isPubliclyVisible);
}

// --- vínculos paciente-profissional / troca de profissional (Onda 4) ---

export async function demoGetPatientProfessionalLink(patientId: string, professionalId: string): Promise<PatientProfessionalLink | null> {
  return patientProfessionalLinks.get(`${patientId}_${professionalId}`) ?? null;
}

export async function demoRevokeHistoryAccess(patientId: string, professionalId: string): Promise<void> {
  const key = `${patientId}_${professionalId}`;
  const link = patientProfessionalLinks.get(key);
  if (!link) return;
  patientProfessionalLinks.set(key, { ...link, historyAccessConsented: false, revokedAt: Date.now() });
}

export async function demoListSwitchHistoryByPatient(patientId: string): Promise<SwitchHistoryEntry[]> {
  return switchHistory.filter((s) => s.patientId === patientId).sort((a, b) => b.switchedAt - a.switchedAt);
}

export interface DemoSwitchProfessionalParams {
  patientId: string;
  patientUid: string;
  currentProfessionalId: string;
  currentProfessionalName: string;
  newProfessionalId: string;
  newProfessionalName: string;
  historyAccessConsented: boolean;
  consentTerm: string;
  patientCreatedAt: number;
}

// Espelha exatamente as 5 escritas de firebase/professionalSwitch.ts (sem a
// checagem de concorrência via transação — em memória, single-thread, não há
// corrida possível entre duas trocas simultâneas).
export async function demoSwitchProfessional(params: DemoSwitchProfessionalParams): Promise<void> {
  const now = Date.now();
  const oldKey = `${params.patientId}_${params.currentProfessionalId}`;
  const newKey = `${params.patientId}_${params.newProfessionalId}`;

  const oldLink = patientProfessionalLinks.get(oldKey);
  if (oldLink) {
    patientProfessionalLinks.set(oldKey, { ...oldLink, status: 'inactive', unlinkedAt: now });
  } else {
    patientProfessionalLinks.set(oldKey, {
      patientId: params.patientId,
      professionalId: params.currentProfessionalId,
      status: 'inactive',
      linkedAt: params.patientCreatedAt,
      unlinkedAt: now,
      historyAccessConsented: false,
    });
  }

  patientProfessionalLinks.set(newKey, {
    patientId: params.patientId,
    professionalId: params.newProfessionalId,
    status: 'active',
    linkedAt: now,
    historyAccessConsented: params.historyAccessConsented,
    consentedAt: now,
    consentTerm: params.consentTerm,
    previousProfessionalId: params.currentProfessionalId,
    previousProfessionalName: params.currentProfessionalName,
  });

  switchHistory = [
    ...switchHistory,
    {
      id: uuid(),
      patientId: params.patientId,
      previousProfessionalId: params.currentProfessionalId,
      previousProfessionalName: params.currentProfessionalName,
      newProfessionalId: params.newProfessionalId,
      newProfessionalName: params.newProfessionalName,
      switchedAt: now,
      historyShared: params.historyAccessConsented,
    },
  ];

  patients = patients.map((p) => (p.id === params.patientId ? { ...p, professionalId: params.newProfessionalId, updatedAt: now } : p));
  const account = patientAccounts.get(params.patientUid);
  if (account) patientAccounts.set(params.patientUid, { ...account, professionalId: params.newProfessionalId });
}

// --- validação profissional (etapa complementar de cadastro, demonstrativa) ---

export async function demoGetProfessionalValidation(professionalId: string): Promise<ProfessionalValidation | null> {
  return professionalValidations.get(professionalId) ?? null;
}

export async function demoSaveProfessionalValidation(
  professionalId: string,
  data: Omit<ProfessionalValidation, 'professionalId' | 'status' | 'submittedAt' | 'updatedAt'>,
): Promise<void> {
  const existing = professionalValidations.get(professionalId);
  const now = Date.now();
  professionalValidations.set(professionalId, {
    ...data,
    professionalId,
    status: 'pendente',
    submittedAt: existing?.submittedAt ?? now,
    updatedAt: now,
  });
}

// --- prescriptions ---

export async function demoCreatePrescription(data: Omit<Prescription, 'id' | 'createdAt'>): Promise<string> {
  const id = `demo-prescription-${uuid()}`;
  const now = Date.now();
  prescriptions.push({ ...data, id, createdAt: now });
  // Mesmo comportamento do Firestore: a notificação nasce junto com a prescrição.
  notifications.push({
    id: `demo-notification-${uuid()}`,
    patientId: data.patientId,
    professionalId: data.professionalId,
    type: 'new_prescription',
    message: newPrescriptionMessage(data.description),
    prescriptionId: id,
    read: false,
    createdAt: now,
  });
  return id;
}

// --- notifications ---

export async function demoListUnreadNotifications(patientId: string): Promise<AppNotification[]> {
  return notifications.filter((n) => n.patientId === patientId && !n.read).sort((a, b) => b.createdAt - a.createdAt);
}

export async function demoMarkNotificationsRead(ids: string[]): Promise<void> {
  const set = new Set(ids);
  notifications = notifications.map((n) => (set.has(n.id) ? { ...n, read: true } : n));
}

export async function demoListPrescriptionsByPatient(patientId: string, professionalId: string): Promise<Prescription[]> {
  return byPatientAndProfessional(prescriptions, patientId, professionalId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function demoDeletePrescription(id: string): Promise<void> {
  prescriptions = prescriptions.filter((p) => p.id !== id);
  prescriptionAdherence.delete(id);
}

// --- adesão às prescrições (espelho de prescriptions/{id}/adherence/{dia}) ---

export async function demoMarkPrescriptionDone(prescriptionId: string, dayIso: string): Promise<void> {
  const days = prescriptionAdherence.get(prescriptionId) ?? new Set<string>();
  days.add(dayIso);
  prescriptionAdherence.set(prescriptionId, days);
}

export async function demoIsPrescriptionDoneOn(prescriptionId: string, dayIso: string): Promise<boolean> {
  return prescriptionAdherence.get(prescriptionId)?.has(dayIso) ?? false;
}

export async function demoListAdherenceDays(prescriptionId: string): Promise<string[]> {
  return [...(prescriptionAdherence.get(prescriptionId) ?? [])];
}
