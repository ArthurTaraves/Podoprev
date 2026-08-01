import type {
  Anamnesis,
  Appointment,
  AppointmentSlot,
  Availability,
  Consent,
  ExamSigns,
  Patient,
  PatientAccount,
  PatientProfessionalLink,
  PreAnamnesis,
  Professional,
  ProfessionalProfile,
  SwitchHistoryEntry,
  Visit,
} from '../types';
import { emptyAlertChecklist, emptyAnamnesis, emptyAvailability, emptyExamSigns } from '../domain/factories';
import { calculateAge, calculateRiskScore } from '../domain/riskScore';
import { suggestReturnDate } from '../domain/returnSuggestion';
import { hasCriticalAlert } from '../domain/alertChecklist';
import { deriveCareInstructions } from '../domain/careInstructions';

// Dados de demonstração — só existem em memória, nunca tocam o Firebase. Servem
// para visualizar o Painel de Ação e o restante da interface com uma situação
// clínica plausível e variada antes de um projeto Firebase real estar configurado.

export const DEMO_PROFESSIONAL_UID = 'demo-professional';

export const demoProfessional: Professional = {
  uid: DEMO_PROFESSIONAL_UID,
  name: 'Podólogo(a) demonstração',
  email: 'demo@podoprev.app',
  registrationNumber: 'DEMO-0000',
  createdAt: Date.now(),
};

// Profissionais B e C existem só como dado (perfil público + disponibilidade +
// autoria de atendimentos antigos) — não são login-áveis no modo demonstração
// (só existe DEMO_PROFESSIONAL_UID/DEMO_PATIENT_ACCOUNT_UID como contas reais).
// Servem para demonstrar "busca de profissionais" (aparecem ao lado de A) e como
// profissional ANTERIOR nos cenários de troca (Pacientes 4 e 5) — o jeito de ver
// o resultado do lado profissional é logar como A (demo-professional) e abrir o
// prontuário desses pacientes, que já chegam com o histórico compartilhado
// (ou bloqueado) pronto, sem precisar logar como B ou C.
export const DEMO_PROFESSIONAL_B_UID = 'demo-professional-b';
export const DEMO_PROFESSIONAL_C_UID = 'demo-professional-c';

export const demoProfessionalB: Professional = {
  uid: DEMO_PROFESSIONAL_B_UID,
  name: 'Dr. Rafael Lima',
  email: 'rafael.lima@podoprev.app',
  registrationNumber: 'DEMO-0001',
  createdAt: Date.now(),
};

export const demoProfessionalC: Professional = {
  uid: DEMO_PROFESSIONAL_C_UID,
  name: 'Dra. Fernanda Alves',
  email: 'fernanda.alves@podoprev.app',
  registrationNumber: 'DEMO-0002',
  createdAt: Date.now(),
};

export const demoProfessionals: Professional[] = [demoProfessionalB, demoProfessionalC];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function timestampDaysAgo(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.getTime();
}

function buildVisit(params: {
  id: string;
  patientId: string;
  birthDateIso: string;
  daysAgo: number;
  mainComplaint: string;
  anamnesisOverrides: Partial<Anamnesis>;
  examSignsOverrides?: Partial<ExamSigns>;
  conduct: string;
  professionalId?: string;
  professionalName?: string;
}): Visit {
  const anamnesis: Anamnesis = { ...emptyAnamnesis(), mainComplaint: params.mainComplaint, ...params.anamnesisOverrides };
  const examSigns: ExamSigns = { ...emptyExamSigns(), ...params.examSignsOverrides };
  const checklist = emptyAlertChecklist();
  const age = calculateAge(params.birthDateIso);
  const visitDate = timestampDaysAgo(params.daysAgo);

  const risk = calculateRiskScore(anamnesis, age, {
    hasOpenWound: examSigns.ferida,
    hasDischargeOrOdor: examSigns.secrecao,
    hasDeepCrack: examSigns.rachadura,
  });
  const suggestedReturnDate = suggestReturnDate(risk.level, new Date(visitDate));
  const careInstructions = deriveCareInstructions(anamnesis, examSigns, risk.level);

  return {
    id: params.id,
    patientId: params.patientId,
    professionalId: params.professionalId ?? DEMO_PROFESSIONAL_UID,
    professionalName: params.professionalName ?? demoProfessional.name,
    date: visitDate,
    anamnesis,
    examSigns,
    alertChecklist: checklist,
    hasCriticalAlert: hasCriticalAlert(checklist),
    risk,
    conduct: params.conduct,
    careInstructions,
    suggestedReturnDate,
    returnDate: suggestedReturnDate,
    createdAt: visitDate,
  };
}

