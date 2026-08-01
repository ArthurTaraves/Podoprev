import type { Anamnesis, RiskLevel, RiskResult } from '../types';

// "Score Podológico Preventivo": pontuação simples e auditável, NÃO diagnóstica.
// Cada fator soma pontos fixos; a soma classifica o paciente em uma faixa de risco
// que orienta a periodicidade de retorno e o nível de atenção do profissional.

const POINTS = {
  hasDiabetes: 20,
  footWoundHistory: 20,
  amputation: 30,
  numbnessOrSensationLoss: 20,
  frequentTingling: 10,
  colorChange: 15,
  temperatureChange: 15,
  healingDifficulty: 20,
  openWound: 30,
  dischargeOrOdor: 25,
  deepCrack: 10,
  inadequateFootwear: 5,
  footDeformity: 10,
  ageOver60: 10,
  lowMobility: 10,
  smoking: 10,
} as const;

export function calculateAge(birthDateIso: string): number {
  if (!birthDateIso) return 0;
  const birth = new Date(birthDateIso);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Calcula o Score Podológico Preventivo a partir da anamnese e do mapeamento do pé.
 * `hasOpenWoundOnFoot` e `hasDischargeOrOdorOnFoot` vêm do mapeamento visual / checklist,
 * pois representam achados do exame, não apenas relato do paciente.
 */
export function calculateRiskScore(
  anamnesis: Anamnesis,
  patientAge: number,
  examFindings: { hasOpenWound: boolean; hasDischargeOrOdor: boolean; hasDeepCrack: boolean },
): RiskResult {
  const breakdown: { label: string; points: number }[] = [];
  const add = (condition: boolean, label: string, points: number) => {
    if (condition) breakdown.push({ label, points });
  };

  const { diabetes, riskFactors } = anamnesis;

  add(diabetes.hasDiabetes === 'sim', 'Possui diabetes', POINTS.hasDiabetes);
  add(diabetes.hadFootWound === 'sim', 'Histórico de ferida nos pés', POINTS.footWoundHistory);
  add(diabetes.hadAmputation === 'sim', 'Amputação prévia', POINTS.amputation);
  add(diabetes.hasNumbness === 'sim', 'Dormência / perda de sensibilidade', POINTS.numbnessOrSensationLoss);
  add(diabetes.hasTingling === 'sim', 'Formigamento frequente', POINTS.frequentTingling);
  add(diabetes.hasColorChange === 'sim', 'Alteração de cor nos pés', POINTS.colorChange);
  add(diabetes.hasTemperatureChange === 'sim', 'Alteração de temperatura nos pés', POINTS.temperatureChange);
  add(diabetes.hasHealingDifficulty === 'sim', 'Dificuldade de cicatrização', POINTS.healingDifficulty);

  add(examFindings.hasOpenWound, 'Ferida aberta identificada no exame', POINTS.openWound);
  add(examFindings.hasDischargeOrOdor, 'Secreção ou mau cheiro', POINTS.dischargeOrOdor);
  add(examFindings.hasDeepCrack, 'Rachadura profunda', POINTS.deepCrack);

  add(riskFactors.inadequateFootwear, 'Calçado inadequado', POINTS.inadequateFootwear);
  add(riskFactors.footDeformity, 'Deformidade nos pés', POINTS.footDeformity);
  add(patientAge > 60, 'Idade acima de 60 anos', POINTS.ageOver60);
  add(riskFactors.lowMobility, 'Baixa mobilidade', POINTS.lowMobility);
  add(riskFactors.smoking, 'Tabagismo', POINTS.smoking);

  const score = breakdown.reduce((sum, item) => sum + item.points, 0);
  const level = classifyRisk(score);

  return { score, level, message: riskMessage(level), breakdown };
}

export function classifyRisk(score: number): RiskLevel {
  if (score <= 20) return 'baixo';
  if (score <= 50) return 'moderado';
  return 'alto';
}

export function riskMessage(level: RiskLevel): string {
  switch (level) {
    case 'baixo':
      return 'Paciente sem sinais relevantes no momento. Manter acompanhamento preventivo de rotina.';
    case 'moderado':
      return 'Paciente apresenta alguns sinais que pedem acompanhamento mais próximo.';
    case 'alto':
      return 'Paciente apresenta múltiplos sinais que exigem maior acompanhamento e atenção prioritária.';
  }
}

// Aviso fixo exibido em toda tela que mostra o nível de atenção — reforça que o
// sistema orienta a organização do cuidado, não substitui avaliação profissional.
export const ATTENTION_DISCLAIMER =
  'Esta classificação não é um diagnóstico. É uma ferramenta de apoio à organização do acompanhamento, ' +
  'construída a partir de sinais informados e observados — a decisão clínica é sempre do profissional.';

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'baixo':
      return 'var(--color-risk-low)';
    case 'moderado':
      return 'var(--color-risk-moderate)';
    case 'alto':
      return 'var(--color-risk-high)';
  }
}
