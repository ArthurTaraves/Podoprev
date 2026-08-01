import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAvailability } from '../../firebase/availability';
import { cancelAppointment, confirmAppointment, listOccupiedSlots, reserveSlot } from '../../firebase/appointments';
import { buildCalendarDays, generateDaySlots, removeBlockedSlots, weekdayFromDate } from '../../domain/availability';
import type { Appointment, Availability } from '../../types';

interface Props {
  onClose: () => void;
  onBooked: () => void;
}

type Step = 'data' | 'horario' | 'confirmacao';

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function AppointmentBooking({ onClose, onBooked }: Props) {
  const { patientAccount, professional } = useAuth();
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('data');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [freeSlots, setFreeSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [reservation, setReservation] = useState<Appointment | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!patientAccount) return;
    getAvailability(patientAccount.professionalId).then((a) => {
      setAvailability(a);
      setLoading(false);
    });
  }, [patientAccount]);

  const calendarDays = useMemo(() => (availability ? buildCalendarDays(availability) : []), [availability]);

  async function selectDate(iso: string) {
    if (!patientAccount || !availability) return;
    setError('');
    setSelectedDate(iso);
    setStep('horario');
    setLoadingSlots(true);
    const weekday = weekdayFromDate(iso);
    const occupied = await listOccupiedSlots(patientAccount.professionalId, iso);
    const now = Date.now();
    const occupiedStartTimes = occupied
      .filter((slot) => slot.status === 'confirmado' || (slot.status === 'reservado_temporario' && slot.expiresAt > now))
      .map((slot) => slot.startTime);
    const rawSlots = generateDaySlots(availability.schedule[weekday], availability.slotDurationMinutes, occupiedStartTimes);
    setFreeSlots(removeBlockedSlots(rawSlots, iso, availability.blocks, availability.slotDurationMinutes));
    setLoadingSlots(false);
  }

  async function selectTime(time: string) {
    if (!patientAccount || !selectedDate || !availability) return;
    setBusy(true);
    setError('');
    try {
      const appointment = await reserveSlot({
        patientId: patientAccount.patientId,
        professionalId: patientAccount.professionalId,
        date: selectedDate,
        startTime: time,
        slotDurationMinutes: availability.slotDurationMinutes,
      });
      setReservation(appointment);
      setStep('confirmacao');
    } catch {
      setError('Esse horário acabou de ser reservado por outro paciente. Escolha outro horário.');
      await selectDate(selectedDate);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!reservation || reservation.status !== 'reservado_temporario') return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((reservation.expiresAt - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [reservation]);

  async function handleConfirm() {
    if (!reservation) return;
    setBusy(true);
    setError('');
    try {
      await confirmAppointment(reservation.id);
      onBooked();
    } catch {
      setError('O tempo da reserva expirou. Escolha outro horário.');
      setReservation(null);
      setStep('data');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!reservation) return;
    setBusy(true);
    try {
      await cancelAppointment(reservation.id);
    } finally {
      setBusy(false);
      onClose();
    }
  }

  if (loading) return <p>Carregando…</p>;

  if (!availability) {
    return (
      <div className="card empty-state">
        O profissional ainda não configurou horários de atendimento.
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      {step === 'data' && (
        <div>
          <h4>Escolha a data</h4>
          <p className="hint" style={{ marginBottom: 12 }}>
            Dias sem atendimento aparecem desabilitados.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {calendarDays.map((d) => (
              <button
                key={d.date}
                type="button"
                className={`btn btn-sm ${d.available ? 'btn-outline' : ''}`}
                disabled={!d.available}
                style={!d.available ? { color: 'var(--color-text-muted)', background: 'var(--color-bg)', cursor: 'not-allowed' } : undefined}
                onClick={() => d.available && selectDate(d.date)}
              >
                {new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-outline" style={{ marginTop: 16 }} onClick={onClose}>
            Cancelar
          </button>
        </div>
      )}

      {step === 'horario' && selectedDate && (
        <div>
          <h4>Escolha o horário</h4>
          <p className="hint" style={{ marginBottom: 12 }}>
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}
          </p>
          {loadingSlots ? (
            <p>Carregando horários…</p>
          ) : freeSlots.length === 0 ? (
            <div className="empty-state">Nenhum horário disponível neste dia.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {freeSlots.map((time) => (
                <button key={time} type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => selectTime(time)}>
                  {time}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => setStep('data')}>
            Voltar
          </button>
        </div>
      )}

      {step === 'confirmacao' && reservation && (
        <div>
          <h4>Confirmar agendamento</h4>
          <div className="card" style={{ background: 'var(--color-secondary-light)', border: 'none', marginBottom: 16 }}>
            <p style={{ margin: 0 }}>
              <strong>Profissional:</strong> {professional?.name ?? 'Podólogo(a)'}
            </p>
            <p style={{ margin: '6px 0' }}>
              <strong>Data:</strong> {new Date(reservation.date + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Horário:</strong> {reservation.startTime} às {reservation.endTime}
            </p>
          </div>

          {reservation.status === 'reservado_temporario' && (
            <>
              <p style={{ fontWeight: 600 }}>Este horário ficará reservado para você por 10 minutos.</p>
              <p className="hint" style={{ marginBottom: 16 }}>
                Tempo restante: {secondsLeft > 0 ? formatCountdown(secondsLeft) : 'expirado'}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-primary" disabled={busy || secondsLeft <= 0} onClick={handleConfirm}>
                  {busy ? 'Confirmando…' : 'Confirmar agendamento'}
                </button>
                <button type="button" className="btn btn-outline" disabled={busy} onClick={handleCancel}>
                  Cancelar reserva
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
