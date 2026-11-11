import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export interface MobileNavItem {
  to: string;
  label: string;
  icon: string;
  badge?: number; // contador (ex.: notificações não lidas); 0/ausente = sem bolinha
}

interface Props {
  title: string;
  navItems: MobileNavItem[];
  onLogout: () => void;
  children: ReactNode;
  banner?: string;
  /** Texto do aviso de "sem conexão" (só o app do paciente usa). */
  offlineBanner?: string;
}

// Casca única de app mobile, reaproveitada tanto pelo profissional (AppShell)
// quanto pelo paciente (PatientShell) — todo o PodoPrev roda como um único app
// instalado, com telas mobile de verdade em vez de layout de site desktop.
export function MobileShell({ title, navItems, onLogout, children, banner, offlineBanner }: Props) {
  return (
    <div className="mobile-shell">
      <header className="mobile-topbar">
        <span>🦶 {title}</span>
        <button className="mobile-logout" onClick={onLogout}>
          Sair
        </button>
      </header>

      {banner && <div className="demo-banner">{banner}</div>}
      {offlineBanner && (
        <div className="offline-banner" role="status">
          {offlineBanner}
        </div>
      )}

      <main className="mobile-content">{children}</main>

      <nav className="mobile-tabbar">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `mobile-tab ${isActive ? 'active' : ''}`}>
            <span className="mobile-tab-icon">
              {item.icon}
              {!!item.badge && (
                <span className="mobile-tab-badge" aria-label={`${item.badge} não lida(s)`}>
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