const patientMaria: Patient = {
  id: 'demo-patient-1',
  professionalId: DEMO_PROFESSIONAL_UID,
  fullName: 'Maria Souza',
  birthDate: isoDaysAgo(68 * 365),
  cpf: '111.111.111-11',
  phone: '(11) 91111-1111',
  email: 'maria.souza@exemplo.com',
  city: 'São Paulo',
  state: 'SP',
  profession: 'Costureira',
  emergencyContact: 'Pedro Souza — (11) 90000-0001',
  notes: 'Paciente com diabetes tipo 2 de longa data.',
  isActive: true,
  createdAt: timestampDaysAgo(200),
  updatedAt: timestampDaysAgo(20),
};

const patientJoao: Patient = {
  id: 'demo-patient-2',
  professionalId: DEMO_PROFESSIONAL_UID,
  fullName: 'João Pereira',
  birthDate: isoDaysAgo(54 * 365),
  cpf: '222.222.222-22',
  phone: '(11) 92222-2222',
  city: 'São Paulo',
  state: 'SP',
  profession: 'Motorista',
  isActive: true,
  createdAt: timestampDaysAgo(90),
  updatedAt: timestampDaysAgo(30),
};

const patientAna: Patient = {
  id: 'demo-patient-3',
  professionalId: DEMO_PROFESSIONAL_UID,
  fullName: 'Ana Lima',
  birthDate: isoDaysAgo(36 * 365),
  cpf: '333.333.333-33',
  phone: '(11) 93333-3333',
  city: 'Guarulhos',
  state: 'SP',
  profession: 'Professora',
  isActive: true,
  createdAt: timestampDaysAgo(3),
  updatedAt: timestampDaysAgo(3),
};

const patientCarlos: Patient = {
  id: 'demo-patient-4',
  professionalId: DEMO_PROFESSIONAL_UID,
  fullName: 'Carlos Nogueira',
  birthDate: isoDaysAgo(71 * 365),
  cpf: '444.444.444-44',
  phone: '(11) 94444-4444',
  city: 'São Paulo',
  state: 'SP',
  profession: 'Aposentado',
  isActive: true,
  createdAt: timestampDaysAgo(40),
  updatedAt: timestampDaysAgo(3),
};

const patientBeatriz: Patient = {
  id: 'demo-patient-5',
  professionalId: DEMO_PROFESSIONAL_UID,
  fullName: 'Beatriz Rocha',
  birthDate: isoDaysAgo(41 * 365),
  cpf: '555.555.555-55',
  phone: '(11) 95555-5555',
  city: 'São Paulo',
  state: 'SP',
  profession: 'Designer',
  isActive: true,
  createdAt: timestampDaysAgo(120),
  updatedAt: timestampDaysAgo(5),
};

// --- Pacientes adicionais (base de demonstração das Ondas 1-4) ---
// Roberto: múltiplos atendimentos com melhora contínua (Paciente 3 do pedido).
const patientRoberto: Patient = {
  id: 'demo-patient-6',
  professionalId: DEMO_PROFESSIONAL_UID,
  fullName: 'Roberto Alves',
  birthDate: isoDaysAgo(59 * 365),
  cpf: '666.666.666-66',
  phone: '(11) 96666-6666',
  city: 'São Paulo',
  state: 'SP',
  profession: 'Comerciante',
  isActive: true,
  createdAt: timestampDaysAgo(90),
  updatedAt: timestampDaysAgo(5),
};

