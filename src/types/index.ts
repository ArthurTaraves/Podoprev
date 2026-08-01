// Tipos centrais do domínio PodoPrev.
// Mantidos em um único arquivo por simplicidade — projeto de porte de TCC.

export type YesNo = 'sim' | 'nao' | null;

export interface Professional {
  uid: string;
  name: string;
  email: string;
  registrationNumber?: string; // registro profissional (opcional)
  createdAt: number;
}

export interface Patient {
  id: string;
  professionalId: string;
  fullName: string;
  birthDate: string; // ISO yyyy-mm-dd
  cpf: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  profession?: string;
  emergencyContact?: string;
  notes?: string;
  isActive: boolean;
  linkedUserId?: string; // uid da conta do paciente no app, após vincular via convite
  createdAt: number;
  updatedAt: number;
}

// --- Conta do paciente no app (login próprio, separado do profissional) ---

export interface PatientAccount {
  uid: string;
  patientId: string;
  professionalId: string;
  name: string;
  email: string;
  createdAt: number;
}

// Convite gerado pelo profissional no prontuário; o paciente informa o código
// no cadastro para vincular sua conta ao registro clínico já existente.
export interface PatientInvite {
  code: string;
  patientId: string;
  professionalId: string;
  createdAt: number;
  used: boolean;
  usedByUid?: string;
}

// --- Anamnese ---

export interface DiabetesData {
  hasDiabetes: YesNo;
  type?: string; // "Tipo 1" | "Tipo 2" | "Não sabe informar"
  diagnosisTime?: string;
  hasMedicalFollowUp: YesNo;
  usesMedication: YesNo;
  hadFootWound: YesNo;
  hadAmputation: YesNo;
  hasTingling: YesNo;
  hasNumbness: YesNo;
  hasColorChange: YesNo;
  hasTemperatureChange: YesNo;
  hasHealingDifficulty: YesNo;
}

export interface RiskFactors {
  hypertension: boolean;
  poorCirculation: boolean;
  neuropathy: boolean;
  ulcerHistory: boolean;
  recurrentIngrownNails: boolean;
  fungalInfection: boolean;
  cracks: boolean;
  calluses: boolean;
  footDeformity: boolean;
  inadequateFootwear: boolean;
  smoking: boolean;
  lowMobility: boolean;
}

export interface Anamnesis {
  mainComplaint: string;
  hasPain: YesNo;
  painIntensity?: number; // 0-10
  painLocation?: string;
  problemDuration?: string;
  wearsClosedShoesLongHours: YesNo;
  practicesPhysicalActivity: YesNo;
  hadFootWoundsBefore: YesNo;
  hadPodiatricTreatmentBefore: YesNo;
  diabetes: DiabetesData;
  riskFactors: RiskFactors;
}

// --- Sinais observados no exame ---
// Estrutura FIXA e simples (checklist de sinais gerais), sem mapeamento visual
// por região do pé — o profissional marca o que observa e, se relevante, qual pé.

export type FootSide = 'direito' | 'esquerdo' | 'ambos';

export interface ExamSigns {
  ferida: boolean;
  vermelhidao: boolean;
  rachadura: boolean;
  calo: boolean;
  micose: boolean;
  unhaEncravada: boolean;
  secrecao: boolean;
  dorAoExame: boolean;
  foot: FootSide | null;
  observation: string;
}

// --- Checklist de sinais de alerta ---

export interface AlertChecklist {
  openWound: boolean;
  bleeding: boolean;
  discharge: boolean;
  badOdor: boolean;
  intenseRedness: boolean;
  swelling: boolean;
  severePain: boolean;
  colorChange: boolean;
  temperatureChange: boolean;
  sensationLoss: boolean;
  apparentNecrosis: boolean;
  reportedFever: boolean;
  diabeticWithActiveLesion: boolean;
}

// --- Nível de atenção (classificação preventiva, NÃO diagnóstica) ---
// "RiskLevel" é o identificador interno (mantido por estabilidade do código e do
// banco); na interface e nos textos, este nível é sempre chamado de "nível de
// atenção" — nunca de "risco médico" ou "diagnóstico".

