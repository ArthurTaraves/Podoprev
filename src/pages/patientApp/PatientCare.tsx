import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listVisitsByPatient } from '../../firebase/visits';
import { listSwitchHistoryByPatient } from '../../firebase/switchHistory';
import type { CareInstruction } from '../../types';

export function PatientCarePage() {
  const { patientAccount } = useAuth();
  const [instructions, setInstructions] = useState<CareInstruction[]>([]);
  const [visitDate, setVisitDate] = useState<number | null>(null);
  const [recentlySwitched, setRecentlySwitched] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientAccount) return;
    Promise.all([
      listVisitsByPatient(patientAccount.patientId, patientAccount.professionalId),
      listSwitchHistoryByPatient(patientAccount.patientId),
    ]).then(([visits, switches]) => {
      const latest = visits[0];
      setInstructions(latest?.careInstructions ?? []);
      setVisitDate(latest?.date ?? null);
      setRecentlySwitched(switches.length > 0);
      setLoading(false);
    });
  }, [patientAccount]);

  function toggle(id: string) {
    setDone((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) return <p>Carregando…</p>;

  return (
    <div>
      <h1 style={{ fontSize: 20 }}>Cuidados de hoje</h1>
      {visitDate && (
        <p className="hint" style={{ marginBottom: 16 }}>
          Orientações do atendimento de {new Date(visitDate).toLocaleDateString('pt-BR')}
        </p>
      )}

      {instructions.length === 0 ? (
        <div className="card empty-state">
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          {recentlySwitched ? 'Ainda não existem orientações de cuidado registradas com seu profissional atual.' : 'Nenhuma orientação registrada ainda.'}
          <p className="care-description" style={{ marginTop: 6, marginBottom: 0, fontSize: 13 }}>
            {recentlySwitched ? 'Consulte orientações de atendimentos anteriores na aba Histórico.' : 'Após sua consulta, as orientações do seu podólogo aparecerão aqui.'}
          </p>
          {recentlySwitched && (
            <Link to="/patient/history" className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>
              Ver meu histórico
            </Link>
          )}
        </div>
      ) : (
        instructions.map((instruction) => (
          <div key={instruction.id} className={`care-card ${done[instruction.id] ? 'done' : ''}`}>
            <div className="care-card-header">
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input type="checkbox" checked={!!done[instruction.id]} onChange={() => toggle(instruction.id)} style={{ marginTop: 3 }} />
                <strong>{instruction.title}</strong>
              </label>
              <span className="care-freq-pill">{instruction.timesPerDay}x ao dia</span>
            </div>
            <p className="care-description" style={{ marginTop: 8, marginBottom: 0, fontSize: 13.5 }}>{instruction.description}</p>
          </div>
        ))
      )}

      <p className="disclaimer">
        Esta é uma ferramenta de apoio à triagem podológica. Não substitui diagnóstico ou prescrição médica.
      </p>
    </div>
  );
}
