import type { Availability, AvailabilityBlock, ScheduleBlock, Weekday } from '../types';
import { WEEKDAYS } from './factories';

// Validação da disponibilidade configurada pelo profissional — puramente
// declarativa, sem efeito colateral. Retorna a primeira mensagem de erro
// encontrada, ou null se estiver tudo certo.
export function validateAvailability(availability: Availability): string | null {
  const activeDays = WEEKDAYS.filter((day) => availability.schedule[day].length > 0);
  if (activeDays.length === 0) {
    return 'Selecione pelo menos um dia de atendimento.';
  }
  for (const day of activeDays) {
    for (const block of availability.schedule[day]) {
      if (!block.start || !block.end) {
        return 'Preencha os horários de início e fim para os dias ativos.';
      }
      if (block.end <= block.start) {
        return 'O horário final deve ser maior que o horário inicial.';
      }
    }
  }
  for (const block of availability.blocks) {
    const blockError = validateScheduleBlock(block);
    if (blockError) return blockError;
  }
  return null;
}

// Validação de um bloqueio excepcional — mesma ideia de validateAvailability,
// mas para um único bloqueio de data específica.
export function validateScheduleBlock(block: ScheduleBlock): string | null {
  if (!block.date) {
    return 'Selecione a data do bloqueio.';
  }
  if (!block.startTime || !block.endTime) {
    return 'Preencha os horários de início e fim do bloqueio.';
  }
  if (block.endTime <= block.startTime) {
    return 'O horário final do bloqueio deve ser maior que o horário inicial.';
  }
  return null;
}

// Gera os horários de início possíveis dentro de um bloco, espaçados pela
// duração da consulta (ex.: bloco 08:00–12:00, 60min → 08:00, 09:00, 10:00, 11:00).
// `occupied` é opcional e, por enquanto, sempre vazio — parâmetro já preparado
// para a próxima onda considerar agendamentos confirmados e reservas temporárias
// sem precisar mudar a assinatura desta função.
export function generateSlotsForBlock(block: AvailabilityBlock, slotDurationMinutes: number, occupied: string[] = []): string[] {
  if (!block.start || !block.end || slotDurationMinutes <= 0) return [];

  const [startH, startM] = block.start.split(':').map(Number);
  const [endH, endM] = block.end.split(':').map(Number);
  const endMinutes = endH * 60 + endM;

  const slots: string[] = [];
  let current = startH * 60 + startM;
  while (current + slotDurationMinutes <= endMinutes) {
    const hh = String(Math.floor(current / 60)).padStart(2, '0');
    const mm = String(current % 60).padStart(2, '0');
    const time = `${hh}:${mm}`;
    if (!occupied.includes(time)) slots.push(time);
    current += slotDurationMinutes;
  }
  return slots;
}

// Todos os horários de um dia (pode ter mais de um bloco, ex.: manhã e tarde).
export function generateDaySlots(blocks: AvailabilityBlock[], slotDurationMinutes: number, occupied: string[] = []): string[] {
  return blocks.flatMap((block) => generateSlotsForBlock(block, slotDurationMinutes, occupied));
}

// --- Helpers de agendamento (Onda 2) ---

const WEEKDAY_BY_JS_DAY: Weekday[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

// "yyyy-mm-dd" → dia da semana no formato usado por Availability.schedule.
// Constrói a data em horário local (não usa Date.parse/toISOString) para não
// sofrer deslocamento de fuso horário.
export function weekdayFromDate(dateIso: string): Weekday {
  const [y, m, d] = dateIso.split('-').map(Number);
  return WEEKDAY_BY_JS_DAY[new Date(y, m - 1, d).getDay()];
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export interface CalendarDay {
  date: string; // ISO yyyy-mm-dd
  day: number; // dia do mês, para exibição
  available: boolean;
}

// Mês atual + próximo mês, marcando quais dias têm algum bloco de disponibilidade
// ativo — alimenta o calendário do passo 1 do agendamento.
export function buildCalendarDays(availability: Availability, from: Date = new Date()): CalendarDay[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(start.getFullYear(), start.getMonth() + 2, 0); // último dia do próximo mês
  const days: CalendarDay[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const iso = toIsoDate(cursor);
    const weekday = weekdayFromDate(iso);
    days.push({ date: iso, day: cursor.getDate(), available: availability.schedule[weekday].length > 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// --- Bloqueios excepcionais de agenda (Onda 3) ---

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Um horário é bloqueado quando seu intervalo [início, início+duração) se
// sobrepõe ao intervalo de algum bloqueio daquele dia — não é comparação de
// horário exato (um bloqueio de 13:00–14:00 bloqueia o slot "13:00" mesmo que
// a consulta dure só 30min e o bloqueio não termine exatamente às 13:30).
function isSlotBlocked(startTime: string, slotDurationMinutes: number, blocksForDay: ScheduleBlock[]): boolean {
  const slotStart = timeToMinutes(startTime);
  const slotEnd = slotStart + slotDurationMinutes;
  return blocksForDay.some((block) => {
    const blockStart = timeToMinutes(block.startTime);
    const blockEnd = timeToMinutes(block.endTime);
    return slotStart < blockEnd && blockStart < slotEnd;
  });
}

// Aplicado depois de generateDaySlots (que continua sendo a fonte principal
// dos horários) — remove os horários que caem em algum bloqueio manual
// daquela data específica. Não altera generateDaySlots/generateSlotsForBlock.
export function removeBlockedSlots(slots: string[], date: string, blocks: ScheduleBlock[], slotDurationMinutes: number): string[] {
  const blocksForDay = blocks.filter((b) => b.date === date);
  if (blocksForDay.length === 0) return slots;
  return slots.filter((time) => !isSlotBlocked(time, slotDurationMinutes, blocksForDay));
}

// --- Busca de profissionais (Onda 4) ---

const WEEKDAY_ABBR: Record<Weekday, string> = {
  segunda: 'Seg',
  terca: 'Ter',
  quarta: 'Qua',
  quinta: 'Qui',
  sexta: 'Sex',
  sabado: 'Sáb',
  domingo: 'Dom',
};

export function hasActiveAvailability(availability: Availability | null): boolean {
  if (!availability) return false;
  return WEEKDAYS.some((day) => availability.schedule[day].length > 0);
}

// "Atende Seg, Qua e Sex" — resumo legível da disponibilidade semanal, para o
// card/perfil detalhado do profissional na busca do paciente.
export function summarizeAvailability(availability: Availability | null): string {
  if (!availability) return 'Disponibilidade não configurada.';
  const activeDays = WEEKDAYS.filter((day) => availability.schedule[day].length > 0).map((day) => WEEKDAY_ABBR[day]);
  if (activeDays.length === 0) return 'Disponibilidade não configurada.';
  if (activeDays.length === 1) return `Atende ${activeDays[0]}`;
  return `Atende ${activeDays.slice(0, -1).join(', ')} e ${activeDays[activeDays.length - 1]}`;
}
