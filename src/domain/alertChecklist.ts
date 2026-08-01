import type { AlertChecklist } from '../types';

export const ALERT_CHECKLIST_LABELS: { key: keyof AlertChecklist; label: string }[] = [
  { key: 'openWound', label: 'Ferida aberta' },
  { key: 'bleeding', label: 'Sangramento' },
  { key: 'discharge', label: 'Secreção' },
  { key: 'badOdor', label: 'Mau cheiro' },
  { key: 'intenseRedness', label: 'Vermelhidão intensa' },
  { key: 'swelling', label: 'Inchaço' },
  { key: 'severePain', label: 'Dor forte' },
  { key: 'colorChange', label: 'Alteração de cor' },
  { key: 'temperatureChange', label: 'Alteração de temperatura' },
  { key: 'sensationLoss', label: 'Perda de sensibilidade' },
  { key: 'apparentNecrosis', label: 'Necrose aparente' },
  { key: 'reportedFever', label: 'Febre relatada pelo paciente' },
  { key: 'diabeticWithActiveLesion', label: 'Paciente diabético com lesão ativa' },
];

export function hasCriticalAlert(checklist: AlertChecklist): boolean {
  return Object.values(checklist).some(Boolean);
}
