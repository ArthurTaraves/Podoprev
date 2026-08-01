import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { useAuth } from '../../context/AuthContext';
import { getPatient } from '../../firebase/patients';
import { saveVisit, listVisitsByPatient } from '../../firebase/visits';
import { hasActiveConsent } from '../../firebase/consents';
import type { Anamnesis, AlertChecklist as AlertChecklistType, CareInstruction, ExamSigns, Patient, PatientPhoto, Visit } from '../../types';
import { emptyAlertChecklist, emptyAnamnesis, emptyExamSigns } from '../../domain/factories';
import { calculateAge, calculateRiskScore } from '../../domain/riskScore';
import { suggestReturnDate } from '../../domain/returnSuggestion';
import { hasCriticalAlert } from '../../domain/alertChecklist';
import { StepAnamnesis } from './steps/StepAnamnesis';
import { StepSignals } from './steps/StepSignals';
import { StepPhotos } from './steps/StepPhotos';
import { StepCareInstructions } from './steps/StepCareInstructions';
import { StepResult } from './steps/StepResult';

const STEPS = ['Anamnese', 'Sinais observados', 'Fotos', 'Orientações', 'Resultado'];

export function NewVisitWizard() {
  const { id: patientId } = useParams();
  const { user, professional } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Presente quando o profissional chega aqui validando uma pré-anamnese do
  // paciente (ver PatientRecord.tsx) — pré-preenche a etapa 1 com o que ele já
  // revisou, mas continua totalmente editável.
  const prefillAnamnesis = (location.state as { prefillAnamnesis?: Anamnesis } | null)?.prefillAnamnesis ?? null;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [hasImageConsent, setHasImageConsent] = useState(false);
  const [previousVisit, setPreviousVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const visitId = useMemo(() => uuid(), []);
  const [anamnesis, setAnamnesis] = useState<Anamnesis>(prefillAnamnesis ?? emptyAnamnesis());
  const [examSigns, setExamSigns] = useState<ExamSigns>(emptyExamSigns());
  const [photos, setPhotos] = useState<PatientPhoto[]>([]);
  const [checklist, setChecklist] = useState<AlertChecklistType>(emptyAlertChecklist());
  const [conduct, setConduct] = useState('');
  const [careInstructions, setCareInstructions] = useState<CareInstruction[]>([]);
  const [returnDateOverride, setReturnDateOverride] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId || !user) return;
    Promise.all([
      getPatient(patientId),
      hasActiveConsent(patientId, user.uid, 'imagem'),
      listVisitsByPatient(patientId, user.uid),
    ]).then(([p, consent, priorVisits]) => {
      setPatient(p);
      setHasImageConsent(consent);
      setPreviousVisit(priorVisits[0] ?? null); // priorVisits já vem ordenado por data desc.
      setLoading(false);
    });
  }, [patientId, user]);

  const age = patient ? calculateAge(patient.birthDate) : 0;

  // Cálculo FIXO: mesma fórmula sempre, não editável pelo profissional (ver domain/riskScore.ts).
  const risk = useMemo(() => {
    const hasOpenWound = examSigns.ferida || checklist.openWound;
    const hasDischargeOrOdor = examSigns.secrecao || checklist.discharge || checklist.badOdor;
    const hasDeepCrack = examSigns.rachadura;
    return calculateRiskScore(anamnesis, age, { hasOpenWound, hasDischargeOrOdor, hasDeepCrack });
  }, [anamnesis, age, examSigns, checklist]);

  const suggestedReturn = useMemo(() => suggestReturnDate(risk.level), [risk.level]);
  const returnDate = returnDateOverride ?? suggestedReturn;

  function goToStep(nextStep: number) {
    setStep(nextStep);
  }

  async function handleSave() {
    if (!patientId || !user || !professional) return;
    setSaving(true);
    setSaveError('');
    try {
      await saveVisit(visitId, {
        patientId,
        professionalId: user.uid,
        professionalName: professional.name,
        date: Date.now(),
        anamnesis,
        examSigns,
        alertChecklist: checklist,
        hasCriticalAlert: hasCriticalAlert(checklist),
        risk,
        conduct,
        careInstructions,
        suggestedReturnDate: suggestedReturn,
        returnDate,
      });
      navigate(`/app/patients/${patientId}`);
    } catch {
      setSaveError('Não foi possível salvar o atendimento. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Carregando…</p>;
  if (!patient || !patientId) return <p>Paciente não encontrado.</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Novo atendimento</h1>
          <p>Paciente: {patient.fullName}</p>
        </div>
      </div>

      <div className="wizard-steps">
        {STEPS.map((label, i) => (
          <div key={label} className={`wizard-step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
            {i + 1}. {label}
          </div>
        ))}
      </div>

      <div className="card">
        {step === 0 && (
          <>
            {prefillAnamnesis && (
              <div className="info-banner" style={{ marginBottom: 16 }}>
                Pré-anamnese enviada pelo paciente foi carregada — revise antes de continuar.
              </div>
            )}
            <StepAnamnesis value={anamnesis} onChange={setAnamnesis} />
          </>
        )}
        {step === 1 && (
          <StepSignals examSigns={examSigns} onExamSignsChange={setExamSigns} checklist={checklist} onChecklistChange={setChecklist} />
        )}
        {step === 2 && (
          <StepPhotos
            patientId={patientId}
            visitId={visitId}
            professionalId={user?.uid ?? ''}
            hasImageConsent={hasImageConsent}
            examSigns={examSigns}
            photos={photos}
            onPhotosChange={setPhotos}
            onGoToConsent={() => navigate(`/app/patients/${patientId}/consent`)}
          />
        )}
        {step === 3 && (
          <StepCareInstructions value={careInstructions} onChange={setCareInstructions} anamnesis={anamnesis} examSigns={examSigns} />
        )}
        {step === 4 && (
          <StepResult
            risk={risk}
            examSigns={examSigns}
            suggestedReturnDate={suggestedReturn}
            returnDate={returnDate}
            onReturnDateChange={setReturnDateOverride}
            conduct={conduct}
            onConductChange={setConduct}
            previousVisit={previousVisit}
            hasCriticalAlert={hasCriticalAlert(checklist)}
          />
        )}

        {saveError && <div className="error-text">{saveError}</div>}

        <div className="wizard-actions">
          <button type="button" className="btn btn-outline" disabled={step === 0} onClick={() => goToStep(step - 1)}>
            Voltar
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={() => goToStep(step + 1)}>
              Continuar
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={handleSave}>
              {saving ? 'Salvando…' : 'Salvar atendimento'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
