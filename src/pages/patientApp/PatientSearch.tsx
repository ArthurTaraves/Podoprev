import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getProfessionalProfile, listPublicProfessionalProfiles } from '../../firebase/professionalProfiles';
import { getAvailability } from '../../firebase/availability';
import { getPreAnamnesisForPatient } from '../../firebase/preAnamnesis';
import { switchProfessional } from '../../firebase/professionalSwitch';
import { getPatient } from '../../firebase/patients';
import { hasActiveAvailability, summarizeAvailability } from '../../domain/availability';
import { SPECIALTY_OPTIONS, WEEKDAY_LABELS, WEEKDAYS } from '../../domain/factories';
import type { Availability, ProfessionalProfile, Specialty } from '../../types';

type FilterOption = 'todos' | 'disponivel' | Specialty;
type SortOption = 'nome' | 'avaliacao';

// Passo 1: confirmação da troca. Passo 2: autorização LGPD de compartilhamento de
// histórico. Passo 3: execução (switchProfessional) + mensagem final. Ver validação
// arquitetural desta onda — "consent" sempre precede a escrita real.
type SwitchStep = 'confirm' | 'consent' | 'done';

const FILTER_LABELS: Record<FilterOption, string> = {
  todos: 'Todos',
  disponivel: 'Disponível',
  Diabetes: 'Diabetes',
  Onicomicose: 'Onicomicose',
  Joanete: 'Joanete',
  Calosidade: 'Calosidade',
};
const FILTER_OPTIONS: FilterOption[] = ['todos', 'disponivel', ...SPECIALTY_OPTIONS];

const CONSENT_TERM_TEXT =
  'Autorizo o compartilhamento do meu histórico podológico com o profissional selecionado para fins de continuidade do acompanhamento.';

