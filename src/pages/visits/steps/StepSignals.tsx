import type { AlertChecklist, ExamSigns, FootSide } from '../../../types';
import { ALERT_CHECKLIST_LABELS, hasCriticalAlert } from '../../../domain/alertChecklist';
import { EXAM_SIGN_LABELS as SIGN_LABELS } from '../../../domain/examSignLabels';

interface Props {
  examSigns: ExamSigns;
  onExamSignsChange: (value: ExamSigns) => void;
  checklist: AlertChecklist;
  onChecklistChange: (value: AlertChecklist) => void;
}

export function StepSignals({ examSigns, onExamSignsChange, checklist, onChecklistChange }: Props) {
  function toggleSign(key: (typeof SIGN_LABELS)[number]['key']) {
    onExamSignsChange({ ...examSigns, [key]: !examSigns[key] });
  }

  function toggleAlert(key: keyof AlertChecklist) {
    onChecklistChange({ ...checklist, [key]: !checklist[key] });
  }

  const alert = hasCriticalAlert(checklist);

  return (
    <div>
      <h3>Sinais observados</h3>
      <p className="hint">Estrutura fixa do sistema — marque o que foi observado no exame ou relatado pelo paciente. Sem mapeamento visual complexo: um checklist simples já alimenta a classificação.</p>

      <div className="form-grid">
        {SIGN_LABELS.map(({ key, label }) => (
          <label key={key} className="checkbox-row">
            <input type="checkbox" checked={examSigns[key]} onChange={() => toggleSign(key)} />
            {label}
          </label>
        ))}
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>Pé afetado</label>
        <select value={examSigns.foot ?? ''} onChange={(e) => onExamSignsChange({ ...examSigns, foot: (e.target.value || null) as FootSide | null })}>
          <option value="">Não se aplica / não observado</option>
          <option value="esquerdo">Pé esquerdo</option>
          <option value="direito">Pé direito</option>
          <option value="ambos">Ambos os pés</option>
        </select>
      </div>

      <div className="field">
        <label>Observação sobre os sinais observados</label>
        <textarea value={examSigns.observation} onChange={(e) => onExamSignsChange({ ...examSigns, observation: e.target.value })} />
      </div>

      <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

      <h3>Sinais de alerta</h3>
      <p className="hint">Se algum item crítico abaixo for marcado, o sistema recomenda orientar o paciente a buscar avaliação com profissional de saúde habilitado.</p>

      <div className="form-grid">
        {ALERT_CHECKLIST_LABELS.map(({ key, label }) => (
          <label key={key} className="checkbox-row">
            <input type="checkbox" checked={checklist[key]} onChange={() => toggleAlert(key)} />
            {label}
          </label>
        ))}
      </div>

      {alert && (
        <div className="alert-banner" style={{ marginTop: 16 }}>
          Atenção: sinal de alerta identificado. Recomenda-se orientar o paciente a buscar avaliação com
          profissional de saúde habilitado.
        </div>
      )}
    </div>
  );
}
