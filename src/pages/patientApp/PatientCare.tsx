import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Disclaimer } from '../../components/Disclaimer';
import { listVisitsByPatient } from '../../firebase/visits';
import { listSwitchHistoryByPatient } from '../../firebase/switchHistory';
import { listPrescriptionsByPatient } from '../../firebase/prescriptions';
import { daysRemaining, isPrescriptionActive } from '../../domain/prescriptions';
import { formatDateBR, todayIso as getTodayIso } from '../../lib/dates';
import {
  getReminderPermission,
  hasRemindersForThisDevice,
  isNativeApp,
  requestReminderPermission,
  scheduleReminders,
  shouldAskPermissionAutomatically,
  type ReminderPermission,
} from '../../lib/reminders';
import type { CareInstruction, Prescription } from '../../types';

function remainingLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return 'Último dia';
  if (days === 1) return 'Falta 1 dia';
  return `Faltam ${days} dias`;
}

// Único ponto de ativação de lembretes do app (ver src/lib/reminders.ts).
function ReminderCard({ status, native, onEnable }: { status: ReminderPermission; native: boolean; onEnable: () => void }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <strong>🔔 Lembretes</strong>
      {status === 'granted' ? (
        <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13 }}>
          ✓ Lembretes ativados neste dispositivo.{' '}
          {native
            ? 'Você recebe os lembretes dos cuidados prescritos e das orientações do atendimento, mesmo com o app fechado.'
            : 'Os lembretes dos cuidados prescritos chegam enquanto o PodoPrev estiver aberto no navegador. Para receber também os das orientações do atendimento — mesmo com o app fechado — use o app Android.'}
        </p>
      ) : status === 'denied' ? (
        <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13 }}>
          As notificações estão bloqueadas. Para receber lembretes, libere as notificações do PodoPrev nas configurações do{' '}
          {native ? 'celular' : 'navegador'}.
        </p>
      ) : status === 'unsupported' ? (
        <p style={{ marginTop: 6, marginBottom: 0, fontSize: 13 }}>Este navegador não permite notificações.</p>
      ) : (
        <>
          <p style={{ marginTop: 6, marginBottom: 6, fontSize: 13 }}>Um só botão ativa todos os seus lembretes neste dispositivo:</p>
          <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13 }}>
            <li>Cuidados prescritos: no navegador (com o site aberto) e no app Android.</li>
            <li>Orientações do atendimento: só no app Android.</li>
          </ul>
          <button type="button" className="btn btn-primary btn-block" onClick={onEnable}>
            Ativar lembretes
          </button>
        </>
      )}
    </div>
  );
}

export function PatientCarePage() {
  const { patientAccount } = useAuth();
  const [instructions, setInstructions] = useState<CareInstruction[]>([]);
  const [visitDate, setVisitDate] = useState<number | null>(null);
  const [recentlySwitched, setRecentlySwitched] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [reminderStatus, setReminderStatus] = useState<ReminderPermission>('default');
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
      const careInstructions = latest?.careInstructions ?? [];
      setInstructions(careInstructions);
      setVisitDate(latest?.date ?? null);
      setRecentlySwitched(switches.length > 0);
      setPrescriptions(active);
      setLoading(false);

      // Primeira vez com algo a lembrar neste dispositivo: pede permissão. Depois
      // disso, só pelo botão "Ativar lembretes" (não insiste a cada visita à aba).
      let permission = await getReminderPermission();
      if (hasRemindersForThisDevice(active, careInstructions) && shouldAskPermissionAutomatically(permission)) {
        permission = await requestReminderPermission();
      }
      setReminderStatus(permission);
      // Agenda (ou limpa, se não houver mais nada) os lembretes deste dispositivo.
      await scheduleReminders(active, careInstructions);
    });
  }, [patientAccount]);

  async function handleEnableReminders() {
    const permission = await requestReminderPermission();
    setReminderStatus(permission);
    if (permission === 'granted') await scheduleReminders(prescriptions, instructions);
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
        </section>
      )}

      {(prescriptions.length > 0 || instructions.length > 0) && (
        <ReminderCard status={reminderStatus} native={isNativeApp()} onEnable={handleEnableReminders} />
      )}

      {visitDate && (
        <p className="hint" style={{ marginBottom: 16 }}>
          Orientações do atendimento de {formatDateBR(visitDate)}
        </p>
      )}

      {instructions.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">📋</div>
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

      <Disclaimer />
    </div>
  );
}
