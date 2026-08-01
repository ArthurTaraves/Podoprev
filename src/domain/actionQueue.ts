import type { Patient, RiskLevel, Visit } from '../types';

// Lógica FIXA de priorização de pacientes — o núcleo do "Painel de Ação".
// Não é configurável pelo profissional: dado um paciente e seu atendimento mais
// recente, a prioridade é sempre calculada da mesma forma. É isso que transforma
// o painel em uma lista de tarefas, e não em um cadastro passivo.

export type ActionPriority = 'sem_atendimento' | 'atrasado' | 'hoje' | 'alto' | 'em_dia';

export interface PatientActionStatus {
  patient: Patient;
  latestVisit: Visit | null;
  attentionLevel: RiskLevel | null;
  nextReturnDate: string | null;
  daysUntilReturn: number | null; // negativo = retorno já passou (atrasado)
  priority: ActionPriority;
}

// Ordem de urgência: quem precisa de ação primeiro aparece primeiro.
const PRIORITY_ORDER: Record<ActionPriority, number> = {
  atrasado: 0,
  hoje: 1,
  sem_atendimento: 2,
  alto: 3,
  em_dia: 4,
};

export const PRIORITY_LABELS: Record<ActionPriority, string> = {
  atrasado: 'Retorno atrasado',
  hoje: 'Retorno é hoje',
  sem_atendimento: 'Nunca avaliado',
  alto: 'Alto nível de atenção',
  em_dia: 'Em dia',
};

function daysBetween(returnDateIso: string, today: Date): number {
  const [y, m, d] = returnDateIso.split('-').map(Number);
  const returnDate = new Date(y, (m ?? 1) - 1, d ?? 1);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((returnDate.getTime() - todayMidnight.getTime()) / 86_400_000);
}

export function computeActionStatus(patient: Patient, latestVisit: Visit | null, today: Date = new Date()): PatientActionStatus {
  if (!latestVisit) {
    return { patient, latestVisit: null, attentionLevel: null, nextReturnDate: null, daysUntilReturn: null, priority: 'sem_atendimento' };
  }

  const daysUntilReturn = daysBetween(latestVisit.returnDate, today);
  let priority: ActionPriority;
  if (daysUntilReturn < 0) priority = 'atrasado';
  else if (daysUntilReturn === 0) priority = 'hoje';
  else if (latestVisit.risk.level === 'alto') priority = 'alto';
  else priority = 'em_dia';

  return {
    patient,
    latestVisit,
    attentionLevel: latestVisit.risk.level,
    nextReturnDate: latestVisit.returnDate,
    daysUntilReturn,
    priority,
  };
}

export function sortByPriority(list: PatientActionStatus[]): PatientActionStatus[] {
  return [...list].sort((a, b) => {
    const order = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (order !== 0) return order;
    return (a.daysUntilReturn ?? 0) - (b.daysUntilReturn ?? 0);
  });
}

// "Precisa de atenção hoje": o recorte que abre o Painel de Ação.
export function needsAttentionToday(status: PatientActionStatus): boolean {
  return status.priority === 'atrasado' || status.priority === 'hoje' || status.priority === 'sem_atendimento';
}