export type RiskLevel = 'baixo' | 'moderado' | 'alto';

export interface RiskResult {
  score: number;
  level: RiskLevel;
  message: string;
  breakdown: { label: string; points: number }[];
}

// --- Fotos ---

export interface PatientPhoto {
  id: string;
  patientId: string;
  visitId: string;
  professionalId: string;
  foot?: FootSide;
  caption?: string;
  storagePath: string;
  url: string;
  createdAt: number;
}

// --- Consentimento LGPD ---

export type ConsentType = 'dados' | 'imagem';

export interface Consent {
  id: string;
  patientId: string;
  professionalId: string;
  type: ConsentType;
  patientNameSnapshot: string;
  cpfSnapshot: string;
  agreed: boolean;
  signatureDataUrl?: string;
  agreedAt: number;
}

// --- Disponibilidade do profissional (dias/horários de atendimento) ---
// Documento único por profissional (doc id = professionalId), configurado por ele
// mesmo. Nesta onda é só configuração — nenhuma tela ainda lê esse dado para
// montar agenda/agendamento (fica para uma etapa futura).

export type Weekday = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado' | 'domingo';

export interface AvailabilityBlock {
  start: string; // "08:00"
  end: string; // "12:00"
}

// Bloqueio excepcional numa data específica (Onda 3) — exceção pontual à
// disponibilidade semanal, não uma configuração alternativa dela. "Dia inteiro"
// não é um campo à parte: é só um bloqueio com startTime/endTime cobrindo o dia
// todo (00:00–23:59), tratado pela mesma lógica de sobreposição de horário.
export interface ScheduleBlock {
  id: string;
  date: string; // ISO yyyy-mm-dd
  startTime: string; // "HH:mm"
  endTime: string;
  reason?: string;
}

export interface Availability {
  professionalId: string;
  slotDurationMinutes: number;
  schedule: Record<Weekday, AvailabilityBlock[]>; // array por dia: permite mais de um bloco (ex.: manhã e tarde)
  blocks: ScheduleBlock[]; // bloqueios excepcionais em datas específicas
  updatedAt: number;
}

// --- Pré-anamnese (preenchida pelo paciente, aguarda validação do profissional) ---
// Único ponto do sistema em que o paciente escreve dado clínico — ver comentário
// em firestore.rules sobre a regra específica e restrita que permite isso.

export type PreAnamnesisStatus = 'aguardando_validacao' | 'validada';

export interface PreAnamnesis {
  id: string;
  patientId: string;
  professionalId: string;
  anamnesis: Anamnesis; // reaproveita o mesmo tipo usado na etapa 1 do atendimento
  status: PreAnamnesisStatus;
  createdAt: number;
  reviewedAt?: number;
  preenchidoPor: string; // uid da conta do paciente que preencheu
  validadoPor?: string; // uid do profissional que validou
}

// --- Agendamento (Onda 2) ---
// Duas coleções: `appointments` guarda o dado real (com patientId); `appointmentSlots`
// é o espelho sem nenhum dado pessoal, só ocupação — é o que o paciente consulta pra
// ver horários livres sem enxergar quem ocupa os outros. Mesmo id determinístico nas
// duas (`professionalId_data_hora`), o que evita reserva duplicada por construção
// (o Firestore trata escrita num id já existente como "update", não "create") e
// dispensa lógica de concorrência à parte. Ver firestore.rules para o detalhe de
// segurança de cada coleção.

export type AppointmentStatus = 'reservado_temporario' | 'confirmado' | 'cancelado';

export interface Appointment {
  id: string; // = slotId determinístico
  patientId: string;
  professionalId: string;
  date: string; // ISO yyyy-mm-dd
  startTime: string; // "HH:mm"
  endTime: string;
  status: AppointmentStatus;
  createdAt: number;
  expiresAt: number; // só relevante enquanto status = 'reservado_temporario'
  confirmedAt?: number;
}

export interface AppointmentSlot {
  professionalId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  expiresAt: number;
}