// Lúcia: trocou de profissional (de B para A) COM autorização de compartilhamento
// (Paciente 4 do pedido) — professionalId já reflete a transferência de titularidade
// do prontuário para o profissional atual (A), como no fluxo real de troca.
const patientLucia: Patient = {
  id: 'demo-patient-7',
  professionalId: DEMO_PROFESSIONAL_UID,
  fullName: 'Lúcia Martins',
  birthDate: isoDaysAgo(63 * 365),
  cpf: '777.777.777-77',
  phone: '(11) 97777-7777',
  city: 'São Paulo',
  state: 'SP',
  profession: 'Aposentada',
  notes: 'Vinculada anteriormente a Dr. Rafael Lima; trocou de profissional com compartilhamento de histórico autorizado.',
  isActive: true,
  createdAt: timestampDaysAgo(200),
  updatedAt: timestampDaysAgo(60),
};

// Fernando: trocou de profissional (de C para A) SEM autorização de compartilhamento
// (Paciente 5 do pedido) — histórico anterior existe no banco, mas A não tem acesso.
const patientFernando: Patient = {
  id: 'demo-patient-8',
  professionalId: DEMO_PROFESSIONAL_UID,
  fullName: 'Fernando Costa',
  birthDate: isoDaysAgo(48 * 365),
  cpf: '888.888.888-88',
  phone: '(11) 98888-8888',
  city: 'São Paulo',
  state: 'SP',
  profession: 'Motorista de aplicativo',
  notes: 'Vinculado anteriormente a Dra. Fernanda Alves; optou por não compartilhar o histórico ao trocar de profissional.',
  isActive: true,
  createdAt: timestampDaysAgo(150),
  updatedAt: timestampDaysAgo(30),
};

export const demoPatients: Patient[] = [
  patientMaria,
  patientJoao,
  patientAna,
  patientCarlos,
  patientBeatriz,
  patientRoberto,
  patientLucia,
  patientFernando,
];

