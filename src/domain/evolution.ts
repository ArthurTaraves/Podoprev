import type { ExamSigns, RiskLevel } from '../types';
import { EXAM_SIGN_LABELS } from './examSignLabels';

// Compara o atendimento atual com o anterior do mesmo paciente — puramente
// descritivo (não influencia o score nem a classificação). Usado na etapa de
// resultado, no prontuário e no Painel de ação.

const LEVEL_RANK: Record<RiskLevel, number> = { baixo: 0, moderado: 1, alto: 2 };

type Trend = 'primeira' | 'estavel' | 'aumento' | 'melhora';

function compareLevel(current: RiskLevel, previous: RiskLevel | null): Trend {
  if (previous === null) return 'primeira';
  const diff = LEVEL_RANK[current] - LEVEL_RANK[previous];
  if (diff > 0) return 'aumento';
  if (diff < 0) return 'melhora';
  return 'estavel';
}

export interface EvolutionSummary {
  trend: Trend;
  text: string;
  icon: string | null;
  color: string | null;
}

// Etapa de resultado (etapa 5) e prontuário — melhoria 1.
export function describeAttentionEvolution(current: RiskLevel, previous: RiskLevel | null): EvolutionSummary {
  const trend = compareLevel(current, previous);
  if (trend === 'primeira') {
    return { trend, text: 'Primeira avaliação registrada para este paciente', icon: null, color: null };
  }
  if (trend === 'aumento') {
    return { trend, text: 'Nível de atenção aumentou desde o último atendimento', icon: '↑', color: 'var(--color-risk-moderate)' };
  }
  if (trend === 'melhora') {
    return { trend, text: 'Melhora observada em relação ao último atendimento', icon: '↓', color: 'var(--color-risk-low)' };
  }
  return { trend, text: 'Nível de atenção estável em relação ao último atendimento', icon: '—', color: 'var(--color-text-muted)' };
}

// Linha compacta do Painel de ação — melhoria 5 (mesma comparação, texto próprio).
export function describePanelEvolution(current: RiskLevel, previous: RiskLevel | null): string | null {
  const trend = compareLevel(current, previous);
  if (trend === 'primeira') return null; // só 1 atendimento: não exibe linha extra
  if (trend === 'aumento') return '↑ Atenção aumentou desde a última consulta';
  if (trend === 'melhora') return '↓ Melhora observada desde a última consulta';
  return '→ Sem mudança desde a última consulta';
}

export function describeScoreDiff(current: number, previous: number | null): string | null {
  if (previous === null) return null;
  const diff = current - previous;
  const variacao = diff > 0 ? `+${diff} pts` : diff < 0 ? `−${Math.abs(diff)} pts` : '0 pts';
  return `Score anterior: ${previous} pts → Score atual: ${current} pts (variação: ${variacao})`;
}

export function signLabelsFromExamSigns(examSigns: ExamSigns): string[] {
  return EXAM_SIGN_LABELS.filter(({ key }) => examSigns[key]).map(({ label }) => label);
}

export interface SignalListChange {
  novos: string[];
  resolvidos: string[];
}

// Diferença sinal-a-sinal (não apenas contagem) entre o atendimento atual e o
// anterior — melhoria 2. Usa os mesmos nomes marcados pelo profissional na etapa 2.
export function describeSignalListChange(currentSigns: ExamSigns, previousSigns: ExamSigns | null): SignalListChange | null {
  if (previousSigns === null) return null;
  const current = signLabelsFromExamSigns(currentSigns);
  const previous = signLabelsFromExamSigns(previousSigns);
  return {
    novos: current.filter((s) => !previous.includes(s)),
    resolvidos: previous.filter((s) => !current.includes(s)),
  };
}
