import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listPatients } from '../../firebase/patients';
import { latestVisitByPatient, listVisitsByProfessional, previousVisitByPatient } from '../../firebase/visits';
import { listPendingPreAnamnesisByProfessional } from '../../firebase/preAnamnesis';
import { getPatientProfessionalLink } from '../../firebase/patientProfessionalLinks';
import { calculateAge } from '../../domain/riskScore';
import { computeActionStatus, sortByPriority, type PatientActionStatus } from '../../domain/actionQueue';
import { describeAttentionEvolution } from '../../domain/evolution';
import { RiskBadge } from '../../components/ui/RiskBadge';

// Indicador de descobribilidade (Onda 5): sinaliza, direto na lista, quais
// pacientes têm um vínculo vindo de troca — com ou sem compartilhamento
// autorizado — sem precisar abrir o prontuário pra descobrir. Puramente visual,
// não influencia nenhuma regra de acesso (essa continua só nas regras do Firestore).
type SwitchBadge = 'compartilhado' | 'nao_autorizado' | null;

export function PatientListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<PatientActionStatus[]>([]);
  const [pendingPreAnamnesisIds, setPendingPreAnamnesisIds] = useState<Set<string>>(new Set());
  const [switchBadges, setSwitchBadges] = useState<Record<string, SwitchBadge>>({});
  const [positiveEvolutionIds, setPositiveEvolutionIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([listPatients(user.uid), listVisitsByProfessional(user.uid), listPendingPreAnamnesisByProfessional(user.uid)])
      .then(async ([patients, visits, pendingPreAnamnesis]) => {
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

  const filtered = statuses.filter(
    (s) => s.patient.fullName.toLowerCase().includes(search.toLowerCase()) || s.patient.cpf.includes(search),
  );

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

      <div className="search-bar">
        <input placeholder="Buscar por nome ou CPF…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card">
        {loading ? (
          <p>Carregando…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {statuses.length === 0 ? 'Nenhum paciente cadastrado ainda.' : 'Nenhum paciente encontrado para essa busca.'}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Idade</th>
                  <th>Telefone</th>
                  <th>Nível de atenção</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.patient.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/app/patients/${s.patient.id}`)}>
                    <td>
                      {s.patient.fullName}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
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
                    </td>
                    <td>{calculateAge(s.patient.birthDate)} anos</td>
                    <td>{s.patient.phone}</td>
                    <td>
                      {s.latestVisit ? <RiskBadge level={s.latestVisit.risk.level} /> : <span className="badge badge-moderate">Aguardando primeira avaliação</span>}
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/app/patients/${s.patient.id}`);
                        }}
                      >
                        Ver prontuário completo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
