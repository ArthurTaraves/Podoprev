import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listPatients } from '../firebase/patients';
import { latestVisitByPatient, listVisitsByProfessional, previousVisitByPatient } from '../firebase/visits';
import type { Visit } from '../types';
import { RiskBadge } from '../components/ui/RiskBadge';
import {
  computeActionStatus,
  needsAttentionToday,
  sortByPriority,
  type PatientActionStatus,
} from '../domain/actionQueue';
import { describePanelEvolution } from '../domain/evolution';

// Duas maiores pontuações do atendimento, como frase simples — a "explicação"
// de por que o paciente está em destaque no grupo 1.
function topFactorsSummary(visit: Visit): string {
  const top = [...visit.risk.breakdown].sort((a, b) => b.points - a.points).slice(0, 2);
  if (top.length === 0) return 'Múltiplos fatores de risco';
  return top.map((f) => f.label).join(' + ');
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR');
}

function Grupo1Card({
  status,
  previousVisit,
  onOpenRecord,
  onRegister,
}: {
  status: PatientActionStatus;
  previousVisit: Visit | null;
  onOpenRecord: () => void;
  onRegister: () => void;
}) {
  const { patient, latestVisit } = status;
  if (!latestVisit) return null;
  const evolutionText = previousVisit ? describePanelEvolution(latestVisit.risk.level, previousVisit.risk.level) : null;
  return (
    <div className="action-row action-row-grupo1">
      <div className="action-row-main">
        <div className="action-row-name">{patient.fullName}</div>
        <div className="action-row-meta">{topFactorsSummary(latestVisit)}</div>
        {evolutionText && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{evolutionText}</div>}
        {status.priority === 'atrasado' && (
          <div className="action-row-warning">• Retorno atrasado há {Math.abs(status.daysUntilReturn ?? 0)} dia{Math.abs(status.daysUntilReturn ?? 0) === 1 ? '' : 's'}</div>
        )}
      </div>
      <div className="action-row-side">
        <RiskBadge level={latestVisit.risk.level} />
        <div className="action-row-buttons">
          <button className="btn btn-primary btn-sm" onClick={onOpenRecord}>
            Ver prontuário
          </button>
          <button className="btn btn-outline btn-sm" onClick={onRegister}>
            Registrar retorno
          </button>
        </div>
      </div>
    </div>
  );
}

function Grupo2Card({
  status,
  previousVisit,
  onRegister,
  onHistory,
}: {
  status: PatientActionStatus;
  previousVisit: Visit | null;
  onRegister: () => void;
  onHistory: () => void;
}) {
  const { patient, latestVisit } = status;
  if (!latestVisit) return null;
  const days = status.daysUntilReturn ?? 0;
  const evolutionText = previousVisit ? describePanelEvolution(latestVisit.risk.level, previousVisit.risk.level) : null;
  return (
    <div className="action-row action-row-grupo2">
      <div className="action-row-main">
        <div className="action-row-name">{patient.fullName}</div>
        <div className="action-row-meta">{days === 0 ? 'Retorno é hoje' : `Retorno atrasado há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`}</div>
        <div className="hint">Último atendimento em {formatDate(latestVisit.date)}</div>
        {evolutionText && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{evolutionText}</div>}
      </div>
      <div className="action-row-side">
        <RiskBadge level={latestVisit.risk.level} />
        <div className="action-row-buttons">
          <button className="btn btn-primary btn-sm" onClick={onRegister}>
            Registrar atendimento
          </button>
          <button className="btn btn-outline btn-sm" onClick={onHistory}>
            Ver histórico de atendimentos
          </button>
        </div>
      </div>
    </div>
  );
}

