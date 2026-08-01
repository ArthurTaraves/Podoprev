import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export interface MobileNavItem {
  to: string;
  label: string;
  icon: string;
}

interface Props {
  title: string;
  navItems: MobileNavItem[];
  onLogout: () => void;
  children: ReactNode;
  banner?: string;
}

// Casca única de app mobile, reaproveitada tanto pelo profissional (AppShell)
// quanto pelo paciente (PatientShell) — todo o PodoPrev roda como um único app
// instalado, com telas mobile de verdade em vez de layout de site desktop.
export function MobileShell({ title, navItems, onLogout, children, banner }: Props) {
  return (
    <div className="mobile-shell">
      <header className="mobile-topbar">
        <span>🦶 {title}</span>
        <button className="mobile-logout" onClick={onLogout}>
          Sair
        </button>
      </header>

      {banner && <div className="demo-banner">{banner}</div>}

      <main className="mobile-content">{children}</main>

      <nav className="mobile-tabbar">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `mobile-tab ${isActive ? 'active' : ''}`}>
            <span className="mobile-tab-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
