import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppShell } from './layout/AppShell';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();

  if (loading) return <p style={{ padding: 24 }}>Carregando…</p>;
  if (!user || role !== 'professional') return <Navigate to="/login" replace />;

  return <AppShell>{children}</AppShell>;
}
