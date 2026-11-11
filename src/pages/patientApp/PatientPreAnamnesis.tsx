import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { NoProfessionalCard } from '../../components/NoProfessionalCard';
import { createPreAnamnesis, getPreAnamnesisForPatient, updatePreAnamnesisAnswers } from '../../firebase/preAnamnesis';
import { emptyAnamnesis } from '../../domain/factories';
import { StepAnamnesis } from '../visits/steps/StepAnamnesis';
import type { Anamnesis, PreAnamnesis } from '../../types';
import { formatDateBR } from '../../lib/dates';
import { assertOnline, useReloadOnReconnect, type LoadStatus } from '../../lib/network';
import { LoadFailedNotice } from '../../components/ui/LoadFailedNotice';

type ViewMode = 'summary' | 'form';

export function PatientPreAnamnesisPage() {
  const { patientAccount } = useAuth();
  const [pre, setPre] = useState<PreAnamnesis | null>(null);
  const [draft, setDraft] = useState<Anamnesis>(emptyAnamnesis());
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [saving, setSaving] = useState(false);
  const { online, reloadKey, retry } = useReloadOnReconnect();

  useEffect(() => {
    if (!patientAccount || !patientAccount.professionalId) return;
    // Não recarrega com o formulário aberto — apagaria respostas ainda não enviadas.
    if (viewMode === 'form') return;
    let cancelled = false;
    (async () => {
      try {
        assertOnline();
        const existing = await getPreAnamnesisForPatient(patientAccount.patientId, patientAccount.professionalId);
        if (cancelled) return;
        setPre(existing);
        setStatus('ready');
      } catch {
        // Falha numa recarga com dados já na tela mantém os dados.
        if (!cancelled) setStatus((prev) => (prev === 'ready' ? prev : 'failed'));
      }
    })();
    return () => {
      cancelled = true;
    };
    // viewMode fica de fora de propósito: só patientAccount/reconexão disparam recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientAccount, reloadKey]);

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

  if (patientAccount && !patientAccount.professionalId) {
    return (
      <NoProfessionalCard icon="📋" message="Busque um profissional na aba Buscar para habilitar a pré-anamnese." />
    );
  }

  if (status === 'loading') return <p>Carregando…</p>;
  if (status === 'failed') {
    return (
      <LoadFailedNotice
        online={online}
        onRetry={() => {
          setStatus('loading');
          retry();
        }}
      />
    );
  }

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
          <div className="empty-icon">📋</div>
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
          <div className="empty-icon">⏳</div>
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
        <div className="empty-icon">✅</div>
        <span className="badge badge-low">Validada pelo profissional</span>
        {pre.reviewedAt && (
          <p className="hint" style={{ marginTop: 10, marginBottom: 12 }}>
            Validada em {formatDateBR(pre.reviewedAt)}
          </p>
        )}
        <button type="button" className="btn btn-outline" onClick={viewAnswers}>
          Ver respostas
        </button>
      </div>
    </div>
  );
}
