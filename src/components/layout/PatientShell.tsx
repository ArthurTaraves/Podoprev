import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listUnreadNotifications, NOTIFICATIONS_CHANGED_EVENT } from '../../firebase/notifications';
import { showNotificationsOnce } from '../../lib/reminders';
import { isOffline, useOnlineStatus } from '../../lib/network';
import { MobileShell, type MobileNavItem } from './MobileShell';

const NAV_ITEMS: MobileNavItem[] = [
  { to: '/patient/home', label: 'Início', icon: '🏠' },
  { to: '/patient/search', label: 'Buscar', icon: '🔎' },
  { to: '/patient/care', label: 'Cuidados', icon: '🧴' },
  { to: '/patient/history', label: 'Histórico', icon: '📋' },
  { to: '/patient/profile', label: 'Perfil', icon: '👤' },
];

// Modo offline: as páginas são carregadas sob demanda (React.lazy). Se a conexão
// cair antes de o paciente abrir uma aba pela primeira vez, o chunk dela não
// conseguiria ser baixado e o app inteiro quebraria em tela branca (não há
// ErrorBoundary). Baixar todas as abas assim que o app do paciente abre evita
// isso — são os mesmos chunks que App.tsx usa, o Vite reaproveita o módulo.
function prefetchPatientPages() {
  const loaders = [
    () => import('../../pages/patientApp/PatientHome'),
    () => import('../../pages/patientApp/PatientCare'),
    () => import('../../pages/patientApp/PatientHistory'),
    () => import('../../pages/patientApp/PatientProfile'),
    () => import('../../pages/patientApp/PatientSearch'),
    () => import('../../pages/patientApp/PatientPreAnamnesis'),
  ];
  for (const load of loaders) load().catch(() => undefined);
}

export function PatientShell({ children }: { children: ReactNode }) {
  const { patientAccount, logout } = useAuth();
  const { online, reconnectCount } = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (online) prefetchPatientPages();
  }, [online]);

  // Recontagem ao trocar de tela e quando a aba Cuidados avisa que marcou como lidas.
  useEffect(() => {
    if (!patientAccount) return;
    const patientId = patientAccount.patientId;
    let cancelled = false;
    async function refresh() {
      if (isOffline()) return; // mantém o último contador até a conexão voltar
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
  }, [patientAccount, location.pathname, reconnectCount]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const navItems = NAV_ITEMS.map((item) => (item.to === '/patient/care' ? { ...item, badge: unread } : item));

  return (
    <MobileShell
      title={`Olá, ${patientAccount?.name.split(' ')[0] ?? 'paciente'}`}
      navItems={navItems}
      onLogout={handleLogout}
      offlineBanner={online ? undefined : 'Você está offline — exibindo dados salvos'}
    >
      {children}
    </MobileShell>
  );
}
