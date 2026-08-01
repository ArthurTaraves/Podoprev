import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MobileShell, type MobileNavItem } from './MobileShell';

const NAV_ITEMS: MobileNavItem[] = [
  { to: '/patient/home', label: 'Início', icon: '🏠' },
  { to: '/patient/search', label: 'Buscar', icon: '🔎' },
  { to: '/patient/care', label: 'Cuidados', icon: '🧴' },
  { to: '/patient/history', label: 'Histórico', icon: '📋' },
  { to: '/patient/profile', label: 'Perfil', icon: '👤' },
];

export function PatientShell({ children }: { children: ReactNode }) {
  const { patientAccount, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/patient/login');
  }

  return (
    <MobileShell title={`Olá, ${patientAccount?.name.split(' ')[0] ?? 'paciente'}`} navItems={NAV_ITEMS} onLogout={handleLogout}>
      {children}
    </MobileShell>
  );
}