export const demoVisits: Visit[] = [
  // Maria: atendida há 20 dias, nível de atenção alto → retorno sugerido (10 dias) já venceu = ATRASADO.
  buildVisit({
    id: 'demo-visit-1',
    patientId: patientMaria.id,
    birthDateIso: patientMaria.birthDate,
    daysAgo: 20,
    mainComplaint: 'Formigamento e dormência nos pés há algumas semanas.',
    anamnesisOverrides: {
      hasPain: 'nao',
      diabetes: {
        ...emptyAnamnesis().diabetes,
        hasDiabetes: 'sim',
        type: 'Tipo 2',
        diagnosisTime: '12 anos',
        hasMedicalFollowUp: 'sim',
        usesMedication: 'sim',
        hadFootWound: 'sim',
        hasNumbness: 'sim',
      },
    },
    examSignsOverrides: { rachadura: true, foot: 'direito', observation: 'Rachadura no calcanhar direito, sem sinais de infecção.' },
    conduct: 'Orientada sobre inspeção diária dos pés e hidratação da região da rachadura. Encaminhada para avaliação vascular.',
  }),
  // João: atendido há 30 dias, nível médio (retorno sugerido em 30 dias) → vence HOJE.
  buildVisit({
    id: 'demo-visit-2',
    patientId: patientJoao.id,
    birthDateIso: patientJoao.birthDate,
    daysAgo: 30,
    mainComplaint: 'Calo doloroso na planta do pé direito.',
    anamnesisOverrides: {
      hasPain: 'sim',
      painIntensity: 4,
      painLocation: 'Planta do pé direito',
      diabetes: { ...emptyAnamnesis().diabetes, hasDiabetes: 'sim', hasTingling: 'sim' },
      riskFactors: { ...emptyAnamnesis().riskFactors, inadequateFootwear: true },
    },
    conduct: 'Realizada remoção de calosidade. Orientado sobre calçado adequado.',
  }),
  // Ana: nenhum atendimento — cai automaticamente em "sem_atendimento".
  // Carlos: atendido há 3 dias, nível alto (retorno sugerido em 10 dias) → ainda não venceu = ALTO (não atrasado).
  buildVisit({
    id: 'demo-visit-4',
    patientId: patientCarlos.id,
    birthDateIso: patientCarlos.birthDate,
    daysAgo: 3,
    mainComplaint: 'Alteração de cor e temperatura nos pés.',
    anamnesisOverrides: {
      hasPain: 'nao',
      diabetes: { ...emptyAnamnesis().diabetes, hasDiabetes: 'sim', hasColorChange: 'sim', hasTemperatureChange: 'sim' },
    },
    conduct: 'Sinais compatíveis com má circulação. Encaminhado para avaliação vascular urgente.',
  }),
  // Beatriz: atendida há 5 dias, nível baixo (retorno sugerido em 75 dias) → EM DIA.
  buildVisit({
    id: 'demo-visit-5',
    patientId: patientBeatriz.id,
    birthDateIso: patientBeatriz.birthDate,
    daysAgo: 5,
    mainComplaint: 'Avaliação de rotina, sem queixas.',
    anamnesisOverrides: { hasPain: 'nao', practicesPhysicalActivity: 'sim' },
    conduct: 'Pés saudáveis. Mantida orientação preventiva de rotina.',
  }),

  // Maria: 2º atendimento, 3 dias atrás, mesmo quadro clínico do primeiro →
  // demonstra evolução "Estável em relação ao atendimento anterior".
  buildVisit({
    id: 'demo-visit-6',
    patientId: patientMaria.id,
    birthDateIso: patientMaria.birthDate,
    daysAgo: 3,
    mainComplaint: 'Retorno para reavaliação da rachadura no calcanhar.',
    anamnesisOverrides: {
      hasPain: 'nao',
      diabetes: {
        ...emptyAnamnesis().diabetes,
        hasDiabetes: 'sim',
        type: 'Tipo 2',
        diagnosisTime: '12 anos',
        hasMedicalFollowUp: 'sim',
        usesMedication: 'sim',
        hadFootWound: 'sim',
        hasNumbness: 'sim',
      },
    },
    examSignsOverrides: { rachadura: true, foot: 'direito', observation: 'Rachadura em processo de cicatrização, sem sinais de infecção.' },
    conduct: 'Quadro estável. Mantida orientação de hidratação e inspeção diária.',
  }),

  // Carlos: 1º atendimento, 60 dias atrás, quadro leve — o atendimento já existente
  // (3 dias atrás, nível alto) passa a ser o 2º → demonstra "Nível de atenção
  // aumentou desde o último atendimento".
  buildVisit({
    id: 'demo-visit-7',
    patientId: patientCarlos.id,
    birthDateIso: patientCarlos.birthDate,
    daysAgo: 60,
    mainComplaint: 'Avaliação de rotina, sem alterações relevantes.',
    anamnesisOverrides: { hasPain: 'nao', practicesPhysicalActivity: 'sim', diabetes: { ...emptyAnamnesis().diabetes, hasDiabetes: 'sim', hasMedicalFollowUp: 'sim' } },
    conduct: 'Pés sem alterações. Mantida orientação preventiva de rotina.',
  }),

  // Roberto (Paciente 3 — evolução com múltiplos atendimentos): trajetória de
  // melhora contínua alto → moderado → baixo ao longo de 90 dias.
  buildVisit({
    id: 'demo-visit-8',
    patientId: patientRoberto.id,
    birthDateIso: patientRoberto.birthDate,
    daysAgo: 90,
    mainComplaint: 'Ferida no pé esquerdo que não cicatriza.',
    anamnesisOverrides: {
      hasPain: 'sim',
      painIntensity: 6,
      diabetes: { ...emptyAnamnesis().diabetes, hasDiabetes: 'sim', hadFootWound: 'sim', hasHealingDifficulty: 'sim' },
      riskFactors: { ...emptyAnamnesis().riskFactors, ulcerHistory: true, poorCirculation: true },
    },
    examSignsOverrides: { ferida: true, foot: 'esquerdo', observation: 'Ferida com bordas irregulares, sem secreção purulenta.' },
    conduct: 'Encaminhado para avaliação vascular. Curativo orientado e retorno em curto prazo.',
  }),
  buildVisit({
    id: 'demo-visit-9',
    patientId: patientRoberto.id,
    birthDateIso: patientRoberto.birthDate,
    daysAgo: 45,
    mainComplaint: 'Retorno — ferida em cicatrização.',
    anamnesisOverrides: {
      hasPain: 'sim',
      painIntensity: 2,
      diabetes: { ...emptyAnamnesis().diabetes, hasDiabetes: 'sim', hadFootWound: 'sim' },
    },
    examSignsOverrides: { calo: true, foot: 'esquerdo', observation: 'Ferida cicatrizada, calosidade residual na região.' },
    conduct: 'Boa evolução da cicatrização. Removida calosidade residual.',
  }),
  buildVisit({
    id: 'demo-visit-10',
    patientId: patientRoberto.id,
    birthDateIso: patientRoberto.birthDate,
    daysAgo: 5,
    mainComplaint: 'Avaliação de rotina, sem queixas.',
    anamnesisOverrides: { hasPain: 'nao', practicesPhysicalActivity: 'sim', diabetes: { ...emptyAnamnesis().diabetes, hasDiabetes: 'sim', hasMedicalFollowUp: 'sim' } },
    conduct: 'Pés saudáveis, sem sinais residuais. Mantida orientação preventiva de rotina.',
  }),

  // Lúcia (Paciente 4 — trocou COM compartilhamento): 2 atendimentos antigos com
  // Dr. Rafael Lima (profissional B) mostrando melhora, + 1 atendimento novo já
  // com o profissional atual (A) — evolução atravessa a troca (item 5).
  buildVisit({
    id: 'demo-visit-11',
    patientId: patientLucia.id,
    birthDateIso: patientLucia.birthDate,
    daysAgo: 150,
    mainComplaint: 'Unha encravada recorrente no hálux direito.',
    anamnesisOverrides: {
      hasPain: 'sim',
      painIntensity: 5,
      diabetes: { ...emptyAnamnesis().diabetes, hasDiabetes: 'sim', hasMedicalFollowUp: 'sim' },
      riskFactors: { ...emptyAnamnesis().riskFactors, recurrentIngrownNails: true, inadequateFootwear: true },
    },
    examSignsOverrides: { unhaEncravada: true, foot: 'direito', observation: 'Unha encravada com sinais de inflamação leve.' },
    conduct: 'Realizado tratamento da unha encravada. Orientação sobre calçado adequado.',
    professionalId: DEMO_PROFESSIONAL_B_UID,
    professionalName: demoProfessionalB.name,
  }),
  buildVisit({
    id: 'demo-visit-12',
    patientId: patientLucia.id,
    birthDateIso: patientLucia.birthDate,
    daysAgo: 100,
    mainComplaint: 'Retorno — unha em recuperação.',
    anamnesisOverrides: {
      hasPain: 'nao',
      diabetes: { ...emptyAnamnesis().diabetes, hasDiabetes: 'sim', hasMedicalFollowUp: 'sim' },
    },
    conduct: 'Boa evolução, sem sinais de inflamação. Mantida orientação preventiva.',
    professionalId: DEMO_PROFESSIONAL_B_UID,
    professionalName: demoProfessionalB.name,
  }),
  buildVisit({
    id: 'demo-visit-13',
    patientId: patientLucia.id,
    birthDateIso: patientLucia.birthDate,
    daysAgo: 10,
    mainComplaint: 'Primeira consulta com o novo profissional — avaliação de rotina.',
    anamnesisOverrides: { hasPain: 'nao', practicesPhysicalActivity: 'sim', diabetes: { ...emptyAnamnesis().diabetes, hasDiabetes: 'sim', hasMedicalFollowUp: 'sim' } },
    conduct: 'Pés saudáveis, sem sinais residuais da unha encravada. Continuidade do acompanhamento preventivo.',
  }),

  // Fernando (Paciente 5 — trocou SEM compartilhamento): 1 atendimento antigo com
  // Dra. Fernanda Alves (profissional C, não visível para o profissional atual) +
  // 1 atendimento novo já com o profissional atual (A).
  buildVisit({
    id: 'demo-visit-14',
    patientId: patientFernando.id,
    birthDateIso: patientFernando.birthDate,
    daysAgo: 80,
    mainComplaint: 'Calosidade dolorosa na planta do pé.',
    anamnesisOverrides: {
      hasPain: 'sim',
      painIntensity: 3,
      wearsClosedShoesLongHours: 'sim',
      riskFactors: { ...emptyAnamnesis().riskFactors, calluses: true, inadequateFootwear: true },
    },
    examSignsOverrides: { calo: true, foot: 'ambos', observation: 'Calosidade bilateral na região plantar.' },
    conduct: 'Removida calosidade. Orientação sobre calçado adequado.',
    professionalId: DEMO_PROFESSIONAL_C_UID,
    professionalName: demoProfessionalC.name,
  }),
  buildVisit({
    id: 'demo-visit-15',
    patientId: patientFernando.id,
    birthDateIso: patientFernando.birthDate,
    daysAgo: 15,
    mainComplaint: 'Primeira consulta com o novo profissional — avaliação de rotina.',
    anamnesisOverrides: { hasPain: 'nao', practicesPhysicalActivity: 'sim' },
    conduct: 'Pés sem alterações relevantes. Iniciado acompanhamento preventivo.',
  }),
];

