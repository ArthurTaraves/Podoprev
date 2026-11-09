import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listUnreadNotifications, NOTIFICATIONS_CHANGED_EVENT } from '../../firebase/notifications';
import { showNotificationsOnce } from '../../lib/reminders';
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
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  // Recontagem ao trocar de tela e quando a aba Cuidados avisa que marcou como lidas.
  useEffect(() => {
    if (!patientAccount) return;
    const patientId = patientAccount.patientId;
    let cancelled = false;
    async function refresh() {
      try {
        const items = await listUnreadNotifications(patientId);
        if (cancelled) return;
        setUnread(items.length);
        void showNotificationsOnce(items);
      } catch {
        // contador é só indicativo — falha de leitura não deve quebrar a navegação
      }
    }
    void refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [patientAccount, location.pathname]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const navItems = NAV_ITEMS.map((item) => (item.to === '/patient/care' ? { ...item, badge: unread } : item));

  return (
    <MobileShell title={`Olá, ${patientAccount?.name.split(' ')[0] ?? 'paciente'}`} navItems={navItems} onLogout={handleLogout}>
      {children}
    </MobileShell>
  );
}
