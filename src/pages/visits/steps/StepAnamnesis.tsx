import type { Anamnesis, DiabetesData, RiskFactors } from '../../../types';
import { YesNoToggle } from '../../../components/ui/YesNoToggle';

interface Props {
  value: Anamnesis;
  onChange: (value: Anamnesis) => void;
}

const RISK_FACTOR_LABELS: { key: keyof RiskFactors; label: string }[] = [
  { key: 'hypertension', label: 'Hipertensão' },
  { key: 'poorCirculation', label: 'Má circulação' },
  { key: 'neuropathy', label: 'Neuropatia' },
  { key: 'ulcerHistory', label: 'Histórico de úlcera' },
  { key: 'recurrentIngrownNails', label: 'Unhas encravadas recorrentes' },
  { key: 'fungalInfection', label: 'Micose' },
  { key: 'cracks', label: 'Rachaduras' },
  { key: 'calluses', label: 'Calosidades' },
  { key: 'footDeformity', label: 'Deformidades nos pés' },
  { key: 'inadequateFootwear', label: 'Uso de calçado inadequado' },
  { key: 'smoking', label: 'Tabagismo' },
  { key: 'lowMobility', label: 'Baixa mobilidade' },
];

export function StepAnamnesis({ value, onChange }: Props) {
  function set<K extends keyof Anamnesis>(key: K, v: Anamnesis[K]) {
    onChange({ ...value, [key]: v });
  }
  function setDiabetes<K extends keyof DiabetesData>(key: K, v: DiabetesData[K]) {
    onChange({ ...value, diabetes: { ...value.diabetes, [key]: v } });
  }
  function toggleRiskFactor(key: keyof RiskFactors) {
    onChange({ ...value, riskFactors: { ...value.riskFactors, [key]: !value.riskFactors[key] } });
  }

  return (
    <div>
      <h3>Anamnese podológica</h3>

      <div className="field">
        <label>Queixa principal</label>
        <textarea value={value.mainComplaint} onChange={(e) => set('mainComplaint', e.target.value)} />
      </div>

      <YesNoToggle label="Dor nos pés?" value={value.hasPain} onChange={(v) => set('hasPain', v)} />

      {value.hasPain === 'sim' && (
        <div className="form-grid">
          <div className="field">
            <label>Intensidade da dor (0 a 10)</label>
            <input
              type="number"
              min={0}
              max={10}
              value={value.painIntensity ?? ''}
              onChange={(e) => set('painIntensity', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Local da dor</label>
            <input type="text" value={value.painLocation} onChange={(e) => set('painLocation', e.target.value)} />
          </div>
          <div className="field">
            <label>Há quanto tempo sente o problema?</label>
            <input type="text" value={value.problemDuration} onChange={(e) => set('problemDuration', e.target.value)} />
          </div>
        </div>
      )}

      <YesNoToggle
        label="Usa calçado fechado por muitas horas?"
        value={value.wearsClosedShoesLongHours}
        onChange={(v) => set('wearsClosedShoesLongHours', v)}
      />
      <YesNoToggle
        label="Realiza atividade física?"
        value={value.practicesPhysicalActivity}
        onChange={(v) => set('practicesPhysicalActivity', v)}
      />
      <YesNoToggle label="Já teve feridas nos pés?" value={value.hadFootWoundsBefore} onChange={(v) => set('hadFootWoundsBefore', v)} />
      <YesNoToggle
        label="Já fez tratamento podológico antes?"
        value={value.hadPodiatricTreatmentBefore}
        onChange={(v) => set('hadPodiatricTreatmentBefore', v)}
      />

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

      <h3>Diabetes</h3>
      <YesNoToggle label="Possui diabetes?" value={value.diabetes.hasDiabetes} onChange={(v) => setDiabetes('hasDiabetes', v)} />

      {value.diabetes.hasDiabetes === 'sim' && (
        <div className="card" style={{ background: 'var(--color-secondary-light)', border: 'none', marginBottom: 16 }}>
          <div className="form-grid">
            <div className="field">
              <label>Tipo de diabetes, se souber</label>
              <select value={value.diabetes.type} onChange={(e) => setDiabetes('type', e.target.value)}>
                <option value="">Não sabe informar</option>
                <option value="Tipo 1">Tipo 1</option>
                <option value="Tipo 2">Tipo 2</option>
                <option value="Gestacional">Gestacional</option>
              </select>
            </div>
            <div className="field">
              <label>Tempo de diagnóstico</label>
              <input type="text" value={value.diabetes.diagnosisTime} onChange={(e) => setDiabetes('diagnosisTime', e.target.value)} />
            </div>
          </div>

          <YesNoToggle label="Faz acompanhamento médico?" value={value.diabetes.hasMedicalFollowUp} onChange={(v) => setDiabetes('hasMedicalFollowUp', v)} />
          <YesNoToggle label="Usa medicação?" value={value.diabetes.usesMedication} onChange={(v) => setDiabetes('usesMedication', v)} />
          <YesNoToggle label="Já teve ferida nos pés?" value={value.diabetes.hadFootWound} onChange={(v) => setDiabetes('hadFootWound', v)} />
          <YesNoToggle label="Já teve amputação?" value={value.diabetes.hadAmputation} onChange={(v) => setDiabetes('hadAmputation', v)} />
          <YesNoToggle label="Sente formigamento nos pés?" value={value.diabetes.hasTingling} onChange={(v) => setDiabetes('hasTingling', v)} />
          <YesNoToggle label="Sente dormência nos pés?" value={value.diabetes.hasNumbness} onChange={(v) => setDiabetes('hasNumbness', v)} />
          <YesNoToggle label="Percebe alteração de cor nos pés?" value={value.diabetes.hasColorChange} onChange={(v) => setDiabetes('hasColorChange', v)} />
          <YesNoToggle
            label="Percebe alteração de temperatura nos pés?"
            value={value.diabetes.hasTemperatureChange}
            onChange={(v) => setDiabetes('hasTemperatureChange', v)}
          />
          <YesNoToggle
            label="Tem dificuldade de cicatrização?"
            value={value.diabetes.hasHealingDifficulty}
            onChange={(v) => setDiabetes('hasHealingDifficulty', v)}
          />
        </div>
      )}

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

      <h3>Outros fatores de risco</h3>
      <div className="form-grid">
        {RISK_FACTOR_LABELS.map(({ key, label }) => (
          <label key={key} className="checkbox-row">
            <input type="checkbox" checked={value.riskFactors[key]} onChange={() => toggleRiskFactor(key)} />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}