// Conta de paciente de demonstração — vinculada a Maria Souza, cujo atendimento
// tem uma rachadura registrada (vira lembrete de hidratação no app do paciente).
export const DEMO_PATIENT_ACCOUNT_UID = 'demo-patient-account';

export const demoPatientAccount: PatientAccount = {
  uid: DEMO_PATIENT_ACCOUNT_UID,
  patientId: patientMaria.id,
  professionalId: DEMO_PROFESSIONAL_UID,
  name: patientMaria.fullName,
  email: patientMaria.email ?? '',
  createdAt: timestampDaysAgo(20),
};

export const demoConsents: Consent[] = [
  {
    id: 'demo-consent-1',
    patientId: patientMaria.id,
    professionalId: DEMO_PROFESSIONAL_UID,
    type: 'dados',
    patientNameSnapshot: patientMaria.fullName,
    cpfSnapshot: patientMaria.cpf,
    agreed: true,
    agreedAt: timestampDaysAgo(20),
  },
  {
    id: 'demo-consent-2',
    patientId: patientMaria.id,
    professionalId: DEMO_PROFESSIONAL_UID,
    type: 'imagem',
    patientNameSnapshot: patientMaria.fullName,
    cpfSnapshot: patientMaria.cpf,
    agreed: true,
    agreedAt: timestampDaysAgo(20),
  },
  // Lúcia: termos assinados na época em que era paciente de Dr. Rafael Lima (B) —
  // continuam visíveis no perfil dela hoje, mesmo depois da troca (fan-out).
  {
    id: 'demo-consent-3',
    patientId: patientLucia.id,
    professionalId: DEMO_PROFESSIONAL_B_UID,
    type: 'dados',
    patientNameSnapshot: patientLucia.fullName,
    cpfSnapshot: patientLucia.cpf,
    agreed: true,
    agreedAt: timestampDaysAgo(200),
  },
  {
    id: 'demo-consent-4',
    patientId: patientLucia.id,
    professionalId: DEMO_PROFESSIONAL_B_UID,
    type: 'imagem',
    patientNameSnapshot: patientLucia.fullName,
    cpfSnapshot: patientLucia.cpf,
    agreed: true,
    agreedAt: timestampDaysAgo(200),
  },
  // Fernando: termos assinados na época em que era paciente de Dra. Fernanda Alves (C).
  {
    id: 'demo-consent-5',
    patientId: patientFernando.id,
    professionalId: DEMO_PROFESSIONAL_C_UID,
    type: 'dados',
    patientNameSnapshot: patientFernando.fullName,
    cpfSnapshot: patientFernando.cpf,
    agreed: true,
    agreedAt: timestampDaysAgo(150),
  },
];

