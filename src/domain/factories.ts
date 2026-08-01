import type { AlertChecklist, Anamnesis, Availability, DiabetesData, ExamSigns, ProfessionalProfile, RiskFactors, Specialty, Weekday } from '../types';

export const WEEKDAYS: Weekday[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

export const SPECIALTY_OPTIONS: Specialty[] = ['Diabetes', 'Onicomicose', 'Joanete', 'Calosidade'];

export function emptyDiabetesData(): DiabetesData {
  return {
    hasDiabetes: null,
    type: '',
    diagnosisTime: '',
    hasMedicalFollowUp: null,
    usesMedication: null,
    hadFootWound: null,
    hadAmputation: null,
    hasTingling: null,
    hasNumbness: null,
    hasColorChange: null,
    hasTemperatureChange: null,
    hasHealingDifficulty: null,
  };
}

export function emptyRiskFactors(): RiskFactors {
  return {
    hypertension: false,
    poorCirculation: false,
    neuropathy: false,
    ulcerHistory: false,
    recurrentIngrownNails: false,
    fungalInfection: false,
    cracks: false,
    calluses: false,
    footDeformity: false,
    inadequateFootwear: false,
    smoking: false,
    lowMobility: false,
  };
}

export function emptyAnamnesis(): Anamnesis {
  return {
    mainComplaint: '',
    hasPain: null,
    painIntensity: undefined,
    painLocation: '',
    problemDuration: '',
    wearsClosedShoesLongHours: null,
    practicesPhysicalActivity: null,
    hadFootWoundsBefore: null,
    hadPodiatricTreatmentBefore: null,
    diabetes: emptyDiabetesData(),
    riskFactors: emptyRiskFactors(),
  };
}

export function emptyExamSigns(): ExamSigns {
  return {
    ferida: false,
    vermelhidao: false,
    rachadura: false,
    calo: false,
    micose: false,
    unhaEncravada: false,
    secrecao: false,
    dorAoExame: false,
    foot: null,
    observation: '',
  };
}

export function emptyAvailability(professionalId: string): Availability {
  return {
    professionalId,
    slotDurationMinutes: 60,
    schedule: {
      segunda: [],
      terca: [],
      quarta: [],
      quinta: [],
      sexta: [],
      sabado: [],
      domingo: [],
    },
    blocks: [],
    updatedAt: 0,
  };
}

// averageRating/totalReviews começam com um valor demonstrativo fixo — não existe
// sistema real de avaliação ainda, e não são editáveis pelo profissional no formulário.
export function emptyProfessionalProfile(professionalId: string): ProfessionalProfile {
  return {
    professionalId,
    displayName: '',
    bio: '',
    city: '',
    neighborhood: '',
    profilePhotoUrl: '',
    isPubliclyVisible: false,
    averageRating: 4.5,
    totalReviews: 12,
    specialties: [],
    updatedAt: 0,
  };
}

export function emptyAlertChecklist(): AlertChecklist {
  return {
    openWound: false,
    bleeding: false,
    discharge: false,
    badOdor: false,
    intenseRedness: false,
    swelling: false,
    severePain: false,
    colorChange: false,
    temperatureChange: false,
    sensationLoss: false,
    apparentNecrosis: false,
    reportedFever: false,
    diabeticWithActiveLesion: false,
  };
}