export function PatientSearchPage() {
  const { patientAccount, refreshPatientAccount } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ProfessionalProfile[]>([]);
  const [availabilityByProfessional, setAvailabilityByProfessional] = useState<Record<string, Availability | null>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterOption>('todos');
  const [sort, setSort] = useState<SortOption>('nome');
  const [selected, setSelected] = useState<ProfessionalProfile | null>(null);
  const [showAvailabilityDetail, setShowAvailabilityDetail] = useState(false);

  // Fluxo de troca
  const [switching, setSwitching] = useState(false);
  const [switchStep, setSwitchStep] = useState<SwitchStep | null>(null);
  const [currentProfessionalName, setCurrentProfessionalName] = useState('');
  const [pendingPreAnamnesis, setPendingPreAnamnesis] = useState(false);
  const [consentName, setConsentName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [switchError, setSwitchError] = useState('');
  const [switchResult, setSwitchResult] = useState<{ shared: boolean } | null>(null);

  useEffect(() => {
    listPublicProfessionalProfiles().then(async (list) => {
      setProfiles(list);
      const entries = await Promise.all(
        list.map(async (p) => [p.professionalId, await getAvailability(p.professionalId)] as const),
      );
      setAvailabilityByProfessional(Object.fromEntries(entries));
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let result = profiles;
    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (p) => p.displayName.toLowerCase().includes(query) || p.city.toLowerCase().includes(query) || p.neighborhood.toLowerCase().includes(query),
      );
    }
    if (filter === 'disponivel') {
      result = result.filter((p) => hasActiveAvailability(availabilityByProfessional[p.professionalId] ?? null));
    } else if (filter !== 'todos') {
      result = result.filter((p) => p.specialties.includes(filter));
    }
    return [...result].sort((a, b) => (sort === 'nome' ? a.displayName.localeCompare(b.displayName) : b.averageRating - a.averageRating));
  }, [profiles, availabilityByProfessional, search, filter, sort]);

  function openProfile(profile: ProfessionalProfile) {
    setSelected(profile);
    setShowAvailabilityDetail(false);
    resetSwitchFlow();
  }

  function backToList() {
    setSelected(null);
    resetSwitchFlow();
  }

  function resetSwitchFlow() {
    setSwitchStep(null);
    setConsentName('');
    setSwitchError('');
    setSwitchResult(null);
  }

  // Já era o único profissional do paciente desde o cadastro (convite sempre traz
  // um professionalId) — "escolher" um profissional diferente é sempre uma troca.
  // Escolher o profissional que já é o atual não abre o fluxo (não faz sentido).
  async function handleChooseProfessional(profile: ProfessionalProfile) {
    if (!patientAccount || profile.professionalId === patientAccount.professionalId) return;
    setSwitching(true);
    const [currentProfile, pending] = await Promise.all([
      getProfessionalProfile(patientAccount.professionalId),
      getPreAnamnesisForPatient(patientAccount.patientId, patientAccount.professionalId),
    ]);
    setCurrentProfessionalName(currentProfile?.displayName || 'seu profissional atual');
    setPendingPreAnamnesis(pending?.status === 'aguardando_validacao');
    setSwitchStep('confirm');
    setSwitching(false);
  }

  async function executeSwitch(historyAccessConsented: boolean) {
    if (!patientAccount || !selected || !consentName.trim()) return;
    setProcessing(true);
    setSwitchError('');
    try {
      const patient = await getPatient(patientAccount.patientId);
      await switchProfessional({
        patientId: patientAccount.patientId,
        patientUid: patientAccount.uid,
        currentProfessionalId: patientAccount.professionalId,
        currentProfessionalName,
        newProfessionalId: selected.professionalId,
        newProfessionalName: selected.displayName,
        historyAccessConsented,
        consentTerm: CONSENT_TERM_TEXT,
        patientCreatedAt: patient?.createdAt ?? Date.now(),
      });
      await refreshPatientAccount();
      setSwitchResult({ shared: historyAccessConsented });
      setSwitchStep('done');
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : 'Não foi possível concluir a troca. Tente novamente.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) return <p>Carregando…</p>;

  if (selected) {
    const availability = availabilityByProfessional[selected.professionalId] ?? null;
    const isCurrentProfessional = selected.professionalId === patientAccount?.professionalId;

    return (
      <div>
        <button type="button" className="btn btn-outline btn-sm" style={{ marginBottom: 16 }} onClick={backToList}>
          ← Voltar
        </button>

        <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 48 }}>{selected.profilePhotoUrl ? <img src={selected.profilePhotoUrl} alt={selected.displayName} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} /> : '🩺'}</div>
          <h2 style={{ marginBottom: 4 }}>{selected.displayName}</h2>
          <p className="hint" style={{ marginBottom: 8 }}>
            {selected.city}{selected.neighborhood ? ` · ${selected.neighborhood}` : ''}
          </p>
          <p style={{ marginBottom: 8 }}>
            ⭐ {selected.averageRating.toFixed(1)} <span className="hint">({selected.totalReviews} avaliações)</span>
          </p>
          {selected.specialties.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
              {selected.specialties.map((s) => (
                <span key={s} className="badge badge-low">{s}</span>
              ))}
            </div>
          )}
          {selected.bio && <p style={{ marginTop: 8 }}>{selected.bio}</p>}
          <p className="hint" style={{ marginTop: 8 }}>{summarizeAvailability(availability)}</p>
        </div>

        {showAvailabilityDetail && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginTop: 0 }}>Disponibilidade</h4>
            {availability && hasActiveAvailability(availability) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {WEEKDAYS.filter((day) => availability.schedule[day].length > 0).map((day) => (
                  <div key={day}>
                    <strong>{WEEKDAY_LABELS[day]}:</strong>{' '}
                    {availability.schedule[day].map((b) => `${b.start}–${b.end}`).join(', ')}
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint" style={{ marginBottom: 0 }}>Disponibilidade não configurada.</p>
            )}
          </div>
        )}

        {switchStep === 'done' ? (
          <div className="card">
            <p style={{ marginBottom: 4 }}>
              Você agora está vinculado a <strong>{selected.displayName}</strong>.
            </p>
            <p className="hint" style={{ marginBottom: 16 }}>
              {switchResult?.shared
                ? 'Seu histórico anterior foi compartilhado com o novo profissional, conforme sua autorização.'
                : 'Seu histórico anterior não foi compartilhado. Ele continua disponível para você a qualquer momento.'}
            </p>
            <p className="hint" style={{ marginBottom: 16 }}>Seu histórico acompanha você — a troca de profissional não apaga seus registros.</p>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/patient/history')}>
              Ver meu histórico
            </button>
          </div>
        ) : isCurrentProfessional ? (
          <div className="card">
            <p className="hint" style={{ marginBottom: 0 }}>Este já é o seu profissional atual.</p>
          </div>
        ) : switchStep === null ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" className="btn btn-primary" disabled={switching} onClick={() => handleChooseProfessional(selected)}>
              {switching ? 'Carregando…' : 'Escolher este profissional'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setShowAvailabilityDetail((v) => !v)}>
              {showAvailabilityDetail ? 'Ocultar disponibilidade' : 'Ver disponibilidade'}
            </button>
          </div>
        ) : switchStep === 'confirm' ? (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Trocar de profissional</h3>
            <p style={{ marginBottom: 4 }}>
              De <strong>{currentProfessionalName}</strong> para <strong>{selected.displayName}</strong>.
            </p>
            <p className="hint" style={{ marginBottom: 16 }}>Seu histórico permanecerá disponível independentemente da troca.</p>
            {pendingPreAnamnesis && (
              <div className="info-banner" style={{ marginBottom: 16 }}>
                Você tem uma pré-anamnese pendente de validação com seu profissional atual. Ela não será transferida
                automaticamente para o novo profissional — se quiser, você pode preenchê-la novamente após a troca.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-primary" onClick={() => setSwitchStep('consent')}>
                Continuar
              </button>
              <button type="button" className="btn btn-outline" onClick={resetSwitchFlow}>
                Cancelar
              </button>
            </div>
          </div>
        ) : switchStep === 'consent' ? (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Autorização de compartilhamento de histórico</h3>
            <p style={{ marginBottom: 16 }}>{CONSENT_TERM_TEXT}</p>
            <div className="field">
              <label>Nome completo (confirmação)</label>
              <input type="text" value={consentName} onChange={(e) => setConsentName(e.target.value)} placeholder={patientAccount?.name} />
            </div>
            <p className="hint" style={{ marginBottom: 16 }}>Data: {new Date().toLocaleDateString('pt-BR')}</p>
            {switchError && <div className="error-text" style={{ marginBottom: 12 }}>{switchError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button type="button" className="btn btn-primary" disabled={!consentName.trim() || processing} onClick={() => executeSwitch(true)}>
                {processing ? 'Processando…' : 'Compartilhar histórico'}
              </button>
              <button type="button" className="btn btn-secondary" disabled={!consentName.trim() || processing} onClick={() => executeSwitch(false)}>
                {processing ? 'Processando…' : 'Não compartilhar histórico'}
              </button>
              <button type="button" className="btn btn-outline" disabled={processing} onClick={() => setSwitchStep('confirm')}>
                Voltar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 20 }}>Buscar profissional</h1>

      <div className="field">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, cidade ou bairro" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={`btn btn-sm ${filter === option ? 'btn-secondary' : 'btn-outline'}`}
            onClick={() => setFilter(option)}
          >
            {FILTER_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="field" style={{ maxWidth: 220 }}>
        <label>Ordenar por</label>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
          <option value="nome">Nome</option>
          <option value="avaliacao">Melhor avaliado</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card empty-state">Nenhum profissional encontrado.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((profile) => {
            const available = hasActiveAvailability(availabilityByProfessional[profile.professionalId] ?? null);
            const isCurrent = profile.professionalId === patientAccount?.professionalId;
            return (
              <div key={profile.professionalId} className="card" style={{ cursor: 'pointer' }} onClick={() => openProfile(profile)}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 32 }}>
                    {profile.profilePhotoUrl ? (
                      <img src={profile.profilePhotoUrl} alt={profile.displayName} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      '🩺'
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <strong>{profile.displayName}</strong>
                      {isCurrent ? <span className="badge badge-low">Seu profissional atual</span> : available && <span className="badge badge-low">Disponível</span>}
                    </div>
                    <p className="hint" style={{ margin: '4px 0' }}>
                      {profile.city}{profile.neighborhood ? ` · ${profile.neighborhood}` : ''}
                    </p>
                    {profile.specialties.length > 0 && (
                      <p className="hint" style={{ margin: '4px 0' }}>{profile.specialties.join(', ')}</p>
                    )}
                    <p style={{ margin: 0 }}>
                      ⭐ {profile.averageRating.toFixed(1)} <span className="hint">({profile.totalReviews} avaliações)</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
