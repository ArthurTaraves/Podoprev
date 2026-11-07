import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createPrescription, deletePrescription, listPrescriptionsByPatient } from '../../firebase/prescriptions';
import { defaultPrescriptionTimes, isPrescriptionActive, sortTimes, toLocalIsoDate } from '../../domain/prescriptions';
import type { Prescription } from '../../types';

interface Props {
  patientId: string;
  patientName: string;
  onClose: () => void;
}

type Frequency = 1 | 2 | 3 | 'custom';

const timeInputStyle: React.CSSProperties = {
  border: '1.5px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  padding: '9px 10px',
  fontSize: 14,
  fontFamily: 'inherit',
  background: 'white',
};

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
}

export function PrescriptionModal({ patientId, patientName, onClose }: Props) {
  const { user, professional } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<Frequency>(2);
  const [customCount, setCustomCount] = useState(4);
  const [times, setTimes] = useState<string[]>(defaultPrescriptionTimes(2));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    listPrescriptionsByPatient(patientId, user.uid).then(setPrescriptions);
  }, [patientId, user]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function changeCount(count: number) {
    setTimes(defaultPrescriptionTimes(count));
  }

  function selectFrequency(next: Frequency) {
    setFrequency(next);
    changeCount(next === 'custom' ? customCount : next);
  }

  function changeCustomCount(value: number) {
    const count = Math.max(1, Math.min(8, value || 1));
    setCustomCount(count);
    changeCount(count);
  }

  function setTime(index: number, value: string) {
    setTimes(times.map((t, i) => (i === index ? value : t)));
  }

  async function handleSave() {
    if (!user) return;
    setError('');
    setSaved(false);
    if (!description.trim()) return setError('Descreva o cuidado prescrito.');
    if (times.some((t) => !t)) return setError('Preencha todos os horários.');
    if (startDate && endDate && endDate < startDate) return setError('A data de fim não pode ser anterior à de início.');

    setSaving(true);
    try {
      await createPrescription({
        patientId,
        professionalId: user.uid,
        professionalName: professional?.name ?? '',
        description: description.trim(),
        timesPerDay: times.length,
        times: sortTimes(times),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setPrescriptions(await listPrescriptionsByPatient(patientId, user.uid));
      setDescription('');
      setStartDate('');
      setEndDate('');
      setSaved(true);
    } catch {
      setError('Não foi possível salvar a prescrição. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    if (!user || !window.confirm('Remover esta prescrição? O paciente deixará de vê-la e de receber os lembretes.')) return;
    await deletePrescription(id);
    setPrescriptions(await listPrescriptionsByPatient(patientId, user.uid));
  }

  const todayIso = toLocalIsoDate(new Date());

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Prescrever cuidado"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxSizing: 'border-box',
        zIndex: 1000,
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 380, // cabe dentro da moldura de celular do desktop (index.css, ≥600px)
          maxHeight: '90vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          borderRadius: 16,
          margin: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Prescrever cuidado</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
          Para {patientName}. O paciente verá na aba “Cuidados” e receberá lembretes nos horários definidos.
        </p>

        {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
        {saved && <div className="success-text" style={{ marginBottom: 12 }}>Prescrição salva.</div>}

        <div className="field">
          <label htmlFor="prescription-description">Descrição do cuidado</label>
          <textarea
            id="prescription-description"
            placeholder="Ex.: Limpar a ferida com soro fisiológico"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Frequência</label>
          <div className="yesno-group">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={`yesno-btn ${frequency === n ? 'selected-yes' : ''}`}
                onClick={() => selectFrequency(n)}
              >
                {n}x
              </button>
            ))}
            <button
              type="button"
              className={`yesno-btn ${frequency === 'custom' ? 'selected-yes' : ''}`}
              onClick={() => selectFrequency('custom')}
            >
              Outro
            </button>
          </div>
          {frequency === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input
                type="number"
                min={1}
                max={8}
                value={customCount}
                onChange={(e) => changeCustomCount(Number(e.target.value))}
                style={{ width: 80 }}
                aria-label="Vezes por dia"
              />
              <span className="hint">vezes por dia (até 8)</span>
            </div>
          )}
        </div>

        <div className="field">
          <label>Horários</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {times.map((time, index) => (
              <input
                key={index}
                type="time"
                value={time}
                onChange={(e) => setTime(index, e.target.value)}
                style={timeInputStyle}
                aria-label={`Horário ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="prescription-start">Início (opcional)</label>
            <input id="prescription-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="prescription-end">Fim (opcional)</label>
            <input id="prescription-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <button type="button" className="btn btn-primary btn-block" disabled={saving} onClick={handleSave}>
          {saving ? 'Salvando…' : 'Salvar prescrição'}
        </button>

        {prescriptions.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <strong style={{ fontSize: 14 }}>Prescrições deste paciente</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {prescriptions.map((p) => {
                const active = isPrescriptionActive(p, todayIso);
                return (
                  <div key={p.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{p.description}</span>
                      <span className={`badge ${active ? 'badge-low' : 'badge-moderate'}`}>{active ? 'Ativa' : 'Fora do período'}</span>
                    </div>
                    <div className="hint" style={{ marginTop: 4 }}>
                      {p.times.join(' · ')}
                      {(p.startDate || p.endDate) &&
                        ` — ${p.startDate ? formatDate(p.startDate) : 'desde já'} até ${p.endDate ? formatDate(p.endDate) : 'sem data de fim'}`}
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ marginTop: 8 }}
                      onClick={() => handleRemove(p.id)}
                    >
                      Remover
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
