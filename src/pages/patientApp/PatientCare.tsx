import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listVisitsByPatient } from '../../firebase/visits';
import { listSwitchHistoryByPatient } from '../../firebase/switchHistory';
import { listPrescriptionsByPatient } from '../../firebase/prescriptions';
import { daysRemaining, isPrescriptionActive } from '../../domain/prescriptions';
import { formatDateBR, todayIso as getTodayIso } from '../../lib/dates';
import {
  notificationPermission,
  requestReminderPermission,
  schedulePrescriptionReminders,
  shouldAskPermissionAutomatically,
} from '../../mobile/prescriptionReminders';
import type { CareInstruction, Prescription } from '../../types';

type ReminderStatus = 'granted' | 'denied' | 'default' | 'unsupported';

function remainingLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return 'Último dia';
  if (days === 1) return 'Falta 1 dia';
  return `Faltam ${days} dias`;
}

export function PatientCarePage() {
  const { patientAccount } = useAuth();
  const [instructions, setInstructions] = useState<CareInstruction[]>([]);
  const [visitDate, setVisitDate] = useState<number | null>(null);
  const [recentlySwitched, setRecentlySwitched] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [reminderStatus, setReminderStatus] = useState<ReminderStatus>(notificationPermission());
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientAccount) return;
    Promise.all([
      listVisitsByPatient(patientAccount.patientId, patientAccount.professionalId),
      listSwitchHistoryByPatient(patientAccount.patientId),
      patientAccount.professionalId
        ? listPrescriptionsByPatient(patientAccount.patientId, patientAccount.professionalId)
        : Promise.resolve([]),
    ]).then(async ([visits, switches, allPrescriptions]) => {
      const latest = visits[0];
      const todayIso = getTodayIso();
      const active = allPrescriptions.filter((p) => isPrescriptionActive(p, todayIso));
      setInstructions(latest?.careInstructions ?? []);
      setVisitDate(latest?.date ?? null);
      setRecentlySwitched(switches.length > 0);
      setPrescriptions(active);
      setLoading(false);

      // Primeira vez com prescrição ativa: pede permissão de notificação. Depois
      // disso, só pelo botão "Ativar lembretes" (não insiste a cada visita à aba).
      if (active.length > 0 && shouldAskPermissionAutomatically()) {
        setReminderStatus((await requestReminderPermission()) ? 'granted' : notificationPermission());
      }
      // Agenda (ou limpa, se não houver mais nenhuma ativa) os lembretes deste dispositivo.
      await schedulePrescriptionReminders(active);
    });
  }, [patientAccount]);

  async function handleEnableReminders() {
    const granted = await requestReminderPermission();
    setReminderStatus(granted ? 'granted' : notificationPermission());
    if (granted) await schedulePrescriptionReminders(prescriptions);
  }

  function toggle(id: string) {
    setDone((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) return <p>Carregando…</p>;

  const todayIso = getTodayIso();

  return (
    <div>
      <h1 style={{ fontSize: 20 }}>Cuidados de hoje</h1>

      {prescriptions.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Prescrito pelo seu podólogo</h2>
          {prescriptions.map((prescription) => {
            const remaining = remainingLabel(daysRemaining(prescription, todayIso));
            return (
              <div key={prescription.id} className="care-card" style={{ borderLeftColor: '#f59e0b', background: '#fffbeb' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden="true">🔔</span>
                  <div style={{ flex: 1 }}>
                    <strong>{prescription.description}</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {prescription.times.map((time) => (
                        <span key={time} className="care-freq-pill">{time}</span>
                      ))}
                    </div>
                    {remaining && (
                      <p className="care-description" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
                        {remaining}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {reminderStatus === 'granted' && (
            <p className="hint" style={{ marginTop: 4 }}>🔔 Lembretes ativados neste dispositivo.</p>
          )}
          {reminderStatus === 'default' && (
            <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 4 }} onClick={handleEnableReminders}>
              Ativar lembretes
            </button>
          )}
          {reminderStatus === 'denied' && (
            <p className="hint" style={{ marginTop: 4 }}>
              As notificações estão bloqueadas. Para receber lembretes, libere as notificações do PodoPrev nas configurações do navegador.
            </p>
          )}
        </section>
      )}

      {visitDate && (
        <p className="hint" style={{ marginBottom: 16 }}>
          Orientações do atendimento de {formatDateBR(visitDate)}
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