// --- Perfis públicos dos 3 profissionais (busca de profissionais) ---
export const demoProfessionalProfiles: ProfessionalProfile[] = [
  {
    professionalId: DEMO_PROFESSIONAL_UID,
    displayName: demoProfessional.name,
    bio: 'Atendimento preventivo focado em pacientes diabéticos, com acompanhamento contínuo e orientações personalizadas.',
    city: 'São Paulo',
    neighborhood: 'Vila Mariana',
    isPubliclyVisible: true,
    averageRating: 4.8,
    totalReviews: 34,
    specialties: ['Diabetes', 'Calosidade'],
    updatedAt: Date.now(),
  },
  {
    professionalId: DEMO_PROFESSIONAL_B_UID,
    displayName: demoProfessionalB.name,
    bio: 'Especialista em tratamento de unhas encravadas e cuidados preventivos para pés diabéticos.',
    city: 'São Paulo',
    neighborhood: 'Pinheiros',
    isPubliclyVisible: true,
    averageRating: 4.6,
    totalReviews: 21,
    specialties: ['Diabetes', 'Onicomicose'],
    updatedAt: Date.now(),
  },
  {
    professionalId: DEMO_PROFESSIONAL_C_UID,
    displayName: demoProfessionalC.name,
    bio: 'Cuidados podológicos gerais, com foco em calosidades e joanetes.',
    city: 'Guarulhos',
    neighborhood: 'Centro',
    isPubliclyVisible: true,
    averageRating: 4.7,
    totalReviews: 18,
    specialties: ['Joanete', 'Calosidade'],
    updatedAt: Date.now(),
  },
];

