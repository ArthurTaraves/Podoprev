import type { Prescription } from '../types';
import { daysBetween } from '../lib/dates';

// Funções puras sobre prescrições de cuidado — sem acesso a dados nem a datas
// "de agora": quem chama passa o dia de referência (ISO yyyy-mm-dd, horário local,
// ver todayIso() em src/lib/dates.ts).

// Strings ISO yyyy-mm-dd comparam corretamente em ordem lexicográfica.
export function isPrescriptionActive(prescription: Prescription, todayIso: string): boolean {
  if (prescription.startDate && todayIso < prescription.startDate) return false;
  if (prescription.endDate && todayIso > prescription.endDate) return false;
  return true;
}

// Dias até a data de término (0 = hoje é o último dia); null quando não há término.
export function daysRemaining(prescription: Prescription, todayIso: string): number | null {
  if (!prescription.endDate) return null;
  return daysBetween(todayIso, prescription.endDate);
}

// Horários sugeridos ao escolher a frequência — o profissional pode editar cada um.
export function defaultPrescriptionTimes(timesPerDay: number): string[] {
  if (timesPerDay === 1) return ['08:00'];
  if (timesPerDay === 2) return ['08:00', '20:00'];
  if (timesPerDay === 3) return ['08:00', '14:00', '20:00'];
  const startMinutes = 8 * 60;
  const span = 13 * 60; // 08:00 → 21:00
  return Array.from({ length: timesPerDay }, (_, i) => {
    const total = Math.round(startMinutes + (span * i) / (timesPerDay - 1));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  });
}

export function sortTimes(times: string[]): string[] {
  return [...times].sort();
}