function Grupo3Card({ status, onRegister }: { status: PatientActionStatus; onRegister: () => void }) {
  const { patient } = status;
  return (
    <div className="action-row action-row-grupo3">
      <div className="action-row-main">
        <div className="action-row-name">{patient.fullName}</div>
        <div className="action-row-meta">Ainda sem avaliação registrada</div>
        <div className="hint">Cadastrado em {formatDate(patient.createdAt)}</div>
      </div>
      <div className="action-row-side">
        <div className="action-row-buttons">
          <button className="btn btn-primary btn-sm" onClick={onRegister}>
            Realizar avaliação inicial
          </button>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<PatientActionStatus[]>([]);
  const [recentVisits, setRecentVisits] = useState<(Visit & { patientName: string })[]>([]);
  const [previousByPatient, setPreviousByPatient] = useState<Map<string, Visit>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load(user.uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load(uid: string) {
    setLoading(true);
    const [patients, visits] = await Promise.all([listPatients(uid), listVisitsByProfessional(uid)]);
    const latestByPatient = latestVisitByPatient(visits);
    setPreviousByPatient(previousVisitByPatient(visits));

    const computed = sortByPriority(patients.map((p) => computeActionStatus(p, latestByPatient.get(p.id) ?? null)));
    setStatuses(computed);

    const byId: Record<string, (typeof patients)[number]> = {};
    patients.forEach((p) => (byId[p.id] = p));
    setRecentVisits(visits.slice(0, 6).map((v) => ({ ...v, patientName: byId[v.patientId]?.fullName ?? 'Paciente' })));

    setLoading(false);
  }

  const attentionToday = statuses.filter(needsAttentionToday);
  const highAttention = statuses.filter((s) => s.priority === 'alto');
  const upToDate = statuses.filter((s) => s.priority === 'em_dia');

  const diabeticCount = statuses.filter((s) => s.latestVisit?.anamnesis.diabetes.hasDiabetes === 'sim').length;
  const lowCount = statuses.filter((s) => s.attentionLevel === 'baixo').length;
  const moderateCount = statuses.filter((s) => s.attentionLevel === 'moderado').length;
  const highCount = statuses.filter((s) => s.attentionLevel === 'alto').length;

  // Melhoria 1: os mesmos dados do painel (statuses), reorganizados em três grupos
  // visuais por motivo real de urgência — não é uma nova lógica de priorização,
  // só uma leitura diferente do que domain/actionQueue.ts já calcula.
  const grupo1 = statuses.filter((s) => s.attentionLevel === 'moderado' || s.attentionLevel === 'alto');
  const grupo2 = statuses.filter((s) => s.attentionLevel === 'baixo' && (s.priority === 'atrasado' || s.priority === 'hoje'));
  const grupo3 = statuses.filter((s) => s.priority === 'sem_atendimento');
  const totalGrupos = grupo1.length + grupo2.length + grupo3.length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Painel de ação</h1>
          <p>O que precisa da sua atenção agora — não apenas uma lista de cadastros.</p>
        </div>
      </div>

      <div className="quick-actions">
        <button className="btn btn-primary" onClick={() => navigate('/app/patients/new')}>
          + Cadastrar paciente
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/app/patients')}>
          Iniciar nova anamnese
        </button>
        <button className="btn btn-outline" onClick={() => navigate('/app/patients')}>
          Gerar relatórios
        </button>
      </div>

      {loading ? (
        <p>Carregando painel…</p>
      ) : (
        <>
          <div className="stat-strip">
            <div className="stat-pill">
              <strong>{statuses.length}</strong> pacientes
            </div>
            <div className="stat-pill stat-pill-urgent">
              <strong>{attentionToday.length}</strong> precisam de atenção hoje
            </div>
            <div className="stat-pill stat-pill-high">
              <strong>{highAttention.length}</strong> alto nível de atenção
            </div>
            <div className="stat-pill stat-pill-ok">
              <strong>{upToDate.length}</strong> em dia
            </div>
          </div>

          <section className="action-section action-section-hero">
            <h3>🔥 Precisa de atenção hoje</h3>
            {totalGrupos === 0 ? (
              <div className="empty-state">Todos os pacientes estão em dia.</div>
            ) : (
              <>
                {grupo1.length > 0 && (
                  <div className="action-group">
                    <h4 className="action-group-title action-group-title-red">🔴 Sinais relevantes identificados</h4>
                    <div className="action-list">
                      {grupo1.map((status) => (
                        <Grupo1Card
                          key={status.patient.id}
                          status={status}
                          previousVisit={previousByPatient.get(status.patient.id) ?? null}
                          onOpenRecord={() => navigate(`/app/patients/${status.patient.id}`)}
                          onRegister={() => navigate(`/app/patients/${status.patient.id}/visits/new`)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {grupo2.length > 0 && (
                  <div className="action-group">
                    <h4 className="action-group-title action-group-title-orange">🟠 Retorno em atraso</h4>
                    <div className="action-list">
                      {grupo2.map((status) => (
                        <Grupo2Card
                          key={status.patient.id}
                          status={status}
                          previousVisit={previousByPatient.get(status.patient.id) ?? null}
                          onRegister={() => navigate(`/app/patients/${status.patient.id}/visits/new`)}
                          onHistory={() => navigate(`/app/patients/${status.patient.id}`)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {grupo3.length > 0 && (
                  <div className="action-group">
                    <h4 className="action-group-title action-group-title-blue">🔵 Nunca avaliado</h4>
                    <div className="action-list">
                      {grupo3.map((status) => (
                        <Grupo3Card
                          key={status.patient.id}
                          status={status}
                          onRegister={() => navigate(`/app/patients/${status.patient.id}/visits/new`)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="action-section">
            <h3>Resumo geral</h3>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-value">{diabeticCount}</div>
                <div className="stat-label">Pacientes diabéticos</div>
                <div className="stat-sublabel">Requerem atenção redobrada</div>
              </div>
              <div className="stat-card risk-low">
                <div className="stat-value">{lowCount}</div>
                <div className="stat-label">Atenção baixa</div>
                <div className="stat-sublabel">Acompanhamento preventivo de rotina</div>
              </div>
              <div className="stat-card risk-moderate">
                <div className="stat-value">{moderateCount}</div>
                <div className="stat-label">Atenção média</div>
                <div className="stat-sublabel">Acompanhamento mais frequente</div>
              </div>
              <div className={`stat-card risk-high ${highCount > 0 ? 'stat-card-alert' : ''}`}>
                <div className="stat-value">{highCount}</div>
                <div className="stat-label">Atenção alta</div>
                <div className="stat-sublabel">Ação prioritária recomendada</div>
              </div>
            </div>
          </section>

          <div className="card">
            <h3>Atendimentos recentes</h3>
            {recentVisits.length === 0 ? (
              <div className="empty-state">Nenhum atendimento registrado ainda.</div>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Data</th>
                      <th>Queixa principal</th>
                      <th>Nível de atenção</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentVisits.map((v) => (
                      <tr key={v.id}>
                        <td>{v.patientName}</td>
                        <td>{new Date(v.date).toLocaleDateString('pt-BR')}</td>
                        <td>{v.anamnesis.mainComplaint || '—'}</td>
                        <td>
                          <RiskBadge level={v.risk.level} />
                        </td>
                        <td>
                          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/app/patients/${v.patientId}`)}>
                            Ver prontuário
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
