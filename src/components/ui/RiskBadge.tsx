import type { RiskLevel } from '../../types';

const LABELS: Record<RiskLevel, string> = {
  baixo: 'Atenção baixa',
  moderado: 'Atenção média',
  alto: 'Atenção alta',
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`badge badge-${level === 'baixo' ? 'low' : level === 'moderado' ? 'moderate' : 'high'}`}>{LABELS[level]}</span>;
}
