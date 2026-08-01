import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPatient } from '../../firebase/patients';
import { createConsent, listConsentsByPatient } from '../../firebase/consents';
import type { Consent, ConsentType, Patient } from '../../types';
import { SignaturePad } from '../../components/ui/SignaturePad';

const DATA_TERM_TEXT =
  'Declaro que fui informado(a) de que meus dados pessoais e informações de saúde serão utilizados ' +
  'exclusivamente para fins de cadastro, acompanhamento podológico e registro da evolução do atendimento. ' +
  'Autorizo o armazenamento dessas informações no sistema, respeitando os princípios da Lei Geral de Proteção ' +
  'de Dados Pessoais — LGPD.';

const IMAGE_TERM_TEXT =
  'Autorizo o registro e armazenamento de imagens dos meus pés exclusivamente para acompanhamento da evolução podológica.';

export function ConsentPage() {
  const { user, professional } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    Promise.all([getPatient(id), listConsentsByPatient(id, user.uid)]).then(([p, c]) => {
      setPatient(p);
      setConsents(c);
      setLoading(false);
    });
  }, [id, user]);

  async function refresh() {
    if (!id || !user) return;
    setConsents(await listConsentsByPatient(id, user.uid));
  }

  if (loading) return <p>Carregando…</p>;
  if (!patient || !id || !user) return <p>Paciente não encontrado.</p>;

  const dataConsent = consents.find((c) => c.type === 'dados' && c.agreed);
  const imageConsent = consents.find((c) => c.type === 'imagem' && c.agreed);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Termo de consentimento — LGPD</h1>
          <p>Paciente: {patient.fullName}</p>
        </div>
        <button className="btn btn-outline" onClick={() => navigate(`/app/patients/${id}`)}>
          Voltar ao prontuário
        </button>
      </div>

      <div className="info-banner">
        Registre aqui a autorização do paciente para uso de seus dados e, separadamente, para uso de imagens.
        Sem o termo de imagem assinado, não é possível anexar fotos ao prontuário.
      </div>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <ConsentCard
          type="dados"
          title="Autorização de dados pessoais e de saúde"
          text={DATA_TERM_TEXT}
          patient={patient}
          professionalId={user.uid}
          existing={dataConsent}
          onSaved={refresh}
        />
        <ConsentCard
          type="imagem"
          title="Autorização de uso de imagem"
          text={IMAGE_TERM_TEXT}
          patient={patient}
          professionalId={user.uid}
          existing={imageConsent}
          onSaved={refresh}
        />
      </div>
      <p className="disclaimer" style={{ marginTop: 20 }}>
        Assinado por: {professional?.name}
      </p>
    </div>
  );
}

function ConsentCard({
  type,
  title,
  text,
  patient,
  professionalId,
  existing,
  onSaved,
}: {
  type: ConsentType;
  title: string;
  text: string;
  patient: Patient;
  professionalId: string;
  existing?: Consent;
  onSaved: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!agreed) return;
    setSaving(true);
    try {
      await createConsent({
        patientId: patient.id,
        professionalId,
        type,
        patientNameSnapshot: patient.fullName,
        cpfSnapshot: patient.cpf,
        agreed: true,
        signatureDataUrl: signature ?? undefined,
        agreedAt: Date.now(),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3>{title}</h3>
      <p style={{ fontSize: 14 }}>{text}</p>

      {existing ? (
        <div className="info-banner">
          Termo assinado em {new Date(existing.agreedAt).toLocaleDateString('pt-BR')}. Um novo consentimento pode ser
          registrado a qualquer momento caso necessário.
        </div>
      ) : null}

      <div className="field">
        <label>Nome do paciente</label>
        <input type="text" value={patient.fullName} disabled />
      </div>
      <div className="field">
        <label>CPF</label>
        <input type="text" value={patient.cpf} disabled />
      </div>
      <div className="field">
        <label>Data</label>
        <input type="text" value={new Date().toLocaleDateString('pt-BR')} disabled />
      </div>

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
        Li e concordo com o termo.
      </label>

      <SignaturePad onChange={setSignature} />

      <button className="btn btn-secondary btn-block" style={{ marginTop: 12 }} disabled={!agreed || saving} onClick={handleSave}>
        {saving ? 'Salvando…' : 'Salvar consentimento'}
      </button>
    </div>
  );
}
