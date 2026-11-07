import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isFirebaseConfigured } from '../../firebase/config';
import { auth } from '../../firebase/config';
import { getProfessional } from '../../firebase/professionals';
import { getPatientAccount } from '../../firebase/patientAccounts';

type Profile = 'professional' | 'patient';

export function LoginPage() {
  const { login, logout, loginDemo, loginDemoPatient } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ?perfil=podologo|paciente pré-seleciona o perfil (link direto para a demonstração).
  const initialProfile = searchParams.get('perfil');
  const [profile, setProfile] = useState<Profile | null>(
    initialProfile === 'podologo' ? 'professional' : initialProfile === 'paciente' ? 'patient' : null,
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = profile !== null && email.trim() !== '' && password !== '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!profile) return;
    // Sem Firebase não existe conta real — sem isso a chamada iria ao Google com
    // uma chave falsa e voltaria como "E-mail ou senha inválidos", o que engana.
    if (!isFirebaseConfigured) {
      setError('No modo demonstração não há contas reais. Use o botão de demonstração acima.');
      return;
    }
    setLoading(true);
    try {
      // A seleção de perfil não muda a lógica de autenticação — o Firebase Auth
      // continua o mesmo. Ela só serve para checar, logo em seguida, se a conta
      // que entrou de fato corresponde ao perfil escolhido, usando as mesmas
      // funções já existentes (getProfessional/getPatientAccount) em vez de
      // depender do estado assíncrono do contexto, que ainda não teria resolvido
      // o papel neste instante.
      await login(email, password);
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('login-failed');

      if (profile === 'professional') {
        const professionalProfile = await getProfessional(uid);
        if (!professionalProfile) {
          await logout();
          setError('Esta conta é de paciente. Selecione "Sou Paciente" para entrar.');
          return;
        }
      } else {
        const patientProfile = await getPatientAccount(uid);
        if (!patientProfile) {
          await logout();
          setError('Esta conta é de profissional. Selecione "Sou Podólogo" para entrar.');
          return;
        }
      }
      navigate('/');
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }

  function handleDemoLogin() {
    if (profile === 'patient') loginDemoPatient();
    else loginDemo();
    navigate('/');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo-circle">🦶</div>
          <h1 style={{ fontSize: 24 }}>Bem-vindo ao PodoPrev</h1>
          <p style={{ marginTop: 4 }}>Triagem e prevenção podológica</p>
        </div>

        <div className="field">
          <label>Como você vai entrar?</label>
          <div className="profile-select">
            <button
              type="button"
              className={`profile-btn profile-btn-professional ${profile === 'professional' ? 'selected' : ''}`}
              onClick={() => setProfile('professional')}
            >
              <span className="profile-btn-icon">🩺</span>
              <strong>Sou Podólogo</strong>
              <span className="profile-btn-sub">Acesso profissional</span>
            </button>
            <button
              type="button"
              className={`profile-btn profile-btn-patient ${profile === 'patient' ? 'selected' : ''}`}
              onClick={() => setProfile('patient')}
            >
              <span className="profile-btn-icon">🧑</span>
              <strong>Sou Paciente</strong>
              <span className="profile-btn-sub">Acompanhe seu tratamento</span>
            </button>
          </div>
        </div>

        {!isFirebaseConfigured && !profile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => {
                loginDemo();
                navigate('/');
              }}
            >
              Entrar como podólogo (demonstração)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => {
                loginDemoPatient();
                navigate('/');
              }}
            >
              Entrar como paciente (demonstração)
            </button>
          </div>
        )}

        {!isFirebaseConfigured && profile && (
          <>
            <div className="info-banner">
              {/* .info-banner é flex: sem este <p> o texto e o <code> virariam colunas separadas. */}
              <p style={{ margin: 0, lineHeight: 1.5 }}>
                Firebase ainda não foi configurado neste ambiente (falta <code>.env.local</code>). Use o modo
                demonstração abaixo para ver a interface com dados de exemplo.
              </p>
            </div>
            <button type="button" className="btn btn-secondary btn-block" style={{ marginBottom: 20 }} onClick={handleDemoLogin}>
              {profile === 'patient' ? 'Ver como paciente (demonstração)' : 'Entrar em modo demonstração'}
            </button>
          </>
        )}

        <form onSubmit={handleSubmit}>
          {error && <div className="error-text">{error}</div>}
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={!canSubmit || loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password">Esqueci minha senha</Link>
        </div>

        {profile === 'professional' && (
          <div style={{ marginTop: 16 }}>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
              Ainda não tem conta?
            </p>
            <Link to="/register" className="btn btn-outline btn-block" style={{ textDecoration: 'none' }}>
              Cadastrar como profissional
            </Link>
          </div>
        )}

        {profile === 'patient' && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 0 }}>
              Ainda não tem conta?
            </p>
            <Link to="/patient/register?mode=invite" className="btn btn-outline btn-block" style={{ textDecoration: 'none' }}>
              Tenho código de convite
            </Link>
            <Link to="/patient/register?mode=self" className="btn btn-outline btn-block" style={{ textDecoration: 'none' }}>
              Cadastrar sem convite
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
