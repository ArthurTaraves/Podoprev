import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPatientInvite } from '../../firebase/patientInvites';

export function PatientRegisterPage() {
  const { registerPatient } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function checkInvite() {
    setInviteValid(null);
    if (inviteCode.trim().length < 6) return;
    setCheckingInvite(true);
    try {
      const invite = await getPatientInvite(inviteCode.trim());
      if (!invite) {
        setError('Código de convite não encontrado.');
        setInviteValid(false);
        return;
      }
      if (invite.used) {
        setError('Este código de convite já foi utilizado.');
        setInviteValid(false);
        return;
      }
      setError('');
      setInviteValid(true);
    } finally {
      setCheckingInvite(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (!inviteCode.trim()) {
      setError('Informe o código de convite fornecido pelo seu podólogo.');
      return;
    }

    setLoading(true);
    try {
      await registerPatient(name, email, password, inviteCode.trim());
      navigate('/patient/home');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Não foi possível criar a conta. Verifique o código de convite.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo-circle">🧑‍⚕️</div>
          <h1 style={{ fontSize: 24 }}>Cadastro do paciente</h1>
          <p style={{ marginTop: 4 }}>Use o código fornecido pelo seu podólogo</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-text">{error}</div>}

          <div className="field">
            <label htmlFor="code">Código de convite</label>
            <input
              id="code"
              type="text"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              onBlur={checkInvite}
              placeholder="Ex.: 7F3KQ9"
              style={{ letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase' }}
            />
            {checkingInvite && <span className="hint">Verificando código…</span>}
            {inviteValid && <span className="success-text">Código válido. Prossiga com o cadastro.</span>}
          </div>

          <div className="field">
            <label htmlFor="name">Nome completo</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirmar senha</label>
            <input id="confirm" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <div className="auth-links">
          <p>
            Já tem conta? <Link to="/patient/login">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
