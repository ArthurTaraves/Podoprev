import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isFirebaseConfigured } from '../../firebase/config';
import { auth } from '../../firebase/config';
import { getProfessional } from '../../firebase/professionals';
import { getPatientAccount } from '../../firebase/patientAccounts';

type Profile = 'professional' | 'patient';

export function LoginPage() {
  const { login, logout, loginDemo, loginDemoPatient } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = profile !== null && email.trim() !== '' && password !== '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!profile) return;
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

        {!isFirebaseConfigured && profile && (
          <>
            <div className="info-banner">
              Firebase ainda não foi configurado neste ambiente (falta <code>.env.local</code>). Use o modo
              demonstração abaixo para ver a interface com dados de exemplo.
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
          <p style={{ marginTop: 10 }}>
            Não tem conta? <Link to="/register">Cadastre-se como profissional</Link>
          </p>
          <p style={{ marginTop: 6 }}>
            Paciente sem conta? <Link to="/patient/register">Entre com o código de convite do seu podólogo</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
