import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createPreAnamnesis, getPreAnamnesisForPatient, updatePreAnamnesisAnswers } from '../../firebase/preAnamnesis';
import { emptyAnamnesis } from '../../domain/factories';
import { StepAnamnesis } from '../visits/steps/StepAnamnesis';
import type { Anamnesis, PreAnamnesis } from '../../types';

type ViewMode = 'summary' | 'form';

export function PatientPreAnamnesisPage() {
  const { patientAccount } = useAuth();
  const [pre, setPre] = useState<PreAnamnesis | null>(null);
  const [draft, setDraft] = useState<Anamnesis>(emptyAnamnesis());
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!patientAccount) return;
    getPreAnamnesisForPatient(patientAccount.patientId, patientAccount.professionalId).then((existing) => {
      setPre(existing);
      setLoading(false);
    });
  }, [patientAccount]);

  function startFilling() {
    setDraft(emptyAnamnesis());
    setViewMode('form');
  }

  function startEditing() {
    if (!pre) return;
    setDraft(pre.anamnesis);
    setViewMode('form');
  }

  function viewAnswers() {
    if (!pre) return;
    setDraft(pre.anamnesis);
    setViewMode('form');
  }

  async function handleSubmitNew() {
    if (!patientAccount) return;
    setSaving(true);
    try {
      const id = await createPreAnamnesis({
        patientId: patientAccount.patientId,
        professionalId: patientAccount.professionalId,
        anamnesis: draft,
        preenchidoPor: patientAccount.uid,
      });
      setPre({
        id,
        patientId: patientAccount.patientId,
        professionalId: patientAccount.professionalId,
        anamnesis: draft,
        status: 'aguardando_validacao',
        createdAt: Date.now(),
        preenchidoPor: patientAccount.uid,
      });
      setViewMode('summary');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitEdit() {
    if (!pre) return;
    setSaving(true);
    try {
      await updatePreAnamnesisAnswers(pre.id, draft);
      setPre({ ...pre, anamnesis: draft });
      setViewMode('summary');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Carregando…</p>;

  // Formulário aberto — preenchimento inicial, edição (pendente) ou visualização (validada).
  if (viewMode === 'form') {
    const readOnly = pre?.status === 'validada';
    return (
      <div>
        <h1 style={{ fontSize: 20 }}>Pré-anamnese</h1>
        {!readOnly && (
          <div className="info-banner" style={{ marginBottom: 16 }}>
            Estas informações foram fornecidas pelo paciente e deverão ser revisadas pelo podólogo.
          </div>
        )}

        <div style={readOnly ? { pointerEvents: 'none', opacity: 0.75 } : undefined}>
          <StepAnamnesis value={draft} onChange={setDraft} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-outline" onClick={() => setViewMode('summary')}>
            Voltar
          </button>
          {!readOnly && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={pre ? handleSubmitEdit : handleSubmitNew}
            >
              {saving ? 'Enviando…' : pre ? 'Salvar alterações' : 'Enviar para o profissional'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Estado 1 — sem anamnese preenchida.
  if (!pre) {
    return (
      <div>
        <h1 style={{ fontSize: 20 }}>Pré-anamnese</h1>
        <div className="card empty-state">
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <strong>Preencha sua anamnese antes da consulta</strong>
          <p className="hint" style={{ marginTop: 6, marginBottom: 12 }}>
            Isso ajuda o profissional a se preparar para o atendimento.
          </p>
          <button type="button" className="btn btn-primary" onClick={startFilling}>
            Preencher agora
          </button>
        </div>
      </div>
    );
  }

  // Estado 2 — enviada, aguardando validação.
  if (pre.status === 'aguardando_validacao') {
    return (
      <div>
        <h1 style={{ fontSize: 20 }}>Pré-anamnese</h1>
        <div className="card empty-state">
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <span className="badge badge-moderate">Aguardando validação do profissional</span>
          <p className="hint" style={{ marginTop: 10, marginBottom: 12 }}>
            Sua anamnese foi enviada e será revisada pelo profissional.
          </p>
          <button type="button" className="btn btn-outline" onClick={startEditing}>
            Editar respostas
          </button>
        </div>
      </div>
    );
  }

  // Estado 3 — validada pelo profissional.
  return (
    <div>
      <h1 style={{ fontSize: 20 }}>Pré-anamnese</h1>
      <div className="card empty-state">
        <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
        <span className="badge badge-low">Validada pelo profissional</span>
        {pre.reviewedAt && (
          <p className="hint" style={{ marginTop: 10, marginBottom: 12 }}>
            Validada em {new Date(pre.reviewedAt).toLocaleDateString('pt-BR')}
          </p>
        )}
        <button type="button" className="btn btn-outline" onClick={viewAnswers}>
          Ver respostas
        </button>
      </div>
    </div>
  );
}
