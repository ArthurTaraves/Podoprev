import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch {
      setError('Não foi possível enviar o e-mail. Verifique o endereço informado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo-circle">🔑</div>
          <h1 style={{ fontSize: 24 }}>Recuperar senha</h1>
          <p style={{ marginTop: 4 }}>Enviaremos um link de redefinição para seu e-mail</p>
        </div>

        {sent ? (
          <div className="success-text">
            Link de redefinição enviado. Verifique sua caixa de entrada (e o spam).
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="error-text">{error}</div>}
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar link'}
            </button>
          </form>
        )}

        <div className="auth-links">
          <Link to="/login">Voltar ao login</Link>
        </div>
      </div>
    </div>
  );
}
