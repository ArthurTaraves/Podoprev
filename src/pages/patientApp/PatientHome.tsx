import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../../context/AuthContext';
import { getPatient } from '../../firebase/patients';
import { listVisitsByPatient } from '../../firebase/visits';
import { getProfessionalProfile } from '../../firebase/professionalProfiles';
import { listSwitchHistoryByPatient } from '../../firebase/switchHistory';
import type { Patient, ProfessionalProfile, Visit } from '../../types';
import { RiskBadge } from '../../components/ui/RiskBadge';
import { requestNotificationPermission, scheduleCareReminders } from '../../mobile/notifications';

const FRIENDLY_MESSAGE: Record<Visit['risk']['level'], string> = {
  baixo: 'Seus pés estão bem! Continue com os cuidados de rotina.',
  moderado: 'Atenção redobrada. Siga as orientações do seu podólogo.',
  alto: 'Importante: siga as orientações com cuidado e não perca o retorno agendado.',
};

const EDUCATIONAL_CARDS = [
  {
    title: 'Como cuidar das unhas entre as consultas',
    text: 'Mantenha os pés secos, use calçados respiráveis e evite cortar unhas encravadas em casa.',
    icon: '💅',
  },
  {
    title: 'Cuidados para quem tem diabetes',
    text: 'Inspecione os pés diariamente. Qualquer ferida ou alteração: procure seu podólogo.',
    icon: '🩺',
  },
  {
    title: 'Prevenção de fungos',
    text: 'Troque meias diariamente e seque bem entre os dedos dos pés.',
    icon: '🧦',
  },
];

