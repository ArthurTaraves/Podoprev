import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { useAuth } from '../../context/AuthContext';
import { getAvailability, saveAvailability } from '../../firebase/availability';
import { listConfirmedAppointmentsByProfessional } from '../../firebase/appointments';
import { getPatient } from '../../firebase/patients';
import { getProfessionalProfile, saveProfessionalProfile } from '../../firebase/professionalProfiles';
import { getProfessionalValidation } from '../../firebase/professionalValidations';
import { emptyAvailability, emptyProfessionalProfile, SPECIALTY_OPTIONS, WEEKDAY_LABELS, WEEKDAYS } from '../../domain/factories';
import { generateDaySlots, validateAvailability, validateScheduleBlock } from '../../domain/availability';
import type { Appointment, Availability, AvailabilityBlock, ProfessionalProfile, ProfessionalValidation, ScheduleBlock, Specialty, Weekday } from '../../types';

const DURATION_OPTIONS = [30, 45, 60, 90];

const VALIDATION_STATUS_LABEL: Record<ProfessionalValidation['status'], string> = {
  pendente: '🟡 Pendente',
  aprovado: '🟢 Aprovado',
  rejeitado: '🔴 Rejeitado',
};

export function AvailabilitySettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const [draftDate, setDraftDate] = useState('');
  const [draftStart, setDraftStart] = useState('08:00');
  const [draftEnd, setDraftEnd] = useState('09:00');
  const [draftAllDay, setDraftAllDay] = useState(false);
  const [draftReason, setDraftReason] = useState('');
  const [blockError, setBlockError] = useState('');
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [validation, setValidation] = useState<ProfessionalValidation | null>(null);
  const [validationLoading, setValidationLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getAvailability(user.uid).then((a) => {
      setAvailability(a ?? emptyAvailability(user.uid));
      setLoading(false);
    });
    listConfirmedAppointmentsByProfessional(user.uid).then(async (list) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
      setAppointments(sorted);
      const uniquePatientIds = Array.from(new Set(sorted.map((a) => a.patientId)));
      const entries = await Promise.all(
        uniquePatientIds.map(async (patientId) => [patientId, (await getPatient(patientId))?.fullName ?? 'Paciente'] as const),
      );
      setPatientNames(Object.fromEntries(entries));
    });
    getProfessionalProfile(user.uid).then((p) => {
      setProfile(p ?? emptyProfessionalProfile(user.uid));
    });
    getProfessionalValidation(user.uid).then((v) => {
      setValidation(v);
      setValidationLoading(false);
    });
  }, [user]);

  function toggleDay(day: Weekday, active: boolean) {
    if (!availability) return;
    setSaved(false);
    setAvailability({
      ...availability,
      schedule: { ...availability.schedule, [day]: active ? [{ start: '08:00', end: '12:00' }] : [] },
    });
  }

  function updateBlock(day: Weekday, index: number, patch: Partial<AvailabilityBlock>) {
    if (!availability) return;
    setSaved(false);
    const blocks = availability.schedule[day].map((b, i) => (i === index ? { ...b, ...patch } : b));
    setAvailability({ ...availability, schedule: { ...availability.schedule, [day]: blocks } });
  }

  function addBlock(day: Weekday) {
    if (!availability) return;
    setSaved(false);
    const blocks = [...availability.schedule[day], { start: '13:00', end: '18:00' }];
    setAvailability({ ...availability, schedule: { ...availability.schedule, [day]: blocks } });
  }

  function removeBlock(day: Weekday, index: number) {
    if (!availability) return;
    setSaved(false);
    const blocks = availability.schedule[day].filter((_, i) => i !== index);
    setAvailability({ ...availability, schedule: { ...availability.schedule, [day]: blocks } });
  }

  function setSlotDuration(minutes: number) {
    if (!availability) return;
    setSaved(false);
    setAvailability({ ...availability, slotDurationMinutes: minutes });
  }

  function addScheduleBlock() {
    if (!availability) return;
    const newBlock: ScheduleBlock = {
      id: uuid(),
      date: draftDate,
      startTime: draftAllDay ? '00:00' : draftStart,
      endTime: draftAllDay ? '23:59' : draftEnd,
      reason: draftReason.trim() || undefined,
    };
    const validationError = validateScheduleBlock(newBlock);
    if (validationError) {
      setBlockError(validationError);
      return;
    }
    setBlockError('');
    setSaved(false);
    setAvailability({ ...availability, blocks: [...availability.blocks, newBlock] });
    setDraftDate('');
    setDraftStart('08:00');
    setDraftEnd('09:00');
    setDraftAllDay(false);
    setDraftReason('');
  }

  function removeScheduleBlock(id: string) {
    if (!availability) return;
    setSaved(false);
    setAvailability({ ...availability, blocks: availability.blocks.filter((b) => b.id !== id) });
  }

  function updateProfile<K extends keyof ProfessionalProfile>(key: K, value: ProfessionalProfile[K]) {
    if (!profile) return;
    setProfileSaved(false);
    setProfile({ ...profile, [key]: value });
  }

  function toggleSpecialty(specialty: Specialty) {
    if (!profile) return;
    setProfileSaved(false);
    const has = profile.specialties.includes(specialty);
    setProfile({
      ...profile,
      specialties: has ? profile.specialties.filter((s) => s !== specialty) : [...profile.specialties, specialty],
    });
  }

  async function handleSaveProfile() {
    if (!user || !profile) return;
    setProfileSaving(true);
    try {
      await saveProfessionalProfile(user.uid, {
        displayName: profile.displayName,
        bio: profile.bio,
        city: profile.city,
        neighborhood: profile.neighborhood,
        profilePhotoUrl: profile.profilePhotoUrl,
        isPubliclyVisible: profile.isPubliclyVisible,
        averageRating: profile.averageRating,
        totalReviews: profile.totalReviews,
        specialties: profile.specialties,
      });
      setProfileSaved(true);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSave() {
    if (!user || !availability) return;
    setSaved(false);
    const validationError = validateAvailability(availability);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setSaving(true);
    try {
      await saveAvailability(user.uid, {
        slotDurationMinutes: availability.slotDurationMinutes,
        schedule: availability.schedule,
        blocks: availability.blocks,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !availability) return <p>Carregando…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Minha disponibilidade</h1>
          <p>Configure os dias e horários em que você atende. Isso ainda não é visível ao paciente nesta versão — é a base para o agendamento.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Próximos agendamentos</h3>
        {appointments.length === 0 ? (
          <div className="empty-state">Nenhum agendamento confirmado ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {appointments.map((appt) => (
              <div key={appt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{patientNames[appt.patientId] ?? 'Paciente'}</strong> — {new Date(appt.date + 'T00:00:00').toLocaleDateString('pt-BR')}, {appt.startTime} às {appt.endTime}
                </div>
                <span className="badge badge-low">Agendado pelo paciente</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="field">
          <label>Duração padrão da consulta</label>
          <select value={availability.slotDurationMinutes} onChange={(e) => setSlotDuration(Number(e.target.value))}>
            {DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutos
              </option>
            ))}
          </select>
        </div>
      </div>

      {WEEKDAYS.map((day) => {
        const blocks = availability.schedule[day];
        const active = blocks.length > 0;
        const preview = generateDaySlots(blocks, availability.slotDurationMinutes);
        return (
          <div key={day} className="card" style={{ marginBottom: 12 }}>
            <label className="checkbox-row" style={{ marginBottom: active ? 12 : 0 }}>
              <input type="checkbox" checked={active} onChange={(e) => toggleDay(day, e.target.checked)} />
              <strong>{WEEKDAY_LABELS[day]}</strong>
            </label>

            {active && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {blocks.map((block, index) => (
                  <div key={index} className="form-grid" style={{ alignItems: 'end' }}>
                    <div className="field">
                      <label>Início</label>
                      <input type="time" value={block.start} onChange={(e) => updateBlock(day, index, { start: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>Fim</label>
                      <input type="time" value={block.end} onChange={(e) => updateBlock(day, index, { end: e.target.value })} />
                    </div>
                    {blocks.length > 1 && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeBlock(day, index)}>
                        Remover
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => addBlock(day)}>
                  + Adicionar horário neste dia
                </button>

                {preview.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <span className="hint">Pré-visualização dos horários:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {preview.map((time) => (
                        <span key={time} className="badge badge-low">
                          {time}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Bloqueios de agenda</h3>
        <p className="hint" style={{ marginBottom: 12 }}>
          Exceções pontuais em datas específicas (ex.: reunião, consulta médica, férias) — a disponibilidade semanal continua sendo a configuração principal.
        </p>

        {availability.blocks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {availability.blocks.map((block) => (
              <div key={block.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{new Date(block.date + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>
                  {' — '}
                  {block.startTime === '00:00' && block.endTime === '23:59' ? 'Dia inteiro' : `${block.startTime} às ${block.endTime}`}
                  {block.reason && <span className="hint"> · {block.reason}</span>}
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeScheduleBlock(block.id)}>
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ background: 'var(--color-secondary-light)', border: 'none' }}>
          <h4>+ Novo bloqueio</h4>
          <div className="form-grid">
            <div className="field">
              <label>Data</label>
              <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
            </div>
          </div>
          <label className="checkbox-row" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={draftAllDay} onChange={(e) => setDraftAllDay(e.target.checked)} />
            Bloquear o dia inteiro
          </label>
          {!draftAllDay && (
            <div className="form-grid">
              <div className="field">
                <label>Horário inicial</label>
                <input type="time" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} />
              </div>
              <div className="field">
                <label>Horário final</label>
                <input type="time" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} />
              </div>
            </div>
          )}
          <div className="field">
            <label>Motivo (opcional)</label>
            <input type="text" value={draftReason} onChange={(e) => setDraftReason(e.target.value)} placeholder="Ex.: Compromisso pessoal" />
          </div>
          {blockError && <div className="error-text">{blockError}</div>}
          <button type="button" className="btn btn-secondary" onClick={addScheduleBlock}>
            + Novo bloqueio
          </button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="wizard-actions">
        {saved && <span className="hint">Disponibilidade atualizada com sucesso</span>}
        <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Salvando…' : 'Salvar disponibilidade'}
        </button>
      </div>

      {profile && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3 style={{ marginTop: 0 }}>Meu perfil público</h3>
          <div className="info-banner" style={{ marginBottom: 16 }}>
            Estas informações poderão ser visualizadas por pacientes.
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Nome de exibição</label>
              <input type="text" value={profile.displayName} onChange={(e) => updateProfile('displayName', e.target.value)} placeholder="Ex.: Dra. Ana Podóloga" />
            </div>
            <div className="field">
              <label>Foto (URL, opcional)</label>
              <input type="url" value={profile.profilePhotoUrl ?? ''} onChange={(e) => updateProfile('profilePhotoUrl', e.target.value)} placeholder="https://…" />
            </div>
          </div>

          <div className="field">
            <label>Descrição profissional</label>
            <textarea value={profile.bio} onChange={(e) => updateProfile('bio', e.target.value)} placeholder="Conte um pouco da sua experiência para os pacientes." />
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Cidade</label>
              <input type="text" value={profile.city} onChange={(e) => updateProfile('city', e.target.value)} />
            </div>
            <div className="field">
              <label>Bairro</label>
              <input type="text" value={profile.neighborhood} onChange={(e) => updateProfile('neighborhood', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Especialidades</label>
            <div className="form-grid">
              {SPECIALTY_OPTIONS.map((specialty) => (
                <label key={specialty} className="checkbox-row">
                  <input type="checkbox" checked={profile.specialties.includes(specialty)} onChange={() => toggleSpecialty(specialty)} />
                  {specialty}
                </label>
              ))}
            </div>
          </div>

          <label className="checkbox-row" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={profile.isPubliclyVisible} onChange={(e) => updateProfile('isPubliclyVisible', e.target.checked)} />
            Tornar meu perfil visível na busca de pacientes
          </label>

          <div className="wizard-actions">
            {profileSaved && <span className="hint">Perfil público atualizado com sucesso</span>}
            <button type="button" className="btn btn-primary" disabled={profileSaving} onClick={handleSaveProfile}>
              {profileSaving ? 'Salvando…' : 'Salvar perfil público'}
            </button>
          </div>
        </div>
      )}

      {!validationLoading && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3 style={{ marginTop: 0 }}>Validação Profissional</h3>
          {!validation ? (
            <>
              <p className="hint" style={{ marginBottom: 12 }}>Informações profissionais não cadastradas.</p>
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/app/professional-info')}>
                Preencher agora
              </button>
            </>
          ) : (
            <>
              <span className="badge badge-moderate" style={{ marginBottom: 12, display: 'inline-block' }}>
                {VALIDATION_STATUS_LABEL[validation.status]}
              </span>
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div>
                  <strong>Nome profissional exibido</strong>
                  <p style={{ margin: '2px 0 0' }}>{validation.displayName}</p>
                </div>
                <div>
                  <strong>Cidade/Estado</strong>
                  <p style={{ margin: '2px 0 0' }}>{validation.city}/{validation.state}</p>
                </div>
                <div>
                  <strong>Instituição de formação</strong>
                  <p style={{ margin: '2px 0 0' }}>{validation.institution}</p>
                </div>
                <div>
                  <strong>Ano de conclusão</strong>
                  <p style={{ margin: '2px 0 0' }}>{validation.graduationYear}</p>
                </div>
                <div>
                  <strong>Registro profissional</strong>
                  <p style={{ margin: '2px 0 0' }}>{validation.registrationNumber || '—'}</p>
                </div>
                <div>
                  <strong>Documento anexado</strong>
                  <p style={{ margin: '2px 0 0' }}>
                    {validation.certificateUrl ? (
                      <a href={validation.certificateUrl} target="_blank" rel="noreferrer">{validation.certificateFileName}</a>
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
              </div>
              <p className="hint" style={{ marginBottom: 12 }}>
                Seu cadastro profissional foi registrado e aguarda validação documental. Em uma versão futura, os
                documentos enviados poderão ser analisados por um administrador responsável pela validação profissional.
              </p>
              <button type="button" className="btn btn-outline" onClick={() => navigate('/app/professional-info')}>
                Editar informações
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
