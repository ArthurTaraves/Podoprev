import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Disclaimer } from '../../components/Disclaimer';
import { mergeById } from '../../lib/mergeById';
import { getPatient } from '../../firebase/patients';
import { listConsentsByPatient } from '../../firebase/consents';
import { listAllProfessionalIdsForPatient } from '../../firebase/switchHistory';
import { getProfessionalProfile } from '../../firebase/professionalProfiles';
import type { Consent, Patient } from '../../types';
import { calculateAge } from '../../domain/riskScore';
import { formatPhone } from '../../lib/phone';
import { formatDateBR } from '../../lib/dates';
import { assertOnline, useReloadOnReconnect, type LoadStatus } from '../../lib/network';
import { LoadFailedNotice } from '../../components/ui/LoadFailedNotice';

export function PatientProfilePage() {
  const { patientAccount } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [professionalNames, setProfessionalNames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<LoadStatus>('loading');
  const { online, reloadKey, retry } = useReloadOnReconnect();

  useEffect(() => {
    if (!patientAccount) return;
    let cancelled = false;
    (async () => {
      try {
        assertOnline();
        const [p, professionalIds] = await Promise.all([
          getPatient(patientAccount.patientId),
          listAllProfessionalIdsForPatient(patientAccount.patientId, patientAccount.professionalId),
        ]);
        const [consentLists, profileEntries] = await Promise.all([
          Promise.all(professionalIds.map((profId) => listConsentsByPatient(patientAccount.patientId, profId))),
          // profId vazio = paciente cadastrado sem convite, ainda sem profissional (não há perfil a ler).
          Promise.all(professionalIds.map(async (profId) => [profId, profId ? (await getProfessionalProfile(profId))?.displayName ?? null : null] as const)),
        ]);
        if (cancelled) return;
        setPatient(p);
        setConsents(mergeById(consentLists.flat()).sort((a, b) => b.agreedAt - a.agreedAt));
        setProfessionalNames(Object.fromEntries(profileEntries.filter(([, name]) => name != null) as [string, string][]));
        setStatus('ready');
      } catch {
        // Falha numa recarga com dados já na tela mantém os dados.
        if (!cancelled) setStatus((prev) => (prev === 'ready' ? prev : 'failed'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientAccount, reloadKey]);

  if (status === 'loading') return <p>Carregando…</p>;
  if (status === 'failed') {
    return (
      <LoadFailedNotice
        online={online}
        onRetry={() => {
          setStatus('loading');
          retry();
        }}
      />
    );
  }
  if (!patient) return <p>Não encontramos seus dados. Fale com seu podólogo.</p>;

  // Um paciente que já teve mais de um profissional pode ter mais de um termo do
  // mesmo tipo assinado (um por profissional) — nenhum consentimento antigo "some"
  // da tela só porque houve uma troca depois (ver PatientHistory.tsx, mesmo princípio).
  const dataConsents = consents.filter((c) => c.type === 'dados' && c.agreed);
  const imageConsents = consents.filter((c) => c.type === 'imagem' && c.agreed);
  const hasMultipleProfessionals = new Set(consents.map((c) => c.professionalId)).size > 1;

  function consentLabel(label: string, list: Consent[]) {
    if (list.length === 0) return `${label}: Pendente`;
    if (list.length === 1 && !hasMultipleProfessionals) {
      return `${label}: Assinado em ${formatDateBR(list[0].agreedAt)}`;
    }
    return list
      .map((c) => {
        const name = professionalNames[c.professionalId];
        return `${formatDateBR(c.agreedAt)}${name ? ` (com ${name})` : ''}`;
      })
      .join(' · ');
  }

  return (
    <div>
      <h1 style={{ fontSize: 20 }}>Meu perfil</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 10 }}>
          <span className="hint">Nome completo</span>
          <p style={{ margin: 0, fontWeight: 600 }}>{patient.fullName}</p>
        </div>
        <div style={{ marginBottom: 10 }}>
          <span className="hint">Idade</span>
          <p style={{ margin: 0, fontWeight: 600 }}>{calculateAge(patient.birthDate)} anos</p>
        </div>
        <div style={{ marginBottom: 10 }}>
          <span className="hint">E-mail</span>
          <p style={{ margin: 0, fontWeight: 600 }}>{patient.email || '—'}</p>
        </div>
        <div style={{ marginBottom: 10 }}>
          <span className="hint">Telefone</span>
          <p style={{ margin: 0, fontWeight: 600 }}>{patient.phone ? formatPhone(patient.phone) : '—'}</p>
        </div>
        <div>
          <span className="hint">Cidade/Estado</span>
          <p style={{ margin: 0, fontWeight: 600 }}>{patient.city ? `${patient.city}/${patient.state ?? ''}` : '—'}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <strong>Termos LGPD</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <span className={`badge ${dataConsents.length > 0 ? 'badge-low' : 'badge-moderate'}`} style={{ alignSelf: 'flex-start' }}>
            {consentLabel('Termo de dados', dataConsents)}
          </span>
          <span className={`badge ${imageConsents.length > 0 ? 'badge-low' : 'badge-moderate'}`} style={{ alignSelf: 'flex-start' }}>
            {consentLabel('Autorização de imagem', imageConsents)}
          </span>
        </div>
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Esses dados são somente leitura aqui. Fale com seu podólogo caso precise assinar ou atualizar um termo.
        </p>
      </div>

      <Disclaimer />
    </div>
  );
}
