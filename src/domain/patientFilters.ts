import type { PatientActionStatus } from './actionQueue';
import { daysBetween, toIsoDate } from '../lib/dates';

// Filtros rápidos da lista de pacientes do profissional. Puros: recebem o "hoje"
// e o conjunto de pacientes com consulta futura já calculados por quem chama.

export type AttentionFilter = 'todos' | 'alto' | 'moderado' | 'baixo' | 'aguardando';
export type SituationFilter = 'todos' | 'com_consulta' | 'sem_consulta' | 'sem_atendimento_30';

export const ATTENTION_FILTER_OPTIONS: { value: AttentionFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'alto', label: 'Atenção alta' },
  { value: 'moderado', label: 'Atenção média' },
  { value: 'baixo', label: 'Atenção baixa' },
  { value: 'aguardando', label: 'Aguardando avaliação' },
];

export const SITUATION_FILTER_OPTIONS: { value: SituationFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'com_consulta', label: 'Com consulta agendada' },
  { value: 'sem_consulta', label: 'Sem consulta agendada' },
  { value: 'sem_atendimento_30', label: 'Sem atendimento há mais de 30 dias' },
];

const STALE_DAYS = 30;

// Valor de filtro vindo da URL (?nivel=, ?situacao=) — ignora o que não for uma
// opção conhecida, para um link antigo/errado não deixar a lista num estado inválido.
export function parseFilter<T extends string>(raw: string | null, options: { value: T }[], fallback: T): T {
  return options.find((option) => option.value === raw)?.value ?? fallback;
}

export function matchesAttention(status: PatientActionStatus, filter: AttentionFilter): boolean {
  if (filter === 'todos') return true;
  if (filter === 'aguardando') return status.latestVisit === null;
  return status.latestVisit?.risk.level === filter;
}

// "Sem atendimento há mais de 30 dias" considera só quem já foi atendido alguma
// vez — quem nunca foi já tem o filtro próprio ("Aguardando avaliação").
export function matchesSituation(
  status: PatientActionStatus,
  filter: SituationFilter,
  patientIdsWithUpcomingAppointment: Set<string>,
  todayIso: string,
): boolean {
  switch (filter) {
    case 'todos':
      return true;
    case 'com_consulta':
      return patientIdsWithUpcomingAppointment.has(status.patient.id);
    case 'sem_consulta':
      return !patientIdsWithUpcomingAppointment.has(status.patient.id);
    case 'sem_atendimento_30':
      return status.latestVisit !== null && daysBetween(toIsoDate(status.latestVisit.date), todayIso) > STALE_DAYS;
  }
}

export function matchesSearch(status: PatientActionStatus, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return status.patient.fullName.toLowerCase().includes(term) || status.patient.cpf.includes(term);
}
