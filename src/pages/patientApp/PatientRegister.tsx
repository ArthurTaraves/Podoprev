import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPatientInvite } from '../../firebase/patientInvites';
import { formatCpf, isValidCpf } from '../../lib/cpf';
import { formatPhone } from '../../lib/phone';

// Botão com aparência de link, para o "← Voltar" entre as telas de escolha.
export function PatientRegisterPage() {
  const { registerPatient, registerPatientWithoutInvite } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Lê ?mode= da URL para abrir direto no modo certo (via links da tela de login)
  const initialMode: 'choose' | 'invite' | 'self' = (() => {
    const m = searchParams.get('mode');
    if (m === 'invite') return 'invite';
    if (m === 'self') return 'self';
    return 'choose';
  })();

  const [mode, setMode] = useState<'choose' | 'invite' | 'self'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(false);
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function goToMode(next: 'choose' | 'invite' | 'self') {
    setError('');
    setMode(next);
  }

  // Quem chegou pelos links do login (?mode=...) já escolheu lá — voltar para a
  // tela de escolha repetiria a mesma pergunta. Sem ?mode=, volta para a escolha.
  function handleBack() {
    if (initialMode === 'choose') goToMode('choose');
    else navigate('/login');
  }

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

  async function handleSelfSubmit(e: React.FormEvent) {
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
    if (!isValidCpf(cpf)) {
      setError('CPF inválido.');
      return;
    }

    setLoading(true);
    try {
      await registerPatientWithoutInvite(name, email, password, cpf, birthDate, phone);
      navigate('/patient/home');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  }

  if (mode === 'choose') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="logo-circle">🧑‍⚕️</div>
            <h1 style={{ fontSize: 24 }}>Cadastro do paciente</h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-primary btn-block" onClick={() => goToMode('invite')}>
              Tenho código de convite
            </button>
            <button type="button" className="btn btn-outline btn-block" onClick={() => goToMode('self')}>
              Cadastrar sem convite
            </button>
          </div>

          <div className="auth-links">
            <p>
              Já tem conta? <Link to="/login">Entrar</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'invite') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="logo-circle">🧑‍⚕️</div>
            <h1 style={{ fontSize: 24 }}>Cadastro com convite</h1>
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
              <button type="button" className="btn-link" onClick={handleBack}>
                ← Voltar
              </button>
            </p>
            <p>
              Já tem conta? <Link to="/login">Entrar</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo-circle">🧑‍⚕️</div>
          <h1 style={{ fontSize: 24 }}>Cadastro sem convite</h1>
          <p style={{ marginTop: 4 }}>Preencha seus dados para criar sua conta</p>
        </div>

        <form onSubmit={handleSelfSubmit}>
          {error && <div className="error-text">{error}</div>}

          <div className="field">
            <label htmlFor="sname">Nome completo</label>
            <input id="sname" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="scpf">CPF</label>
            <input
              id="scpf"
              type="text"
              required
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="field">
            <label htmlFor="sbirth">Data de nascimento</label>
            <input id="sbirth" type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="sphone">Telefone</label>
            <input
              id="sphone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="field">
            <label htmlFor="semail">E-mail</label>
            <input id="semail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="spassword">Senha</label>
            <input id="spassword" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="sconfirm">Confirmar senha</label>
            <input id="sconfirm" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <div className="auth-links">
          <p>
            <button type="button" className="btn-link" onClick={handleBack}>
              ← Voltar
            </button>
          </p>
          <p>
            Já tem conta? <Link to="/login">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
