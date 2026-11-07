import type { Prescription } from '../types';

// Funções puras sobre prescrições de cuidado — sem acesso a dados nem a datas
// "de agora": quem chama passa o dia de referência (ISO yyyy-mm-dd, horário local).

export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Strings ISO yyyy-mm-dd comparam corretamente em ordem lexicográfica.
export function isPrescriptionActive(prescription: Prescription, todayIso: string): boolean {
  if (prescription.startDate && todayIso < prescription.startDate) return false;
  if (prescription.endDate && todayIso > prescription.endDate) return false;
  return true;
}

// Dias até a data de término (0 = hoje é o último dia); null quando não há término.
export function daysRemaining(prescription: Prescription, todayIso: string): number | null {
  if (!prescription.endDate) return null;
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const [ey, em, ed] = prescription.endDate.split('-').map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
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