// --- Vínculos paciente-profissional (Onda 4) — Lúcia (com compartilhamento) e
// Fernando (sem compartilhamento). Cada um tem 2 documentos: o vínculo antigo
// (inactive) e o vínculo atual (active), exatamente como produzido por uma troca
// real via switchProfessional().
export const demoPatientProfessionalLinks: PatientProfessionalLink[] = [
  {
    patientId: patientLucia.id,
    professionalId: DEMO_PROFESSIONAL_B_UID,
    status: 'inactive',
    linkedAt: timestampDaysAgo(200),
    unlinkedAt: timestampDaysAgo(60),
    historyAccessConsented: false,
  },
  {
    patientId: patientLucia.id,
    professionalId: DEMO_PROFESSIONAL_UID,
    status: 'active',
    linkedAt: timestampDaysAgo(60),
    historyAccessConsented: true,
    consentedAt: timestampDaysAgo(60),
    consentTerm:
      'Autorizo o compartilhamento do meu histórico podológico com o profissional selecionado para fins de continuidade do acompanhamento.',
    previousProfessionalId: DEMO_PROFESSIONAL_B_UID,
    previousProfessionalName: demoProfessionalB.name,
  },
  {
    patientId: patientFernando.id,
    professionalId: DEMO_PROFESSIONAL_C_UID,
    status: 'inactive',
    linkedAt: timestampDaysAgo(150),
    unlinkedAt: timestampDaysAgo(30),
    historyAccessConsented: false,
  },
  {
    patientId: patientFernando.id,
    professionalId: DEMO_PROFESSIONAL_UID,
    status: 'active',
    linkedAt: timestampDaysAgo(30),
    historyAccessConsented: false,
    consentedAt: timestampDaysAgo(30),
    consentTerm:
      'Autorizo o compartilhamento do meu histórico podológico com o profissional selecionado para fins de continuidade do acompanhamento.',
    previousProfessionalId: DEMO_PROFESSIONAL_C_UID,
    previousProfessionalName: demoProfessionalC.name,
  },
];

// --- Log de trocas (Onda 4) ---
export const demoSwitchHistoryEntries: SwitchHistoryEntry[] = [
  {
    id: 'demo-switch-1',
    patientId: patientLucia.id,
    previousProfessionalId: DEMO_PROFESSIONAL_B_UID,
    previousProfessionalName: demoProfessionalB.name,
    newProfessionalId: DEMO_PROFESSIONAL_UID,
    newProfessionalName: demoProfessional.name,
    switchedAt: timestampDaysAgo(60),
    historyShared: true,
  },
  {
    id: 'demo-switch-2',
    patientId: patientFernando.id,
    previousProfessionalId: DEMO_PROFESSIONAL_C_UID,
    previousProfessionalName: demoProfessionalC.name,
    newProfessionalId: DEMO_PROFESSIONAL_UID,
    newProfessionalName: demoProfessional.name,
    switchedAt: timestampDaysAgo(30),
    historyShared: false,
  },
];

