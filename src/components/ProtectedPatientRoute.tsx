import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PatientShell } from './layout/PatientShell';

export function ProtectedPatientRoute({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();

  if (loading) return <p style={{ padding: 24 }}>Carregando…</p>;
  if (!user || role !== 'patient') return <Navigate to="/patient/login" replace />;

  return <PatientShell>{children}</PatientShell>;
}
