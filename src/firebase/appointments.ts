import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import {
  demoCancelAppointment,
  demoConfirmAppointment,
  demoListAppointmentsByPatient,
  demoListConfirmedAppointmentsByProfessional,
  demoListOccupiedSlots,
  demoReserveSlot,
} from '../demo/store';
import { addMinutesToTime } from '../domain/availability';
import type { Appointment, AppointmentSlot } from '../types';

const HOLD_MINUTES = 10;

const appointmentsRef = collection(db, 'appointments');
const appointmentSlotsRef = collection(db, 'appointmentSlots');

// Id determinístico: evita reserva duplicada por construção (o Firestore trata
// escrita num id já existente como "update", não "create" — nossa regra só
// permite "create" quando o status inicial é reservado_temporario, então uma
// segunda tentativa no mesmo horário cai automaticamente como não permitida).
function buildSlotId(professionalId: string, date: string, startTime: string): string {
  return `${professionalId}_${date}_${startTime}`;
}

// Só lê appointmentSlots — nenhum dado pessoal, seguro para o paciente
// consultar horários de outros pacientes do mesmo profissional.
export async function listOccupiedSlots(professionalId: string, date: string): Promise<AppointmentSlot[]> {
  if (!isFirebaseConfigured) return demoListOccupiedSlots(professionalId, date);
  const q = query(appointmentSlotsRef, where('professionalId', '==', professionalId), where('date', '==', date));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as AppointmentSlot);
}

export interface ReserveSlotParams {
  patientId: string;
  professionalId: string;
  date: string;
  startTime: string;
  slotDurationMinutes: number;
}

// Cria a reserva temporária — grava appointments/{slotId} e appointmentSlots/{slotId}
// no mesmo lote atômico: ou os dois são criados, ou nenhum é (ver firestore.rules).
export async function reserveSlot(params: ReserveSlotParams): Promise<Appointment> {
  const id = buildSlotId(params.professionalId, params.date, params.startTime);
  const endTime = addMinutesToTime(params.startTime, params.slotDurationMinutes);
  const now = Date.now();
  const expiresAt = now + HOLD_MINUTES * 60 * 1000;

  const appointmentData: Omit<Appointment, 'id'> = {
    patientId: params.patientId,
    professionalId: params.professionalId,
    date: params.date,
    startTime: params.startTime,
    endTime,
    status: 'reservado_temporario',
    createdAt: now,
    expiresAt,
  };
  const slot: AppointmentSlot = {
    professionalId: params.professionalId,
    date: params.date,
    startTime: params.startTime,
    endTime,
    status: 'reservado_temporario',
    expiresAt,
  };
  const appointment: Appointment = { id, ...appointmentData };

  if (!isFirebaseConfigured) return demoReserveSlot(appointment, slot);

  const batch = writeBatch(db);
  batch.set(doc(db, 'appointments', id), appointmentData);
  batch.set(doc(db, 'appointmentSlots', id), slot);
  await batch.commit();
  return appointment;
}

export async function confirmAppointment(id: string): Promise<void> {
  if (!isFirebaseConfigured) return demoConfirmAppointment(id);
  const confirmedAt = Date.now();
  const batch = writeBatch(db);
  batch.update(doc(db, 'appointments', id), { status: 'confirmado', confirmedAt });
  batch.update(doc(db, 'appointmentSlots', id), { status: 'confirmado' });
  await batch.commit();
}

export async function cancelAppointment(id: string): Promise<void> {
  if (!isFirebaseConfigured) return demoCancelAppointment(id);
  const batch = writeBatch(db);
  batch.update(doc(db, 'appointments', id), { status: 'cancelado' });
  batch.update(doc(db, 'appointmentSlots', id), { status: 'cancelado' });
  await batch.commit();
}

// "Meus agendamentos" — filtro duplo (professionalId + patientId), mesmo motivo
// documentado em src/firebase/visits.ts (provabilidade de regra em queries de lista).
export async function listAppointmentsByPatient(patientId: string, professionalId: string): Promise<Appointment[]> {
  if (!isFirebaseConfigured) return demoListAppointmentsByPatient(patientId, professionalId);
  const q = query(appointmentsRef, where('professionalId', '==', professionalId), where('patientId', '==', patientId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Appointment, 'id'>) }));
}

// Agenda do profissional — todos os agendamentos confirmados, de todos os pacientes.
export async function listConfirmedAppointmentsByProfessional(professionalId: string): Promise<Appointment[]> {
  if (!isFirebaseConfigured) return demoListConfirmedAppointmentsByProfessional(professionalId);
  const q = query(appointmentsRef, where('professionalId', '==', professionalId), where('status', '==', 'confirmado'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Appointment, 'id'>) }));
}
