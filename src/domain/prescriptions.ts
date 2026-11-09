import type { Prescription } from '../types';
import { addDaysIso, daysBetween, toIsoDate } from '../lib/dates';

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

export interface AdherenceSummary {
  done: number; // dias marcados como "feito" na janela
  total: number; // dias da janela em que a prescrição estava valendo
}

// Adesão nos últimos `windowDays` dias (incluindo hoje). O denominador conta só
// os dias em que a prescrição valia (do início — startDate ou criação — até o
// fim/hoje): uma prescrição de 3 dias mostra "2/3", não "2/7", para não parecer
// baixa adesão só por ser recente.
export function adherenceSummary(prescription: Prescription, doneDays: Set<string>, todayIso: string, windowDays: number): AdherenceSummary {
  const windowStart = addDaysIso(todayIso, -(windowDays - 1));
  const activeFrom = prescription.startDate ?? toIsoDate(prescription.createdAt);
  const from = activeFrom > windowStart ? activeFrom : windowStart;
  const to = prescription.endDate && prescription.endDate < todayIso ? prescription.endDate : todayIso;
  if (from > to) return { done: 0, total: 0 };
  let done = 0;
  for (let day = from; day <= to; day = addDaysIso(day, 1)) {
    if (doneDays.has(day)) done++;
  }
  return { done, total: daysBetween(from, to) + 1 };
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
