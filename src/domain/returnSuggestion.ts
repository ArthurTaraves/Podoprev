import type { RiskLevel } from '../types';

// Sugestão de retorno preventivo com base na classificação de risco.
// O profissional pode sempre sobrescrever a data sugerida (ver Visit.returnDate).

const RETURN_DAYS: Record<RiskLevel, number> = {
  baixo: 75, // faixa 60–90 dias: usamos o ponto médio como sugestão
  moderado: 30,
  alto: 10, // faixa 7–15 dias
};

export const RETURN_DESCRIPTION: Record<RiskLevel, string> = {
  baixo: 'Retorno preventivo sugerido em 60 a 90 dias.',
  moderado: 'Retorno sugerido em até 30 dias.',
  alto: 'Retorno sugerido em 7 a 15 dias, ou encaminhamento, conforme avaliação profissional.',
};

export function suggestReturnDate(level: RiskLevel, fromDate: Date = new Date()): string {
  const days = RETURN_DAYS[level];
  const result = new Date(fromDate);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
}