function daysUntil(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  const target = new Date(y, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function returnUrgency(days: number): { urgencyClass: string; badgeClass: string; text: string } {
  if (days < 0) return { urgencyClass: 'urgency-overdue', badgeClass: 'badge-overdue', text: 'Retorno em atraso' };
  if (days === 0) return { urgencyClass: 'urgency-high', badgeClass: 'badge-high', text: 'Em breve! É hoje' };
  if (days < 7) return { urgencyClass: 'urgency-high', badgeClass: 'badge-high', text: `Em breve! Faltam ${days} dias` };
  if (days <= 30) return { urgencyClass: 'urgency-mid', badgeClass: 'badge-moderate', text: `Faltam ${days} dias — prepare-se!` };
  return { urgencyClass: 'urgency-low', badgeClass: 'badge-low', text: `Faltam ${days} dias` };
}

export function PatientHomePage() {
  const { patientAccount } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [latestVisit, setLatestVisit] = useState<Visit | null>(null);
  const [professionalProfile, setProfessionalProfile] = useState<ProfessionalProfile | null>(null);
  const [recentlySwitched, setRecentlySwitched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'requesting' | 'on' | 'unavailable'>('idle');

  useEffect(() => {
    if (!patientAccount) return;
    Promise.all([
      getPatient(patientAccount.patientId),
      listVisitsByPatient(patientAccount.patientId, patientAccount.professionalId),
      getProfessionalProfile(patientAccount.professionalId),
      listSwitchHistoryByPatient(patientAccount.patientId),
    ]).then(([p, visits, profile, switches]) => {
      setPatient(p);
      setLatestVisit(visits[0] ?? null);
      setProfessionalProfile(profile);
      setRecentlySwitched(switches.length > 0);
      setLoading(false);
    });
  }, [patientAccount]);

  async function handleEnableReminders() {
    if (!Capacitor.isNativePlatform()) {
      setNotificationStatus('unavailable');
      return;
    }
    setNotificationStatus('requesting');
    const granted = await requestNotificationPermission();
    if (granted && latestVisit) {
      await scheduleCareReminders(latestVisit.careInstructions);
      setNotificationStatus('on');
    } else {
      setNotificationStatus('unavailable');
    }
  }

  if (loading) return <p>Carregando…</p>;
  if (!patient) return <p>Não encontramos seus dados. Fale com seu podólogo.</p>;

  const days = latestVisit ? daysUntil(latestVisit.returnDate) : null;
  const urgency = days !== null ? returnUrgency(days) : null;

  return (
    <div>
      <h1 style={{ fontSize: 20 }}>Início</h1>

      {/* Bloco A — Próximo retorno */}
      <div className={`card return-card ${urgency?.urgencyClass ?? ''}`} style={{ padding: 20, marginBottom: 24 }}>
        <strong>🗓️ Próximo retorno</strong>
        {latestVisit ? (
          <>
            <p style={{ marginTop: 8, marginBottom: 8, fontSize: 22, fontWeight: 600, color: '#1565c0' }}>
              {new Date(latestVisit.returnDate + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
            {urgency && <span className={`badge ${urgency.badgeClass}`}>{urgency.text}</span>}
          </>
        ) : (
          <>
            <p style={{ marginTop: 4, marginBottom: 4 }}>Nenhum retorno agendado ainda</p>
            <p className="hint" style={{ margin: 0 }}>
              {recentlySwitched
                ? 'Você trocou de profissional recentemente. Seu histórico completo continua disponível na aba Histórico.'
                : 'Após seu primeiro atendimento, a data de retorno sugerida pelo podólogo aparecerá aqui.'}
            </p>
            {recentlySwitched && (
              <Link to="/patient/history" className="btn btn-outline btn-sm" style={{ marginTop: 8 }}>
                Ver meu histórico
              </Link>
            )}
          </>
        )}
      </div>

      {/* Seu podólogo */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 32 }}>
          {professionalProfile?.profilePhotoUrl ? (
            <img src={professionalProfile.profilePhotoUrl} alt={professionalProfile.displayName} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            '🩺'
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div className="hint" style={{ marginBottom: 2 }}>Seu podólogo</div>
          <strong>{professionalProfile?.displayName || latestVisit?.professionalName || 'Profissional vinculado'}</strong>
          {professionalProfile && (
            <p className="hint" style={{ margin: '2px 0 0' }}>
              {professionalProfile.city}{professionalProfile.neighborhood ? ` · ${professionalProfile.neighborhood}` : ''}
            </p>
          )}
          <Link to="/patient/search" className="btn btn-outline btn-sm" style={{ marginTop: 8 }}>
            Trocar profissional
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Pré-anamnese</strong>
        <p style={{ marginTop: 4, marginBottom: 12, fontSize: 13 }}>
          Antes do seu próximo atendimento, você pode preencher algumas informações para adiantar a consulta. O podólogo revisa tudo antes de usar.
        </p>
        <Link to="/patient/pre-anamnesis" className="btn btn-outline btn-block">
          Preencher pré-anamnese
        </Link>
      </div>

      {latestVisit && (
        <div style={{ marginBottom: 8 }}>
          <strong>Seus cuidados</strong>
        </div>
      )}

      {latestVisit ? (
        <>
          {/* Bloco B — Meu nível de atenção */}
          <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ margin: '4px 0 8px' }}>
              <RiskBadge level={latestVisit.risk.level} />
            </div>
            <p style={{ margin: 0 }}>{FRIENDLY_MESSAGE[latestVisit.risk.level]}</p>
            <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
              Esta classificação é apenas uma ferramenta de apoio. Não substitui avaliação profissional.
            </p>
          </div>

          {/* Bloco C — Orientações do dia */}
          <div className="card" style={{ marginBottom: 16 }}>
            <strong>Orientações do dia</strong>
            {latestVisit.careInstructions.length === 0 ? (
              <p style={{ marginTop: 4 }}>Nenhuma orientação registrada ainda</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {latestVisit.careInstructions.map((instruction) => (
                  <div key={instruction.id} className="care-card" style={{ marginBottom: 0 }}>
                    <div className="care-card-header">
                      <strong style={{ fontSize: 13.5 }}>🧴 {instruction.title}</strong>
                      <span className="care-freq-pill">{instruction.timesPerDay}x ao dia</span>
                    </div>
                    <p className="care-description" style={{ marginTop: 6, marginBottom: 0, fontSize: 13 }}>{instruction.description}</p>
                  </div>
                ))}
              </div>
            )}
            <Link to="/patient/care" className="btn btn-secondary btn-block" style={{ marginTop: 12 }}>
              Ver todos os cuidados
            </Link>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <strong>Lembretes no celular</strong>
            <p style={{ marginTop: 4, fontSize: 13 }}>
              Ative para receber notificações ao longo do dia lembrando dos seus cuidados (ex.: hidratar os pés).
            </p>
            <button className="btn btn-primary btn-block" onClick={handleEnableReminders} disabled={notificationStatus === 'requesting'}>
              {notificationStatus === 'on' ? 'Lembretes ativados ✓' : notificationStatus === 'requesting' ? 'Ativando…' : 'Ativar lembretes'}
            </button>
            {notificationStatus === 'unavailable' && (
              <p className="hint" style={{ marginTop: 8 }}>
                Lembretes automáticos funcionam apenas no aplicativo instalado no celular (não no navegador).
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="card empty-state" style={{ marginBottom: 16 }}>
          {recentlySwitched
            ? 'Ainda não há nenhum atendimento registrado com seu profissional atual. Seu histórico anterior continua disponível na aba Histórico.'
            : 'Ainda não há nenhum atendimento registrado pelo seu podólogo.'}
        </div>
      )}

      {/* Bloco D — Cuidados educativos */}
      <div style={{ marginBottom: 4 }}>
        <strong>Cuidados educativos</strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {EDUCATIONAL_CARDS.map((c) => (
          <div key={c.title} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 22 }}>{c.icon}</span>
            <div>
              <strong style={{ fontSize: 13.5 }}>{c.title}</strong>
              <p className="care-description" style={{ marginTop: 4, marginBottom: 0, fontSize: 13 }}>{c.text}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="disclaimer">
        Esta é uma ferramenta de apoio à triagem podológica. Não substitui diagnóstico ou prescrição médica.
      </p>
    </div>
  );
}