// --- Perfil público do profissional (busca de profissionais) ---
// Coleção separada de `users` (não um campo dentro dele) porque `users/{uid}`
// guarda email/registrationNumber, que nunca podem ficar públicos — o Firestore
// não tem segurança por campo, só por documento inteiro, então a única forma seura
// de expor "nome, cidade, bio" sem expor "email" é um documento à parte com só os
// campos públicos. `averageRating`/`totalReviews` são demonstrativos (não existe
// sistema real de avaliação ainda) e não são editáveis pelo profissional.
export type Specialty = 'Diabetes' | 'Onicomicose' | 'Joanete' | 'Calosidade';

export interface ProfessionalProfile {
  professionalId: string; // = doc id
  displayName: string;
  bio: string;
  city: string;
  neighborhood: string;
  profilePhotoUrl?: string;
  isPubliclyVisible: boolean;
  averageRating: number; // demonstrativo
  totalReviews: number; // demonstrativo
  specialties: Specialty[]; // informativo — nunca influencia score/classificação
  updatedAt: number;
}

// --- Vínculo paciente-profissional (Onda 4 — troca de profissional) ---
// Id determinístico `${patientId}_${professionalId}` — sempre acessado por leitura
// de documento único (get), nunca por consulta de lista, o que evita por completo o
// problema de "provabilidade" de regra em queries (ver comentário em firebase/visits.ts).
// Um documento existe para CADA profissional que o paciente já teve (ativo ou não) —
// nunca é apagado, é a base de `wasEverLinkedProfessional` e `hasConsentedHistoryAccess`.
// `previousProfessionalId`/`previousProfessionalName` só são gravados no vínculo NOVO
// (o que está sendo criado na troca) e amarram, num único get(), o profissional novo
// ao profissional de quem ele está herdando histórico compartilhado — por desenho,
// cobre só um "salto" (o profissional imediatamente anterior), não uma cadeia
// transitiva de trocas — suficiente para o escopo deste TCC.
export type PatientProfessionalLinkStatus = 'active' | 'inactive';

export interface PatientProfessionalLink {
  patientId: string;
  professionalId: string;
  status: PatientProfessionalLinkStatus;
  linkedAt: number;
  unlinkedAt?: number;
  historyAccessConsented: boolean;
  consentedAt?: number;
  consentTerm?: string;
  revokedAt?: number;
  previousProfessionalId?: string;
  previousProfessionalName?: string;
}

// Log imutável de cada troca de profissional — nunca é sobrescrito por uma
// revogação posterior de consentimento (isso vive só em PatientProfessionalLink).
// Lido só pelo próprio paciente (query por patientId, filtro único, sempre provável).
export interface SwitchHistoryEntry {
  id: string;
  patientId: string;
  previousProfessionalId: string;
  previousProfessionalName: string;
  newProfessionalId: string;
  newProfessionalName: string;
  switchedAt: number;
  historyShared: boolean;
}

// --- Orientações de cuidado (viram lembretes no app do paciente) ---

export interface CareInstruction {
  id: string;
  title: string;
  description: string;
  timesPerDay: number; // usado para distribuir os horários de lembrete no app do paciente
  sourceLabel: string; // origem: região/alteração que motivou a orientação, ou "Orientação manual"
}

// --- Atendimento / Visita ---
// Agrega anamnese + sinais observados + checklist de alerta + classificação.
// Estrutura FIXA (definida pelo sistema); ver README seção "Modelo híbrido"
// para o que dentro dela é fixo (cálculo, classificação) vs. flexível
// (conduta, orientações, data de retorno).

export interface Visit {
  id: string;
  patientId: string;
  professionalId: string;
  professionalName: string;
  date: number; // timestamp do atendimento
  anamnesis: Anamnesis;
  examSigns: ExamSigns;
  alertChecklist: AlertChecklist;
  hasCriticalAlert: boolean;
  risk: RiskResult;
  conduct?: string;
  careInstructions: CareInstruction[];
  suggestedReturnDate: string; // ISO yyyy-mm-dd, sugerido pelo sistema (fixo)
  returnDate: string; // ISO yyyy-mm-dd, editável pelo profissional (flexível)
  createdAt: number;
}
