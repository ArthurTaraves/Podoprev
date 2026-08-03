import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getProfessionalValidation, saveProfessionalValidation } from '../../firebase/professionalValidations';
import { SPECIALTY_OPTIONS } from '../../domain/factories';
import type { Specialty } from '../../types';

// Etapa complementar e demonstrativa do cadastro — coleta informações
// profissionais e registra o status "pendente". Não existe fluxo real de
// aprovação nem área de administrador (ver comentário em firestore.rules).
export function ProfessionalValidationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prefillName = (location.state as { fullNamePrefill?: string } | null)?.fullNamePrefill ?? '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [fullName, setFullName] = useState(prefillName);
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [certificateFileName, setCertificateFileName] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');

  useEffect(() => {
    if (!user) return;
    getProfessionalValidation(user.uid).then((existing) => {
      if (existing) {
        setFullName(existing.fullName);
        setDisplayName(existing.displayName);
        setCity(existing.city);
        setState(existing.state);
        setPhone(existing.phone);
        setInstitution(existing.institution);
        setGraduationYear(existing.graduationYear);
        setRegistrationNumber(existing.registrationNumber ?? '');
        setSpecialties(existing.specialties);
        setCertificateFileName(existing.certificateFileName ?? '');
        setCertificateUrl(existing.certificateUrl ?? '');
      }
      setLoading(false);
    });
  }, [user]);

  function toggleSpecialty(specialty: Specialty) {
    setSpecialties((prev) => (prev.includes(specialty) ? prev.filter((s) => s !== specialty) : [...prev, specialty]));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Sem Storage configurado (de propósito, ver CLAUDE.md) — o "upload" fica só
    // local nesta aba, mesmo padrão já usado para fotos de atendimento.
    setCertificateFileName(file.name);
    setCertificateUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await saveProfessionalValidation(user.uid, {
        fullName,
        displayName,
        city,
        state,
        phone,
        institution,
        graduationYear,
        registrationNumber: registrationNumber || undefined,
        specialties,
        certificateFileName: certificateFileName || undefined,
        certificateUrl: certificateUrl || undefined,
      });
      setSubmitted(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ padding: 24 }}>Carregando…</p>;

  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="logo-circle">🟡</div>
            <h1 style={{ fontSize: 22 }}>Cadastro profissional enviado</h1>
          </div>
          <p style={{ textAlign: 'center', marginBottom: 16 }}>
            Seu cadastro profissional foi registrado e aguarda validação documental.
          </p>
          <p className="hint" style={{ textAlign: 'center', marginBottom: 20 }}>
            Em uma versão futura, os documentos enviados poderão ser analisados por um administrador responsável pela
            validação profissional.
          </p>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/app/dashboard')}>
            Ir para o painel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-brand">
          <div className="logo-circle">🦶</div>
          <h1 style={{ fontSize: 22 }}>Informações Profissionais</h1>
          <p style={{ marginTop: 4 }}>Complete seus dados profissionais — isso ajuda pacientes a te conhecer melhor.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nome completo</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="field">
            <label>Nome profissional exibido</label>
            <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex.: Dra. Ana Podóloga" />
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Cidade</label>
              <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="field">
              <label>Estado</label>
              <input type="text" required value={state} onChange={(e) => setState(e.target.value)} placeholder="Ex.: SP" />
            </div>
          </div>
          <div className="field">
            <label>Telefone profissional</label>
            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>Instituição de formação</label>
            <input type="text" required value={institution} onChange={(e) => setInstitution(e.target.value)} />
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Ano de conclusão</label>
              <input type="text" required value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} placeholder="Ex.: 2018" />
            </div>
            <div className="field">
              <label>Registro profissional (se aplicável)</label>
              <input type="text" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Especialidades</label>
            <div className="form-grid">
              {SPECIALTY_OPTIONS.map((specialty) => (
                <label key={specialty} className="checkbox-row">
                  <input type="checkbox" checked={specialties.includes(specialty)} onChange={() => toggleSpecialty(specialty)} />
                  {specialty}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Certificado ou comprovante de formação</label>
            <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} />
            {certificateFileName && <p className="hint" style={{ marginTop: 6 }}>Arquivo selecionado: {certificateFileName}</p>}
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={saving} style={{ marginTop: 8 }}>
            {saving ? 'Enviando…' : 'Enviar informações profissionais'}
          </button>
        </form>

        <div className="auth-links">
          <p>
            <button
              type="button"
              onClick={() => navigate('/app/dashboard')}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
            >
              Preencher depois
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
