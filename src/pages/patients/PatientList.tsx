import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listPatients } from '../../firebase/patients';
import { latestVisitByPatient, listVisitsByProfessional, previousVisitByPatient } from '../../firebase/visits';
import { listPendingPreAnamnesisByProfessional } from '../../firebase/preAnamnesis';
import { getPatientProfessionalLink } from '../../firebase/patientProfessionalLinks';
import { calculateAge } from '../../domain/riskScore';
import { computeActionStatus, sortByPriority, type PatientActionStatus } from '../../domain/actionQueue';
import { describeAttentionEvolution } from '../../domain/evolution';
import { RiskBadge } from '../../components/ui/RiskBadge';
import { listConfirmedAppointmentsByProfessional } from '../../firebase/appointments';
import {
  ATTENTION_FILTER_OPTIONS,
  SITUATION_FILTER_OPTIONS,
  matchesAttention,
  matchesSearch,
  matchesSituation,
  parseFilter,
  type AttentionFilter,
  type SituationFilter,
} from '../../domain/patientFilters';
import { todayIso } from '../../lib/dates';

// Indicador de descobribilidade (Onda 5): sinaliza, direto na lista, quais
// pacientes têm um vínculo vindo de troca — com ou sem compartilhamento
// autorizado — sem precisar abrir o prontuário pra descobrir. Puramente visual,
// não influencia nenhuma regra de acesso (essa continua só nas regras do Firestore).
type SwitchBadge = 'compartilhado' | 'nao_autorizado' | null;

