import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isFirebaseConfigured } from '../../firebase/config';
import { MobileShell, type MobileNavItem } from './MobileShell';

const NAV_ITEMS: MobileNavItem[] = [
  { to: '/app/dashboard', label: 'Painel', icon: '🏠' },
  { to: '/app/patients', label: 'Pacientes', icon: '🧑‍🤝‍🧑' },
  { to: '/app/availability', label: 'Agenda', icon: '🗓️' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { professional, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <MobileShell
      title={`Olá, ${professional?.name?.split(' ')[0] ?? 'profissional'}`}
      navItems={NAV_ITEMS}
      onLogout={handleLogout}
      banner={!isFirebaseConfigured ? 'Modo demonstração — dados fictícios, nada é salvo de verdade.' : undefined}
    >
      {children}
    </MobileShell>
  );
}
