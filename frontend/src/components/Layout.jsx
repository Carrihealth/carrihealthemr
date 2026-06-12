import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = {
  doctor: [
    { to: '/dashboard',  label: 'Dashboard' },
    { to: '/patients',   label: 'Patients' },
    { to: '/reports',    label: 'Reports' },
  ],
  nurse: [
    { to: '/patients',   label: 'Patients' },
  ],
  lab: [
    { to: '/patients',   label: 'Patients' },
  ],
  admin: [
    { to: '/dashboard',  label: 'Dashboard' },
    { to: '/patients',   label: 'Patients' },
    { to: '/users',      label: 'Users' },
    { to: '/reports',    label: 'Reports' },
    { to: '/audit',      label: 'Audit Log' },
  ],
  super_admin: [
    { to: '/dashboard',  label: 'Dashboard' },
    { to: '/patients',   label: 'Patients' },
    { to: '/users',      label: 'Users' },
    { to: '/reports',    label: 'Reports' },
    { to: '/audit',      label: 'Audit Log' },
  ],
};

const ROLE_LABELS = {
  doctor:      'Doctor',
  nurse:       'Nurse',
  lab:         'Lab Technician',
  admin:       'Administrator',
  super_admin: 'Super Admin',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const links = NAV[user?.role] ?? [];
  const hospitalName = user?.hospital?.name ?? 'Carri Health EMR';

  return (
    <div className="layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <span className="sidebar__logo">⚕</span>
          <span className="sidebar__hospital">{hospitalName}</span>
        </div>

        <nav className="sidebar__nav">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <p className="sidebar__user-name">{user?.full_name}</p>
            <p className="sidebar__user-role">{ROLE_LABELS[user?.role]}</p>
          </div>
          <button className="btn btn--danger btn--sm" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-wrap">
        <header className="topbar">
          <button
            className="topbar__hamburger"
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <span className="topbar__title">Carri Health EMR</span>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