export function PatientListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // ?nivel= e ?situacao= abrem a lista já filtrada (ex.: cards de resumo do Painel).
  const [searchParams] = useSearchParams();
  const [statuses, setStatuses] = useState<PatientActionStatus[]>([]);
  const [pendingPreAnamnesisIds, setPendingPreAnamnesisIds] = useState<Set<string>>(new Set());
  const [switchBadges, setSwitchBadges] = useState<Record<string, SwitchBadge>>({});
  const [positiveEvolutionIds, setPositiveEvolutionIds] = useState<Set<string>>(new Set());
  const [upcomingAppointmentIds, setUpcomingAppointmentIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>(() =>
    parseFilter(searchParams.get('nivel'), ATTENTION_FILTER_OPTIONS, 'todos'),
  );
  const [situationFilter, setSituationFilter] = useState<SituationFilter>(() =>
    parseFilter(searchParams.get('situacao'), SITUATION_FILTER_OPTIONS, 'todos'),
  );
  const [loading, setLoading] = useState(true);

  // Mesma tela, URL diferente (ex.: card do Painel → aba "Pacientes" sem filtro):
  // o componente não é recriado, então os filtros acompanham a URL aqui.
  useEffect(() => {
    setAttentionFilter(parseFilter(searchParams.get('nivel'), ATTENTION_FILTER_OPTIONS, 'todos'));
    setSituationFilter(parseFilter(searchParams.get('situacao'), SITUATION_FILTER_OPTIONS, 'todos'));
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      listPatients(user.uid),
      listVisitsByProfessional(user.uid),
      listPendingPreAnamnesisByProfessional(user.uid),
      listConfirmedAppointmentsByProfessional(user.uid),
    ])
      .then(async ([patients, visits, pendingPreAnamnesis, appointments]) => {
        const today = todayIso();
        setUpcomingAppointmentIds(new Set(appointments.filter((a) => a.date >= today).map((a) => a.patientId)));
        const latestByPatient = latestVisitByPatient(visits);
        const previousByPatient = previousVisitByPatient(visits);
        setStatuses(sortByPriority(patients.map((p) => computeActionStatus(p, latestByPatient.get(p.id) ?? null))));
        setPendingPreAnamnesisIds(new Set(pendingPreAnamnesis.map((p) => p.patientId)));

        const positive = new Set<string>();
        for (const p of patients) {
          const latest = latestByPatient.get(p.id);
          const previous = previousByPatient.get(p.id);
          if (latest && describeAttentionEvolution(latest.risk.level, previous?.risk.level ?? null).trend === 'melhora') {
            positive.add(p.id);
          }
        }
        setPositiveEvolutionIds(positive);

        const links = await Promise.all(patients.map((p) => getPatientProfessionalLink(p.id, user.uid)));
        const badges: Record<string, SwitchBadge> = {};
        links.forEach((link, i) => {
          if (!link?.previousProfessionalId) return;
          badges[patients[i].id] = link.historyAccessConsented ? 'compartilhado' : 'nao_autorizado';
        });
        setSwitchBadges(badges);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const today = todayIso();
  const filtered = statuses.filter(
    (s) =>
      matchesSearch(s, search) &&
      matchesAttention(s, attentionFilter) &&
      matchesSituation(s, situationFilter, upcomingAppointmentIds, today),
  );
  const hasActiveFilter = search.trim() !== '' || attentionFilter !== 'todos' || situationFilter !== 'todos';

  function clearFilters() {
    setSearch('');
    setAttentionFilter('todos');
    setSituationFilter('todos');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pacientes</h1>
          <p>Ordenados por prioridade de atenção — quem precisa de ação aparece primeiro.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/app/patients/new')}>
          + Cadastrar paciente
        </button>
      </div>

      <div className="filter-group">
        <div className="filter-group-label">Nível de atenção</div>
        <div className="filter-chips" role="group" aria-label="Filtrar por nível de atenção">
          {ATTENTION_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`filter-chip ${attentionFilter === option.value ? 'selected' : ''}`}
              aria-pressed={attentionFilter === option.value}
              onClick={() => setAttentionFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-group" style={{ marginBottom: 14 }}>
        <div className="filter-group-label">Situação</div>
        <div className="filter-chips" role="group" aria-label="Filtrar por situação">
          {SITUATION_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`filter-chip ${situationFilter === option.value ? 'selected' : ''}`}
              aria-pressed={situationFilter === option.value}
              onClick={() => setSituationFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="search-bar">
        <input placeholder="Buscar por nome ou CPF…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {!loading && statuses.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
          <span>
            {filtered.length} de {statuses.length} pacientes
          </span>
          {hasActiveFilter && (
            <button type="button" className="btn-link" onClick={clearFilters}>
              Limpar filtros
            </button>
          )}
        </div>
      )}

      <div className="card">
        {loading ? (
          <p>Carregando…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {statuses.length === 0 ? 'Nenhum paciente cadastrado ainda.' : 'Nenhum paciente encontrado com esses filtros.'}
          </div>
        ) : (
          <div role="list">
            {filtered.map((s, index) => (
              <div
                key={s.patient.id}
                role="listitem"
                tabIndex={0}
                style={{
                  cursor: 'pointer',
                  padding: '12px 0',
                  borderBottom: index < filtered.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
                onClick={() => navigate(`/app/patients/${s.patient.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/app/patients/${s.patient.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong>{s.patient.fullName}</strong>
                  <span aria-hidden="true" style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>
                    ›
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {calculateAge(s.patient.birthDate)} anos · {s.patient.phone}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {s.latestVisit ? <RiskBadge level={s.latestVisit.risk.level} /> : <span className="badge badge-moderate">Aguardando primeira avaliação</span>}
                  {pendingPreAnamnesisIds.has(s.patient.id) && (
                    <span className="badge badge-moderate" style={{ fontSize: 11 }}>
                      🕓 Anamnese pendente
                    </span>
                  )}
                  {switchBadges[s.patient.id] === 'compartilhado' && (
                    <span className="badge badge-low" style={{ fontSize: 11 }}>
                      🔗 Histórico compartilhado
                    </span>
                  )}
                  {switchBadges[s.patient.id] === 'nao_autorizado' && (
                    <span className="badge badge-high" style={{ fontSize: 11 }}>
                      🔒 Compartilhamento não autorizado
                    </span>
                  )}
                  {positiveEvolutionIds.has(s.patient.id) && (
                    <span className="badge badge-low" style={{ fontSize: 11 }}>
                      ↓ Evolução positiva
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
