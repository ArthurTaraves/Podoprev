import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listPatients } from '../../firebase/patients';
import { latestVisitByPatient, listVisitsByProfessional } from '../../firebase/visits';
import { listPendingPreAnamnesisByProfessional } from '../../firebase/preAnamnesis';
import { calculateAge } from '../../domain/riskScore';
import { computeActionStatus, sortByPriority, type PatientActionStatus } from '../../domain/actionQueue';
import { RiskBadge } from '../../components/ui/RiskBadge';

export function PatientListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<PatientActionStatus[]>([]);
  const [pendingPreAnamnesisIds, setPendingPreAnamnesisIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([listPatients(user.uid), listVisitsByProfessional(user.uid), listPendingPreAnamnesisByProfessional(user.uid)])
      .then(([patients, visits, pendingPreAnamnesis]) => {
        const latestByPatient = latestVisitByPatient(visits);
        setStatuses(sortByPriority(patients.map((p) => computeActionStatus(p, latestByPatient.get(p.id) ?? null))));
        setPendingPreAnamnesisIds(new Set(pendingPreAnamnesis.map((p) => p.patientId)));
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
                      {pendingPreAnamnesisIds.has(s.patient.id) && (
                        <div>
                          <span className="badge badge-moderate" style={{ fontSize: 11 }}>
                            🕓 Anamnese pendente
                          </span>
                        </div>
                      )}
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
