import type { ExamSigns } from '../types';

// Fonte única dos rótulos dos sinais observados (etapa 2) — usada tanto pelo
// formulário (StepSignals) quanto pela comparação de evolução entre atendimentos
// (domain/evolution.ts), para que os nomes exibidos sejam sempre os mesmos que
// o profissional marcou.
export const EXAM_SIGN_LABELS: {
  key: keyof Pick<ExamSigns, 'ferida' | 'vermelhidao' | 'rachadura' | 'calo' | 'micose' | 'unhaEncravada' | 'secrecao' | 'dorAoExame'>;
  label: string;
}[] = [
  { key: 'dorAoExame', label: 'Dor' },
  { key: 'vermelhidao', label: 'Vermelhidão' },
  { key: 'ferida', label: 'Ferida' },
  { key: 'rachadura', label: 'Rachadura' },
  { key: 'calo', label: 'Calo' },
  { key: 'micose', label: 'Micose' },
  { key: 'unhaEncravada', label: 'Unha encravada' },
  { key: 'secrecao', label: 'Secreção' },
];
