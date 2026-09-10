import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getPatient } from '../../firebase/patients';
import { listVisitsByPatient } from '../../firebase/visits';
import { listAppointmentsByPatient } from '../../firebase/appointments';
import { listAllProfessionalIdsForPatient, listSwitchHistoryByPatient } from '../../firebase/switchHistory';
import { getPatientProfessionalLink, revokeHistoryAccess } from '../../firebase/patientProfessionalLinks';
import type { Appointment, Patient, SwitchHistoryEntry, Visit } from '../../types';
import { RiskBadge } from '../../components/ui/RiskBadge';
import { generateVisitReportPdf } from '../../lib/pdf';
import { AppointmentBooking } from './AppointmentBooking';

// Junta os resultados de várias consultas (uma por professionalId que o paciente
// já teve) e remove duplicatas por id — necessário porque, em modo demonstração,
// a consulta em memória ignora professionalId e devolveria a mesma lista completa
// a cada chamada; no Firestore real cada chamada já devolve um conjunto disjunto.
function mergeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return Array.from(map.values());
}

// Helpers puros de data/duração — só apresentação, nenhum dado clínico novo.
const MES_ABREV = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

function mesAno(ms: number): string {
  const d = new Date(ms);
  return `${MES_ABREV[d.getMonth()]} ${d.getFullYear()}`;
}

function mesesEntre(startMs: number, endMs: number): number {
  const s = new Date(startMs);
  const e = new Date(endMs);
  let m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() < s.getDate()) m -= 1;
  return Math.max(0, m);
}

function formatTempoAcompanhamento(meses: number): string {
  if (meses < 1) return 'menos de 1 mês de acompanhamento';
  if (meses === 1) return '1 mês de acompanhamento';
  if (meses < 12) return `${meses} meses de acompanhamento`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const anosLabel = anos === 1 ? '1 ano' : `${anos} anos`;
  if (resto === 0) return `${anosLabel} de acompanhamento`;
  const restoLabel = resto === 1 ? '1 mês' : `${resto} meses`;
  return `${anosLabel} e ${restoLabel} de acompanhamento`;
}

