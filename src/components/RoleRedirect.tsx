import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RoleRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) return <p style={{ padding: 24 }}>Carregando…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'professional') return <Navigate to="/app/dashboard" replace />;
  if (role === 'patient') return <Navigate to="/patient/home" replace />;
  return <Navigate to="/login" replace />;
}
