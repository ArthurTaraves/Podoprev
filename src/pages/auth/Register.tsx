import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function RegisterPage() {
  const { registerProfessional } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

    setLoading(true);
    try {
      await registerProfessional(name, email, password, registrationNumber || undefined);
      // Etapa complementar (demonstrativa) antes do painel — não faz parte da
      // autenticação em si, só do que acontece depois dela (ver ProfessionalValidation.tsx).
      navigate('/app/professional-info', { state: { fullNamePrefill: name } });
    } catch (err) {
      console.error(err);
      setError('Não foi possível criar a conta. Verifique o e-mail informado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo-circle">🦶</div>
          <h1 style={{ fontSize: 24 }}>Cadastro profissional</h1>
          <p style={{ marginTop: 4 }}>Crie sua conta para começar a usar o PodoPrev</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-text">{error}</div>}
          <div className="field">
            <label htmlFor="name">Nome completo</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="reg">Registro profissional (opcional)</label>
            <input id="reg" type="text" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
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
            Já tem conta? <Link to="/login">Entrar</Link>
          </p>
          <p style={{ marginTop: 6 }}>
            É paciente e recebeu um código de convite? <Link to="/patient/register">Cadastre-se aqui</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