export function PatientHistoryPage() {
  const { patientAccount } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [switchHistory, setSwitchHistory] = useState<SwitchHistoryEntry[]>([]);
  const [currentLinkConsented, setCurrentLinkConsented] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    if (!patientAccount) return;
    load();
  }, [patientAccount]);

  async function load() {
    if (!patientAccount) return;
    const [p, professionalIds, history, currentLink] = await Promise.all([
      getPatient(patientAccount.patientId),
      listAllProfessionalIdsForPatient(patientAccount.patientId, patientAccount.professionalId),
      listSwitchHistoryByPatient(patientAccount.patientId),
      getPatientProfessionalLink(patientAccount.patientId, patientAccount.professionalId),
    ]);
    const [visitLists, appointmentLists] = await Promise.all([
      Promise.all(professionalIds.map((profId) => listVisitsByPatient(patientAccount.patientId, profId))),
      Promise.all(professionalIds.map((profId) => listAppointmentsByPatient(patientAccount.patientId, profId))),
    ]);
    setPatient(p);
    setVisits(mergeById(visitLists.flat()).sort((a, b) => b.date - a.date));
    setSwitchHistory(history);
    setCurrentLinkConsented(currentLink?.status === 'active' && currentLink.historyAccessConsented === true);
    setAppointments(
      mergeById(appointmentLists.flat())
        .filter((appt) => appt.status === 'confirmado')
        .sort((x, y) => x.date.localeCompare(y.date) || x.startTime.localeCompare(y.startTime)),
    );
    setLoading(false);
  }

  async function handleRevoke(newProfessionalId: string) {
    if (!patientAccount) return;
    setRevokingId(newProfessionalId);
    try {
      await revokeHistoryAccess(patientAccount.patientId, newProfessionalId);
      await load();
    } finally {
      setRevokingId(null);
    }
  }

  function handleBooked() {
    setShowBooking(false);
    load();
  }

  async function handleDownload(visit: Visit) {
    if (!patient) return;
    setGeneratingId(visit.id);
    try {
      await generateVisitReportPdf(patient, visit, []);
    } finally {
      setGeneratingId(null);
    }
  }

  if (loading) return <p>Carregando…</p>;

  // --- Melhoria 1: resumo da jornada (só com dados já carregados) ---
  const totalAtendimentos = visits.length;
  const professionaisEnvolvidos = new Set<string>();
  for (const v of visits) professionaisEnvolvidos.add(v.professionalId);
  for (const s of switchHistory) {
    professionaisEnvolvidos.add(s.previousProfessionalId);
    professionaisEnvolvidos.add(s.newProfessionalId);
  }
  if (patientAccount?.professionalId) professionaisEnvolvidos.add(patientAccount.professionalId);
  const totalProfissionais = professionaisEnvolvidos.size;
  // visits está ordenado por data desc
  const ultimoAtendimentoMs = totalAtendimentos > 0 ? visits[0].date : null;
  const primeiroAtendimentoMs = totalAtendimentos > 0 ? visits[totalAtendimentos - 1].date : null;
  const mesesAcompanhamento =
    totalAtendimentos >= 2 && primeiroAtendimentoMs !== null && ultimoAtendimentoMs !== null
      ? mesesEntre(primeiroAtendimentoMs, ultimoAtendimentoMs)
      : null;

  // --- Melhoria 2: trajetória de profissionais em ordem cronológica ---
  const trajetoria = [...switchHistory].sort((a, b) => a.switchedAt - b.switchedAt);

  return (
    <div>
      <h1 style={{ fontSize: 20 }}>Meus atendimentos</h1>

      <div className="info-banner" style={{ marginBottom: 20 }}>
        <div>
          <strong>Seu histórico é seu.</strong>
          <p style={{ margin: '4px 0 0' }}>Todos os seus atendimentos permanecem disponíveis mesmo que você troque de profissional.</p>
        </div>
      </div>

      {totalAtendimentos > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Sua Jornada</h3>
          <p style={{ margin: 0 }}>
            <strong>{totalAtendimentos}</strong> {totalAtendimentos === 1 ? 'atendimento registrado' : 'atendimentos'}
          </p>
          <p style={{ margin: '2px 0 0' }}>
            <strong>{totalProfissionais}</strong> {totalProfissionais === 1 ? 'profissional' : 'profissionais'}
          </p>
          {mesesAcompanhamento !== null && (
            <p style={{ margin: '10px 0 0' }}>{formatTempoAcompanhamento(mesesAcompanhamento)}</p>
          )}
          {totalAtendimentos >= 2 && primeiroAtendimentoMs !== null && ultimoAtendimentoMs !== null && (
            <p className="hint" style={{ margin: '10px 0 0' }}>
              Primeiro: {new Date(primeiroAtendimentoMs).toLocaleDateString('pt-BR')}
              <br />
              Último: {new Date(ultimoAtendimentoMs).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      )}

      <h3 style={{ marginTop: 0 }}>Consultas</h3>
      {showBooking ? (
        <div style={{ marginBottom: 20 }}>
          <AppointmentBooking onClose={() => setShowBooking(false)} onBooked={handleBooked} />
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          {appointments.length === 0 ? (
            <div className="card empty-state">Nenhuma consulta agendada ainda.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {appointments.map((appt) => (
                <div key={appt.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <strong>{new Date(appt.date + 'T00:00:00').toLocaleDateString('pt-BR')}</strong> — {appt.startTime} às {appt.endTime}
                  </div>
                  <span className="badge badge-low">Agendado pelo paciente</span>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-primary" onClick={() => setShowBooking(true)}>
            + Agendar consulta
          </button>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 8 }}>Histórico de profissionais</h3>
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          A troca de profissional não apaga seus registros. Você controla o compartilhamento do seu histórico e pode
          revogar autorizações a qualquer momento.
        </p>
        {switchHistory.length === 0 ? (
          <div className="card empty-state">
            Você ainda não trocou de profissional.
            <p className="hint" style={{ marginTop: 6, marginBottom: 0 }}>Quando uma troca acontecer, ela aparecerá aqui.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* nó inicial: primeiro profissional da trajetória */}
            <div className="card">
              <strong>● {trajetoria[0].previousProfessionalName}</strong>
              <p className="hint" style={{ margin: '2px 0 0' }}>
                {patient?.createdAt
                  ? `${mesAno(patient.createdAt)} → ${mesAno(trajetoria[0].switchedAt)}`
                  : `até ${mesAno(trajetoria[0].switchedAt)}`}
              </p>
            </div>

            {trajetoria.map((entry, i) => {
              const isLast = i === trajetoria.length - 1;
              const isCurrentRelationship = entry.newProfessionalId === patientAccount?.professionalId;
              // O badge reflete o estado ATUAL do compartilhamento (revogável a
              // qualquer momento), não só o que foi decidido no instante da troca —
              // entry.historyShared é o registro histórico imutável desse evento.
              const currentlyShared = isCurrentRelationship ? currentLinkConsented : entry.historyShared;
              const fim = isLast ? 'Atual' : mesAno(trajetoria[i + 1].switchedAt);
              return (
                <div key={entry.id}>
                  <p className="hint" style={{ margin: '4px 0', textAlign: 'center' }}>↓ troca</p>
                  <div className="card">
                    <strong>● {entry.newProfessionalName}{isCurrentRelationship ? ' (Atual)' : ''}</strong>
                    <p className="hint" style={{ margin: '2px 0 8px' }}>{mesAno(entry.switchedAt)} → {fim}</p>
                    <span className={`badge ${currentlyShared ? 'badge-low' : 'badge-moderate'}`}>
                      {currentlyShared ? 'Histórico compartilhado ✓' : entry.historyShared ? 'Compartilhamento revogado' : 'Histórico não compartilhado'}
                    </span>
                    {isCurrentRelationship && currentLinkConsented && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ marginTop: 10 }}
                        disabled={revokingId === entry.newProfessionalId}
                        onClick={() => handleRevoke(entry.newProfessionalId)}
                      >
                        {revokingId === entry.newProfessionalId ? 'Revogando…' : 'Revogar compartilhamento'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <h3>Atendimentos</h3>
      {visits.length === 0 ? (
        <div className="card empty-state">
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          Nenhum atendimento registrado ainda. Após sua primeira consulta, o histórico aparecerá aqui.
        </div>
      ) : (
        <div className="timeline">
          {visits.map((visit) => {
            const expanded = expandedId === visit.id;
            return (
              <div key={visit.id} className="timeline-item card" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : visit.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <strong>{new Date(visit.date).toLocaleDateString('pt-BR')}</strong>
                  <RiskBadge level={visit.risk.level} />
                </div>
                <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>
                  Profissional responsável: {visit.professionalName}
                </p>
                <p style={{ marginTop: 8 }}>
                  <strong>Pontuação:</strong> {visit.risk.score} pontos
                </p>
                <p>
                  <strong>Queixa principal:</strong> {visit.anamnesis.mainComplaint || 'Não informada'}
                </p>
                <p>
                  <strong>Retorno sugerido:</strong> {new Date(visit.returnDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>

                {expanded && (
                  <div style={{ marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                    <p>
                      <strong>Resumo:</strong> {visit.risk.message}
                    </p>
                    {visit.careInstructions.length > 0 && (
                      <p>
                        <strong>Orientações:</strong> {visit.careInstructions.map((c) => c.title).join(', ')}
                      </p>
                    )}
                    {visit.conduct && (
                      <p>
                        <strong>Observações do podólogo:</strong> {visit.conduct}
                      </p>
                    )}
                    <button className="btn btn-outline btn-sm" disabled={generatingId === visit.id} onClick={() => handleDownload(visit)}>
                      {generatingId === visit.id ? 'Gerando…' : 'Baixar relatório PDF'}
                    </button>
                  </div>
                )}

                <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>{expanded ? 'Toque para recolher ▲' : 'Toque para ver detalhes ▼'}</p>
              </div>
            );
          })}
        </div>
      )}

      <p className="disclaimer">
        Esta é uma ferramenta de apoio à triagem podológica. Não substitui diagnóstico ou prescrição médica.
      </p>
    </div>
  );
}