// --- Disponibilidade (Onda 1/3) — configurada para os 3 profissionais, para que
// a busca (Onda 4) mostre "Disponível" e o agendamento (Onda 2) funcione de ponta
// a ponta com qualquer um deles.
function weekdayAvailability(professionalId: string, blocks: { start: string; end: string }[]): Availability {
  const base = emptyAvailability(professionalId);
  return {
    ...base,
    slotDurationMinutes: 60,
    schedule: {
      ...base.schedule,
      segunda: blocks,
      quarta: blocks,
      sexta: blocks,
    },
  };
}

export const demoAvailabilities: Availability[] = [
  weekdayAvailability(DEMO_PROFESSIONAL_UID, [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '17:00' }]),
  weekdayAvailability(DEMO_PROFESSIONAL_B_UID, [{ start: '09:00', end: '12:00' }]),
  weekdayAvailability(DEMO_PROFESSIONAL_C_UID, [{ start: '14:00', end: '18:00' }]),
];

// --- Agendamentos (Onda 2) — uma consulta confirmada futura de Maria com o
// profissional atual (A), visível tanto na Agenda dele quanto no Histórico dela.
function nextWeekdayIso(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

const demoAppointmentDate = nextWeekdayIso(7);

export const demoAppointments: Appointment[] = [
  {
    id: `${DEMO_PROFESSIONAL_UID}_${demoAppointmentDate}_09:00`,
    patientId: patientMaria.id,
    professionalId: DEMO_PROFESSIONAL_UID,
    date: demoAppointmentDate,
    startTime: '09:00',
    endTime: '10:00',
    status: 'confirmado',
    createdAt: timestampDaysAgo(2),
    expiresAt: timestampDaysAgo(2) + 10 * 60 * 1000,
    confirmedAt: timestampDaysAgo(2),
  },
];

export const demoAppointmentSlots: AppointmentSlot[] = [
  {
    professionalId: DEMO_PROFESSIONAL_UID,
    date: demoAppointmentDate,
    startTime: '09:00',
    endTime: '10:00',
    status: 'confirmado',
    expiresAt: timestampDaysAgo(2) + 10 * 60 * 1000,
  },
];

// --- Pré-anamnese (Onda 1) — Ana (Paciente 1, aguardando 1ª avaliação) já
// preencheu a pré-anamnese antes da primeira consulta; João já teve a dele
// validada num atendimento anterior.
export const demoPreAnamneses: PreAnamnesis[] = [
  {
    id: 'demo-pre-anamnesis-1',
    patientId: patientAna.id,
    professionalId: DEMO_PROFESSIONAL_UID,
    anamnesis: {
      ...emptyAnamnesis(),
      mainComplaint: 'Sinto um desconforto leve na sola do pé esquerdo ao caminhar.',
      hasPain: 'sim',
      painIntensity: 2,
      painLocation: 'Sola do pé esquerdo',
    },
    status: 'aguardando_validacao',
    createdAt: timestampDaysAgo(1),
    preenchidoPor: 'demo-ana-standin', // paciente sem conta própria no app neste cenário
  },
  {
    id: 'demo-pre-anamnesis-2',
    patientId: patientJoao.id,
    professionalId: DEMO_PROFESSIONAL_UID,
    anamnesis: {
      ...emptyAnamnesis(),
      mainComplaint: 'Calo doloroso na planta do pé direito.',
      hasPain: 'sim',
      painIntensity: 4,
      painLocation: 'Planta do pé direito',
    },
    status: 'validada',
    createdAt: timestampDaysAgo(31),
    reviewedAt: timestampDaysAgo(30),
    preenchidoPor: 'demo-joao-standin',
    validadoPor: DEMO_PROFESSIONAL_UID,
  },
];
