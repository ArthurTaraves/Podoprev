import { useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import type { Anamnesis, CareInstruction, ExamSigns } from '../../../types';
import { deriveCareSuggestions } from '../../../domain/careInstructions';

interface Props {
  value: CareInstruction[];
  onChange: (value: CareInstruction[]) => void;
  anamnesis: Anamnesis;
  examSigns: ExamSigns;
}

export function StepCareInstructions({ value, onChange, anamnesis, examSigns }: Props) {
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftTimesPerDay, setDraftTimesPerDay] = useState(1);

  const suggestions = useMemo(() => deriveCareSuggestions(anamnesis, examSigns), [anamnesis, examSigns]);

  function update(id: string, patch: Partial<CareInstruction>) {
    onChange(value.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function remove(id: string) {
    onChange(value.filter((i) => i.id !== id));
  }

  function addManual() {
    if (!draftTitle.trim()) return;
    onChange([
      ...value,
      {
        id: uuid(),
        title: draftTitle,
        description: draftDescription,
        timesPerDay: draftTimesPerDay,
        sourceLabel: 'Orientação manual',
      },
    ]);
    setDraftTitle('');
    setDraftDescription('');
    setDraftTimesPerDay(1);
  }

  function addSuggestion(text: string) {
    onChange([
      ...value,
      {
        id: uuid(),
        title: text,
        description: text,
        timesPerDay: 1,
        sourceLabel: 'Sugestão automática',
      },
    ]);
  }

  return (
    <div>
      <h3>Orientações ao paciente</h3>
      <div className="info-banner">
        Estas orientações aparecem no app do paciente como "cuidados do dia" e viram lembretes no celular
        (quantidade de vezes ao dia definida abaixo). Adicione manualmente ou a partir das sugestões automáticas
        abaixo — nada é incluído sozinho, você decide o que faz sentido para o caso.
      </div>

      {suggestions.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h4>Sugestões automáticas</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {suggestions.map((s) => {
              const alreadyAdded = value.some((i) => i.title === s.text);
              return (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span>{s.text}</span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={alreadyAdded}
                    onClick={() => addSuggestion(s.text)}
                  >
                    {alreadyAdded ? 'Adicionada' : '+ Adicionar às orientações'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
            Sugestões geradas com base nos sinais registrados. O profissional deve avaliar a adequação para cada caso.
          </p>
        </div>
      )}

      {value.length === 0 ? (
        <div className="empty-state">Nenhuma orientação definida ainda. Adicione uma abaixo.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {value.map((instruction) => (
            <div key={instruction.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="hint">{instruction.sourceLabel}</span>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(instruction.id)}>
                  Remover
                </button>
              </div>
              <div className="form-grid" style={{ marginTop: 6 }}>
                <div className="field">
                  <label>Título</label>
                  <input type="text" value={instruction.title} onChange={(e) => update(instruction.id, { title: e.target.value })} />
                </div>
                <div className="field">
                  <label>Vezes ao dia</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={instruction.timesPerDay}
                    onChange={(e) => update(instruction.id, { timesPerDay: Number(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div className="field">
                <label>Descrição (aparece no lembrete)</label>
                <textarea value={instruction.description} onChange={(e) => update(instruction.id, { description: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ background: 'var(--color-secondary-light)', border: 'none' }}>
        <h4>Adicionar orientação manual</h4>
        <div className="form-grid">
          <div className="field">
            <label>Título</label>
            <input type="text" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Ex.: Trocar meias" />
          </div>
          <div className="field">
            <label>Vezes ao dia</label>
            <input type="number" min={1} max={8} value={draftTimesPerDay} onChange={(e) => setDraftTimesPerDay(Number(e.target.value) || 1)} />
          </div>
        </div>
        <div className="field">
          <label>Descrição</label>
          <textarea value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} />
        </div>
        <button type="button" className="btn btn-secondary" onClick={addManual}>
          + Adicionar
        </button>
      </div>
    </div>
  );
}
