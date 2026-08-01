import { v4 as uuid } from 'uuid';
import type { Anamnesis, CareInstruction, ExamSigns, RiskLevel } from '../types';

// Deriva sugestões de orientação de cuidado a partir dos sinais observados no
// atendimento. O profissional revisa e edita essa lista antes de salvar
// (StepCareInstructions) — é aqui que a parte FIXA (regras abaixo) vira
// conteúdo FLEXÍVEL (o profissional pode reescrever, remover ou adicionar).
// O app do paciente usa `timesPerDay` para agendar os lembretes locais no celular.

type SignRule = {
  key: keyof Pick<ExamSigns, 'rachadura' | 'ferida' | 'calo' | 'micose' | 'unhaEncravada' | 'secrecao'>;
  title: string;
  description: (foot: string) => string;
  timesPerDay: number;
};

const SIGN_RULES: SignRule[] = [
  {
    key: 'rachadura',
    title: 'Hidratar os pés',
    description: (foot) => `Aplique creme hidratante na região com rachadura (${foot}), evitando a área entre os dedos.`,
    timesPerDay: 3,
  },
  {
    key: 'ferida',
    title: 'Cuidar do curativo',
    description: (foot) => `Troque o curativo da ferida (${foot}) conforme orientado e evite molhar a região.`,
    timesPerDay: 2,
  },
  {
    key: 'calo',
    title: 'Aliviar pressão nas calosidades',
    description: (foot) => `Evite pressão prolongada sobre a calosidade (${foot}). Não remova o calo sozinho(a).`,
    timesPerDay: 1,
  },
  {
    key: 'micose',
    title: 'Manter os pés secos',
    description: (foot) => `Seque bem a região com micose (${foot}) após o banho e use o antifúngico indicado.`,
    timesPerDay: 2,
  },
  {
    key: 'unhaEncravada',
    title: 'Observar unha encravada',
    description: (foot) => `Evite cortar as unhas arredondadas nas laterais (${foot}). Procure o podólogo se notar dor ou vermelhidão.`,
    timesPerDay: 1,
  },
  {
    key: 'secrecao',
    title: 'Observar sinais de infecção',
    description: (foot) => `Fique atento(a) a secreção ou mau cheiro na região marcada (${foot}) e avise o profissional se persistir.`,
    timesPerDay: 2,
  },
];

function footLabel(foot: ExamSigns['foot']): string {
  if (foot === 'ambos') return 'ambos os pés';
  if (foot === 'direito') return 'pé direito';
  if (foot === 'esquerdo') return 'pé esquerdo';
  return 'pé afetado';
}

export function deriveCareInstructions(anamnesis: Anamnesis, examSigns: ExamSigns, riskLevel: RiskLevel): CareInstruction[] {
  const instructions: CareInstruction[] = [];
  const foot = footLabel(examSigns.foot);

  for (const rule of SIGN_RULES) {
    if (!examSigns[rule.key]) continue;
    instructions.push({
      id: uuid(),
      title: rule.title,
      description: rule.description(foot),
      timesPerDay: rule.timesPerDay,
      sourceLabel: 'Sinais observados no exame',
    });
  }

  if (anamnesis.diabetes.hasDiabetes === 'sim') {
    instructions.push({
      id: uuid(),
      title: 'Inspecionar os pés diariamente',
      description: 'Observe toda a superfície dos pés, incluindo entre os dedos e a planta, procurando feridas, bolhas ou mudanças de cor.',
      timesPerDay: 1,
      sourceLabel: 'Cuidado geral para diabéticos',
    });
    instructions.push({
      id: uuid(),
      title: 'Evitar andar descalço(a)',
      description: 'Use sempre calçado fechado e confortável, mesmo dentro de casa, para reduzir o risco de ferimentos.',
      timesPerDay: 1,
      sourceLabel: 'Cuidado geral para diabéticos',
    });
  }

  if (riskLevel === 'alto') {
    instructions.push({
      id: uuid(),
      title: 'Buscar avaliação em breve',
      description: 'Seu podólogo identificou sinais que pedem atenção redobrada. Compareça ao retorno sugerido o quanto antes.',
      timesPerDay: 1,
      sourceLabel: 'Nível de atenção',
    });
  }

  return instructions;
}

// --- Sugestões automáticas (etapa 4) — melhoria 3 ---
// Diferente de deriveCareInstructions acima (que pré-preenche a lista), estas
// sugestões só aparecem como texto com um botão "+ Adicionar às orientações":
// o profissional decide se cada uma faz sentido para o caso, nada é adicionado
// sozinho. Prioridade: diabetes + ferida + rachadura primeiro; no máximo 4 exibidas.

export interface CareSuggestion {
  id: string;
  text: string;
}

type SuggestionRule = { active: boolean; text: string; priority: number };

export function deriveCareSuggestions(anamnesis: Anamnesis, examSigns: ExamSigns): CareSuggestion[] {
  const hasDiabetes = anamnesis.diabetes.hasDiabetes === 'sim';
  const rules: SuggestionRule[] = [
    { active: hasDiabetes, text: 'Inspecionar os pés diariamente, buscando qualquer alteração', priority: 0 },
    { active: hasDiabetes, text: 'Comunicar ao podólogo qualquer ferida ou mudança nos pés', priority: 0 },
    { active: examSigns.ferida, text: 'Evitar pressão na região afetada', priority: 0 },
    { active: examSigns.rachadura, text: 'Hidratação diária dos pés com creme adequado', priority: 0 },
    { active: examSigns.micose, text: 'Manter os pés secos, especialmente entre os dedos', priority: 1 },
    { active: examSigns.calo, text: 'Usar calçados confortáveis e que não pressionem os pés', priority: 1 },
    { active: examSigns.unhaEncravada, text: 'Evitar cortar as unhas nas laterais', priority: 1 },
    { active: anamnesis.hasPain === 'sim', text: 'Evitar esforço excessivo nas regiões de dor', priority: 1 },
  ];

  const seen = new Set<string>();
  const suggestions: CareSuggestion[] = [];
  for (const rule of rules.filter((r) => r.active).sort((a, b) => a.priority - b.priority)) {
    if (seen.has(rule.text)) continue;
    seen.add(rule.text);
    suggestions.push({ id: uuid(), text: rule.text });
    if (suggestions.length >= 4) break;
  }
  return suggestions;
}
